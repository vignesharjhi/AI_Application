import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ChatView } from "./components/ChatView";
import { IngestionView } from "./components/IngestionView";
import { VectorExplorerView } from "./components/VectorExplorerView";
import { RAGSettingsModal } from "./components/RAGSettingsModal";
import {
  DocumentMeta,
  DocumentChunk,
  VectorStoreStats,
  RAGSettings,
  ChatMessage,
  IngestionProgress,
  VectorSearchResult,
} from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "ingestion" | "explorer">("chat");
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<VectorStoreStats | null>(null);
  const [selectedDocChunks, setSelectedDocChunks] = useState<DocumentChunk[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState<IngestionProgress | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [settings, setSettings] = useState<RAGSettings>({
    topK: 4,
    similarityThreshold: 0.2,
    chunkSize: 600,
    chunkOverlap: 100,
    model: "gemini-3.6-flash",
    enableRAG: true,
    selectedDocIds: [],
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Initial Data Fetching
  const fetchDocumentsAndStats = async () => {
    try {
      const [docsRes, statsRes, categoriesRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/vector/stats"),
        fetch("/api/categories"),
      ]);

      const docsData = await docsRes.json();
      const statsData = await statsRes.json();
      const categoriesData = await categoriesRes.json();

      if (docsData.success) {
        setDocuments(docsData.documents || []);
        if (docsData.documents && docsData.documents.length > 0 && !activeDocId) {
          setActiveDocId(docsData.documents[0].id);
        }
      }

      if (statsData.success) {
        setStats(statsData.stats);
      }

      if (categoriesData.success) {
        setCategories(categoriesData.categories || []);
      }
    } catch (err) {
      console.error("Error fetching documents or vector stats:", err);
    }
  };

  useEffect(() => {
    fetchDocumentsAndStats();
  }, []);

  // Fetch Chunks for selected document
  const handleSelectDocument = async (docId: string) => {
    setActiveDocId(docId);
    try {
      const res = await fetch("/api/vector/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "a", topK: 100, similarityThreshold: 0.0, selectedDocIds: [docId] }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        const chunks = data.results.map((r: any) => r.chunk);
        setSelectedDocChunks(chunks);
      }
    } catch (err) {
      console.error("Error fetching document chunks:", err);
    }
  };

  useEffect(() => {
    if (activeDocId) {
      handleSelectDocument(activeDocId);
    }
  }, [activeDocId]);

  // Handle PDF / TXT File Upload
  const handleUploadDocument = async (file: File, chunkSize: number, chunkOverlap: number, category: string) => {
    setIsIngesting(true);
    setIngestionProgress({
      step: "parsing",
      progressPercent: 20,
      message: `Parsing document: ${file.name}...`,
    });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        const base64Content = (reader.result as string).split(",")[1];

        setIngestionProgress({
          step: "chunking",
          progressPercent: 50,
          message: `Splitting text into overlapping chunks (${chunkSize} chars)...`,
        });

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileBase64: base64Content,
            category,
            chunkSize,
            chunkOverlap,
          }),
        });

        setIngestionProgress({
          step: "embedding",
          progressPercent: 80,
          message: "Generating Gemini vector embeddings & indexing into Knowledge Base...",
        });

        const data = await res.json();
        if (data.success) {
          setIngestionProgress({
            step: "completed",
            progressPercent: 100,
            message: "Document successfully vectorized and indexed!",
          });

          await fetchDocumentsAndStats();
          if (data.document?.id) {
            setActiveDocId(data.document.id);
          }
        } else {
          alert(`Upload failed: ${data.error}`);
        }
        setIsIngesting(false);
      };
    } catch (err: any) {
      alert(`Failed to upload document: ${err.message}`);
      setIsIngesting(false);
    }
  };

  // Handle Direct Text Upload
  const handleUploadRawText = async (title: string, text: string, chunkSize: number, chunkOverlap: number, category: string) => {
    setIsIngesting(true);
    setIngestionProgress({
      step: "chunking",
      progressPercent: 40,
      message: "Parsing text and generating overlapping chunks...",
    });

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: title.endsWith(".txt") ? title : `${title}.txt`,
          fileType: "text/plain",
          rawText: text,
          category,
          chunkSize,
          chunkOverlap,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIngestionProgress({
          step: "completed",
          progressPercent: 100,
          message: "Text document successfully vectorized!",
        });
        await fetchDocumentsAndStats();
        if (data.document?.id) {
          setActiveDocId(data.document.id);
        }
      } else {
        alert(`Text ingestion failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Text ingestion failed: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Document Delete
  const handleDeleteDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await fetchDocumentsAndStats();
        if (activeDocId === docId) {
          setActiveDocId(null);
          setSelectedDocChunks([]);
        }
      }
    } catch (err) {
      console.error("Delete document failed:", err);
    }
  };

  // Load Sample PDFs
  const handleLoadSampleDocs = async () => {
    setIsIngesting(true);
    try {
      await fetchDocumentsAndStats();
      if (documents.length > 0) {
        setActiveDocId(documents[0].id);
      }
    } catch (err) {
      console.error("Error loading sample docs:", err);
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Send Chat Message
  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: "msg_" + Date.now(),
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          query: text,
          topK: settings.topK,
          similarityThreshold: settings.similarityThreshold,
          model: settings.model,
          enableRAG: settings.enableRAG,
          selectedDocIds: settings.selectedDocIds,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const botMsg: ChatMessage = {
          id: "msg_" + (Date.now() + 1),
          sender: "assistant",
          content: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          citations: data.citations,
          retrievedChunks: data.retrievedChunks,
          toolCalls: data.toolCalls,
          ragEnabled: data.ragEnabled,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: "msg_err_" + Date.now(),
          sender: "assistant",
          content: `Error processing query: ${data.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: "msg_err_" + Date.now(),
        sender: "assistant",
        content: `Network or Server Error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Perform Standalone Vector Search
  const handlePerformSearch = async (
    query: string,
    topK: number,
    threshold: number
  ): Promise<VectorSearchResult[]> => {
    const res = await fetch("/api/vector/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK, similarityThreshold: threshold }),
    });
    const data = await res.json();
    return data.results || [];
  };

  // Clear Vector Store
  const handleClearDatabase = async () => {
    if (window.confirm("Are you sure you want to clear all documents and vector embeddings from the database?")) {
      await fetch("/api/vector/clear", { method: "POST" });
      setDocuments([]);
      setStats(null);
      setSelectedDocChunks([]);
      setActiveDocId(null);
      await fetchDocumentsAndStats();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased flex flex-col">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onOpenSettings={() => setIsSettingsOpen(true)}
        ragEnabled={settings.enableRAG}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === "chat" && (
          <ChatView
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            settings={settings}
            onUpdateSettings={setSettings}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onResetChat={() => setMessages([])}
          />
        )}

        {activeTab === "ingestion" && (
          <IngestionView
            documents={documents}
            categories={categories}
            onUploadDocument={handleUploadDocument}
            onUploadRawText={handleUploadRawText}
            onDeleteDocument={handleDeleteDocument}
            onLoadSampleDocs={handleLoadSampleDocs}
            isIngesting={isIngesting}
            ingestionProgress={ingestionProgress}
            selectedDocChunks={selectedDocChunks}
            onSelectDocument={handleSelectDocument}
            activeDocId={activeDocId}
          />
        )}

        {activeTab === "explorer" && (
          <VectorExplorerView
            stats={stats}
            onClearDatabase={handleClearDatabase}
            onPerformSearch={handlePerformSearch}
          />
        )}
      </main>

      {/* RAG Settings Modal */}
      <RAGSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        documents={documents}
      />
    </div>
  );
}
