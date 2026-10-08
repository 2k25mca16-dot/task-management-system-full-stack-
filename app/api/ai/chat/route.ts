import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, role, userEmail, tasks = [], users = [] } = body;

    const normalizedRole = (role || "").trim().toLowerCase();

    // STRICT ACCESS CONTROL: Only manager and admin allowed
    if (normalizedRole !== "admin" && normalizedRole !== "manager") {
      return NextResponse.json(
        {
          error:
            "Access Denied: The AI Assistant is an executive tool strictly reserved for Managers and Administrators.",
          role: normalizedRole,
        },
        { status: 403 }
      );
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "A message prompt is required." },
        { status: 400 }
      );
    }

    const query = message.trim();
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Task & Team Context Metrics
    const totalTasks = Array.isArray(tasks) ? tasks.length : 0;
    const completedTasks = Array.isArray(tasks)
      ? tasks.filter((t: any) => t.completed || t.status === "Completed").length
      : 0;
    const pendingTasks = totalTasks - completedTasks;
    const highPriorityTasks = Array.isArray(tasks)
      ? tasks.filter(
          (t: any) =>
            t.priority?.toLowerCase() === "high" &&
            !t.completed &&
            t.status !== "Completed"
        ).length
      : 0;

    // Workload breakdown
    const workloadMap: Record<string, number> = {};
    if (Array.isArray(tasks)) {
      tasks.forEach((t: any) => {
        if (!t.completed && t.status !== "Completed" && t.assignedTo) {
          const assignee = t.assignedTo.trim();
          workloadMap[assignee] = (workloadMap[assignee] || 0) + 1;
        }
      });
    }

    // If Gemini API Key exists, call Google Gemini
    if (apiKey) {
      try {
        const systemPrompt = `You are an Executive AI Operations Assistant inside a full-stack Task Management System.
The logged-in user is an executive with role: ${normalizedRole.toUpperCase()} (${userEmail || "Executive"}).
System Metrics:
- Total Tasks: ${totalTasks}
- Completed: ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%)
- Pending Active Tasks: ${pendingTasks}
- High Priority Pending: ${highPriorityTasks}
Active team assignees with pending workloads: ${JSON.stringify(workloadMap)}

Provide a clear, professional, concise, markdown-formatted executive response. Include actionable next steps for task delegation, risk mitigation, or project planning where appropriate.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `${systemPrompt}\n\nUser Question/Instruction:\n${query}`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidateText =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return NextResponse.json({
              reply: candidateText,
              source: "gemini",
              role: normalizedRole,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (geminiError) {
        console.warn("Gemini API call failed, falling back to built-in executive engine:", geminiError);
      }
    }

    // Built-in intelligent executive engine
    const reply = generateExecutiveReply({
      query,
      role: normalizedRole,
      userEmail,
      totalTasks,
      completedTasks,
      pendingTasks,
      highPriorityTasks,
      workloadMap,
      tasks,
      users,
    });

    return NextResponse.json({
      reply,
      source: "executive-engine",
      role: normalizedRole,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { error: "Internal AI processing error. Please try again." },
      { status: 500 }
    );
  }
}

function generateExecutiveReply({
  query,
  role,
  userEmail,
  totalTasks,
  completedTasks,
  pendingTasks,
  highPriorityTasks,
  workloadMap,
  tasks,
  users,
}: any): string {
  const q = query.toLowerCase();

  // 1. Status / Overview / Summary
  if (
    q.includes("status") ||
    q.includes("summary") ||
    q.includes("overview") ||
    q.includes("progress") ||
    q.includes("report")
  ) {
    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    let workloadText = "";
    const assignees = Object.entries(workloadMap);
    if (assignees.length > 0) {
      workloadText = `\n#### 👥 Active Workload Distribution:\n` +
        assignees
          .map(([name, count]) => `- **${name}**: ${count} active task(s)`)
          .join("\n") +
        "\n";
    }

    return `### 📊 Project & Operations Status Overview

- **Total Registered Tasks:** ${totalTasks}
- **Completed Deliverables:** ${completedTasks} (${rate}% overall completion rate)
- **Active / Pending Tasks:** ${pendingTasks}
- **High Priority Items in Progress:** ${highPriorityTasks}
${workloadText}
${
  highPriorityTasks > 0
    ? `⚠️ **Executive Attention:** There are **${highPriorityTasks} high-priority tasks** currently open. Consider auditing team bandwidth to ensure these milestones stay on track.`
    : `✅ **Operational Health:** All critical paths are clear of pending high-priority blockers.`
}

*Would you like me to suggest task reassignments or generate an executive status report for stakeholders?*`;
  }

  // 2. Workload / Team capacity / Bottlenecks
  if (
    q.includes("workload") ||
    q.includes("team") ||
    q.includes("capacity") ||
    q.includes("bottleneck") ||
    q.includes("member")
  ) {
    const entries = Object.entries(workloadMap);
    if (entries.length === 0) {
      return `### 👥 Team Workload & Capacity Audit

Currently, there are **no active pending tasks** assigned to individual team members.

#### 💡 Executive Recommendation:
- Head over to the **Assign Tasks** tab to delegate incoming sprint items.
- Ensure all team members have clear objectives for the upcoming sprint.`;
    }

    const rows = entries
      .map(([member, count]: [string, any]) => {
        const badge =
          count >= 4
            ? "🔴 Heavy Load (Risk)"
            : count >= 2
            ? "🟡 Moderate Workload"
            : "🟢 Optimal Capacity";
        return `| \`${member}\` | ${count} | ${badge} |`;
      })
      .join("\n");

    return `### 👥 Team Workload & Capacity Audit

| Team Member / Assignee | Pending Tasks | Workload Assessment |
| :--- | :---: | :--- |
${rows}

#### 🎯 Strategic Action Points for ${role.toUpperCase()}:
1. **Balance Bandwidth:** Members flagged with heavy workloads should have secondary tasks reassigned.
2. **Review High Priority Deadlines:** Verify deliverables for anyone handling multiple items.
3. **Standup Sync:** Use the **Chat with Team Member** feature to address any blockers.`;
  }

  // 3. Task breakdown / Feature decomposition
  if (
    q.includes("breakdown") ||
    q.includes("feature") ||
    q.includes("subtask") ||
    q.includes("plan") ||
    q.includes("decompose") ||
    q.includes("create task")
  ) {
    return `### ⚡ Executive Task Decomposition & Sprint Plan

Here is a structured, production-ready operational breakdown for your deliverable:

1. **Phase 1: Architecture & API Specification**
   - **Priority:** High
   - **Action:** Finalize requirements, specify data structures, and define API endpoints.
   - **Estimated Time:** 1-2 Days

2. **Phase 2: Core Backend Implementation**
   - **Priority:** High
   - **Action:** Build database models, repositories, and write business validation logic.
   - **Estimated Time:** 2-3 Days

3. **Phase 3: Frontend Interface & State Handling**
   - **Priority:** Medium
   - **Action:** Construct responsive layouts, form validations, and asynchronous feedback toasts.
   - **Estimated Time:** 2-3 Days

4. **Phase 4: QA, Security Audit & Code Review**
   - **Priority:** High
   - **Action:** Validate role permissions (Admin/Manager), test edge cases, and finalize sign-off.
   - **Estimated Time:** 1 Day

💡 *Tip: You can use the **Assign Tasks** tab to immediately distribute these 4 milestones across your team.*`;
  }

  // 4. Draft announcement / Message / Reminder
  if (
    q.includes("draft") ||
    q.includes("announcement") ||
    q.includes("message") ||
    q.includes("email") ||
    q.includes("reminder")
  ) {
    const isManager = role === "manager";
    return `### 📢 Draft Executive Communication

**Subject:** Important Update on Sprint Deliverables & Task Progress

---

Dear Team,

As we head into the next milestone phase, please ensure your task boards on the **Task Management Portal** are completely up-to-date:

- **Completed Items:** Please attach any relevant pull request links or documentation notes.
- **In-Progress Work:** If you encounter blockers or dependencies, reach out immediately via team chat so management can assist.
- **Upcoming Deadlines:** Review your due dates and flag any schedule adjustments in advance.

Thank you for your continuous dedication and top-notch work!

Best regards,  
**${isManager ? "Engineering Management" : "System Administration"}**

---
*(You can copy this text and broadcast it via team email or messaging channels.)*`;
  }

  // 5. Risk Assessment / Deadlines / Priorities
  if (
    q.includes("risk") ||
    q.includes("priority") ||
    q.includes("urgent") ||
    q.includes("deadline") ||
    q.includes("delay")
  ) {
    return `### ⚠️ Operational Risk & Priority Assessment

- **High Priority Items:** ${highPriorityTasks} task(s) currently marked as critical.
- **Risk Level:** ${highPriorityTasks > 2 ? "High (Action Required)" : highPriorityTasks > 0 ? "Moderate" : "Low (Nominal)"}

#### 🛡️ Mitigation Checklist:
1. **Audit Open Tasks:** Ensure overdue or near-deadline tasks are prioritized above backlog items.
2. **Review Workload Concentration:** Avoid bottlenecking single developers with multiple critical path items.
3. **Verify Reviews:** Check if any completed work is awaiting Manager sign-off in the **Team Requests** queue.`;
  }

  // Default response
  return `### 🤖 Executive AI Operations Assistant

Welcome, **${role.toUpperCase()}**! I am your dedicated AI management partner, calibrated specifically for project governance and operational efficiency.

Here is what I can do for you right now:
- 📊 **"Summarize project status"** — Complete bird's-eye view of completion rate, open deliverables, and active numbers.
- 👥 **"Analyze team workload"** — Capacity assessment across all assignees with bottleneck warnings.
- ⚡ **"Generate task breakdown"** — Break any new initiative or feature into phased implementation tickets.
- 📢 **"Draft team announcement"** — Ready-to-send messages for reminders, sprint kickoffs, or milestone completions.
- ⚠️ **"Identify priority risks"** — Critical path audit of high-priority deliverables.

*What would you like to analyze or draft?*`;
}

