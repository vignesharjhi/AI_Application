export interface DocumentMeta {
  id: string;
  name: string;
  category: string;
  sizeBytes: number;
  uploadDate: string;
  pageCount: number;
  chunkCount: number;
  totalTokensEstimate: number;
  vectorDimensions: number;
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  pageNumber: number;
  charLength: number;
  tokenEstimate: number;
  embedding: number[];
}

export interface VectorSearchResult {
  chunk: DocumentChunk;
  similarity: number;
}

export interface RAGSettings {
  topK: number;
  similarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
  model: string;
  enableRAG: boolean;
  selectedDocIds: string[]; // empty means all documents
}

export interface ToolCallInfo {
  tool: string;
  input: string;
  summary: string;
  policyReference?: string | null;
  sourceUrls?: { title: string; url: string }[] | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: {
    docName: string;
    category: string;
    pageNumber: number;
    chunkIndex: number;
    similarity: number;
    textSnippet: string;
  }[];
  retrievedChunks?: VectorSearchResult[];
  toolCalls?: ToolCallInfo[];
  ragEnabled?: boolean;
}

export interface IngestionProgress {
  step: 'parsing' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'error';
  progressPercent: number;
  message: string;
}

export interface VectorStoreStats {
  totalDocs: number;
  totalChunks: number;
  vectorDimensions: number;
  storageSizeBytes: number;
  avgChunkLength: number;
}
