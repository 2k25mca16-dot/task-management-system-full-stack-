"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface TaskItem {
  id: number;
  name: string;
  priority: string;
  dueDate: string;
  status: string;
  completed: boolean;
  assignedTo: string;
  assignedBy: string;
  type: string;
  completionNote?: string;
  hasFile?: boolean;
  createdAt?: string;
}

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function UserPage() {
  const router = useRouter();
  const todayDate = useMemo(() => getTodayDate(), []);

  // User state
  const [loggedUser, setLoggedUser] = useState<string>("user@example.com");
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "planner" | "profile">("dashboard");

  // Tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Form state
  const [form, setForm] = useState({
    title: "",
    category: "Work",
    priority: "Medium",
    dueDate: todayDate,
    description: "",
  });

  // Edit modal state
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "Work",
    priority: "Medium",
    dueDate: todayDate,
    status: "Pending",
    description: "",
  });

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [mounted, setMounted] = useState(false);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Helper to parse category & description from completionNote
  const parseNotes = (note?: string) => {
    if (!note) return { category: "General", desc: "" };
    const match = note.match(/^\[(.*?)\]\s*([\s\S]*)$/);
    if (match) {
      return { category: match[1] || "General", desc: match[2] || "" };
    }
    return { category: "General", desc: note };
  };

  // Check user session
  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem("loggedUser");
    if (user && user.trim()) {
      setLoggedUser(user.trim());
      loadUserTasks(user.trim());
    } else {
      loadUserTasks("");
    }
  }, []);

  // Load tasks from MySQL
  const loadUserTasks = async (userEmail: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const allTasks: TaskItem[] = await res.json();

      const userLower = (userEmail || loggedUser).toLowerCase();
      const userTasks = allTasks.filter((t) => {
        const assignedTo = (t.assignedTo || "").toLowerCase();
        const assignedBy = (t.assignedBy || "").toLowerCase();
        return (
          assignedTo === userLower ||
          (t.type === "personal" && (assignedBy === userLower || !assignedTo)) ||
          (!userLower && t.type === "personal")
        );
      });

      setTasks(userTasks);
    } catch (err) {
      console.error(err);
      showToast("Unable to load tasks from server", "error");
    } finally {
      setLoading(false);
    }
  };

  // Create new task in MySQL
  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      showToast("Please enter a task title", "error");
      return;
    }

    const fullNote = form.description.trim()
      ? `[${form.category}] ${form.description.trim()}`
      : `[${form.category}]`;

    const newTask = {
      id: Date.now(),
      name: form.title.trim(),
      priority: form.priority,
      dueDate: form.dueDate || todayDate,
      status: "Pending",
      completed: false,
      assignedTo: loggedUser,
      assignedBy: loggedUser,
      type: "personal",
      completionNote: fullNote,
      hasFile: false,
    };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      if (!res.ok) throw new Error("Failed to save task to MySQL");

      showToast("Task created successfully! 🎯", "success");
      setForm({
        title: "",
        category: "Work",
        priority: "Medium",
        dueDate: todayDate,
        description: "",
      });

      loadUserTasks(loggedUser);
    } catch (err) {
      console.error(err);
      showToast("Error creating task", "error");
    }
  };

  // Toggle complete/incomplete in MySQL
  const handleToggleComplete = async (task: TaskItem) => {
    const updatedCompleted = !task.completed;
    const updatedStatus = updatedCompleted ? "Completed" : "Pending";

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: updatedCompleted, status: updatedStatus }
          : t
      )
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          completed: updatedCompleted,
          status: updatedStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      if (updatedCompleted) {
        showToast("Task marked as completed! 🎉", "success");
      } else {
        showToast("Task marked as pending", "info");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update task in database", "error");
      loadUserTasks(loggedUser);
    }
  };

  // Change task status
  const handleStatusChange = async (task: TaskItem, newStatus: string) => {
    const isCompleted = newStatus === "Completed";

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: newStatus, completed: isCompleted }
          : t
      )
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status: newStatus,
          completed: isCompleted,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      showToast(`Status updated to ${newStatus}`, "info");
    } catch (err) {
      console.error(err);
      showToast("Error updating task status", "error");
      loadUserTasks(loggedUser);
    }
  };

  // Delete task from MySQL
  const handleDeleteTask = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to delete task");
      showToast("Task deleted", "info");
    } catch (err) {
      console.error(err);
      showToast("Error deleting task", "error");
      loadUserTasks(loggedUser);
    }
  };

  // Open edit modal
  const openEditModal = (task: TaskItem) => {
    const parsed = parseNotes(task.completionNote);
    setEditingTask(task);
    setEditForm({
      name: task.name,
      category: parsed.category || "Work",
      priority: task.priority || "Medium",
      dueDate: task.dueDate || todayDate,
      status: task.status || "Pending",
      description: parsed.desc || "",
    });
  };

  // Save edited task
  const handleSaveEdit = async () => {
    if (!editingTask) return;
    if (!editForm.name.trim()) {
      showToast("Task name cannot be empty", "error");
      return;
    }

    const fullNote = editForm.description.trim()
      ? `[${editForm.category}] ${editForm.description.trim()}`
      : `[${editForm.category}]`;

    const isCompleted = editForm.status === "Completed";

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          name: editForm.name.trim(),
          priority: editForm.priority,
          dueDate: editForm.dueDate,
          status: editForm.status,
          completed: isCompleted,
          completionNote: fullNote,
        }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      showToast("Task updated successfully", "success");
      setEditingTask(null);
      loadUserTasks(loggedUser);
    } catch (err) {
      console.error(err);
      showToast("Error saving task changes", "error");
    }
  };

  // Sign out
  const handleSignOut = () => {
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    const parsed = parseNotes(t.completionNote);

    const matchSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parsed.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parsed.category.toLowerCase().includes(searchQuery.toLowerCase());

    let matchStatus = true;
    if (statusFilter === "pending") matchStatus = !t.completed && t.status !== "In Progress";
    else if (statusFilter === "in_progress") matchStatus = t.status === "In Progress";
    else if (statusFilter === "completed") matchStatus = t.completed;
    else if (statusFilter === "high") matchStatus = t.priority === "High";

    let matchCategory = true;
    if (categoryFilter !== "all") {
      matchCategory = parsed.category.toLowerCase() === categoryFilter.toLowerCase();
    }

    return matchSearch && matchStatus && matchCategory;
  });

  // KPI Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const inProgressTasks = tasks.filter((t) => t.status === "In Progress").length;
  const pendingTasks = tasks.filter((t) => !t.completed && t.status !== "In Progress").length;
  const highPriorityTasks = tasks.filter((t) => t.priority === "High" && !t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Planner groups
  const tasksDueToday = tasks.filter((t) => t.dueDate === todayDate && !t.completed);
  const tasksUpcoming = tasks.filter((t) => t.dueDate > todayDate && !t.completed);
  const tasksOverdue = tasks.filter((t) => t.dueDate && t.dueDate < todayDate && !t.completed);

  return (
    <div className="flex h-screen bg-[#edf5ff] text-slate-900 font-sans overflow-hidden relative selection:bg-indigo-600 selection:text-white">
      {/* ── Advanced Architectural Geometric Background (Elevated Signature) ── */}
      {/* Layer 1: Ambient Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.98),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.14),transparent_50%)] pointer-events-none z-0"></div>

      {/* Layer 1B: Subtle Black Shade & Moody Vignette Overlays */}
      <div className="absolute inset-0 bg-slate-950/[0.06] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(15,23,42,0.16)_100%)] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/[0.03] via-transparent to-black/[0.10] pointer-events-none z-0"></div>

      {/* Layer 2: Precision Architectural Grid Matrix */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_85%_65%_at_50%_35%,#000_65%,transparent_100%)] pointer-events-none z-0"></div>

      {/* Layer 3: Ambient Color Glow Orbs */}
      <div className="absolute -top-16 -right-16 w-[450px] h-[450px] bg-gradient-to-br from-indigo-300/25 via-sky-200/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>
      <div className="absolute -bottom-24 left-[8%] w-[620px] h-[620px] bg-gradient-to-tr from-indigo-400/20 via-sky-300/15 to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Layer 4: Concentric Rotated Diamonds - Top Right */}
      <div className="absolute top-[-12%] right-[-6%] w-[420px] h-[420px] border-[32px] border-white/80 rounded-[56px] shadow-[0_20px_50px_rgba(15,23,42,0.06)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute top-[-6%] right-[-1%] w-[280px] h-[280px] border-[18px] border-slate-200/75 rounded-[40px] shadow-[inset_0_4px_12px_rgba(255,255,255,0.85)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[3%] right-[7%] w-[120px] h-[120px] border-[6px] border-indigo-400/30 bg-white/40 rounded-[22px] backdrop-blur-sm transform rotate-45 pointer-events-none z-0 shadow-sm"></div>

      {/* Layer 5: Concentric Rotated Diamonds - Bottom Left */}
      <div className="absolute bottom-[-16%] left-[9%] w-[620px] h-[620px] border-[48px] border-white/80 rounded-[76px] shadow-[0_30px_70px_rgba(15,23,42,0.07)] transform rotate-45 pointer-events-none z-0 backdrop-blur-[2px]"></div>
      <div className="absolute bottom-[-8%] left-[15%] w-[440px] h-[440px] border-[24px] border-slate-200/70 rounded-[52px] shadow-[inset_0_6px_20px_rgba(255,255,255,0.9)] transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute bottom-[2%] left-[21%] w-[190px] h-[190px] border-[8px] border-slate-200/50 bg-gradient-to-br from-white/40 to-transparent rounded-[30px] transform rotate-45 pointer-events-none z-0 backdrop-blur-sm"></div>

      {/* Layer 6: Floating Accent Geometric Markers */}
      <div className="absolute top-[42%] right-[2.5%] w-20 h-20 border-[3px] border-slate-300/35 rounded-2xl transform rotate-45 pointer-events-none z-0"></div>
      <div className="absolute top-[49%] right-[5%] w-10 h-10 border-[2px] border-indigo-400/40 bg-indigo-500/5 rounded-lg transform rotate-45 pointer-events-none z-0"></div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 border ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
              : toast.type === "error"
              ? "bg-rose-600 text-white border-rose-500 shadow-rose-600/20"
              : "bg-slate-900 text-white border-slate-700 shadow-slate-900/20"
          }`}
        >
          <span className="font-bold text-sm">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "ℹ"}
          </span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {/* Modern Executive Sidebar */}
      <aside className="w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200/90 flex flex-col p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-700 shadow-md shadow-indigo-950/20 flex items-center justify-center text-lg font-black text-white ring-2 ring-indigo-500/20">
            U
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight leading-none">Task Management</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Individual Workspace
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
            { id: "tasks", label: "My Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
            { id: "planner", label: "Calendar & Planner", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
            { id: "profile", label: "Account & Settings", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full px-4 py-2.5 font-bold rounded-xl transition-all duration-200 flex items-center justify-between text-sm ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 font-extrabold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className={`w-5 h-5 ${activeTab === tab.id ? "text-indigo-400" : "text-slate-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        Personal Workspace
                      </span>
                      {mounted && (
                        <span suppressHydrationWarning className="text-slate-400 text-xs font-semibold">
                          • {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">
                      Welcome, {loggedUser.split("@")[0]}! 👋
                    </h1>
                    <p className="text-slate-300 mt-2 text-sm max-w-xl">
                      Organize your goals, prioritize tasks, and track personal execution with direct MySQL sync.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all text-xs"
                    >
                      + New Task
                    </button>
                    <button
                      onClick={() => loadUserTasks(loggedUser)}
                      className="px-4 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs transition-all"
                    >
                      Sync ↻
                    </button>
                  </div>
                </div>
              </header>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-900 transition-colors">Total Items</span>
                    <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">📋</span>
                  </div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight">{totalTasks}</h3>
                  <p className="text-xs text-slate-400 mt-2 font-semibold">Active tasks</p>
                </div>

                <div className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-emerald-700 transition-colors">Completed</span>
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">✓</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-4xl font-black text-emerald-600 tracking-tight">{completedTasks}</h3>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      {completionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }}></div>
                  </div>
                </div>

                <div className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-amber-700 transition-colors">In Progress</span>
                    <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">⏳</span>
                  </div>
                  <h3 className="text-4xl font-black text-amber-600 tracking-tight">{inProgressTasks}</h3>
                  <p className="text-xs text-slate-400 mt-2 font-semibold">Under execution</p>
                </div>

                <div className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-rose-700 transition-colors">Urgent / Due</span>
                    <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm">⚡</span>
                  </div>
                  <h3 className="text-4xl font-black text-rose-600 tracking-tight">{pendingTasks}</h3>
                  <p className="text-xs text-rose-600 mt-2 font-bold">{highPriorityTasks} high priority</p>
                </div>
              </div>

              {/* Two Column: Quick Add + Today's Agenda */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Add */}
                <div className="lg:col-span-1 bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span className="text-indigo-600">⚡</span> Quick Task
                    </h3>
                    <span className="text-xs text-slate-400 font-semibold">Instant Save</span>
                  </div>
                  <form onSubmit={handleCreateTask} className="space-y-3">
                    <input
                      type="text"
                      placeholder="What needs to be done?"
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="border border-slate-300 bg-slate-50 text-slate-800 font-bold rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      >
                        <option value="Work">Work</option>
                        <option value="Personal">Personal</option>
                        <option value="Study">Study</option>
                        <option value="Finance">Finance</option>
                        <option value="Health">Health</option>
                      </select>
                      <select
                        className="border border-slate-300 bg-slate-50 text-slate-800 font-bold rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <input
                      type="date"
                      min={todayDate}
                      className="w-full border border-slate-300 bg-slate-50 text-slate-800 font-bold rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value || todayDate })}
                    />
                    <button
                      type="submit"
                      disabled={!form.title.trim()}
                      className="w-full py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md text-xs transition-all disabled:opacity-50"
                    >
                      + Save to MySQL
                    </button>
                  </form>
                </div>

                {/* Focus Today */}
                <div className="lg:col-span-2 bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Today's Focus & Deadlines</h3>
                      <p className="text-xs text-slate-400 font-medium">Scheduled for today</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      {tasksDueToday.length} Due Today
                    </span>
                  </div>

                  {tasksDueToday.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-700 text-sm">All caught up for today!</p>
                      <p className="text-xs text-slate-400 mt-1">No pending tasks scheduled for today.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {tasksDueToday.map((task) => {
                        const parsed = parseNotes(task.completionNote);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggleComplete(task)}
                                className="w-4 h-4 cursor-pointer accent-emerald-600 rounded"
                              />
                              <div>
                                <p className="font-bold text-xs text-slate-900">{task.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                    {parsed.category}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      task.priority === "High"
                                        ? "bg-rose-50 text-rose-700"
                                        : task.priority === "Medium"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                              Today
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              MY TASKS TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-bold">Action Queue</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Personal Task Board</h1>
                <p className="text-slate-300 mt-2 text-sm">Create, categorize, and complete your tasks with full MySQL durability.</p>
              </header>

              {/* Task Creation Form Card */}
              <div className="bg-white/95 p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">+</span>
                    New Task Item
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">Direct MySQL sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Task Title *</label>
                    <input
                      placeholder="e.g. Prepare presentation, Submit assignment..."
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && form.title.trim()) handleCreateTask();
                      }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Category</label>
                    <select
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      <option value="Work">Work</option>
                      <option value="Personal">Personal</option>
                      <option value="Study">Study</option>
                      <option value="Finance">Finance</option>
                      <option value="Health">Health</option>
                      <option value="Project">Project</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Priority</label>
                    <select
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Due Date</label>
                    <input
                      type="date"
                      min={todayDate}
                      className="w-full border border-slate-300 bg-slate-50 text-slate-900 font-semibold rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value || todayDate })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      onClick={() => handleCreateTask()}
                      disabled={!form.title.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md disabled:opacity-50"
                    >
                      + Add Task
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold">Quick Date:</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, dueDate: todayDate })}
                      className={`px-2.5 py-1 rounded-lg border font-bold transition-all ${
                        form.dueDate === todayDate ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
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
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="bg-white/95 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "pending", label: "Pending" },
                    { key: "in_progress", label: "In Progress" },
                    { key: "completed", label: "Completed" },
                    { key: "high", label: "High Priority" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        statusFilter === f.key
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs font-bold border border-slate-300 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 focus:outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Study">Study</option>
                    <option value="Finance">Finance</option>
                    <option value="Health">Health</option>
                  </select>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Task Table */}
              <div className="bg-white/95 rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-12 text-center">Done</th>
                        <th className="py-3.5 px-6 min-w-[200px]">Task Name & Notes</th>
                        <th className="py-3.5 px-6">Category</th>
                        <th className="py-3.5 px-6">Priority</th>
                        <th className="py-3.5 px-6">Due Date</th>
                        <th className="py-3.5 px-6">Status</th>
                        <th className="py-3.5 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredTasks.map((task) => {
                        const parsed = parseNotes(task.completionNote);
                        return (
                          <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-4 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={task.completed}
                                onChange={() => handleToggleComplete(task)}
                                className="w-4 h-4 cursor-pointer accent-emerald-600 rounded"
                              />
                            </td>
                            <td className="py-4 px-6">
                              <p className={`font-bold text-xs ${task.completed ? "line-through text-slate-400" : "text-slate-900"}`}>
                                {task.name}
                              </p>
                              {parsed.desc && (
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{parsed.desc}</p>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {parsed.category}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                task.priority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : task.priority === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-600 font-semibold text-xs">{task.dueDate || "—"}</td>
                            <td className="py-4 px-6">
                              <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(task, e.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold bg-white text-slate-800 focus:outline-none"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                              </select>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditModal(task)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTasks.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No tasks found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              PLANNER TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "planner" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-bold">Timeline</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Calendar & Deadlines</h1>
                <p className="text-slate-300 mt-2 text-sm">Visual overview of upcoming and overdue tasks.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center justify-between pb-3 border-b border-slate-100">
                    <span>Due Today</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{tasksDueToday.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {tasksDueToday.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No items due today.</p>}
                    {tasksDueToday.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="font-bold text-xs text-slate-900">{t.name}</p>
                        <button
                          onClick={() => handleToggleComplete(t)}
                          className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Mark Complete ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center justify-between pb-3 border-b border-slate-100">
                    <span>Upcoming Deadlines</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{tasksUpcoming.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {tasksUpcoming.length === 0 && <p className="py-8 text-center text-xs text-slate-400">No upcoming tasks.</p>}
                    {tasksUpcoming.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-xs text-slate-900">{t.name}</p>
                          <span className="text-[10px] text-slate-400 font-semibold">{t.dueDate}</span>
                        </div>
                        <button onClick={() => handleToggleComplete(t)} className="text-xs font-bold text-indigo-600 hover:underline">
                          Done
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center justify-between pb-3 border-b border-slate-100">
                    <span>Overdue</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700">{tasksOverdue.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {tasksOverdue.length === 0 && <p className="py-8 text-center text-xs text-emerald-600 font-bold">✓ All clear!</p>}
                    {tasksOverdue.map((t) => (
                      <div key={t.id} className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                        <p className="font-bold text-xs text-rose-900">{t.name}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleToggleComplete(t)} className="flex-1 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">
                            Complete
                          </button>
                          <button onClick={() => openEditModal(t)} className="px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-lg text-xs font-bold">
                            Reschedule
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              PROFILE TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-bold">Profile Info</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Account & Settings</h1>
                <p className="text-slate-300 mt-2 text-sm">Personal configuration and MySQL database details.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white/95 rounded-3xl border border-slate-200 p-8 shadow-sm text-center space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-700 text-white flex items-center justify-center mx-auto text-2xl font-black shadow-md">
                    {loggedUser.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{loggedUser.split("@")[0]}</h2>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{loggedUser}</p>
                    <span className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Individual User
                    </span>
                  </div>

                  <div className="pt-4 border-t border-slate-100 text-left space-y-2 text-xs font-semibold">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Database Engine</span>
                      <span className="text-slate-900 font-mono">MySQL 8.0</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Table</span>
                      <span className="text-slate-900 font-mono">tasks</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="w-full py-2.5 bg-slate-200 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold rounded-xl text-xs transition-all"
                  >
                    Sign Out
                  </button>
                </div>

                <div className="md:col-span-2 bg-white/95 rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
                  <h3 className="text-base font-black text-slate-900">Workspace Health & Statistics</h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase">Total Tasks</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">{totalTasks}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700 uppercase">Completed</p>
                      <p className="text-2xl font-black text-emerald-700 mt-1">{completedTasks}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <p className="text-xs font-bold text-indigo-700 uppercase">Success Rate</p>
                      <p className="text-2xl font-black text-indigo-700 mt-1">{completionRate}%</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900">MySQL Direct Persistence</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      All your individual tasks and deadlines are stored directly inside your local MySQL database. You can view or query this table inside MySQL Workbench anytime using <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">SELECT * FROM tasks WHERE type = 'personal';</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm text-center border border-slate-200/80">
            <p className="text-slate-500 font-medium text-xs">
              &copy; {new Date().getFullYear()} Task Management System • Personal Productivity Workspace
            </p>
          </footer>
        </div>
      </main>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900">Edit Personal Task</h2>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Title</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Study">Study</option>
                    <option value="Finance">Finance</option>
                    <option value="Health">Health</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Due Date</label>
                  <input
                    type="date"
                    min={todayDate}
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value || todayDate })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Notes</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md"
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
    </div>
  );
}