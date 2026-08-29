import { PDFParse } from "pdf-parse";

export interface ExtractedChunkRaw {
  chunkIndex: number;
  text: string;
  pageNumber: number;
  charLength: number;
  tokenEstimate: number;
}

const SENTENCE_BREAK_RE = /[.!?\n]\s/;

function splitStringWithOverlap(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const result: string[] = [];
  if (!text) return result;

  const effectiveStep = Math.max(1, chunkSize - chunkOverlap);
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < text.length) {
      // Look for natural sentence break (. ! ? \n) near the end boundary
      const windowStart = Math.max(startIndex, endIndex - 80);
      const lookbackWindow = text.slice(windowStart, endIndex);
      const match = lookbackWindow.search(SENTENCE_BREAK_RE);

      if (match !== -1) {
        const offsetFromStart = windowStart + match + 1;
        if (offsetFromStart > startIndex + 50) {
          endIndex = offsetFromStart;
        }
      }
    } else {
      endIndex = text.length;
    }

    const chunkStr = text.slice(startIndex, endIndex).trim();
    if (chunkStr) {
      result.push(chunkStr);
    }

    if (endIndex >= text.length) {
      break;
    }
    startIndex += effectiveStep;
  }

  return result;
}

export function chunkTextContent(
  fullText: string,
  chunkSize: number,
  chunkOverlap: number,
  pagesText?: Array<{ pageNumber: number; text: string }> | null
): ExtractedChunkRaw[] {
  const chunks: ExtractedChunkRaw[] = [];

  if (pagesText && pagesText.length > 0) {
    let globalIndex = 0;
    for (const pageObj of pagesText) {
      const pageText = pageObj.text.trim();
      if (!pageText) continue;

      const pageChunks = splitStringWithOverlap(pageText, chunkSize, chunkOverlap);
      for (const textChunk of pageChunks) {
        const stripped = textChunk.trim();
        if (stripped.length > 10) {
          chunks.push({
            chunkIndex: globalIndex,
            text: stripped,
            pageNumber: pageObj.pageNumber,
            charLength: stripped.length,
            tokenEstimate: Math.ceil(stripped.length / 4),
          });
          globalIndex++;
        }
      }
    }
  } else {
    // Fallback if pages aren't structured individually
    const rawChunks = splitStringWithOverlap(fullText, chunkSize, chunkOverlap);
    let globalIndex = 0;
    for (const textChunk of rawChunks) {
      const stripped = textChunk.trim();
      if (stripped.length > 10) {
        // Estimate page number assuming ~2500 chars per page
        const estimatedPage = Math.floor((globalIndex * (chunkSize - chunkOverlap)) / 2500) + 1;
        chunks.push({
          chunkIndex: globalIndex,
          text: stripped,
          pageNumber: estimatedPage,
          charLength: stripped.length,
          tokenEstimate: Math.ceil(stripped.length / 4),
        });
        globalIndex++;
      }
    }
  }

  return chunks;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<{
  text: string;
  pages: Array<{ pageNumber: number; text: string }>;
  pageCount: number;
}> {
  const parser = new PDFParse(new Uint8Array(buffer));
  const parsed = await parser.getText();
  const pages = (parsed.pages || []).map((p: any) => ({
    pageNumber: p.num,
    text: p.text || "",
  }));

  return {
    text: parsed.text || pages.map((p: any) => p.text).join("\n\n"),
    pages,
    pageCount: parsed.total || pages.length || 1,
  };
}
