import React from "react";
import { X, FileText, Hash, Layers, CheckCircle, ExternalLink, Activity } from "lucide-react";
import { DocumentChunk } from "../types";

interface ChunkInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chunk: DocumentChunk | null;
  similarity?: number;
}

export const ChunkInspectorModal: React.FC<ChunkInspectorModalProps> = ({
  isOpen,
  onClose,
  chunk,
  similarity,
}) => {
  if (!isOpen || !chunk) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Vector Chunk Inspector</h3>
              <p className="text-xs text-gray-500">
                Chunk #{chunk.chunkIndex + 1} from <span className="text-gray-900 font-semibold">{chunk.docName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Page Number</div>
              <div className="text-sm font-semibold text-gray-900 flex items-center space-x-1">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                <span>Page {chunk.pageNumber}</span>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Token Estimate</div>
              <div className="text-sm font-semibold text-gray-900 flex items-center space-x-1">
                <Hash className="h-3.5 w-3.5 text-cyan-600" />
                <span>~{chunk.tokenEstimate} tokens</span>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Length</div>
              <div className="text-sm font-semibold text-gray-900">
                {chunk.charLength} chars
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Cosine Match</div>
              <div className="text-sm font-bold text-emerald-600 flex items-center space-x-1">
                <Activity className="h-3.5 w-3.5" />
                <span>{similarity !== undefined ? `${Math.round(similarity * 100)}%` : "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Chunk Text Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Extracted Raw Context Text
            </label>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-sans font-normal">
              {chunk.text}
            </div>
          </div>

          {/* Embedding Vector Sample */}
          {chunk.embedding && chunk.embedding.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Vector Embedding ({chunk.embedding.length} Dimensions)
                </label>
                <span className="text-[11px] text-blue-600 font-mono font-semibold">
                  L2 Normalized float32
                </span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-[11px] text-gray-600 overflow-x-auto max-h-28 whitespace-pre-wrap">
                [{chunk.embedding.slice(0, 32).map((val) => val.toFixed(4)).join(", ")}, ...]
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Indexed in Knowledge Base</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
