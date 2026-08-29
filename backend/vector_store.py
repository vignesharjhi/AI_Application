"""In-memory vector database with JSON persistence (ported from src/lib/vectorStore.ts)."""

import json
import math
import os
import re
from pathlib import Path
from typing import Optional

from google import genai

STORE_FILE_PATH = Path(__file__).resolve().parent.parent / "vector_store.json"
VECTOR_DIM = 768  # standard embedding size for text-embedding-004


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    if not vec_a or not vec_b or len(vec_a) == 0 or len(vec_a) != len(vec_b):
        return 0.0

    dot_product = 0.0
    norm_a = 0.0
    norm_b = 0.0

    for a, b in zip(vec_a, vec_b):
        dot_product += a * b
        norm_a += a * a
        norm_b += b * b

    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))


def _to_int32(value: int) -> int:
    """Emulates JavaScript's `value | 0` 32-bit signed integer overflow."""
    value &= 0xFFFFFFFF
    if value >= 0x80000000:
        value -= 0x100000000
    return value


def generate_fallback_embedding(text: str, dim: int = VECTOR_DIM) -> list[float]:
    """Deterministic fallback vector generator, mirrors the JS hashing vectorizer 1:1."""
    cleaned = re.sub(r"[^\w\s]", "", text.lower())
    words = [w for w in re.split(r"\s+", cleaned) if w]
    vector = [0.0] * dim

    for word in words:
        hash_val = 0
        for ch in word:
            shifted = _to_int32(hash_val << 5)
            hash_val = _to_int32(shifted - hash_val + ord(ch))

        primary_index = abs(hash_val) % dim
        secondary_index = abs(hash_val * 31) % dim

        vector[primary_index] += 1.0
        vector[secondary_index] += 0.5

    norm = math.sqrt(sum(v * v for v in vector))
    if norm > 0:
        vector = [v / norm for v in vector]

    return vector


async def get_embedding(text: str, api_key: Optional[str] = None) -> list[float]:
    """Generates vector embeddings for a given string using Gemini API or fallback."""
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        return generate_fallback_embedding(text)

    models_to_try = ["gemini-embedding-2-preview", "text-embedding-004"]
    client = genai.Client(api_key=key)

    for model in models_to_try:
        try:
            response = await client.aio.models.embed_content(model=model, contents=text)
            values = None
            if response.embeddings and len(response.embeddings) > 0:
                values = response.embeddings[0].values
            if values:
                return list(values)
        except Exception:
            continue

    return generate_fallback_embedding(text)


class VectorDatabase:
    def __init__(self) -> None:
        self.documents: dict[str, dict] = {}
        self.chunks: dict[str, dict] = {}
        self._load_from_disk()

    def _save_to_disk(self) -> None:
        try:
            data = {
                "documents": list(self.documents.values()),
                "chunks": list(self.chunks.values()),
            }
            STORE_FILE_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"Failed to persist vector store to disk: {e}")

    def _load_from_disk(self) -> None:
        try:
            if STORE_FILE_PATH.exists():
                parsed = json.loads(STORE_FILE_PATH.read_text(encoding="utf-8"))
                for doc in parsed.get("documents", []):
                    self.documents[doc["id"]] = doc
                for chunk in parsed.get("chunks", []):
                    self.chunks[chunk["id"]] = chunk
        except Exception as e:
            print(f"Failed to load vector store from disk: {e}")

    def get_documents(self) -> list[dict]:
        return list(self.documents.values())

    def get_document(self, doc_id: str) -> Optional[dict]:
        return self.documents.get(doc_id)

    def get_chunks_for_doc(self, doc_id: str) -> list[dict]:
        return [c for c in self.chunks.values() if c["docId"] == doc_id]

    def get_all_chunks(self) -> list[dict]:
        return list(self.chunks.values())

    def add_document(self, doc: dict, doc_chunks: list[dict]) -> None:
        self.documents[doc["id"]] = doc
        for chunk in doc_chunks:
            self.chunks[chunk["id"]] = chunk
        self._save_to_disk()

    def delete_document(self, doc_id: str) -> bool:
        if doc_id in self.documents:
            del self.documents[doc_id]
            for chunk_id in [cid for cid, c in self.chunks.items() if c["docId"] == doc_id]:
                del self.chunks[chunk_id]
            self._save_to_disk()
            return True
        return False

    def clear_all(self) -> None:
        self.documents.clear()
        self.chunks.clear()
        self._save_to_disk()

    def get_categories(self) -> list[str]:
        return sorted({doc.get("category", "General") for doc in self.documents.values()})

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 4,
        threshold: float = 0.1,
        selected_doc_ids: Optional[list[str]] = None,
        selected_categories: Optional[list[str]] = None,
    ) -> list[dict]:
        results: list[dict] = []

        for chunk in self.chunks.values():
            if selected_doc_ids and len(selected_doc_ids) > 0 and chunk["docId"] not in selected_doc_ids:
                continue

            if selected_categories and len(selected_categories) > 0:
                doc = self.documents.get(chunk["docId"])
                if not doc or doc.get("category", "General") not in selected_categories:
                    continue

            similarity = cosine_similarity(query_embedding, chunk["embedding"])
            if similarity >= threshold:
                results.append({"chunk": chunk, "similarity": similarity})

        results.sort(key=lambda r: r["similarity"], reverse=True)
        return results[:top_k]

    def get_stats(self) -> dict:
        all_chunks = list(self.chunks.values())
        total_chars = sum(c["charLength"] for c in all_chunks)
        avg_chunk_length = round(total_chars / len(all_chunks)) if all_chunks else 0
        dimensions = len(all_chunks[0]["embedding"]) if all_chunks and all_chunks[0].get("embedding") else VECTOR_DIM

        storage_size_bytes = 0
        try:
            if STORE_FILE_PATH.exists():
                storage_size_bytes = STORE_FILE_PATH.stat().st_size
        except Exception:
            storage_size_bytes = len(json.dumps(all_chunks))

        return {
            "totalDocs": len(self.documents),
            "totalChunks": len(self.chunks),
            "vectorDimensions": dimensions,
            "storageSizeBytes": storage_size_bytes,
            "avgChunkLength": avg_chunk_length,
        }


global_vector_db = VectorDatabase()
