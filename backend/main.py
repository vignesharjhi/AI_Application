"""FastAPI RAG Document Intelligence Server (ported from server.ts)."""

import base64
import inspect
import io
import math
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pypdf import PdfReader

from models import CATEGORIES, ChatRequest, SearchRequest, UploadRequest
from pdf_chunker import chunk_text_content
from sample_docs import populate_sample_docs_if_empty
from tools import TOOL_DECLARATIONS, TOOL_DISPATCH, summarize_tool_result
from vector_store import get_embedding, global_vector_db

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env.local")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    populate_sample_docs_if_empty()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/categories")
async def get_categories():
    try:
        stored = global_vector_db.get_categories()
        merged = sorted(set(CATEGORIES) | set(stored))
        return {"success": True, "categories": merged}
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


@app.get("/api/documents")
async def get_documents():
    try:
        docs = global_vector_db.get_documents()
        return {"success": True, "documents": docs}
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


@app.post("/api/documents/upload")
async def upload_document(payload: UploadRequest):
    try:
        if not payload.fileName:
            return JSONResponse(status_code=400, content={"success": False, "error": "Missing fileName in payload"})

        extracted_text = ""
        page_count = 1
        pages_structured: list[dict] = []

        if payload.rawText:
            extracted_text = payload.rawText
        elif payload.fileBase64:
            buffer = base64.b64decode(payload.fileBase64)

            is_pdf = payload.fileType == "application/pdf" or payload.fileName.lower().endswith(".pdf")
            if is_pdf:
                try:
                    reader = PdfReader(io.BytesIO(buffer))
                    page_texts = [page.extract_text() or "" for page in reader.pages]
                    extracted_text = "\n\n".join(page_texts)
                    page_count = len(reader.pages) or 1

                    if len(page_texts) > 1:
                        pages_structured = [
                            {"pageNumber": idx + 1, "text": text} for idx, text in enumerate(page_texts)
                        ]
                except Exception as pdf_err:
                    return JSONResponse(
                        status_code=400,
                        content={"success": False, "error": f"Failed to parse PDF file: {pdf_err}"},
                    )
            else:
                extracted_text = buffer.decode("utf-8")
        else:
            return JSONResponse(
                status_code=400, content={"success": False, "error": "No document file content or text provided"}
            )

        if not extracted_text.strip():
            return JSONResponse(
                status_code=400, content={"success": False, "error": "Extracted text is empty or unreadable"}
            )

        import random
        import time

        doc_id = f"doc_{int(time.time() * 1000)}_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=5))}"

        raw_chunks = chunk_text_content(
            extracted_text, payload.chunkSize, payload.chunkOverlap, pages_structured or None
        )

        doc_chunks: list[dict] = []
        for rc in raw_chunks:
            embedding = await get_embedding(rc.text)
            doc_chunks.append(
                {
                    "id": f"chunk_{doc_id}_{rc.chunkIndex}",
                    "docId": doc_id,
                    "docName": payload.fileName,
                    "chunkIndex": rc.chunkIndex,
                    "text": rc.text,
                    "pageNumber": rc.pageNumber,
                    "charLength": rc.charLength,
                    "tokenEstimate": rc.tokenEstimate,
                    "embedding": embedding,
                }
            )

        total_tokens_estimate = sum(c["tokenEstimate"] for c in doc_chunks)

        doc_meta = {
            "id": doc_id,
            "name": payload.fileName,
            "category": payload.category or "General",
            "sizeBytes": math.ceil((len(payload.fileBase64) * 3) / 4) if payload.fileBase64 else len(extracted_text),
            "uploadDate": datetime.now(timezone.utc).isoformat(),
            "pageCount": page_count,
            "chunkCount": len(doc_chunks),
            "totalTokensEstimate": total_tokens_estimate,
            "vectorDimensions": len(doc_chunks[0]["embedding"]) if doc_chunks else 768,
            "status": "ready",
        }

        global_vector_db.add_document(doc_meta, doc_chunks)

        return {"success": True, "document": doc_meta, "chunksSample": doc_chunks[:5]}
    except Exception as err:
        return JSONResponse(
            status_code=500, content={"success": False, "error": str(err) or "Failed to ingest document"}
        )


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        success = global_vector_db.delete_document(doc_id)
        if success:
            return {"success": True, "message": "Document deleted successfully"}
        return JSONResponse(status_code=404, content={"success": False, "error": "Document not found"})
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


