import React from "react";
import { X, Sliders, Layers, Sparkles, Filter, Check } from "lucide-react";
import { RAGSettings, DocumentMeta } from "../types";

interface RAGSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RAGSettings;
  onUpdateSettings: (newSettings: RAGSettings) => void;
  documents: DocumentMeta[];
}

export const RAGSettingsModal: React.FC<RAGSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  documents,
}) => {
  if (!isOpen) return null;

  const toggleDocSelection = (docId: string) => {
    let updated: string[];
    if (settings.selectedDocIds.includes(docId)) {
      updated = settings.selectedDocIds.filter((id) => id !== docId);
    } else {
      updated = [...settings.selectedDocIds, docId];
    }
    onUpdateSettings({ ...settings, selectedDocIds: updated });
  };

  const selectAllDocs = () => {
    onUpdateSettings({ ...settings, selectedDocIds: [] });
  };

  const documentCategories = Array.from(new Set<string>(documents.map((d) => d.category || "General")));

  const filterByCategory = (cat: string) => {
    const idsInCategory = documents.filter((d) => (d.category || "General") === cat).map((d) => d.id);
    onUpdateSettings({ ...settings, selectedDocIds: idsInCategory });
  };

  const isCategoryActive = (cat: string) => {
    const idsInCategory = documents.filter((d) => (d.category || "General") === cat).map((d) => d.id);
    return (
      settings.selectedDocIds.length === idsInCategory.length &&
      idsInCategory.every((id) => settings.selectedDocIds.includes(id))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">RAG Search & Retrieval Parameters</h3>
              <p className="text-xs text-gray-500">Configure vector retrieval thresholds and LLM context window</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* RAG Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <div className="text-sm font-bold text-gray-900">Enable RAG Grounding</div>
              <div className="text-xs text-gray-500">
                Retrieve vector chunks from PDF database to contextualize responses
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ ...settings, enableRAG: !settings.enableRAG })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.enableRAG ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-xs ${
                  settings.enableRAG ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Top K Chunks Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label className="font-semibold text-gray-900">Top-K Chunks to Retrieve</label>
              <span className="font-bold text-blue-600 font-mono">{settings.topK} chunks</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.topK}
              onChange={(e) => onUpdateSettings({ ...settings, topK: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none"
            />
            <p className="text-xs text-gray-500">
              Higher K provides more context but increases LLM prompt length.
            </p>
          </div>

          {/* Similarity Threshold Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label className="font-semibold text-gray-900">Min Cosine Similarity Threshold</label>
              <span className="font-bold text-emerald-600 font-mono">
                {Math.round(settings.similarityThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.8"
              step="0.05"
              value={settings.similarityThreshold}
              onChange={(e) => onUpdateSettings({ ...settings, similarityThreshold: Number(e.target.value) })}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-lg appearance-none"
            />
            <p className="text-xs text-gray-500">
              Filters out vector chunks below this match percentage.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-900">Gemini LLM Model</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateSettings({ ...settings, model: "gemini-3.6-flash" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.model === "gemini-3.6-flash"
                    ? "bg-blue-50 border-blue-500 text-gray-900 shadow-2xs"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="font-bold text-xs text-blue-600 mb-1 flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>gemini-3.6-flash</span>
                </div>
                <div className="text-[11px] text-gray-500">Fast, low latency RAG reasoning</div>
              </button>

              <button
                onClick={() => onUpdateSettings({ ...settings, model: "gemini-3.1-pro-preview" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  settings.model === "gemini-3.1-pro-preview"
                    ? "bg-blue-50 border-blue-500 text-gray-900 shadow-2xs"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="font-bold text-xs text-blue-600 mb-1 flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>gemini-3.1-pro</span>
                </div>
                <div className="text-[11px] text-gray-500">High precision complex reasoning</div>
              </button>
            </div>
          </div>

          {/* Document Scope Filter */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Target Ingested Documents</span>
                </label>
                <button
                  onClick={selectAllDocs}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  {settings.selectedDocIds.length === 0 ? "All Docs Selected" : "Select All"}
                </button>
              </div>

              {/* Category Quick Filters */}
              <div className="flex flex-wrap gap-1.5">
                {documentCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => filterByCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                      isCategoryActive(cat)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 space-y-1 max-h-36 overflow-y-auto">
                {documents.map((doc) => {
                  const isSelected =
                    settings.selectedDocIds.length === 0 || settings.selectedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleDocSelection(doc.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? "bg-white text-gray-900 border border-blue-200 font-semibold shadow-2xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      <span className="truncate max-w-[200px]">{doc.name}</span>
                      <span className="flex items-center space-x-1.5 shrink-0">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {doc.category}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
