import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { DocumentMeta, DocumentChunk, VectorSearchResult, VectorStoreStats } from "../types.js";

export const CATEGORIES = [
  "HR Policy",
  "Leave Policy",
  "IT Security Policy",
  "Code of Conduct",
  "Expense & Travel Policy",
  "Onboarding Guide",
];

const STORE_FILE_PATH = path.join(process.cwd(), "vector_store.json");
export const VECTOR_DIM = 768;

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers",
  "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in",
  "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our",
  "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's",
  "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs",
  "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
  "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
  "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
  "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't",
  "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself",
  "yourselves", "tell", "show", "give", "find", "search", "check", "please"
]);

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0.0;
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0.0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Levenshtein distance for fuzzy typo correction (e.g. "hpurs" -> "hours")
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Fuzzy matching score between two words (0.0 to 1.0)
function wordFuzzySimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (w1.length < 3 || w2.length < 3) return w1 === w2 ? 1.0 : 0.0;
  
  // Prefix/contains check
  if (w1.length > 4 && w2.length > 4 && (w1.startsWith(w2) || w2.startsWith(w1))) {
    return 0.9;
  }

  const maxLen = Math.max(w1.length, w2.length);
  const dist = editDistance(w1, w2);
  const maxAllowedDist = maxLen <= 5 ? 1 : 2;

  if (dist <= maxAllowedDist) {
    return Math.max(0, 1.0 - dist / maxLen);
  }
  return 0.0;
}

export function computeLexicalAndFuzzyScore(query: string, chunkText: string, docName: string = ""): number {
  const cleanQ = query.toLowerCase().replace(/[^\w\s]/g, " ");
  const cleanText = (chunkText + " " + docName).toLowerCase().replace(/[^\w\s]/g, " ");

  const qWords = cleanQ.split(/\s+/).filter((w) => w.length > 1);
  const textWords = cleanText.split(/\s+/).filter((w) => w.length > 1);

  if (qWords.length === 0 || textWords.length === 0) return 0.0;

  // Filter query words to emphasize meaningful terms
  const meaningfulQWords = qWords.filter((w) => !STOP_WORDS.has(w));
  const targetQWords = meaningfulQWords.length > 0 ? meaningfulQWords : qWords;

  const textWordSet = new Set(textWords);
  let totalMatchWeight = 0.0;
  let maxPossibleWeight = 0.0;

  for (const qWord of targetQWords) {
    const wordWeight = STOP_WORDS.has(qWord) ? 0.3 : 1.0;
    maxPossibleWeight += wordWeight;

    // Exact match in text
    if (textWordSet.has(qWord)) {
      totalMatchWeight += wordWeight * 1.0;
      continue;
    }

    // Substring in full text
    if (cleanText.includes(qWord)) {
      totalMatchWeight += wordWeight * 0.95;
      continue;
    }

    // Fuzzy matching against all words in chunk
    let bestFuzzy = 0.0;
    for (const tWord of textWords) {
      if (Math.abs(tWord.length - qWord.length) <= 2) {
        const sim = wordFuzzySimilarity(qWord, tWord);
        if (sim > bestFuzzy) {
          bestFuzzy = sim;
          if (bestFuzzy >= 0.9) break;
        }
      }
    }

    if (bestFuzzy >= 0.6) {
      totalMatchWeight += wordWeight * bestFuzzy;
    }
  }

  let lexicalScore = maxPossibleWeight > 0 ? totalMatchWeight / maxPossibleWeight : 0.0;

  // Exact phrase boost (e.g. "working hours" appearing as continuous phrase in text)
  if (targetQWords.length >= 2) {
    const phrase = targetQWords.join(" ");
    if (cleanText.includes(phrase)) {
      lexicalScore = Math.min(1.0, lexicalScore * 1.35 + 0.2);
    }
  }

  return Math.min(1.0, lexicalScore);
}

export function generateFallbackEmbedding(text: string, dim: number = VECTOR_DIM): number[] {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const vector = new Array(dim).fill(0.0);

  // Bag of words + Character n-grams (3-grams) for typo tolerance
  for (const word of words) {
    const isStop = STOP_WORDS.has(word);
    const weight = isStop ? 0.2 : 1.0;

    let hashVal = 0;
    for (let i = 0; i < word.length; i++) {
      hashVal = (Math.imul(hashVal, 31) + word.charCodeAt(i)) | 0;
    }
    const idx1 = Math.abs(hashVal) % dim;
    const idx2 = Math.abs((hashVal * 37) | 0) % dim;
    vector[idx1] += 1.0 * weight;
    vector[idx2] += 0.5 * weight;

    // Character 3-grams
    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        const gram = word.slice(i, i + 3);
        let gHash = 0;
        for (let j = 0; j < gram.length; j++) {
          gHash = (Math.imul(gHash, 33) + gram.charCodeAt(j)) | 0;
        }
        const gIdx = Math.abs(gHash) % dim;
        vector[gIdx] += 0.3 * weight;
      }
    }
  }

  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0));
  if (norm > 0) {
    return vector.map((v) => v / norm);
  }

  return vector;
}

