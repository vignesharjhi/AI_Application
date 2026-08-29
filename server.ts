import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { globalVectorDb, CATEGORIES, getEmbedding } from "./src/server/vectorStore.js";
import { chunkTextContent, parsePdfBuffer } from "./src/server/pdfChunker.js";
import { populateSampleDocsIfEmpty, reindexStoredChunksIfOutdated } from "./src/server/sampleDocs.js";
import { TOOL_DECLARATIONS, TOOL_DISPATCH, summarizeToolResult } from "./src/server/tools.js";
import { DocumentChunk, DocumentMeta } from "./src/types.js";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

// Seed initial sample documents & reindex if needed
(async () => {
  try {
    await populateSampleDocsIfEmpty();
    await reindexStoredChunksIfOutdated();
  } catch (e) {
    console.warn("Sample docs initialization error:", e);
  }
})();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/categories", (_req, res) => {
    try {
      const stored = globalVectorDb.getCategories();
      const merged = Array.from(new Set([...CATEGORIES, ...stored])).sort();
      res.json({ success: true, categories: merged });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  app.get("/api/documents", (_req, res) => {
    try {
      const docs = globalVectorDb.getDocuments();
      res.json({ success: true, documents: docs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  app.post("/api/documents/upload", async (req, res) => {
    try {
      const {
        fileName,
        fileType,
        fileBase64,
        rawText,
        category = "General",
        chunkSize = 600,
        chunkOverlap = 100,
      } = req.body;

      if (!fileName) {
        return res.status(400).json({ success: false, error: "Missing fileName in payload" });
      }

      let extractedText = "";
      let pageCount = 1;
      let pagesStructured: Array<{ pageNumber: number; text: string }> = [];

      if (rawText) {
        extractedText = rawText;
      } else if (fileBase64) {
        const buffer = Buffer.from(fileBase64, "base64");
        const isPdf =
          fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          try {
            const parsedPdf = await parsePdfBuffer(buffer);
            extractedText = parsedPdf.text;
            pageCount = parsedPdf.pageCount || 1;
            pagesStructured = parsedPdf.pages;
          } catch (pdfErr: any) {
            return res.status(400).json({
              success: false,
              error: `Failed to parse PDF file: ${pdfErr.message || String(pdfErr)}`,
            });
          }
        } else {
          extractedText = buffer.toString("utf-8");
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "No document file content or text provided",
        });
      }

      if (!extractedText.trim()) {
        return res.status(400).json({
          success: false,
          error: "Extracted text is empty or unreadable",
        });
      }

      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const docId = `doc_${Date.now()}_${randomSuffix}`;

      const rawChunks = chunkTextContent(
        extractedText,
        chunkSize,
        chunkOverlap,
        pagesStructured.length > 0 ? pagesStructured : null
      );

      const chunkPromises = rawChunks.map(async (rc) => {
        const embedding = await getEmbedding(rc.text);
        return {
          id: `chunk_${docId}_${rc.chunkIndex}`,
          docId,
          docName: fileName,
          chunkIndex: rc.chunkIndex,
          text: rc.text,
          pageNumber: rc.pageNumber,
          charLength: rc.charLength,
          tokenEstimate: rc.tokenEstimate,
          embedding,
        } as DocumentChunk;
      });

      const docChunks = await Promise.all(chunkPromises);

      const totalTokensEstimate = docChunks.reduce((acc, c) => acc + c.tokenEstimate, 0);

      const docMeta: DocumentMeta = {
        id: docId,
        name: fileName,
        category: category || "General",
        sizeBytes: fileBase64
          ? Math.ceil((fileBase64.length * 3) / 4)
          : Buffer.byteLength(extractedText, "utf-8"),
        uploadDate: new Date().toISOString(),
        pageCount,
        chunkCount: docChunks.length,
        totalTokensEstimate,
        vectorDimensions: docChunks[0]?.embedding?.length || 768,
        status: "ready",
      };

      globalVectorDb.addDocument(docMeta, docChunks);

      return res.json({
        success: true,
        document: docMeta,
        chunksSample: docChunks.slice(0, 5),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to ingest document",
      });
    }
  });

  app.delete("/api/documents/:doc_id", (req, res) => {
    try {
      const { doc_id } = req.params;
      const success = globalVectorDb.deleteDocument(doc_id);
      if (success) {
        return res.json({ success: true, message: "Document deleted successfully" });
      }
      return res.status(404).json({ success: false, error: "Document not found" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  app.post("/api/vector/search", async (req, res) => {
    try {
      const {
        query,
        topK = 4,
        similarityThreshold = 0.1,
        selectedDocIds,
        selectedCategories,
      } = req.body;

      if (!query) {
        return res.status(400).json({ success: false, error: "Query string is required" });
      }

      const queryVector = await getEmbedding(query);
      const results = await globalVectorDb.search(
        queryVector,
        query,
        topK,
        similarityThreshold,
        selectedDocIds,
        selectedCategories
      );

      return res.json({
        success: true,
        query,
        resultCount: results.length,
        results,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const {
        messages = [],
        query,
        topK = 4,
        similarityThreshold = 0.2,
        model = "gemini-3.6-flash",
        enableRAG = true,
        selectedDocIds,
        selectedCategories,
      } = req.body;

      const userPrompt =
        query || (messages.length > 0 ? messages[messages.length - 1].content : "");

      if (!userPrompt) {
        return res
          .status(400)
          .json({ success: false, error: "User query or message is required" });
      }

      let retrievedChunks: any[] = [];
      let contextText = "";

      if (enableRAG) {
        const queryVector = await getEmbedding(userPrompt);
        retrievedChunks = await globalVectorDb.search(
          queryVector,
          userPrompt,
          topK,
          similarityThreshold,
          selectedDocIds,
          selectedCategories
        );

        if (retrievedChunks.length > 0) {
          contextText = retrievedChunks
            .map(
              (r, idx) =>
                `--- CONTEXT CHUNK #${idx + 1} (Document: ${r.chunk.docName}, Page ${r.chunk.pageNumber}, Chunk Index ${r.chunk.chunkIndex}, Similarity Score: ${Math.round(r.similarity * 100)}%) ---\n${r.chunk.text}`
            )
            .join("\n\n");
        }
      }

      const apiKey = process.env.GEMINI_API_KEY;
      let botAnswer = "";
      const toolCallsLog: Array<{
        tool: string;
        input: string;
        summary: string;
        policyReference?: string | null;
        sourceUrls?: Array<{ title: string; url: string }> | null;
      }> = [];

      const toolPolicy =
        "\n\nYou also have access to operational enterprise tools: calculate_leave_eligibility, create_it_support_ticket, calculate_travel_per_diem, verify_compliance_clause. " +
        "Invoke these tools when the user's inquiry requires dynamic calculations, creating an IT support ticket, checking per-diem travel/meal limits, or evaluating NDA/IT compliance. " +
        "When grounding answers in retrieved documents, incorporate tool results seamlessly with clear explanations and policy citations.";

      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });

        let systemInstruction = "";
        if (enableRAG && contextText) {
          systemInstruction =
            "You are an expert AI Assistant specialized in Retrieval-Augmented Generation (RAG) over user PDF documents.\n" +
            "Answer the user's question accurately using ONLY the provided CONTEXT CHUNKS below.\n" +
            "Rules:\n" +
            "1. Ground your answer strictly in the provided context text.\n" +
            "2. Cite your sources clearly using inline brackets such as [DocumentName.pdf, Page X, Chunk #Y] whenever presenting facts or metrics from the context.\n" +
            "3. If the context does not contain enough information to fully answer the question, clearly state what information is present and mention that additional details were not found in the ingested document index.\n" +
            "4. Keep the tone professional, concise, clear, and well-structured with markdown headings and bullet points where helpful." +
            toolPolicy;
        } else {
          systemInstruction =
            "You are a helpful AI Assistant. Provide a clear, accurate, and structured answer to the user's prompt." +
            toolPolicy;
        }

        const promptWithContext =
          enableRAG && contextText
            ? `RELEVANT DOCUMENT CONTEXT CHUNKS:\n${contextText}\n\nUSER QUESTION:\n${userPrompt}`
            : userPrompt;

        const contents: any[] = [{ role: "user", parts: [{ text: promptWithContext }] }];
        const chosenModel = model && model !== "gemini-2.5-flash" ? model : "gemini-3.6-flash";

        // Multi-turn loop for function calls
        for (let turn = 0; turn < 3; turn++) {
          const response = await ai.models.generateContent({
            model: chosenModel,
            contents,
            config: {
              systemInstruction,
              temperature: 0.2,
              tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            },
          });

          const functionCalls = response.functionCalls || [];
          if (!functionCalls || functionCalls.length === 0) {
            botAnswer = response.text || "No text generated by Gemini model.";
            break;
          }

          if (response.candidates?.[0]?.content) {
            contents.push(response.candidates[0].content);
          }

          const functionResponseParts: any[] = [];
          for (const call of functionCalls) {
            const handler = TOOL_DISPATCH[call.name];
            const callArgs = call.args || {};
            let result: any;
            if (!handler) {
              result = { error: `Unknown tool '${call.name}'.` };
            } else {
              try {
                result = await handler(callArgs);
              } catch (toolErr: any) {
                result = { error: `Tool '${call.name}' failed: ${toolErr.message || String(toolErr)}` };
              }
            }

            toolCallsLog.push({
              tool: call.name,
              input: Object.entries(callArgs)
                .map(([k, v]) => `${k}=${v}`)
                .join(", "),
              summary: summarizeToolResult(call.name, result),
              policyReference: result.policyReference || null,
            });

            functionResponseParts.push({
              functionResponse: {
                name: call.name,
                response: result,
              },
            });
          }

          contents.push({ role: "user", parts: functionResponseParts });
        }

        if (!botAnswer) {
          botAnswer = "Reached the maximum number of tool-call steps without a final answer.";
        }

        if (
          toolCallsLog.length > 0 &&
          !botAnswer.toLowerCase().includes("web") &&
          !botAnswer.toLowerCase().includes("external")
        ) {
          botAnswer =
            "> ℹ️ Part of this response was retrieved live from an external web source, not the internal knowledge base.\n\n" +
            botAnswer;
        }
      } else {
        if (enableRAG && retrievedChunks.length > 0) {
          const lines = retrievedChunks
            .map(
              (r, i) =>
                `**${i + 1}. Source: ${r.chunk.docName} (Page ${r.chunk.pageNumber}, Match: ${Math.round(r.similarity * 100)}%)**\n> "${r.chunk.text}"`
            )
            .join("\n\n");
          botAnswer = `### Grounded Search Results (Offline Mode)\n\nFound **${retrievedChunks.length} matching document chunks** in vector store for your query: "${userPrompt}"\n\n${lines}`;
        } else {
          botAnswer =
            "No relevant context chunks found in vector database matching your threshold. Try reducing the similarity threshold or uploading PDF documents.";
        }
      }

      const citations = retrievedChunks.map((r) => {
        const doc = globalVectorDb.getDocument(r.chunk.docId);
        return {
          docName: r.chunk.docName,
          category: doc?.category || "General",
          pageNumber: r.chunk.pageNumber,
          chunkIndex: r.chunk.chunkIndex,
          similarity: r.similarity,
          textSnippet:
            r.chunk.text.length > 140
              ? r.chunk.text.slice(0, 140) + "..."
              : r.chunk.text,
        };
      });

      return res.json({
        success: true,
        answer: botAnswer,
        retrievedChunks,
        citations,
        toolCalls: toolCallsLog,
        ragEnabled: enableRAG,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to process chat query",
      });
    }
  });

  app.get("/api/vector/stats", (_req, res) => {
    try {
      const stats = globalVectorDb.getStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  app.post("/api/vector/clear", (_req, res) => {
    try {
      globalVectorDb.clearAll();
      res.json({ success: true, message: "Vector store reset successfully" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  // Presentation Deck Route
  app.get(["/presentation", "/presentation.html"], (_req, res) => {
    const filePath = path.join(process.cwd(), "public", "presentation.html");
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("Presentation document not found");
    }
  });

  // Vite middleware in development vs static file serving in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
