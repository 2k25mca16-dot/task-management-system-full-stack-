"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ChatMessage = {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
};

function mergeChatMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messagesById = new Map<string, ChatMessage>();
  [...current, ...incoming].forEach((message) => {
    messagesById.set(String(message.id), message);
  });
  return [...messagesById.values()].sort(
    (first, second) =>
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );
}

export default function TeamDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("tasks");
  const [form, setForm] = useState({ name: "", assignedTo: "" });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatRecipient, setChatRecipient] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [loggedUser, setLoggedUser] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const [completionForm, setCompletionForm] = useState({
    note: "",
    file: null as File | null,
  });
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleSignOut = () => {
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("loggedUser") || "";
      setLoggedUser(user.trim());
      loadTasks(user.trim());
    }
  }, []);

  // LOAD USERS
  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {});
  }, []);

  // LOAD TASKS & REQUESTS FROM API
  const loadTasks = (userEmailOverride?: string) => {
    const emailToMatch = (
      userEmailOverride ||
      loggedUser ||
      (typeof window !== "undefined" ? localStorage.getItem("loggedUser") : "") ||
      ""
    ).trim().toLowerCase();

    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        const isMyTask = (t: any) =>
          t.assignedTo &&
          emailToMatch &&
          t.assignedTo.trim().toLowerCase() === emailToMatch &&
          t.type !== "request";

        const isMyRequest = (t: any) =>
          t.assignedBy &&
          emailToMatch &&
          t.assignedBy.trim().toLowerCase() === emailToMatch &&
          t.type === "request";

        setTasks(data.filter(isMyTask));
        setMyRequests(data.filter(isMyRequest));
      })
      .catch((err) => console.error("Failed to load tasks:", err));
  };

  const managerUsers = users
    .filter((u: any) => u.role?.toLowerCase() === "manager")
    .filter(
      (user: any, index: number, filteredUsers: any[]) =>
        !user.email ||
        filteredUsers.findIndex(
          (candidate: any) =>
            candidate.email?.trim().toLowerCase() ===
            user.email.trim().toLowerCase()
        ) === index
    );

  const chatRecipients = managerUsers;
  const defaultChatRecipient = chatRecipients[0]?.email;

  const isMatch = (a?: string, b?: string) =>
    Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

  const activeUser = (
    loggedUser ||
    (typeof window !== "undefined" ? localStorage.getItem("loggedUser") || "" : "")
  ).trim();

  const chatHistory = chatMessages.filter(
    (msg: any) =>
      (isMatch(msg.sender, activeUser) && isMatch(msg.recipient, chatRecipient)) ||
      (isMatch(msg.sender, chatRecipient) && isMatch(msg.recipient, activeUser))
  );

  useEffect(() => {
    if (!chatRecipient && defaultChatRecipient) {
      setChatRecipient(defaultChatRecipient);
    }
    if (!form.assignedTo && defaultChatRecipient) {
      setForm((prev) => ({ ...prev, assignedTo: prev.assignedTo || defaultChatRecipient }));
    }
  }, [chatRecipient, defaultChatRecipient, form.assignedTo]);

  // POLLING CHAT
  useEffect(() => {
    if (activeTab !== "chat") return;

    let cancelled = false;
    setChatLoading(true);
    const loadChatMessages = async () => {
      try {
        const response = await fetch("/api/chat", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load chat messages.");
        }
        const messages = await response.json();
        if (!Array.isArray(messages)) {
          throw new Error("The chat service returned invalid messages.");
        }
        if (!cancelled) {
          setChatMessages((previous) => mergeChatMessages(previous, messages));
          setChatError("");
        }
      } catch (error) {
        console.error("Failed to load chat messages:", error);
        if (!cancelled) setChatError("Unable to load messages. Please try again.");
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    };

    void loadChatMessages();
    const refreshTimer = window.setInterval(loadChatMessages, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [activeTab]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    const currentUser = (
      loggedUser ||
      (typeof window !== "undefined" ? localStorage.getItem("loggedUser") || "" : "") ||
      ""
    ).trim();

    if (!currentUser) {
      setChatError("You must be logged in to send chat messages.");
      return;
    }

    if (!chatRecipient) {
      setChatError("Please select a manager to chat with.");
      return;
    }

    if (!text) return;

    setChatSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUser,
          recipient: chatRecipient,
          text,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to deliver message.");
      }

      const result = await response.json();
      setChatMessages((previous) => mergeChatMessages(previous, [result]));
      setChatInput("");
      setChatError("");
    } catch (error: any) {
      console.error("Failed to send chat message:", error);
      setChatError(error?.message || "Unable to send your message. Please try again.");
    } finally {
      setChatSending(false);
    }
  };

  // SEND REQUEST TO MANAGER
  const sendRequest = async () => {
    if (!form.name.trim()) return;

    const newRequest = {
      id: Date.now(),
      name: form.name.trim(),
      priority: "Medium",
      status: "Pending",
      completed: false,
      assignedTo: form.assignedTo || defaultChatRecipient || "",
      assignedBy: loggedUser,
      type: "request",
    };

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRequest),
    });

    setForm({ name: "", assignedTo: defaultChatRecipient || "" });
    loadTasks();
  };

  // COMPLETE / SUBMIT TASK DELIVERABLE
  const submitCompletion = async () => {
    if (!completingTask) return;
    setIsSubmittingFile(true);
    setUploadError("");

    try {
      let fileMeta: any = {
        hasFile: completingTask.hasFile || false,
        fileName: completingTask.fileName || "",
        fileUrl: completingTask.fileUrl || "",
        fileSize: completingTask.fileSize || "",
        fileType: completingTask.fileType || "",
      };

      if (completionForm.file) {
        const formData = new FormData();
        formData.append("file", completionForm.file);
        formData.append("taskId", String(completingTask.id));

        const uploadRes = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || "File upload failed.");
        }

        const uploadData = await uploadRes.json();
        fileMeta = {
          hasFile: true,
          fileName: uploadData.fileName,
          fileUrl: uploadData.fileUrl,
          fileSize: uploadData.fileSize,
          fileType: uploadData.fileType,
        };
      }

      const updatedTask = {
        ...completingTask,
        status: "Completed",
        completed: true,
        completionNote: completionForm.note || completingTask.completionNote || "",
        reviewStatus: "Pending Review",
        ...fileMeta,
      };

      const putRes = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTask),
      });

      if (!putRes.ok) {
        throw new Error("Failed to update task milestone.");
      }

      setCompletingTask(null);
      setCompletionForm({ note: "", file: null });
      setUploadError("");
      loadTasks();
    } catch (err: any) {
      console.error("Submission failed:", err);
      setUploadError(err.message || "Failed to submit milestone.");
    } finally {
      setIsSubmittingFile(false);
    }
  };

  const getTaskStatus = (task: { status?: string; completed?: boolean }) => {
    const status = String(task.status || "").trim().toLowerCase();
    if (task.completed || status === "completed") return "Completed";
    if (["in progress", "in-progress", "in_progress", "started", "active"].includes(status)) return "In progress";
    if (status === "changes requested") return "Changes requested";
    if (status === "paused") return "Paused";
    return "Pending";
  };

  const taskStatusGroups = [
    {
      label: "Pending",
      color: "bg-amber-500",
      count: tasks.filter((task: { status?: string; completed?: boolean }) => getTaskStatus(task) === "Pending").length,
    },
    {
      label: "In progress",
      color: "bg-blue-500",
      count: tasks.filter((task: { status?: string; completed?: boolean }) => getTaskStatus(task) === "In progress").length,
    },
    {
      label: "Changes requested",
      color: "bg-orange-500",
      count: tasks.filter((task: { status?: string; completed?: boolean }) => getTaskStatus(task) === "Changes requested").length,
    },
    {
      label: "Paused",
      color: "bg-slate-400",
      count: tasks.filter((task: { status?: string; completed?: boolean }) => getTaskStatus(task) === "Paused").length,
    },
    {
      label: "Completed",
      color: "bg-emerald-500",
      count: tasks.filter((task: { status?: string; completed?: boolean }) => getTaskStatus(task) === "Completed").length,
    },
  ];

  const taskChartMax = Math.max(4, ...taskStatusGroups.map((group) => group.count));
  const taskChartTicks = [taskChartMax, Math.ceil(taskChartMax * 0.75), Math.ceil(taskChartMax * 0.5), Math.ceil(taskChartMax * 0.25), 0];

  const dashboardCards = [
    { label: "My Tasks", value: tasks.length, icon: "📋", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    {
      label: "Completed",
      value: tasks.filter((t: any) => t.completed).length,
      icon: "✓",
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200"
    },
    {
      label: "Pending",
      value: tasks.filter((t: any) => !t.completed).length,
      icon: "⏳",
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200"
    },
    { label: "My Requests", value: myRequests.length, icon: "📩", color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  ];

  return (
    <div className="flex h-screen bg-[#edf5ff] text-slate-900 font-sans overflow-hidden relative selection:bg-blue-600 selection:text-white">
      {/* ── Advanced Architectural Geometric Background (Elevated Signature) ── */}
      {/* Layer 1: Ambient Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.98),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.14),transparent_50%)] pointer-events-none z-0"></div>

      {/* Layer 1B: Subtle Black Shade & Moody Vignette Overlays */}
      <div className="absolute inset-0 bg-slate-950/[0.06] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(15,23,42,0.16)_100%)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.03] via-transparent to-black/[0.10] pointer-events-none z-0"></div>

      {/* Layer 2: Precision Architectural Grid Matrix */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_85%_65%_at_50%_35%,#000_65%,transparent_100%)] pointer-events-none z-0"></div>

      {/* Layer 3: Ambient Color Glow Orbs */}
      <div className="absolute -top-16 -right-16 w-[450px] h-[450px] bg-gradient-to-br from-blue-300/25 via-sky-200/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute -bottom-24 left-[8%] w-[620px] h-[620px] bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Layer 4: Concentric Rotated Diamonds - Top Right */}
      <div className="absolute top-[-12%] right-[-6%] w-[420px] h-[420px] border-[32px] border-white/80 rounded-[56px] shadow-[0_20px_50px_rgba(15,23,42,0.06)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute top-[-6%] right-[-1%] w-[280px] h-[280px] border-[18px] border-slate-200/75 rounded-[40px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.85)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[3%] right-[7%] w-[120px] h-[120px] border-[6px] border-blue-400/30 bg-white/40 rounded-[22px] backdrop-blur-sm transform rotate-45 pointer-events-none z-0 shadow-sm"></div>

      {/* Layer 5: Concentric Rotated Diamonds - Bottom Left */}
      <div className="absolute bottom-[-16%] left-[9%] w-[620px] h-[620px] border-[48px] border-white/80 rounded-[76px] shadow-[0_30px_70px_rgba(15,23,42,0.07)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute bottom-[-8%] left-[15%] w-[440px] h-[440px] border-[24px] border-slate-200/70 rounded-[52px] shadow-[inset_0_6px_20px_rgba(255,255,255,0.9)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute bottom-[2%] left-[21%] w-[190px] h-[190px] border-[8px] border-slate-200/50 bg-gradient-to-br from-white/40 to-transparent rounded-[30px] transform rotate-45 pointer-events-none z-0 backdrop-blur-sm"></div>

      {/* Layer 6: Floating Accent Geometric Markers */}
      <div className="absolute top-[42%] right-[2.5%] w-20 h-20 border-[3px] border-slate-300/35 rounded-2xl transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[49%] right-[5%] w-10 h-10 border-[2px] border-blue-400/40 bg-blue-500/5 rounded-lg transform rotate-45 pointer-events-none z-0"></div>

      {/* Modern Executive Sidebar */}
      <aside className="w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200/90 flex flex-col p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-blue-950 to-blue-700 shadow-md shadow-blue-950/20 flex items-center justify-center text-lg font-black text-white ring-2 ring-blue-500/20">
            T
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight leading-none">Task Management</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              Team Member
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
            { id: "tasks", label: "My Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
            { id: "requests", label: "Send Request", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
            { id: "chat", label: "Chat with Manager", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
            { id: "directory", label: "Colleagues", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-4 py-2.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-between text-sm ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 ${activeTab === tab.id ? "text-blue-400" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </div>
              {tab.id === "tasks" && tasks.length > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-md font-extrabold ${activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {tasks.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200/80">
          <div className="px-3 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200/70 mb-3">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Member</p>
            <p className="text-xs font-bold text-slate-800 truncate" title={loggedUser}>{loggedUser}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full px-4 py-2.5 bg-slate-200/80 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-xs border border-transparent hover:border-rose-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-10 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ══════════════════════════════════════════════
              DASHBOARD TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-8">
              <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-blue-950/20 border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-400/30">
                        Member Workspace
                      </span>
                      {mounted && (
                        <span suppressHydrationWarning className="text-slate-400 text-xs font-semibold">
                          • {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">
                      My Productivity Dashboard
                    </h1>
                    <p className="text-slate-300 mt-2 text-sm max-w-xl">
                      Review assigned deliverables, complete deadlines, and stay connected with your team leader.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all text-xs"
                    >
                      View Assigned Tasks →
                    </button>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {dashboardCards.map((card, i) => (
                  <div
                    key={i}
                    className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-800 transition-colors">
                        {card.label}
                      </span>
                      <span className={`w-10 h-10 rounded-xl ${card.bg} ${card.color} flex items-center justify-center font-bold text-sm border ${card.border}`}>
                        {card.icon}
                      </span>
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tight">{card.value}</h3>
                  </div>
                ))}
              </div>

              <section
                aria-labelledby="task-status-heading"
                className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-sm sm:p-8"
              >
                <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
                      Task overview
                    </p>
                    <h2 id="task-status-heading" className="mt-1 text-xl font-black tracking-tight text-slate-900">
                      Tasks by status
                    </h2>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    {tasks.length} {tasks.length === 1 ? "task" : "tasks"} assigned
                  </p>
                </div>

                <div
                  className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-x-4"
                  role="img"
                  aria-label={`Vertical bar chart of your assigned tasks by status. ${taskStatusGroups.map((group) => `${group.label}: ${group.count}`).join(", ")}.`}
                >
                  <div className="relative h-52 text-right text-[10px] font-semibold tabular-nums text-slate-400 sm:text-xs" aria-hidden="true">
                    {taskChartTicks.map((tick, index) => (
                      <span
                        key={`${tick}-${index}`}
                        className="absolute right-0 -translate-y-1/2"
                        style={{ top: `${index * 25}%` }}
                      >
                        {tick}
                      </span>
                    ))}
                  </div>
                  <div>
                    <div className="relative h-52 border-b border-slate-200">
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                        {taskChartTicks.map((tick, index) => (
                          <div key={`${tick}-${index}`} className="w-full border-t border-dashed border-slate-200" />
                        ))}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 grid h-full grid-cols-5 gap-2 px-1 sm:gap-6 sm:px-3">
                        {taskStatusGroups.map((group) => {
                          const percentage = (group.count / taskChartMax) * 100;

                          return (
                            <div
                              key={group.label}
                              className="group relative flex h-full flex-col items-center justify-end"
                              aria-label={`${group.label}: ${group.count}`}
                            >
                              <span
                                className="absolute z-10 -translate-y-full text-xs font-black tabular-nums text-slate-700 transition-all duration-200 group-hover:-translate-y-1 group-hover:text-blue-700 sm:text-sm"
                                style={{ bottom: `calc(${percentage}% + 6px)` }}
                              >
                                {group.count}
                              </span>
                              <div
                                className={`w-full max-w-14 origin-bottom rounded-t-lg ${group.color} shadow-sm transition-[height,filter,transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:scale-x-110 hover:brightness-110 hover:shadow-lg`}
                                style={{ height: `${percentage}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 px-1 pt-3 text-center sm:gap-6 sm:px-3">
                      {taskStatusGroups.map((group) => (
                        <span key={group.label} className="text-[10px] font-bold leading-tight text-slate-600 sm:text-xs">
                          {group.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {tasks.length === 0 && (
                  <p className="mt-5 text-center text-sm text-slate-500">
                    Your task status graph will appear when tasks are assigned to you.
                  </p>
                )}
              </section>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              MY TASKS TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-blue-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-300 font-bold">Assigned Queue</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Assigned Deliverables</h1>
                <p className="text-slate-300 mt-2 text-sm">Review your responsibilities and submit completed milestones.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Task List ({tasks.length})</h3>
                  <button onClick={() => loadTasks()} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    Refresh List ↻
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Task Name</th>
                        <th className="py-3.5 px-6">Priority</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6">Deliverable & Review</th>
                        <th className="py-3.5 px-6">Due Date</th>
                        <th className="py-3.5 px-6 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {tasks.map((task: any) => (
                        <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            <span className={task.completed ? "text-slate-700" : ""}>{task.name}</span>
                            {task.secondaryAssignee && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Backup: {task.secondaryAssignee}
                                </span>
                              </div>
                            )}
                            {task.completionNote && (
                              <p className="text-[11px] text-slate-500 mt-0.5 font-normal line-clamp-2">
                                Note: {task.completionNote}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : task.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              task.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : task.status === "Changes Requested" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1.5 items-start">
                              {task.hasFile && task.fileUrl ? (
                                <a
                                  href={task.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all shadow-sm"
                                  title="Click to download or preview"
                                >
                                  <span>📎</span>
                                  <span className="max-w-[140px] truncate">{task.fileName || "Download File"}</span>
                                  {task.fileSize && <span className="text-[10px] text-blue-500 font-normal">({task.fileSize})</span>}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No deliverable file</span>
                              )}

                              {task.reviewStatus && (
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  task.reviewStatus === "Approved"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : task.reviewStatus === "Changes Requested" || task.reviewStatus === "Needs Revision"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : task.reviewStatus === "Rejected"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse"
                                }`}>
                                  {task.reviewStatus === "Approved" ? "✓ Approved" : task.reviewStatus === "Changes Requested" ? "⚠ Revision Requested" : task.reviewStatus === "Pending Review" ? "⏳ Pending Review" : task.reviewStatus}
                                </span>
                              )}

                              {task.reviewComment && (
                                <div className="mt-1 p-2 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[11px] text-amber-900 max-w-xs shadow-xs">
                                  <span className="font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-800">
                                    💬 Manager Feedback {task.reviewedAt ? `(${task.reviewedAt})` : ""}:
                                  </span>
                                  <p className="mt-0.5 font-medium leading-relaxed">{task.reviewComment}</p>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-semibold text-xs whitespace-nowrap">{task.dueDate || "—"}</td>
                          <td className="py-4 px-6 text-center">
                            {!task.completed && task.status !== "Paused" ? (
                              <button
                                onClick={() => {
                                  setCompletingTask(task);
                                  setCompletionForm({ note: task.completionNote || "", file: null });
                                  setUploadError("");
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                              >
                                Complete & Upload ✓
                              </button>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-bold text-emerald-600">✓ Finished</span>
                                <button
                                  onClick={() => {
                                    setCompletingTask(task);
                                    setCompletionForm({ note: task.completionNote || "", file: null });
                                    setUploadError("");
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all"
                                  title="Upload revised file or update note"
                                >
                                  Update File ⟳
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">No tasks assigned to you right now.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              SEND REQUEST TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "requests" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-blue-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-300 font-bold">Manager Communication</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Send Request</h1>
                <p className="text-slate-300 mt-2 text-sm">Submit resource requests, blockers, or leave notices to leadership.</p>
              </header>

              {/* Form */}
              <div className="bg-white/95 p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">New Inbound Request</h3>
                  <span className="text-xs text-slate-400">Directly routed to manager</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-6">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Request Description *</label>
                    <input
                      placeholder="e.g. Leave request for Friday, Need AWS staging access..."
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && form.name.trim()) sendRequest();
                      }}
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Select Manager *</label>
                    <select
                      value={form.assignedTo}
                      onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Choose Manager</option>
                      {managerUsers.map((u: any, i) => (
                        <option key={i} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      onClick={sendRequest}
                      disabled={!form.name.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
                    >
                      Submit Request
                    </button>
                  </div>
                </div>
              </div>

              {/* Sent Requests Table */}
              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">Submitted Requests ({myRequests.length})</h3>
                  <button onClick={() => loadTasks()} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                    Refresh ↻
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Request Detail</th>
                        <th className="py-3.5 px-6">Addressed To</th>
                        <th className="py-3.5 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {myRequests.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">{r.name}</td>
                          <td className="py-4 px-6 text-slate-600 font-medium text-xs font-mono">{r.assignedTo}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              r.status === "Accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : r.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {r.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {myRequests.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400 font-medium">No requests submitted yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              CHAT TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "chat" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-blue-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-300 font-bold">Direct Messaging</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Manager Communication</h1>
                <p className="text-slate-300 mt-2 text-sm">Direct, real-time message stream with your managers.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <h3 className="text-sm font-black text-slate-900">Direct Chat</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Manager:</span>
                    <select
                      value={chatRecipient}
                      onChange={(e) => setChatRecipient(e.target.value)}
                      className="border border-slate-300 bg-white text-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Select manager</option>
                      {managerUsers.map((user: any) => (
                        <option key={user.email} value={user.email}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/30">
                  {chatError && (
                    <div className="p-2.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl text-center border border-rose-200">
                      {chatError}
                    </div>
                  )}

                  {chatLoading && chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 py-16 text-xs font-semibold">Connecting to conversation...</div>
                  ) : chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 py-16 text-xs font-semibold">
                      No messages yet with {chatRecipient || "manager"}. Start typing below!
                    </div>
                  ) : (
                    chatHistory.map((msg) => {
                      const isMe = isMatch(msg.sender, activeUser);
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`max-w-md px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm ${
                            isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                          }`}>
                            <p className="leading-relaxed">{msg.text}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 font-medium">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Input */}
                <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Message ${chatRecipient || "manager"}...`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatSending || !chatInput.trim()}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              DIRECTORY TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "directory" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-blue-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-300 font-bold">Organization Roster</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Colleague Directory</h1>
                <p className="text-slate-300 mt-2 text-sm">Find teammates and departmental leads.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Name</th>
                        <th className="py-3.5 px-6">Email Address</th>
                        <th className="py-3.5 px-6">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {users.map((u: any, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">{u.name || "Colleague"}</td>
                          <td className="py-4 px-6 text-slate-600 font-medium text-xs font-mono">{u.email}</td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm text-center border border-slate-200/80">
            <p className="text-slate-500 font-medium text-xs">
              &copy; {new Date().getFullYear()} Task Management System • Team Collaboration Workspace
            </p>
          </footer>
        </div>
      </main>

      {/* Completion Modal */}
      {completingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900">
                {completingTask.completed ? "Update Deliverable & Submission" : "Submit Deliverable & Complete"}
              </h2>
              <button
                disabled={isSubmittingFile}
                onClick={() => setCompletingTask(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200">
                {uploadError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Task Deliverable</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{completingTask.name}</p>
                {completingTask.hasFile && completingTask.fileName && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                    <span>📎 Currently attached:</span>
                    <span className="font-semibold">{completingTask.fileName}</span>
                    {completingTask.fileSize && <span className="text-[10px] text-blue-500">({completingTask.fileSize})</span>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Completion Notes / Comments</label>
                <textarea
                  rows={3}
                  value={completionForm.note}
                  onChange={(e) => setCompletionForm({ ...completionForm, note: e.target.value })}
                  placeholder="Summarize outcomes, changes made, or link to work..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  {completingTask.hasFile ? "Replace Deliverable File (Optional)" : "Upload Deliverable File"}
                </label>
                <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 transition-all bg-slate-50/50">
                  <input
                    type="file"
                    disabled={isSubmittingFile}
                    onChange={(e) => setCompletionForm({ ...completionForm, file: e.target.files ? e.target.files[0] : null })}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:transition-all file:cursor-pointer cursor-pointer"
                  />
                  {completionForm.file && (
                    <div className="mt-2 text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>✓ Ready to upload:</span>
                      <span className="text-blue-600">{completionForm.file.name}</span>
                      <span className="text-[10px] text-slate-400">({(completionForm.file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">Upload documents, PDFs, ZIP archives, images, spreadsheets, or code.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={submitCompletion}
                disabled={isSubmittingFile}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingFile ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <span>Submit Deliverable ✓</span>
                )}
              </button>
              <button
                onClick={() => setCompletingTask(null)}
                disabled={isSubmittingFile}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}