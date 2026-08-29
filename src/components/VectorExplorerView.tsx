import React, { useState } from "react";
import {
  Database,
  Search,
  Activity,
  Cpu,
  Layers,
  HardDrive,
  Trash2,
  Download,
  FileText,
  Sparkles,
  BarChart3,
  Sliders,
  CheckCircle,
} from "lucide-react";
import { VectorStoreStats, VectorSearchResult, DocumentChunk } from "../types";
import { ChunkInspectorModal } from "./ChunkInspectorModal";

interface VectorExplorerViewProps {
  stats: VectorStoreStats | null;
  onClearDatabase: () => Promise<void>;
  onPerformSearch: (
    query: string,
    topK: number,
    threshold: number
  ) => Promise<VectorSearchResult[]>;
}

export const VectorExplorerView: React.FC<VectorExplorerViewProps> = ({
  stats,
  onClearDatabase,
  onPerformSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<VectorSearchResult[] | null>(null);
  const [inspectChunk, setInspectChunk] = useState<{ chunk: DocumentChunk; similarity?: number } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const results = await onPerformSearch(searchQuery, topK, threshold);
      setSearchResults(results);
    } catch (err) {
      console.error("Vector search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <span>Knowledge Base Vector Explorer</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Analyze stored policy document vectors, execute standalone cosine similarity search queries, and inspect vector dimension metrics.
          </p>
        </div>

        <button
          onClick={onClearDatabase}
          className="flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0"
        >
          <Trash2 className="h-4 w-4" />
          <span>Reset Vector Store</span>
        </button>
      </div>

      {/* Vector Stats Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Total Vector Chunks</span>
            <Layers className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {stats?.totalChunks || 0}
          </div>
          <div className="text-[11px] text-gray-400">Indexed vector embeddings</div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Embedding Dimensions</span>
            <Cpu className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {stats?.vectorDimensions || 768}d
          </div>
          <div className="text-[11px] text-gray-400">Gemini embedding model</div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Documents Ingested</span>
            <FileText className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {stats?.totalDocs || 0}
          </div>
          <div className="text-[11px] text-gray-400">Policy documents ingested</div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Storage Size</span>
            <HardDrive className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {formatBytes(stats?.storageSizeBytes || 0)}
          </div>
          <div className="text-[11px] text-gray-400">Disk-persisted JSON index</div>
        </div>
      </div>

      {/* Vector Cosine Similarity Search Tester */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Search className="h-5 w-5 text-blue-600" />
              <span>Cosine Vector Similarity Search Tester</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Enter a query to vectorize it in real-time and compute dot-product cosine similarity against all document vectors in database.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Type search terms (e.g. 'sick leave policy', 'password rotation', 'expense reimbursement')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!searchQuery.trim() || isSearching}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs flex items-center justify-center space-x-2 shrink-0"
            >
              {isSearching ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Computing Vectors...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Execute Vector Search</span>
                </>
              )}
            </button>
          </div>

          {/* Search Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-gray-500 font-medium">Top K Matches:</span>
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
                {[3, 5, 8, 10].map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setTopK(k)}
                    className={`px-2.5 py-1 rounded font-mono font-bold transition-colors ${
                      topK === k ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="text-gray-500 font-medium">Min Cosine Threshold:</span>
              <span className="font-mono text-emerald-600 font-bold">{Math.round(threshold * 100)}%</span>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none"
              />
            </div>
          </div>
        </form>

        {/* Results List */}
        {searchResults !== null && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-gray-900">
                Search Results ({searchResults.length} matched vectors)
              </span>
              <span className="text-gray-400">Sorted by Cosine Distance</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-xs bg-gray-50 rounded-xl border border-gray-200">
                No vector chunks met the similarity threshold score of {Math.round(threshold * 100)}%. Try lowering the threshold or refining your search term.
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((res, idx) => {
                  const matchPct = Math.round(res.similarity * 100);
                  return (
                    <div
                      key={res.chunk.id}
                      onClick={() => setInspectChunk({ chunk: res.chunk, similarity: res.similarity })}
                      className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-400 cursor-pointer transition-all space-y-2 group shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="h-5 w-5 rounded-full bg-blue-50 text-blue-700 font-mono text-[10px] font-bold flex items-center justify-center border border-blue-200">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {res.chunk.docName} (Page {res.chunk.pageNumber}, Chunk #{res.chunk.chunkIndex + 1})
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-emerald-600 font-bold">{matchPct}% Match</span>
                          <Activity className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                      </div>

                      {/* Similarity Bar */}
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.max(5, matchPct)}%` }}
                        />
                      </div>

                      <p className="text-xs text-gray-700 leading-relaxed italic line-clamp-2">
                        "{res.chunk.text}"
                      </p>

                      <div className="text-[10px] text-gray-400 flex justify-between pt-1">
                        <span>~{res.chunk.tokenEstimate} tokens</span>
                        <span className="text-blue-600 font-semibold group-hover:underline">View Vector Dimensions →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chunk Inspector Modal */}
      <ChunkInspectorModal
        isOpen={!!inspectChunk}
        onClose={() => setInspectChunk(null)}
        chunk={inspectChunk?.chunk || null}
        similarity={inspectChunk?.similarity}
      />
    </div>
  );
};