@app.post("/api/vector/search")
async def vector_search(payload: SearchRequest):
    try:
        if not payload.query:
            return JSONResponse(status_code=400, content={"success": False, "error": "Query string is required"})

        query_vector = await get_embedding(payload.query)
        results = await global_vector_db.search(
            query_vector,
            payload.topK,
            payload.similarityThreshold,
            payload.selectedDocIds,
            payload.selectedCategories,
        )

        return {"success": True, "query": payload.query, "resultCount": len(results), "results": results}
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    try:
        user_prompt = payload.query or (payload.messages[-1].content if payload.messages else "")

        if not user_prompt:
            return JSONResponse(
                status_code=400, content={"success": False, "error": "User query or message is required"}
            )

        retrieved_chunks: list[dict] = []
        context_text = ""

        if payload.enableRAG:
            query_vector = await get_embedding(user_prompt)
            retrieved_chunks = await global_vector_db.search(
                query_vector,
                payload.topK,
                payload.similarityThreshold,
                payload.selectedDocIds,
                payload.selectedCategories,
            )

            if retrieved_chunks:
                context_text = "\n\n".join(
                    f"--- CONTEXT CHUNK #{idx + 1} (Document: {r['chunk']['docName']}, Page {r['chunk']['pageNumber']}, "
                    f"Chunk Index {r['chunk']['chunkIndex']}, Similarity Score: {round(r['similarity'] * 100)}%) ---\n"
                    f"{r['chunk']['text']}"
                    for idx, r in enumerate(retrieved_chunks)
                )

        api_key = os.environ.get("GEMINI_API_KEY")
        bot_answer = ""
        tool_calls_log: list[dict] = []

        tool_policy = (
            "\n\nYou also have access to external tools: web_search, get_weather, convert_currency, "
            "get_current_datetime. Only call a tool when (1) the information needed is NOT already covered "
            "above, and (2) the question is generic/public/general-knowledge in nature (e.g. current events, "
            "weather, currency conversion, date/time) rather than about this company's internal policies or "
            "processes. If the question is about internal company policy/process and the context does not "
            "cover it, state plainly that it was not found in the knowledge base — do NOT call a tool or "
            "guess in that case. Whenever any part of your final answer relies on a tool result, you MUST "
            "explicitly say that portion came from a live web/external source, not the internal knowledge base."
        )

        if api_key:
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(headers={"User-Agent": "aistudio-build"}),
            )

            if payload.enableRAG and context_text:
                system_instruction = (
                    "You are an expert AI Assistant specialized in Retrieval-Augmented Generation (RAG) over user PDF documents.\n"
                    "Answer the user's question accurately using ONLY the provided CONTEXT CHUNKS below.\n"
                    "Rules:\n"
                    "1. Ground your answer strictly in the provided context text.\n"
                    "2. Cite your sources clearly using inline brackets such as [DocumentName.pdf, Page X, Chunk #Y] whenever presenting facts or metrics from the context.\n"
                    "3. If the context does not contain enough information to fully answer the question, clearly state what information is present and mention that additional details were not found in the ingested document index.\n"
                    "4. Keep the tone professional, concise, clear, and well-structured with markdown headings and bullet points where helpful."
                ) + tool_policy
            else:
                system_instruction = (
                    "You are a helpful AI Assistant. Provide a clear, accurate, and structured answer to the user's prompt."
                ) + tool_policy

            prompt_with_context = (
                f"RELEVANT DOCUMENT CONTEXT CHUNKS:\n{context_text}\n\nUSER QUESTION:\n{user_prompt}"
                if payload.enableRAG and context_text
                else user_prompt
            )

            tools = [types.Tool(function_declarations=TOOL_DECLARATIONS)]
            contents: list[types.Content] = [
                types.Content(role="user", parts=[types.Part.from_text(text=prompt_with_context)])
            ]

            for _ in range(3):
                response = await client.aio.models.generate_content(
                    model=payload.model or "gemini-3.6-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                        tools=tools,
                    ),
                )

                function_calls = response.function_calls or []
                if not function_calls:
                    bot_answer = response.text or "No text generated by Gemini model."
                    break

                contents.append(response.candidates[0].content)

                function_response_parts = []
                for call in function_calls:
                    handler = TOOL_DISPATCH.get(call.name)
                    call_args = call.args or {}
                    if handler is None:
                        result = {"error": f"Unknown tool '{call.name}'."}
                    else:
                        try:
                            outcome = handler(**call_args)
                            result = await outcome if inspect.isawaitable(outcome) else outcome
                        except Exception as tool_err:
                            result = {"error": f"Tool '{call.name}' failed: {tool_err}"}

                    tool_calls_log.append(
                        {
                            "tool": call.name,
                            "input": ", ".join(f"{k}={v}" for k, v in call_args.items()),
                            "summary": summarize_tool_result(call.name, result),
                            "sourceUrls": result.get("sources") if call.name == "web_search" else None,
                        }
                    )
                    function_response_parts.append(types.Part.from_function_response(name=call.name, response=result))

                contents.append(types.Content(role="user", parts=function_response_parts))
            else:
                bot_answer = bot_answer or "Reached the maximum number of tool-call steps without a final answer."

            if tool_calls_log and "web" not in bot_answer.lower() and "external" not in bot_answer.lower():
                bot_answer = (
                    "> \u2139\ufe0f Part of this response was retrieved live from an external web source, "
                    "not the internal knowledge base.\n\n" + bot_answer
                )
        else:
            if payload.enableRAG and retrieved_chunks:
                lines = "\n".join(
                    f"**{i + 1}. Source: {r['chunk']['docName']} (Page {r['chunk']['pageNumber']}, "
                    f"Match: {round(r['similarity'] * 100)}%)**\n> \"{r['chunk']['text']}\"\n"
                    for i, r in enumerate(retrieved_chunks)
                )
                bot_answer = (
                    f"### Grounded Search Results (Offline Mode)\n\nFound **{len(retrieved_chunks)} matching document "
                    f'chunks** in vector store for your query: "{user_prompt}"\n\n{lines}'
                )
            else:
                bot_answer = (
                    "No relevant context chunks found in vector database matching your threshold. "
                    "Try reducing the similarity threshold or uploading PDF documents."
                )

        citations = [
            {
                "docName": r["chunk"]["docName"],
                "category": (global_vector_db.get_document(r["chunk"]["docId"]) or {}).get("category", "General"),
                "pageNumber": r["chunk"]["pageNumber"],
                "chunkIndex": r["chunk"]["chunkIndex"],
                "similarity": r["similarity"],
                "textSnippet": r["chunk"]["text"][:140] + ("..." if len(r["chunk"]["text"]) > 140 else ""),
            }
            for r in retrieved_chunks
        ]

        return {
            "success": True,
            "answer": bot_answer,
            "retrievedChunks": retrieved_chunks,
            "citations": citations,
            "toolCalls": tool_calls_log,
            "ragEnabled": payload.enableRAG,
        }
    except Exception as err:
        return JSONResponse(
            status_code=500, content={"success": False, "error": str(err) or "Failed to process chat query"}
        )


@app.get("/api/vector/stats")
async def vector_stats():
    try:
        stats = global_vector_db.get_stats()
        return {"success": True, "stats": stats}
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


@app.post("/api/vector/clear")
async def vector_clear():
    try:
        global_vector_db.clear_all()
        return {"success": True, "message": "Vector store reset successfully"}
    except Exception as err:
        return JSONResponse(status_code=500, content={"success": False, "error": str(err)})


class SPAStaticFiles(StaticFiles):
    """Falls back to index.html for unmatched paths, enabling client-side routing."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


DIST_PATH = PROJECT_ROOT / "dist"
if DIST_PATH.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(DIST_PATH), html=True), name="static")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
