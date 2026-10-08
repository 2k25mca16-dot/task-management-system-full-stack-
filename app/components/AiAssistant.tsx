"use client";

import React, { useState, useEffect, useRef } from "react";

interface AiAssistantProps {
  role: "admin" | "manager" | string;
  loggedUser?: string;
  tasks?: any[];
  users?: any[];
  onTaskCreated?: () => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
}

export default function AiAssistant({
  role,
  loggedUser = "Executive",
  tasks = [],
  users = [],
  onTaskCreated,
}: AiAssistantProps) {
  const isAuthorized = role === "admin" || role === "manager";

  // Floating widget open state
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick Action Prompts
  const quickPrompts = [
    {
      label: "Project Status",
      icon: "📊",
      query: "Please summarize current project status, task completion rate, and open deliverables.",
    },
    {
      label: "Team Workload",
      icon: "👥",
      query: "Analyze current team workload and identify any members with too many pending tasks or potential bottlenecks.",
    },
    {
      label: "Task Breakdown",
      icon: "⚡",
      query: "Help me break down a new feature into phased subtasks with priorities and action steps.",
    },
    {
      label: "Team Announcement",
      icon: "📢",
      query: "Draft a professional team announcement reminding everyone to update their assigned tasks and flag any blockers.",
    },
    {
      label: "Risk Audit",
      icon: "⚠️",
      query: "Assess operational risks, high-priority tasks, and upcoming deadline bottlenecks.",
    },
  ];

  // Initialize welcome message
  useEffect(() => {
    if (!isAuthorized) return;

    const initialMessage: Message = {
      id: "welcome",
      sender: "ai",
      text: `### 🤖 AI Operations Assistant\n\nHello **${role.toUpperCase()}** (${loggedUser})!\n\nI am connected to your live Task Management database. I can analyze team workloads, summarize deliverables, break down features, and draft team announcements.\n\n*Choose a shortcut below or ask me any question:*`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages([initialMessage]);
  }, [role, loggedUser, isAuthorized]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  const handleSend = async (customQuery?: string) => {
    const textToSend = customQuery || input;
    if (!textToSend.trim() || loading || !isAuthorized) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customQuery) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend.trim(),
          role,
          userEmail: loggedUser,
          tasks,
          users,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.reply || "No reply generated. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      console.error("AI Assistant query failed:", err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `⚠️ **Error communicating with AI Assistant:** ${err.message || "Please check your network or try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    const initial: Message = {
      id: "welcome-cleared",
      sender: "ai",
      text: `### 🤖 AI Assistant Reset\n\nChat cleared. How can I assist your operations today, **${role.toUpperCase()}**?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([initial]);
  };

  // Render markdown helper
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split("\n");
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} className="text-sm font-black text-slate-900 mt-2 mb-1">
                {trimmed.replace("### ", "")}
              </h4>
            );
          }
          if (trimmed.startsWith("#### ")) {
            return (
              <h5 key={idx} className="text-xs font-bold text-slate-800 mt-1.5 mb-1">
                {trimmed.replace("#### ", "")}
              </h5>
            );
          }

          if (trimmed === "---") {
            return <hr key={idx} className="border-slate-200 my-1.5" />;
          }

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const content = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="text-[#ff5a1f] font-bold">•</span>
                <span>{renderInlineMarkdown(content)}</span>
              </div>
            );
          }

          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                <span className="font-bold text-[#ff5a1f] shrink-0">{numMatch[1]}.</span>
                <span>{renderInlineMarkdown(numMatch[2])}</span>
              </div>
            );
          }

          if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            if (trimmed.includes(":---") || trimmed.includes("---")) {
              return null;
            }
            const cells = trimmed.split("|").slice(1, -1);
            return (
              <div key={idx} className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-[11px]">
                {cells.map((cell, cIdx) => (
                  <div key={cIdx} className="font-medium text-slate-700">
                    {renderInlineMarkdown(cell.trim())}
                  </div>
                ))}
              </div>
            );
          }

          if (!trimmed) {
            return <div key={idx} className="h-0.5" />;
          }

          return <p key={idx}>{renderInlineMarkdown(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="bg-slate-200/80 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono font-bold">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  // Strictly hidden for non-manager and non-admin
  if (!isAuthorized) {
    return null;
  }

  return (
    <>
      {/* ── FLOATING ORANGE LAUNCHER BUTTON (Bottom Right) ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#ff5a1f] hover:bg-[#ff4500] text-white flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(255,90,31,0.5),0_8px_10px_-6px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
        style={{ borderRadius: "50% 14px 50% 50%" }}
        title={isOpen ? "Close AI Assistant" : "Open AI Assistant (Manager & Admin)"}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white fill-current drop-shadow-sm" viewBox="0 0 24 24">
            {/* Primary Advanced AI Flare Star */}
            <path d="M11 1.5C11 6.75 6.75 11 1.5 11C6.75 11 11 15.25 11 20.5C11 15.25 15.25 11 20.5 11C15.25 11 11 6.75 11 1.5Z" />
            {/* Secondary Companion AI Sparkle */}
            <path d="M18.5 1.5C18.5 3.43 16.93 5 15 5C16.93 5 18.5 6.57 18.5 8.5C18.5 6.57 20.07 5 22 5C20.07 5 18.5 3.43 18.5 1.5Z" />
            {/* Tertiary Micro-Sparkle */}
            <path d="M4.5 18C4.5 19.1 3.6 20 2.5 20C3.6 20 4.5 20.9 4.5 22C4.5 20.9 5.4 20 6.5 20C5.4 20 4.5 19.1 4.5 18Z" />
          </svg>
        )}
      </button>

      {/* ── FLOATING CHAT DIALOG (Bottom Right Popup) ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] sm:w-[420px] h-[580px] max-h-[calc(100vh-120px)] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.22)] border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <header className="bg-gradient-to-r from-[#ff5a1f] to-[#ff7a45] p-4 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg backdrop-blur-sm">
                ✨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white tracking-tight">AI Assistant</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white">
                    {role.toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-white/90 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  Connected to {tasks.length} Tasks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                title="Clear Chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all text-xs font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="w-7 h-7 rounded-lg hover:bg-white/10 text-white flex items-center justify-center text-lg font-bold transition-all"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Quick Prompts Carousel */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(qp.query)}
                disabled={loading}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 hover:border-orange-200 border border-slate-200 text-slate-700 hover:text-[#ff5a1f] text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50"
              >
                <span>{qp.icon}</span>
                <span>{qp.label}</span>
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#fbfcfd]">
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isUser
                        ? "bg-slate-900 text-white"
                        : "bg-[#ff5a1f] text-white shadow-xs"
                    }`}
                  >
                    {isUser ? (
                      role.charAt(0).toUpperCase()
                    ) : (
                      <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                        <path d="M11 2C11 6.5 6.5 11 2 11C6.5 11 11 15.5 11 20C11 15.5 15.5 11 20 11C15.5 11 11 6.5 11 2Z" />
                        <path d="M18 2C18 3.5 16.5 5 15 5C16.5 5 18 6.5 18 8C18 6.5 19.5 5 21 5C19.5 5 18 3.5 18 2Z" />
                      </svg>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-2xs relative group ${
                      isUser
                        ? "bg-[#ff5a1f] text-white rounded-tr-none text-xs font-medium"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 border-b border-black/5 pb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isUser ? "text-orange-100" : "text-[#ff5a1f]"}`}>
                        {isUser ? "You" : "Assistant"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] ${isUser ? "text-orange-100" : "text-slate-400"}`}>
                          {m.timestamp}
                        </span>
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.text, m.id)}
                            title="Copy text"
                            className="text-slate-400 hover:text-[#ff5a1f] transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100"
                          >
                            {copiedId === m.id ? (
                              <span className="text-[9px] font-bold text-emerald-600">Copied</span>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={isUser ? "text-white whitespace-pre-wrap" : "text-slate-800"}>
                      {isUser ? m.text : renderFormattedText(m.text)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#ff5a1f] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M11 2C11 6.5 6.5 11 2 11C6.5 11 11 15.5 11 20C11 15.5 15.5 11 20 11C15.5 11 11 6.5 11 2Z" />
                    <path d="M18 2C18 3.5 16.5 5 15 5C16.5 5 18 6.5 18 8C18 6.5 19.5 5 21 5C19.5 5 18 3.5 18 2Z" />
                  </svg>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-2xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a1f] animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a1f] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a1f] animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[11px] font-semibold text-slate-500 ml-1.5">
                    Analyzing...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <footer className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about tasks, workloads, plans..."
                disabled={loading}
                className="flex-1 bg-slate-50 focus:bg-white text-slate-900 font-semibold placeholder-slate-400 text-xs rounded-xl px-3.5 py-2.5 border border-slate-300 focus:ring-2 focus:ring-[#ff5a1f] focus:outline-none transition-all disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 bg-[#ff5a1f] hover:bg-[#ff4500] text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer text-xs shrink-0"
              >
                <span>Send</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  );
}
