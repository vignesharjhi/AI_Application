import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle,
  FileText,
  SlidersHorizontal,
  Info,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookOpen,
  Copy,
  Check,
  AlertCircle,
  Globe,
  CloudSun,
  DollarSign,
  Clock,
  ExternalLink,
} from "lucide-react";
import { ChatMessage, RAGSettings, DocumentChunk } from "../types";
import { ChunkInspectorModal } from "./ChunkInspectorModal";

// Maps backend tool names to their display icon in the "Tools Used" badge row.
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Globe,
  get_weather: CloudSun,
  convert_currency: DollarSign,
  get_current_datetime: Clock,
};

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  settings: RAGSettings;
  onUpdateSettings: (newSettings: RAGSettings) => void;
  onOpenSettings: () => void;
  onResetChat: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  isLoading,
  settings,
  onUpdateSettings,
  onOpenSettings,
  onResetChat,
}) => {
  const [inputText, setInputText] = useState("");
  const [inspectChunk, setInspectChunk] = useState<{ chunk: DocumentChunk; similarity?: number } | null>(null);
  const [expandedChunksMessageId, setExpandedChunksMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText("");
    await onSendMessage(text);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full px-4 py-4">
      {/* Top Bar Banner / Quick Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3 flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            <span>LLM: {settings.model}</span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-gray-500">
            <span>Top-K: <strong className="text-gray-900">{settings.topK}</strong></span>
            <span>•</span>
            <span>Min Similarity: <strong className="text-gray-900">{Math.round(settings.similarityThreshold * 100)}%</strong></span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* RAG Quick Toggle */}
          <button
            onClick={() => onUpdateSettings({ ...settings, enableRAG: !settings.enableRAG })}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
              settings.enableRAG
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${settings.enableRAG ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span>RAG Grounding: {settings.enableRAG ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors shadow-xs"
            title="Configure RAG Parameters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onResetChat}
            className="p-1.5 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors shadow-xs"
            title="Reset Chat Session"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex space-x-3.5 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "assistant" && (
                <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
              )}

              <div className={`max-w-3xl space-y-2 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-gray-100 text-gray-900 border border-gray-200 rounded-tr-none"
                      : "bg-white text-gray-900 border border-gray-200 rounded-tl-none shadow-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans text-sm">
                    {msg.content}
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="mt-3 pt-2 border-t border-gray-200/80 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{msg.timestamp}</span>
                    {msg.sender === "assistant" && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="flex items-center space-x-1 text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* RAG Grounding Citations (for Assistant) */}
                {msg.sender === "assistant" && msg.citations && msg.citations.length > 0 && (
                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-blue-900">
                        <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                        <span>Retrieved Source Citations ({msg.citations.length})</span>
                      </div>

                      {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedChunksMessageId(
                              expandedChunksMessageId === msg.id ? null : msg.id
                            )
                          }
                          className="flex items-center space-x-1 text-xs text-blue-700 hover:text-blue-900 font-semibold"
                        >
                          <span>{expandedChunksMessageId === msg.id ? "Hide Chunks" : "View Scores"}</span>
                          {expandedChunksMessageId === msg.id ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Citation Badges List */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.citations.map((cit, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (msg.retrievedChunks && msg.retrievedChunks[idx]) {
                              setInspectChunk({
                                chunk: msg.retrievedChunks[idx].chunk,
                                similarity: msg.retrievedChunks[idx].similarity,
                              });
                            }
                          }}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-xs text-gray-700 hover:border-blue-400 hover:bg-blue-50/50 shadow-2xs transition-all group"
                        >
                          <FileText className="h-3 w-3 text-blue-600" />
                          <span className="font-semibold truncate max-w-[150px] text-gray-900">{cit.docName}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-500">p.{cit.pageNumber}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {Math.round(cit.similarity * 100)}%
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Expanded Chunk Details */}
                    {expandedChunksMessageId === msg.id && msg.retrievedChunks && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-blue-200/60 text-xs">
                        {msg.retrievedChunks.map((res, cIdx) => (
                          <div key={cIdx} className="p-2.5 bg-white rounded-lg border border-gray-200 space-y-1">
                            <div className="flex justify-between text-[11px] text-gray-500">
                              <span className="font-semibold text-gray-900">
                                #{cIdx + 1} {res.chunk.docName} (Page {res.chunk.pageNumber})
                              </span>
                              <span className="font-mono text-emerald-600 font-bold">
                                Cosine: {Math.round(res.similarity * 100)}%
                              </span>
                            </div>
                            <p className="text-gray-700 italic line-clamp-2">"{res.chunk.text}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* External Tool Calls (Web Search / Weather / Currency / DateTime) */}
                {msg.sender === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="bg-violet-50/50 p-3 rounded-xl border border-violet-200/80 space-y-2">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-violet-900">
                      <Globe className="h-3.5 w-3.5 text-violet-600" />
                      <span>External Tools Used ({msg.toolCalls.length})</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {msg.toolCalls.map((call, idx) => {
                        const ToolIcon = TOOL_ICONS[call.tool] || Globe;
                        return (
                          <div
                            key={idx}
                            className="flex flex-col gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-violet-200 text-xs shadow-2xs"
                          >
                            <div className="flex items-center space-x-1.5">
                              <ToolIcon className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                              <span className="font-semibold text-gray-900">{call.tool}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500 truncate">{call.input}</span>
                            </div>
                            <p className="text-gray-700">{call.summary}</p>
                            {call.sourceUrls && call.sourceUrls.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-0.5">
                                {call.sourceUrls.map((src, sIdx) => (
                                  <a
                                    key={sIdx}
                                    href={src.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-1 text-[11px] text-violet-700 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span className="truncate max-w-[180px]">{src.title}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === "user" && (
                <div className="h-9 w-9 rounded-xl bg-gray-200 flex items-center justify-center text-gray-700 shrink-0 border border-gray-300">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex space-x-3.5 justify-start">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 animate-pulse">
              <Bot className="h-5 w-5" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm flex items-center space-x-3 shadow-xs">
              <div className="flex space-x-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {settings.enableRAG ? "Searching vector store & synthesizing context..." : "Calling Gemini..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="mt-3 relative">
        <div className="relative flex items-center bg-white border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl shadow-xs transition-all p-1.5">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              settings.enableRAG
                ? "Ask a question about your documents..."
                : "Ask Gemini anything (Direct LLM mode)..."
            }
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs flex items-center justify-center shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>

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
