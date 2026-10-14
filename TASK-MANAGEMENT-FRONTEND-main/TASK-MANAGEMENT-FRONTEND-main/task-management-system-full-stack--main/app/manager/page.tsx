"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AiAssistant from "../components/AiAssistant";

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

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function ManagerDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [managerTasks, setManagerTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [reviewingTask, setReviewingTask] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<string>("Approved");
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatRecipient, setChatRecipient] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const todayDate = useMemo(() => getTodayDate(), []);

  const [form, setForm] = useState({
    name: "",
    assignedTo: "",
    secondaryAssignee: "",
    priority: "Medium",
    dueDate: todayDate,
  });

  const [loggedUser, setLoggedUser] = useState<string>("");

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
  const loadUsers = () => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const teamUsers = users
    .filter((u: any) => u.role?.toLowerCase() === "team")
    .filter(
      (user: any, index: number, filteredUsers: any[]) =>
        !user.email ||
        filteredUsers.findIndex(
          (candidate: any) =>
            candidate.email?.trim().toLowerCase() ===
            user.email.trim().toLowerCase()
        ) === index
    );

  const chatRecipients = teamUsers;
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
  }, [chatRecipient, defaultChatRecipient]);

  const assignableUsers = [
    ...(loggedUser
      ? [{ name: "Myself", email: loggedUser }]
      : []),
    ...teamUsers,
  ];

  // LOAD TASKS FROM API
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
        const isToMe = (email?: string) =>
          Boolean(email && emailToMatch && email.trim().toLowerCase() === emailToMatch);
        const isByMe = (email?: string) =>
          Boolean(email && emailToMatch && email.trim().toLowerCase() === emailToMatch);

        const req = data.filter(
          (t: any) => isToMe(t.assignedTo) && t.type === "request"
        );

        const assignedByMe = data.filter(
          (t: any) => isByMe(t.assignedBy) && t.type === "task"
        );

        setRequests(req);
        setManagerTasks(assignedByMe);
      })
      .catch((err) => console.error("Failed to load tasks:", err));
  };

  // CHAT POLLING
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
      setChatError("Please select a team member recipient.");
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

  // ADD TASK (with optional specification/document upload)
  const addTask = async () => {
    if (!form.name.trim() || !form.assignedTo) return;
    setIsCreatingTask(true);

    try {
      let fileMeta: any = { hasFile: false };

      if (taskFile) {
        const fd = new FormData();
        fd.append("file", taskFile);
        const upRes = await fetch("/api/files/upload", {
          method: "POST",
          body: fd,
        });

        if (upRes.ok) {
          const upData = await upRes.json();
          fileMeta = {
            hasFile: true,
            fileName: upData.fileName,
            fileUrl: upData.fileUrl,
            fileSize: upData.fileSize,
            fileType: upData.fileType,
          };
        }
      }

      const newTask = {
        id: Date.now(),
        name: form.name.trim(),
        priority: form.priority,
        dueDate: form.dueDate,
        status: "Pending",
        completed: false,
        assignedTo: form.assignedTo,
        secondaryAssignee: form.secondaryAssignee || "",
        assignedBy: loggedUser,
        type: "task",
        ...fileMeta,
      };

      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      setForm({ name: "", assignedTo: "", secondaryAssignee: "", priority: "Medium", dueDate: todayDate });
      setTaskFile(null);
      loadTasks();
    } catch (err) {
      console.error("Failed to assign task:", err);
      alert("Failed to assign task.");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // REMOVE PRIMARY ASSIGNEE (Auto-transfers task to backup assignee)
  const handleRemovePrimaryAssignee = async (task: any) => {
    const primaryName = task.assignedTo || "Current assignee";
    const backupName = task.secondaryAssignee ? task.secondaryAssignee.trim() : "";

    const confirmMsg = backupName
      ? `Remove primary team member "${primaryName}" from this task?\n\nThis task will AUTOMATICALLY be transferred to the backup person: "${backupName}".`
      : `Remove primary team member "${primaryName}" from this task?\n\nNo backup member is assigned, so this task will become Unassigned.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}/remove-primary`, {
        method: "POST",
      });

      if (!res.ok) {
        // Fallback update
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: task.id,
            assignedTo: backupName || "Unassigned",
            secondaryAssignee: "",
          }),
        });
      }

      alert(
        backupName
          ? `Primary member removed. Task automatically transferred to backup person: ${backupName}!`
          : `Primary member removed. Task is now unassigned.`
      );
      loadTasks();
    } catch (err) {
      console.error("Error removing primary assignee:", err);
      // Fallback update
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          assignedTo: backupName || "Unassigned",
          secondaryAssignee: "",
        }),
      });
      loadTasks();
    }
  };

  // REMOVE TEAM MEMBER (Auto-transfers all their tasks to backup persons)
  const handleRemoveTeamMember = async (email: string, name: string) => {
    if (!email) return;
    if (
      !window.confirm(
        `Remove team member "${name}" (${email}) from the system?\n\nAny tasks assigned to this primary member will AUTOMATICALLY transfer to their secondary backup assignee (who will become the new primary person).`
      )
    ) {
      return;
    }

    let transferredCount = 0;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const affectedTasks = managerTasks.filter(
        (t: any) =>
          (t.assignedTo && t.assignedTo.trim().toLowerCase() === cleanEmail) ||
          (t.secondaryAssignee && t.secondaryAssignee.trim().toLowerCase() === cleanEmail)
      );

      for (const t of affectedTasks) {
        if (t.assignedTo && t.assignedTo.trim().toLowerCase() === cleanEmail) {
          const fallback =
            t.secondaryAssignee && t.secondaryAssignee.trim().toLowerCase() !== cleanEmail
              ? t.secondaryAssignee.trim()
              : "Unassigned";
          await fetch("/api/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...t,
              assignedTo: fallback,
              secondaryAssignee: "",
            }),
          });
          transferredCount++;
        } else if (t.secondaryAssignee && t.secondaryAssignee.trim().toLowerCase() === cleanEmail) {
          await fetch("/api/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...t,
              secondaryAssignee: "",
            }),
          });
        }
      }
    } catch (taskErr) {
      console.error("Error transferring tasks during team member removal:", taskErr);
    }

    try {
      await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      alert(
        transferredCount > 0
          ? `Team member removed. ${transferredCount} task(s) previously assigned to "${name}" have automatically transferred to their secondary backup assignees (who are now the primary assignees).`
          : `Team member removed successfully.`
      );
      loadTasks();
      loadUsers();
    } catch (err) {
      console.error("Failed to remove team member:", err);
    }
  };

  // SUBMIT MANAGER REVIEW ON DELIVERABLE
  const submitReview = async () => {
    if (!reviewingTask) return;
    setSubmittingReview(true);

    try {
      const res = await fetch(`/api/tasks/${reviewingTask.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: reviewDecision,
          reviewComment: reviewComment,
          reviewedBy: loggedUser || "Manager",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit review");
      }

      setReviewingTask(null);
      setReviewComment("");
      loadTasks();
    } catch (err) {
      console.error("Review submission failed:", err);
      alert("Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // DELETE
  const deleteAssignedTask = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadTasks();
  };

  // UPDATE
  const updateTask = async () => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingTask),
    });

    setEditingTask(null);
    loadTasks();
  };

  // PAUSE / RESUME
  const pauseTask = async (task: any) => {
    const updatedStatus = task.status === "Paused" ? "Pending" : "Paused";
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...task, status: updatedStatus }),
    });

    loadTasks();
  };

  // ACCEPT REQUEST
  const acceptRequest = async (req: any) => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, status: "Accepted" }),
    });

    loadTasks();
  };

  // REJECT REQUEST
  const rejectRequest = async (req: any) => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...req, status: "Rejected" }),
    });

    loadTasks();
  };

  const dashboardCards = [
    { label: "Assigned Tasks", value: managerTasks.length, icon: "📋", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    { label: "Pending Requests", value: requests.length, icon: "📩", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    {
      label: "Completed",
      value: managerTasks.filter((t: any) => t.completed).length,
      icon: "✓",
      color: "text-teal-700",
      bg: "bg-teal-50",
      border: "border-teal-200"
    },
    { label: "Team Members", value: teamUsers.length, icon: "👥", color: "text-slate-800", bg: "bg-slate-100", border: "border-slate-200" },
  ];

  return (
    <div className="flex h-screen bg-[#edf5ff] text-slate-900 font-sans overflow-hidden relative selection:bg-emerald-600 selection:text-white">
      {/* ── Advanced Architectural Geometric Background (Elevated Signature) ── */}
      {/* Layer 1: Ambient Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.98),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.14),transparent_50%)] pointer-events-none z-0"></div>

      {/* Layer 1B: Subtle Black Shade & Moody Vignette Overlays */}
      <div className="absolute inset-0 bg-slate-950/[0.06] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(15,23,42,0.16)_100%)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.03] via-transparent to-black/[0.10] pointer-events-none z-0"></div>

      {/* Layer 2: Precision Architectural Grid Matrix */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_85%_65%_at_50%_35%,#000_65%,transparent_100%)] pointer-events-none z-0"></div>

      {/* Layer 3: Ambient Color Glow Orbs */}
      <div className="absolute -top-16 -right-16 w-[450px] h-[450px] bg-gradient-to-br from-emerald-300/25 via-teal-200/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute -bottom-24 left-[8%] w-[620px] h-[620px] bg-gradient-to-tr from-emerald-400/20 via-sky-300/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Layer 4: Concentric Rotated Diamonds - Top Right */}
      <div className="absolute top-[-12%] right-[-6%] w-[420px] h-[420px] border-[32px] border-white/80 rounded-[56px] shadow-[0_20px_50px_rgba(15,23,42,0.06)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute top-[-6%] right-[-1%] w-[280px] h-[280px] border-[18px] border-slate-200/75 rounded-[40px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.85)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[3%] right-[7%] w-[120px] h-[120px] border-[6px] border-emerald-400/30 bg-white/40 rounded-[22px] backdrop-blur-sm transform rotate-45 pointer-events-none z-0 shadow-sm"></div>

      {/* Layer 5: Concentric Rotated Diamonds - Bottom Left */}
      <div className="absolute bottom-[-16%] left-[9%] w-[620px] h-[620px] border-[48px] border-white/80 rounded-[76px] shadow-[0_30px_70px_rgba(15,23,42,0.07)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute bottom-[-8%] left-[15%] w-[440px] h-[440px] border-[24px] border-slate-200/70 rounded-[52px] shadow-[inset_0_6px_20px_rgba(255,255,255,0.9)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute bottom-[2%] left-[21%] w-[190px] h-[190px] border-[8px] border-slate-200/50 bg-gradient-to-br from-white/40 to-transparent rounded-[30px] transform rotate-45 pointer-events-none z-0 backdrop-blur-sm"></div>

      {/* Layer 6: Floating Accent Geometric Markers */}
      <div className="absolute top-[42%] right-[2.5%] w-20 h-20 border-[3px] border-slate-300/35 rounded-2xl transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[49%] right-[5%] w-10 h-10 border-[2px] border-emerald-400/40 bg-emerald-500/5 rounded-lg transform rotate-45 pointer-events-none z-0"></div>

      {/* Modern Executive Sidebar */}
      <aside className="w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200/90 flex flex-col p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-emerald-950 to-emerald-700 shadow-md shadow-emerald-950/20 flex items-center justify-center text-lg font-black text-white ring-2 ring-emerald-500/20">
            M
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight leading-none">Task Management</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Manager Portal
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
            { id: "tasks", label: "Assign Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
            { id: "requests", label: "Team Requests", icon: "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" },
            { id: "chat", label: "Chat with Team Member", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
            { id: "team", label: "Team Directory", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
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
                <svg className={`w-5 h-5 ${activeTab === tab.id ? "text-emerald-400" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </div>
              {tab.id === "requests" && requests.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-white">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200/80">
          <div className="px-3 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200/70 mb-3">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Signed in as</p>
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
              <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-emerald-950/20 border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Management Overview
                      </span>
                      {mounted && (
                        <span suppressHydrationWarning className="text-slate-400 text-xs font-semibold">
                          • {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">
                      Team Operations Hub
                    </h1>
                    <p className="text-slate-300 mt-2 text-sm max-w-xl">
                      Monitor team bandwidth, approve leave or resource requests, and delegate high-priority deliverables.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all text-xs flex items-center gap-2"
                    >
                      + Assign Task
                    </button>
                  </div>
                </div>
              </header>

              {/* 4 KPI Cards */}
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
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TASKS MANAGEMENT TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-emerald-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold">Workflow Delegation</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Assign & Manage Tasks</h1>
                <p className="text-slate-300 mt-2 text-sm">Delegate items to team members and monitor delivery timelines.</p>
              </header>

              {/* Task Creation Form Card */}
              <div className="bg-white/95 p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">+</span>
                    New Task Assignment
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">Direct MySQL sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Task Description *</label>
                    <input
                      placeholder="e.g. Implement authentication module..."
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="md:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">Primary Assignee *</label>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">1st Person</span>
                    </div>
                    <select
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={form.assignedTo}
                      onChange={(e) => {
                        const newPrimary = e.target.value;
                        setForm({
                          ...form,
                          assignedTo: newPrimary,
                          secondaryAssignee: form.secondaryAssignee === newPrimary ? "" : form.secondaryAssignee,
                        });
                      }}
                    >
                      <option value="">Select Primary Member</option>
                      {assignableUsers.map((u: any, i) => (
                        <option key={i} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">Backup Assignee (Optional)</label>
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">2nd Person (Auto-Fallback)</span>
                    </div>
                    <select
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={form.secondaryAssignee}
                      onChange={(e) => setForm({ ...form, secondaryAssignee: e.target.value })}
                    >
                      <option value="">No Backup Person</option>
                      {assignableUsers
                        .filter((u: any) => u.email !== form.assignedTo)
                        .map((u: any, i) => (
                          <option key={i} value={u.email}>{u.name} ({u.email})</option>
                        ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Priority</label>
                    <select
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Due Date</label>
                    <input
                      type="date"
                      min={todayDate}
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      value={form.dueDate}
                      onChange={(e) => {
                        const chosen = e.target.value;
                        if (chosen && chosen < todayDate) {
                          alert("Due date cannot be before today (" + todayDate + "). Setting to today.");
                          setForm({ ...form, dueDate: todayDate });
                        } else {
                          setForm({ ...form, dueDate: chosen || todayDate });
                        }
                      }}
                    />
                  </div>

                  <div className="md:col-span-12 pt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Attach Specification / Reference File (Optional)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        onChange={(e) => setTaskFile(e.target.files ? e.target.files[0] : null)}
                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                      {taskFile && (
                        <button
                          type="button"
                          onClick={() => setTaskFile(null)}
                          className="text-xs text-rose-500 font-bold hover:underline shrink-0"
                        >
                          Clear File ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold">Quick Date:</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, dueDate: todayDate })}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-all ${
                        form.dueDate === todayDate ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        const yr = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, "0");
                        const da = String(d.getDate()).padStart(2, "0");
                        setForm({ ...form, dueDate: `${yr}-${mo}-${da}` });
                      }}
                      className="px-2.5 py-1 rounded-lg border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-bold transition-all"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        const yr = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, "0");
                        const da = String(d.getDate()).padStart(2, "0");
                        setForm({ ...form, dueDate: `${yr}-${mo}-${da}` });
                      }}
                      className="px-2.5 py-1 rounded-lg border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-bold transition-all"
                    >
                      +1 Week
                    </button>
                  </div>

                  <button
                    onClick={addTask}
                    disabled={!form.name.trim() || !form.assignedTo || isCreatingTask}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-xs disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreatingTask ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Assigning...</span>
                      </>
                    ) : (
                      <span>+ Assign Task</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Tasks Table Card */}
              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900">Assigned Tasks ({managerTasks.length})</h3>
                  <button
                    onClick={() => loadTasks()}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Refresh List ↻
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Task Name</th>
                        <th className="py-3.5 px-6">Assigned Member</th>
                        <th className="py-3.5 px-6">Priority</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6">Deliverable & Review</th>
                        <th className="py-3.5 px-6">Due Date</th>
                        <th className="py-3.5 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {managerTasks.map((task: any) => (
                        <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            <span>{task.name}</span>
                            {task.completionNote && (
                              <p className="text-[11px] text-slate-500 mt-0.5 font-normal line-clamp-2">
                                Note: {task.completionNote}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-medium text-xs">
                            <div className="flex flex-col gap-1.5 items-start">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                                  Primary
                                </span>
                                <span className="font-mono text-slate-800 font-bold">{task.assignedTo || "Unassigned"}</span>
                              </div>
                              {task.secondaryAssignee ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Backup
                                  </span>
                                  <span className="font-mono text-slate-600">{task.secondaryAssignee}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No backup assigned</span>
                              )}
                            </div>
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
                              task.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : task.status === "Changes Requested" ? "bg-amber-50 text-amber-700 border-amber-200" : task.status === "Paused" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-blue-50 text-blue-700 border-blue-200"
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
                                  title="Click to download or preview deliverable"
                                >
                                  <span>📎</span>
                                  <span className="max-w-[130px] truncate">{task.fileName || "View Deliverable"}</span>
                                  {task.fileSize && <span className="text-[10px] text-blue-500 font-normal">({task.fileSize})</span>}
                                </a>
                              ) : task.completed ? (
                                <span className="text-xs text-emerald-600 font-semibold">Submitted (No file)</span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No deliverable yet</span>
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
                                <p className="text-[11px] text-slate-500 line-clamp-1 italic max-w-xs">
                                  💬 "{task.reviewComment}"
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-semibold text-xs whitespace-nowrap">{task.dueDate || "—"}</td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setReviewingTask(task);
                                  setReviewDecision(task.reviewStatus && task.reviewStatus !== "Pending Review" ? task.reviewStatus : "Approved");
                                  setReviewComment(task.reviewComment || "");
                                }}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1"
                                title="Review file deliverable and record decision"
                              >
                                <span>👁</span> Review
                              </button>
                              <button
                                onClick={() => setEditingTask(task)}
                                className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                              >
                                Edit
                              </button>
                              {task.assignedTo && task.assignedTo !== "Unassigned" && (
                                <button
                                  onClick={() => handleRemovePrimaryAssignee(task)}
                                  className="px-2 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1"
                                  title={task.secondaryAssignee ? `Remove primary assignee and reassign task to backup (${task.secondaryAssignee})` : "Unassign current member"}
                                >
                                  <span>⤾</span> Transfer
                                </button>
                              )}
                              <button
                                onClick={() => pauseTask(task)}
                                className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${
                                  task.status === "Paused" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                }`}
                              >
                                {task.status === "Paused" ? "Resume" : "Pause"}
                              </button>
                              <button
                                onClick={() => deleteAssignedTask(task.id)}
                                className="px-2 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {managerTasks.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No tasks assigned yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              REQUESTS TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "requests" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-emerald-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold">Inbound Inquiries</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Team Requests</h1>
                <p className="text-slate-300 mt-2 text-sm">Review, approve, or reject support and leave requests from team members.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900">
                    Pending Inbound Requests ({requests.length})
                  </h3>
                  <button
                    onClick={() => loadTasks()}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    Refresh Requests ↻
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Request Detail</th>
                        <th className="py-3.5 px-6">From Team Member</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6 text-center">Decisions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {requests.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">{r.name}</td>
                          <td className="py-4 px-6 text-slate-600 font-medium text-xs font-mono">{r.assignedBy}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              r.status === "Accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : r.status === "Rejected" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {r.status || "Pending"}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => acceptRequest(r)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-sm"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => rejectRequest(r)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {requests.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">No pending requests at this time.</td>
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
              <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-emerald-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold">Team Communication</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Chat with Team Member</h1>
                <p className="text-slate-300 mt-2 text-sm">Send real-time updates and collaborate with team members.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
                {/* Chat Top Bar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="text-sm font-black text-slate-900">Chat with Team Member</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Messaging:</span>
                    <select
                      value={chatRecipient}
                      onChange={(e) => setChatRecipient(e.target.value)}
                      className="border border-slate-300 bg-white text-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">Select recipient</option>
                      {chatRecipients.map((user: any) => (
                        <option key={user.email} value={user.email}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message Scroll Area */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/30">
                  {chatError && (
                    <div className="p-2.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl text-center border border-rose-200">
                      {chatError}
                    </div>
                  )}

                  {chatLoading && chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 py-16 text-xs font-semibold">Connecting to live message feed...</div>
                  ) : chatHistory.length === 0 ? (
                    <div className="text-center text-slate-400 py-16 text-xs font-semibold">
                      No message history with {chatRecipient || "recipient"}. Say hello below!
                    </div>
                  ) : (
                    chatHistory.map((msg) => {
                      const isMe = isMatch(msg.sender, activeUser);
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div className={`max-w-md px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-sm ${
                            isMe ? "bg-emerald-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
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

                {/* Chat Input Bar */}
                <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    placeholder={`Type message to ${chatRecipient || "team member"}...`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatSending || !chatInput.trim()}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TEAM DIRECTORY TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "team" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-emerald-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-300 font-bold">Roster</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Team Members</h1>
                <p className="text-slate-300 mt-2 text-sm">Direct reporting personnel and active staff.</p>
              </header>

              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">Member Name</th>
                        <th className="py-3.5 px-6">Contact Email</th>
                        <th className="py-3.5 px-6">Designation</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {teamUsers.map((u: any, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">{u.name}</td>
                          <td className="py-4 px-6 text-slate-600 font-medium text-xs font-mono">{u.email}</td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Team Member
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleRemoveTeamMember(u.email, u.name)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                              title="Remove member and automatically reassign their tasks to secondary backup assignees"
                            >
                              Remove Member 🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                      {teamUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">No team members assigned.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm text-center border border-slate-200/80">
            <p className="text-slate-500 font-medium text-xs">
              &copy; {new Date().getFullYear()} Task Management System • Managerial Operations Portal
            </p>
          </footer>
        </div>
      </main>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900">Edit Task Assignment</h2>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Task Name</label>
                <input
                  value={editingTask.name}
                  onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Task name"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Priority</label>
                <select
                  value={editingTask.priority || "Medium"}
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Due Date</label>
                <input
                  type="date"
                  min={todayDate}
                  value={editingTask.dueDate || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                  Primary Assignee (1st Person)
                </label>
                <select
                  value={editingTask.assignedTo || ""}
                  onChange={(e) => {
                    const newPrimary = e.target.value;
                    setEditingTask({
                      ...editingTask,
                      assignedTo: newPrimary,
                      // Clear secondary if it matches new primary
                      secondaryAssignee: editingTask.secondaryAssignee === newPrimary ? "" : editingTask.secondaryAssignee,
                    });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select Primary Assignee --</option>
                  {teamUsers.map((u: any, i: number) => (
                    <option key={i} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block flex items-center justify-between">
                  <span>Backup Assignee (2nd Person - Auto Fallback)</span>
                  <span className="text-[10px] text-emerald-600 font-semibold normal-case">Optional</span>
                </label>
                <select
                  value={editingTask.secondaryAssignee || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, secondaryAssignee: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="">-- No Backup Assignee --</option>
                  {teamUsers
                    .filter((u: any) => u.email !== editingTask.assignedTo)
                    .map((u: any, i: number) => (
                      <option key={i} value={u.email}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  If primary member is removed or unassigned, the task automatically transfers to this person.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={updateTask}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Deliverable Modal */}
      {reviewingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Deliverable Evaluation
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">Review Deliverable & Task</h2>
              </div>
              <button
                disabled={submittingReview}
                onClick={() => setReviewingTask(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* Task Info */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Deliverable Name</p>
                  <p className="text-sm font-black text-slate-900">{reviewingTask.name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                  reviewingTask.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                }`}>
                  {reviewingTask.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400 font-semibold text-[11px]">Assigned Member:</span>
                  <p className="font-mono text-slate-800 font-bold truncate">{reviewingTask.assignedTo}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold text-[11px]">Due Date:</span>
                  <p className="text-slate-800 font-bold">{reviewingTask.dueDate || "—"}</p>
                </div>
              </div>

              {reviewingTask.completionNote && (
                <div className="pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-400 font-semibold text-[11px]">Member Notes:</span>
                  <p className="text-slate-700 font-medium italic mt-0.5">"{reviewingTask.completionNote}"</p>
                </div>
              )}
            </div>

            {/* Deliverable File Card */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Attached File Deliverable</label>
              {reviewingTask.hasFile && reviewingTask.fileUrl ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                      📎
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate" title={reviewingTask.fileName}>
                        {reviewingTask.fileName || "Submitted File"}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {reviewingTask.fileSize ? `Size: ${reviewingTask.fileSize}` : "Deliverable Attached"}
                      </p>
                    </div>
                  </div>
                  <a
                    href={reviewingTask.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all shrink-0 flex items-center gap-1.5"
                  >
                    <span>📥</span> Download
                  </a>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-400 italic">
                  No file was uploaded by the team member for this task yet.
                </div>
              )}
            </div>

            {/* Review Decision */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Review Decision *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "Approved", label: "Approve ✓", desc: "Deliverable accepted", color: "border-emerald-500 bg-emerald-600 text-white" },
                  { id: "Changes Requested", label: "Request Changes ⚠", desc: "Revisions needed", color: "border-amber-500 bg-amber-600 text-white" },
                  { id: "Rejected", label: "Reject ✗", desc: "Deliverable rejected", color: "border-rose-500 bg-rose-600 text-white" },
                ].map((dec) => {
                  const isSelected = reviewDecision === dec.id;
                  return (
                    <button
                      key={dec.id}
                      type="button"
                      onClick={() => setReviewDecision(dec.id)}
                      className={`p-3 rounded-2xl text-left border-2 transition-all ${
                        isSelected
                          ? `${dec.color} shadow-md font-black`
                          : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <p className="text-xs font-bold">{dec.label}</p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                        {dec.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Review Comments */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Review Feedback / Comments</label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Write specific remarks, questions, revision instructions, or approval note for the member..."
                className="w-full border border-slate-300 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={submitReview}
                disabled={submittingReview}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submittingReview ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Submitting Decision...</span>
                  </>
                ) : (
                  <span>Submit Review Decision ✓</span>
                )}
              </button>
              <button
                onClick={() => setReviewingTask(null)}
                disabled={submittingReview}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Orange AI Assistant Widget (Bottom Right) */}
      <AiAssistant
        role="manager"
        loggedUser={loggedUser || "Manager"}
        tasks={[...requests, ...managerTasks]}
        users={users}
      />
    </div>
  );
}