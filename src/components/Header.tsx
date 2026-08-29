import React from "react";
import { Database, FileText, MessageSquareText, SlidersHorizontal, Sparkles, Cpu } from "lucide-react";
import { VectorStoreStats } from "../types";

interface HeaderProps {
  activeTab: "chat" | "ingestion" | "explorer";
  setActiveTab: (tab: "chat" | "ingestion" | "explorer") => void;
  stats: VectorStoreStats | null;
  onOpenSettings: () => void;
  ragEnabled: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onOpenSettings,
  ragEnabled,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 text-gray-900 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base text-gray-900 tracking-tight">Knowledge Repo</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  IT Company
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                HR, Leave & IT Policies • Categorized Documents • Grounded Q&A Chat
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "chat"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              <MessageSquareText className="h-4 w-4" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => setActiveTab("ingestion")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "ingestion"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Documents</span>
              {stats && stats.totalDocs > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-blue-100 text-blue-700 rounded-full font-bold">
                  {stats.totalDocs}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "explorer"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
              }`}
            >
              <Database className="h-4 w-4" />
              <span className="hidden md:inline">Vector DB</span>
              <span className="md:hidden">DB</span>
              {stats && stats.totalChunks > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-gray-200 text-gray-700 rounded-full font-bold">
                  {stats.totalChunks}
                </span>
              )}
            </button>
          </nav>

          {/* Quick Metrics & Settings */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-3 text-xs bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-1.5 text-gray-700">
                <Cpu className="h-3.5 w-3.5 text-blue-600" />
                <span>{stats?.vectorDimensions || 768}d Embeddings</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${ragEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span className="text-gray-700 font-medium">{ragEnabled ? "RAG Active" : "Direct LLM"}</span>
              </div>
            </div>

            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors shadow-xs"
              title="RAG Retrieval Settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
