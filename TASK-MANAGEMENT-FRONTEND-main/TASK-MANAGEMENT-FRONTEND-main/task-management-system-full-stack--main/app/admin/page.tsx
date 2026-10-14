"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AiAssistant from "../components/AiAssistant";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchUser, setSearchUser] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("loggedUser");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const loadTasks = () => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  };

  useEffect(() => {
    setMounted(true);
    loadUsers();
    loadTasks();
  }, []);

  const handleDeleteUser = async (email: string) => {
    if (!email) return;

    if (email.trim().toLowerCase() === "admin@gmail.com") {
      alert("The admin account cannot be deleted.");
      return;
    }

    const currentUser = localStorage.getItem("loggedUser") || "";
    if (currentUser.toLowerCase() === email.toLowerCase()) {
      alert("Admin cannot delete their own account.");
      return;
    }

    const confirmed = window.confirm(
      `Permanently remove user "${email}" from the system?\n\nAny tasks assigned to this primary member will AUTOMATICALLY transfer to their secondary/backup assignee (who will become the new primary person).`
    );
    if (!confirmed) return;

    const localUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const updatedLocalUsers = localUsers.filter(
      (user: any) => user.email?.trim().toLowerCase() !== email.trim().toLowerCase()
    );

    localStorage.setItem("users", JSON.stringify(updatedLocalUsers));

    // 1. Proactively transfer all tasks where this user is primary assignee to their secondary assignee
    let transferredCount = 0;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const affectedTasks = tasks.filter(
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
      console.error("Error auto-transferring tasks to secondary person:", taskErr);
    }

    try {
      await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (transferredCount > 0) {
        alert(`User removed. ${transferredCount} task(s) previously assigned to this user have automatically transferred to their secondary assignee (who is now the primary assignee).`);
      }
    } catch (error) {
      console.error("Delete failed", error);
    }

    loadUsers();
    loadTasks();
  };

  const handleRoleChange = async (email: string, newRole: string) => {
    if (email.trim().toLowerCase() === "admin@gmail.com") {
      alert("The admin role cannot be changed.");
      return;
    }
    if (newRole.trim().toLowerCase() === "admin") {
      alert("Only one admin is permitted.");
      return;
    }
    const normalizedRole = newRole.trim().toLowerCase();
    const updatedUsers = users.map((user) =>
      user.email?.trim().toLowerCase() === email.trim().toLowerCase()
        ? { ...user, role: normalizedRole }
        : user
    );

    setUsers(updatedUsers);

    const localUsers = JSON.parse(localStorage.getItem("users") || "[]");
    const updatedLocalUsers = localUsers.map((user: any) =>
      user.email?.trim().toLowerCase() === email.trim().toLowerCase()
        ? { ...user, role: normalizedRole }
        : user
    );

    localStorage.setItem("users", JSON.stringify(updatedLocalUsers));

    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: normalizedRole }),
      });
      loadUsers();
    } catch (error) {
      console.error("Role update failed", error);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchRole = filter === "all" || u.role?.toLowerCase() === filter;
    const matchSearch =
      !searchUser.trim() ||
      (u.name && u.name.toLowerCase().includes(searchUser.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchUser.toLowerCase()));
    return matchRole && matchSearch;
  });

  const managerTasks = tasks.filter((task) => {
    const assignedByUser = users.find(
      (user) => user.email?.trim().toLowerCase() === task.assignedBy?.trim().toLowerCase()
    );
    return assignedByUser?.role?.toLowerCase() === "manager" || task.type === "task";
  });

  const teamTasks = tasks.filter((task) => {
    const assignedToUser = users.find(
      (user) => user.email?.trim().toLowerCase() === task.assignedTo?.trim().toLowerCase()
    );
    return assignedToUser?.role?.toLowerCase() === "team" || task.type === "request";
  });

  const adminCount = users.filter((u) => u.role?.toLowerCase() === "admin").length;
  const managerCount = users.filter((u) => u.role?.toLowerCase() === "manager").length;
  const teamCount = users.filter((u) => u.role?.toLowerCase() === "team").length;
  const individualCount = users.filter((u) => u.role?.toLowerCase() === "user").length;

  return (
    <div className="flex h-screen bg-[#edf5ff] text-slate-900 font-sans overflow-hidden relative selection:bg-indigo-500 selection:text-white">
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

      {/* Modern Executive Sidebar */}
      <aside className="w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200/90 flex flex-col p-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-indigo-700 shadow-md shadow-indigo-950/20 flex items-center justify-center text-lg font-black text-white ring-2 ring-indigo-500/20">
            A
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight leading-none">Task Management</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Admin Portal
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full px-4 py-3 font-bold rounded-xl transition-all duration-200 flex items-center gap-3 text-sm ${
              activeTab === "dashboard"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full px-4 py-3 font-bold rounded-xl transition-all duration-200 flex items-center justify-between text-sm ${
              activeTab === "users"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>User Directory</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-md font-extrabold ${activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("tasks")}
            className={`w-full px-4 py-3 font-bold rounded-xl transition-all duration-200 flex items-center justify-between text-sm ${
              activeTab === "tasks"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 font-extrabold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>Task Monitor</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-md font-extrabold ${activeTab === 'tasks' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'}`}>
              {tasks.length}
            </span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200/80">
          <div className="px-3 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200/70 mb-3">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Active Role</p>
            <p className="text-xs font-bold text-slate-800">Admin</p>
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
              {/* Executive Header Banner */}
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        Admin Overview
                      </span>
                      {mounted && (
                        <span suppressHydrationWarning className="text-slate-400 text-xs font-semibold">
                          • {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mt-3 tracking-tight">
                      System Control Center
                    </h1>
                    <p className="text-slate-300 mt-2 text-sm max-w-xl">
                      Real-time visibility across user privileges, organizational hierarchy, and team task operations.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setFilter("all"); setActiveTab("users"); }}
                      className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all text-xs flex items-center gap-2"
                    >
                      Manage Users ({users.length}) →
                    </button>
                  </div>
                </div>
              </header>

              {/* 4 Professional KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div
                  onClick={() => { setFilter("all"); setActiveTab("users"); }}
                  className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-slate-900 transition-colors">Total Accounts</span>
                    <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                      👥
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight">{users.length}</h3>
                  <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>All active directory users</span>
                  </div>
                </div>

                <div
                  onClick={() => { setFilter("manager"); setActiveTab("users"); }}
                  className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">Managers</span>
                    <span className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      💼
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-indigo-600 tracking-tight">{managerCount}</h3>
                  <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-500">
                    <span>Task delegators & leads</span>
                  </div>
                </div>

                <div
                  onClick={() => { setFilter("team"); setActiveTab("users"); }}
                  className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-sky-600 transition-colors">Team Members</span>
                    <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-sm group-hover:bg-sky-600 group-hover:text-white transition-all">
                      ⚡
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-sky-600 tracking-tight">{teamCount}</h3>
                  <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-500">
                    <span>Active task contributors</span>
                  </div>
                </div>

                <div
                  onClick={() => { setFilter("user"); setActiveTab("users"); }}
                  className="bg-white/95 rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">Individual Users</span>
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      👤
                    </span>
                  </div>
                  <h3 className="text-4xl font-black text-emerald-600 tracking-tight">{individualCount}</h3>
                  <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-slate-500">
                    <span>Personal productivity workspaces</span>
                  </div>
                </div>
              </div>

              {/* Operations Overview & Recent Directory Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* System Stats Card */}
                <div className="lg:col-span-1 bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <span className="text-indigo-600">📊</span> System Integrity
                    </h3>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Healthy
                    </span>
                  </div>
                  <div className="space-y-3 text-xs font-semibold">
                    <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-500">Database Engine</span>
                      <span className="font-bold text-slate-900 font-mono">MySQL 8.0</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-500">Total System Tasks</span>
                      <span className="font-bold text-slate-900">{tasks.length} items</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-500">Admins Registered</span>
                      <span className="font-bold text-slate-900">{adminCount} accounts</span>
                    </div>
                  </div>
                </div>

                {/* Directory Snapshot */}
                <div className="lg:col-span-2 bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Recent Users</h3>
                      <p className="text-xs text-slate-400 font-medium">Quick inspection of registered members</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("users")}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      View Full Table →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {users.slice(0, 5).map((u, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-900">{u.name || "User"}</td>
                            <td className="py-3 px-3 text-slate-600">{u.email}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  u.role === "admin"
                                    ? "bg-slate-100 text-slate-800 border-slate-300"
                                    : u.role === "manager"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : u.role === "team"
                                    ? "bg-sky-50 text-sky-700 border-sky-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {u.role?.toUpperCase() || "TEAM"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              USERS DIRECTORY TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "users" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-bold">Access & Roles</p>
                  <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">User Directory</h1>
                  <p className="text-slate-300 mt-2 text-sm">Control role assignments and manage user accounts.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    className="bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl border border-white/20 text-xs outline-none focus:ring-2 focus:ring-indigo-400 backdrop-blur-md"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all" className="text-slate-900">All Roles ({users.length})</option>
                    <option value="admin" className="text-slate-900">Admins ({adminCount})</option>
                    <option value="manager" className="text-slate-900">Managers ({managerCount})</option>
                    <option value="team" className="text-slate-900">Team Members ({teamCount})</option>
                    <option value="user" className="text-slate-900">Individual Users ({individualCount})</option>
                  </select>
                </div>
              </header>

              {/* Search Bar & Table Card */}
              <div className="bg-white/95 rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-black text-slate-900">
                      Registered Accounts
                    </h3>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200/60">
                      {filteredUsers.length} Results
                    </span>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-6">User</th>
                        <th className="py-3.5 px-6">Role Assignment</th>
                        <th className="py-3.5 px-6">Email Address</th>
                        <th className="py-3.5 px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredUsers.map((u, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                                {(u.name || u.email || "U").charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">{u.name || "Unnamed User"}</p>
                                <span className="text-[11px] text-slate-400 font-medium">ID #{u.id || i + 1}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {u.email?.trim().toLowerCase() === "admin@gmail.com" ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black tracking-wide border border-slate-700 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Admin
                              </span>
                            ) : (
                              <select
                                value={u.role || "user"}
                                onChange={(e) => handleRoleChange(u.email, e.target.value)}
                                className="rounded-xl border border-slate-300 bg-white text-slate-800 px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:border-indigo-400"
                              >
                                <option value="manager">Manager</option>
                                <option value="team">Team Member</option>
                                <option value="user">Individual User</option>
                              </select>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-semibold text-xs font-mono">{u.email}</td>
                          <td className="py-4 px-6 text-center">
                            {u.email?.trim().toLowerCase() === "admin@gmail.com" ? (
                              <span className="text-[11px] font-bold text-slate-400 italic">Protected</span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(u.email)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition-all border border-rose-200"
                                title="Delete user"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 font-medium text-sm">
                            No users found matching current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TASKS MONITOR TAB
             ══════════════════════════════════════════════ */}
          {activeTab === "tasks" && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-400 space-y-6">
              <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-3xl shadow-xl shadow-indigo-950/20 border border-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-300 font-bold">Task Oversight</p>
                <h1 className="text-3xl md:text-4xl font-black text-white mt-2 tracking-tight">Organizational Tasks</h1>
                <p className="text-slate-300 mt-2 text-sm">Monitor manager delegations and team assignment progress.</p>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Manager Delegated Tasks */}
                <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Manager Assigned Tasks</h3>
                      <p className="text-xs text-slate-400">Created by managers for team execution</p>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {managerTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {managerTasks.length === 0 ? (
                      <p className="py-12 text-center text-xs text-slate-400 font-semibold">No manager tasks logged.</p>
                    ) : (
                      managerTasks.map((task) => (
                        <div key={task.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 hover:bg-white hover:shadow-sm transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{task.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                By: {task.assignedBy || "Manager"} → To: <span className="font-semibold text-slate-800">{task.assignedTo || "Unassigned"}</span>
                                {task.secondaryAssignee && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Backup: {task.secondaryAssignee}
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              task.completed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {task.completed ? "Done" : task.status || "Pending"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                            <span className="font-bold">Priority: {task.priority}</span>
                            <span>•</span>
                            <span>Due: {task.dueDate || "None"}</span>
                            {task.hasFile && task.fileUrl && (
                              <>
                                <span>•</span>
                                <a href={task.fileUrl} target="_blank" rel="noopener noreferrer" download className="font-bold text-blue-600 hover:underline">
                                  📎 {task.fileName || "File"}
                                </a>
                              </>
                            )}
                            {task.reviewStatus && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                {task.reviewStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Team Tasks & Requests */}
                <div className="bg-white/95 rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Team Requests & Submissions</h3>
                      <p className="text-xs text-slate-400">Requests originating from team members</p>
                    </div>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      {teamTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {teamTasks.length === 0 ? (
                      <p className="py-12 text-center text-xs text-slate-400 font-semibold">No team requests logged.</p>
                    ) : (
                      teamTasks.map((task) => (
                        <div key={task.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 hover:bg-white hover:shadow-sm transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">{task.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">From: {task.assignedBy || "Team"} → To: {task.assignedTo || "Manager"}</p>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              task.completed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}>
                              {task.completed ? "Completed" : task.status || "Pending"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-1">
                            <span className="font-bold">Type: {task.type}</span>
                            <span>•</span>
                            <span>Due: {task.dueDate || "None"}</span>
                            {task.hasFile && task.fileUrl && (
                              <>
                                <span>•</span>
                                <a href={task.fileUrl} target="_blank" rel="noopener noreferrer" download className="font-bold text-blue-600 hover:underline">
                                  📎 {task.fileName || "File"}
                                </a>
                              </>
                            )}
                            {task.reviewStatus && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                {task.reviewStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm text-center border border-slate-200/80">
            <p className="text-slate-500 font-medium text-xs">
              &copy; {new Date().getFullYear()} Task Management System • Administration Console
            </p>
          </footer>
        </div>
      </main>

      {/* Floating Orange AI Assistant Widget (Bottom Right) */}
      <AiAssistant
        role="admin"
        loggedUser="admin@gmail.com"
        tasks={tasks}
        users={users}
      />
    </div>
  );
}