export async function getEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return generateFallbackEmbedding(text);
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const models = ["gemini-embedding-001", "gemini-embedding-2", "gemini-embedding-2-preview"];
  for (const model of models) {
    try {
      const response = await ai.models.embedContent({
        model,
        contents: text,
      });
      const values = (response as any).embedding?.values || (response as any).embeddings?.[0]?.values;
      if (values && values.length > 0) {
        return Array.from(values);
      }
    } catch {
      continue;
    }
  }

  return generateFallbackEmbedding(text);
}

export class VectorDatabase {
  private documents: Map<string, DocumentMeta> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private saveToDisk(): void {
    try {
      const data = {
        documents: Array.from(this.documents.values()),
        chunks: Array.from(this.chunks.values()),
      };
      fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.warn(`Failed to persist vector store to disk: ${e}`);
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(STORE_FILE_PATH)) {
        const raw = fs.readFileSync(STORE_FILE_PATH, "utf-8");
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          for (const doc of parsed.documents || []) {
            this.documents.set(doc.id, doc);
          }
          for (const chunk of parsed.chunks || []) {
            this.chunks.set(chunk.id, chunk);
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to load vector store from disk: ${e}`);
    }
  }

  public getDocuments(): DocumentMeta[] {
    return Array.from(this.documents.values());
  }

  public getDocument(docId: string): DocumentMeta | undefined {
    return this.documents.get(docId);
  }

  public getChunksForDoc(docId: string): DocumentChunk[] {
    return Array.from(this.chunks.values()).filter((c) => c.docId === docId);
  }

  public getAllChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  public addDocument(doc: DocumentMeta, docChunks: DocumentChunk[]): void {
    this.documents.set(doc.id, doc);
    for (const chunk of docChunks) {
      this.chunks.set(chunk.id, chunk);
    }
    this.saveToDisk();
  }

  public updateChunkEmbedding(chunkId: string, embedding: number[]): void {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.embedding = embedding;
      this.saveToDisk();
    }
  }

  public deleteDocument(docId: string): boolean {
    if (this.documents.has(docId)) {
      this.documents.delete(docId);
      for (const [cid, c] of this.chunks.entries()) {
        if (c.docId === docId) {
          this.chunks.delete(cid);
        }
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public clearAll(): void {
    this.documents.clear();
    this.chunks.clear();
    this.saveToDisk();
  }

  public getCategories(): string[] {
    const cats = new Set<string>();
    for (const doc of this.documents.values()) {
      cats.add(doc.category || "General");
    }
    return Array.from(cats).sort();
  }

  /**
   * Hybrid Search: Combines Dense Neural Vector Similarity + Sparse Lexical & Fuzzy Typo Matching.
   * This guarantees that exact & near-match queries (e.g. "Working hpurs", "working hours", "leave rules")
   * as well as conceptual/semantic queries retrieve the most accurate document chunks.
   */
  public async search(
    queryEmbedding: number[],
    queryString: string = "",
    topK: number = 4,
    threshold: number = 0.1,
    selectedDocIds?: string[] | null,
    selectedCategories?: string[] | null
  ): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (selectedDocIds && selectedDocIds.length > 0 && !selectedDocIds.includes(chunk.docId)) {
        continue;
      }

      if (selectedCategories && selectedCategories.length > 0) {
        const doc = this.documents.get(chunk.docId);
        if (!doc || !selectedCategories.includes(doc.category || "General")) {
          continue;
        }
      }

      const vectorSim = cosineSimilarity(queryEmbedding, chunk.embedding);
      const lexicalFuzzySim = queryString
        ? computeLexicalAndFuzzyScore(queryString, chunk.text, chunk.docName)
        : 0.0;

      // Hybrid score:
      // If neural vector similarity is strong (>0.25), combine with lexical weight.
      // If neural similarity is 0 (e.g., embedding model mismatch or fallback), lexical/fuzzy dominates.
      let finalScore = 0.0;
      if (vectorSim > 0.1) {
        finalScore = vectorSim * 0.6 + lexicalFuzzySim * 0.4;
      } else if (lexicalFuzzySim > 0.0) {
        finalScore = lexicalFuzzySim * 0.95;
      } else {
        finalScore = vectorSim;
      }

      if (finalScore >= threshold) {
        results.push({
          chunk,
          similarity: Number(finalScore.toFixed(4)),
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  public getStats(): VectorStoreStats {
    const allChunks = Array.from(this.chunks.values());
    const totalChars = allChunks.reduce((acc, c) => acc + (c.charLength || 0), 0);
    const avgChunkLength = allChunks.length > 0 ? Math.round(totalChars / allChunks.length) : 0;
    const dimensions =
      allChunks.length > 0 && allChunks[0].embedding?.length
        ? allChunks[0].embedding.length
        : VECTOR_DIM;

    let storageSizeBytes = 0;
    try {
      if (fs.existsSync(STORE_FILE_PATH)) {
        storageSizeBytes = fs.statSync(STORE_FILE_PATH).size;
      }
    } catch {
      storageSizeBytes = JSON.stringify(allChunks).length;
    }

    return {
      totalDocs: this.documents.size,
      totalChunks: this.chunks.size,
      vectorDimensions: dimensions,
      storageSizeBytes,
      avgChunkLength,
    };
  }
}

export const globalVectorDb = new VectorDatabase();
