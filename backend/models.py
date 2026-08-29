"""Pydantic request/response models mirroring src/types.ts (camelCase field names)."""

from typing import Optional

from pydantic import BaseModel

# Default knowledge categories for the IT company knowledge repository.
CATEGORIES = [
    "HR Policy",
    "Leave Policy",
    "IT Security Policy",
    "Code of Conduct",
    "Expense & Travel Policy",
    "Onboarding Guide",
]


class UploadRequest(BaseModel):
    fileName: str
    fileType: Optional[str] = None
    fileBase64: Optional[str] = None
    rawText: Optional[str] = None
    category: str = "General"
    chunkSize: int = 600
    chunkOverlap: int = 100


class SearchRequest(BaseModel):
    query: str
    topK: int = 4
    similarityThreshold: float = 0.1
    selectedDocIds: Optional[list[str]] = None
    selectedCategories: Optional[list[str]] = None


class ChatMessageIn(BaseModel):
    id: str
    sender: str
    content: str
    timestamp: str


class ChatRequest(BaseModel):
    messages: list[ChatMessageIn] = []
    query: Optional[str] = None
    topK: int = 4
    similarityThreshold: float = 0.2
    model: str = "gemini-3.6-flash"
    enableRAG: bool = True
    selectedDocIds: Optional[list[str]] = None
    selectedCategories: Optional[list[str]] = None
