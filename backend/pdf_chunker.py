"""PDF Processing & Text Chunking Engine (ported from src/lib/pdfChunker.ts)."""

import math
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class ExtractedChunkRaw:
    chunkIndex: int
    text: str
    pageNumber: int
    charLength: int
    tokenEstimate: int


_SENTENCE_BREAK_RE = re.compile(r"[.!?\n]\s")


def _split_string_with_overlap(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """Splits a string into chunks with overlap, preserving sentence boundaries where possible."""
    result: list[str] = []
    if not text:
        return result

    effective_step = max(1, chunk_size - chunk_overlap)
    start_index = 0

    while start_index < len(text):
        end_index = start_index + chunk_size

        if end_index < len(text):
            # Look for natural sentence break (. ! ? \n) near the end boundary
            window_start = max(start_index, end_index - 80)
            lookback_window = text[window_start:end_index]
            match = _SENTENCE_BREAK_RE.search(lookback_window)

            if match is not None:
                offset_from_start = window_start + match.start() + 1
                if offset_from_start > start_index + 50:
                    end_index = offset_from_start
        else:
            end_index = len(text)

        chunk_str = text[start_index:end_index].strip()
        if chunk_str:
            result.append(chunk_str)

        if end_index >= len(text):
            break
        start_index += effective_step

    return result


def chunk_text_content(
    full_text: str,
    chunk_size: int,
    chunk_overlap: int,
    pages_text: Optional[list[dict]] = None,
) -> list[ExtractedChunkRaw]:
    """Splits extracted text into structured chunks with page numbers and overlap."""
    chunks: list[ExtractedChunkRaw] = []

    if pages_text:
        global_index = 0
        for page_obj in pages_text:
            page_text = page_obj["text"].strip()
            if not page_text:
                continue

            page_chunks = _split_string_with_overlap(page_text, chunk_size, chunk_overlap)
            for text_chunk in page_chunks:
                stripped = text_chunk.strip()
                if len(stripped) > 10:
                    chunks.append(
                        ExtractedChunkRaw(
                            chunkIndex=global_index,
                            text=stripped,
                            pageNumber=page_obj["pageNumber"],
                            charLength=len(stripped),
                            tokenEstimate=math.ceil(len(stripped) / 4),
                        )
                    )
                    global_index += 1
    else:
        # Fallback if pages aren't structured individually
        raw_chunks = _split_string_with_overlap(full_text, chunk_size, chunk_overlap)
        global_index = 0
        for text_chunk in raw_chunks:
            stripped = text_chunk.strip()
            if len(stripped) > 10:
                # Estimate page number assuming ~2500 chars per page
                estimated_page = math.floor((global_index * (chunk_size - chunk_overlap)) / 2500) + 1
                chunks.append(
                    ExtractedChunkRaw(
                        chunkIndex=global_index,
                        text=stripped,
                        pageNumber=estimated_page,
                        charLength=len(stripped),
                        tokenEstimate=math.ceil(len(stripped) / 4),
                    )
                )
                global_index += 1

    return chunks
