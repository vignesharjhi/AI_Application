import React, { useEffect, useState } from "react";
import {
  UploadCloud,
  FileText,
  Trash2,
  Sparkles,
  Database,
  Layers,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Sliders,
  RefreshCw,
  Hash,
} from "lucide-react";
import { DocumentMeta, DocumentChunk, IngestionProgress } from "../types";
import { ChunkInspectorModal } from "./ChunkInspectorModal";

interface IngestionViewProps {
  documents: DocumentMeta[];
  categories: string[];
  onUploadDocument: (file: File, chunkSize: number, chunkOverlap: number, category: string) => Promise<void>;
  onUploadRawText: (title: string, text: string, chunkSize: number, chunkOverlap: number, category: string) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onLoadSampleDocs: () => Promise<void>;
  isIngesting: boolean;
  ingestionProgress: IngestionProgress | null;
  selectedDocChunks: DocumentChunk[];
  onSelectDocument: (docId: string) => Promise<void>;
  activeDocId: string | null;
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  documents,
  categories,
  onUploadDocument,
  onUploadRawText,
  onDeleteDocument,
  onLoadSampleDocs,
  isIngesting,
  ingestionProgress,
  selectedDocChunks,
  onSelectDocument,
  activeDocId,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [chunkSize, setChunkSize] = useState(600);
  const [chunkOverlap, setChunkOverlap] = useState(100);
  const [activeMode, setActiveMode] = useState<"file" | "text">("file");
  const [rawTextTitle, setRawTextTitle] = useState("");
  const [rawTextContent, setRawTextContent] = useState("");
  const [category, setCategory] = useState(categories[0] || "General");
  const [inspectChunk, setInspectChunk] = useState<DocumentChunk | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await onUploadDocument(file, chunkSize, chunkOverlap, category);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onUploadDocument(file, chunkSize, chunkOverlap, category);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTextTitle.trim() || !rawTextContent.trim() || isIngesting) return;
    await onUploadRawText(rawTextTitle, rawTextContent, chunkSize, chunkOverlap, category);
    setRawTextTitle("");
    setRawTextContent("");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Company Knowledge Base Ingestion</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Upload HR, Leave, IT Security, and other company policy documents (PDF or text), tag them with a category, and index them for grounded Q&A.
          </p>
        </div>

        <button
          onClick={onLoadSampleDocs}
          disabled={isIngesting}
          className="flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isIngesting ? "animate-spin text-blue-600" : ""}`} />
          <span>Reload Sample Policies</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Category Selection Box */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-900">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>Knowledge Category</span>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500">Documents are organized by category so employees can find and filter the right policy quickly.</p>
          </div>

          {/* Chunking Settings Box */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-900">
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>Chunking & Overlap Settings</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700 font-medium">Target Chunk Size</span>
                  <span className="text-blue-600 font-mono font-bold">{chunkSize} chars</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1500"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700 font-medium">Chunk Overlap</span>
                  <span className="text-cyan-600 font-mono font-bold">{chunkOverlap} chars</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="25"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-gray-200 rounded-lg appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold">
              <button
                onClick={() => setActiveMode("file")}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  activeMode === "file" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Upload PDF / TXT
              </button>
              <button
                onClick={() => setActiveMode("text")}
                className={`flex-1 py-2 rounded-lg transition-all ${
                  activeMode === "text" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Direct Text Input
              </button>
            </div>

            {activeMode === "file" ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-gray-300 bg-gray-50/50 hover:border-gray-400"
                }`}
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">
                    Drag & Drop your policy document here
                  </p>
                  <p className="text-xs text-gray-500">Supports PDF or plain text TXT files up to 25MB</p>
                </div>

                <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition-colors shadow-xs inline-block">
                  Browse File
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileChange}
                    disabled={isIngesting}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Document Title (e.g. Remote_Work_Policy.txt)"
                  value={rawTextTitle}
                  onChange={(e) => setRawTextTitle(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  required
                />
                <textarea
                  placeholder="Paste document text content here..."
                  rows={6}
                  value={rawTextContent}
                  onChange={(e) => setRawTextContent(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
                <button
                  type="submit"
                  disabled={isIngesting || !rawTextTitle.trim() || !rawTextContent.trim()}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs"
                >
                  Ingest & Vectorize Text
                </button>
              </form>
            )}

            {/* Ingestion Progress Indicator */}
            {isIngesting && (
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2 text-xs animate-in fade-in">
                <div className="flex justify-between items-center font-semibold text-blue-900">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600 animate-spin" />
                    <span>Processing Document Pipeline...</span>
                  </span>
                  <span className="font-mono">{ingestionProgress?.progressPercent || 30}%</span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${ingestionProgress?.progressPercent || 30}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 italic">{ingestionProgress?.message || "Chunking and calculating Gemini embeddings..."}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ingested Documents & Chunk Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Documents Table */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span>Ingested Knowledge Base Documents ({documents.length})</span>
              </h3>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 border border-gray-200 rounded-xl bg-gray-50/50 text-center space-y-3">
                <FileText className="h-10 w-10 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">No policy documents ingested into the knowledge base yet.</p>
                <p className="text-xs text-gray-400">
                  Upload a PDF file above or click "Reload Sample Policies" to test immediately.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const isActive = activeDocId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive
                          ? "bg-blue-50/30 border-blue-500 shadow-xs"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 cursor-pointer" onClick={() => onSelectDocument(doc.id)}>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                            <span className="font-bold text-sm text-gray-900 truncate">{doc.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {doc.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              READY
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center space-x-1">
                              <Layers className="h-3.5 w-3.5 text-blue-600" />
                              <span>{doc.pageCount} Pages</span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              <Hash className="h-3.5 w-3.5 text-cyan-600" />
                              <span>{doc.chunkCount} Chunks</span>
                            </span>
                            <span>•</span>
                            <span>~{doc.totalTokensEstimate} Tokens</span>
                            <span>•</span>
                            <span>{formatBytes(doc.sizeBytes)}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => onSelectDocument(doc.id)}
                            className={`p-2 rounded-lg border text-xs font-semibold transition-colors flex items-center space-x-1 ${
                              isActive
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">View Chunks</span>
                          </button>

                          <button
                            onClick={() => onDeleteDocument(doc.id)}
                            className="p-2 text-gray-400 hover:text-red-600 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                            title="Delete Document & Chunks"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chunk Inspection Grid for Selected Document */}
          {activeDocId && selectedDocChunks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Extracted Chunks Preview ({selectedDocChunks.length})
                </h3>
                <span className="text-xs text-blue-600 font-mono font-semibold">
                  Vector Dim: {selectedDocChunks[0]?.embedding?.length || 768}d
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {selectedDocChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    onClick={() => setInspectChunk(chunk)}
                    className="p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-400 cursor-pointer transition-all space-y-2 group shadow-2xs"
                  >
                    <div className="flex justify-between items-center text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        Chunk #{chunk.chunkIndex + 1} (p.{chunk.pageNumber})
                      </span>
                      <span className="text-cyan-600 font-mono">~{chunk.tokenEstimate} tokens</span>
                    </div>

                    <p className="text-xs text-gray-700 line-clamp-3 font-sans leading-relaxed">
                      {chunk.text}
                    </p>

                    <div className="text-[10px] text-gray-400 flex justify-between items-center pt-1 border-t border-gray-100">
                      <span>{chunk.charLength} chars</span>
                      <span className="text-blue-600 font-semibold group-hover:underline">Inspect Vector →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chunk Modal */}
      <ChunkInspectorModal
        isOpen={!!inspectChunk}
        onClose={() => setInspectChunk(null)}
        chunk={inspectChunk}
      />
    </div>
  );
};
