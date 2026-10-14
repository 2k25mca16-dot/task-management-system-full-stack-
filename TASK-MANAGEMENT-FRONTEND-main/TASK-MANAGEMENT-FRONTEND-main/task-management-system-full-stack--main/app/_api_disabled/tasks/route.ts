import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/tasks
export async function GET() {
  try {
    const rawTasks: any = await query("SELECT * FROM tasks ORDER BY id DESC");

    const formattedTasks = rawTasks.map((t: any) => ({
      id: Number(t.id),
      name: t.name,
      priority: t.priority || "Medium",
      dueDate: t.dueDate || "",
      status: t.status || "Pending",
      completed: Boolean(t.completed),
      assignedTo: t.assignedTo || "",
      assignedBy: t.assignedBy || "",
      type: t.type || "task",
      completionNote: t.completionNote || "",
      hasFile: Boolean(t.hasFile),
      createdAt: t.created_at,
    }));

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Error fetching tasks from MySQL:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/tasks
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      priority = "Medium",
      dueDate = "",
      status = "Pending",
      completed = false,
      assignedTo = "",
      assignedBy = "",
      type = "task",
      completionNote = "",
      hasFile = false,
    } = body;

    const taskId = id || Date.now();

    await query(
      `INSERT INTO tasks 
        (id, name, priority, dueDate, status, completed, assignedTo, assignedBy, type, completionNote, hasFile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        priority = VALUES(priority),
        dueDate = VALUES(dueDate),
        status = VALUES(status),
        completed = VALUES(completed),
        assignedTo = VALUES(assignedTo),
        assignedBy = VALUES(assignedBy),
        type = VALUES(type),
        completionNote = VALUES(completionNote),
        hasFile = VALUES(hasFile)`,
      [
        taskId,
        name || "Untitled Task",
        priority,
        dueDate,
        status,
        completed ? 1 : 0,
        assignedTo,
        assignedBy,
        type,
        completionNote,
        hasFile ? 1 : 0,
      ]
    );

    return NextResponse.json({ message: "Task added", id: taskId }, { status: 201 });
  } catch (error) {
    console.error("Error creating task in MySQL:", error);
    return NextResponse.json({ error: "Failed to save task" }, { status: 500 });
  }
}

// PUT /api/tasks
export async function PUT(req: Request) {
  try {
    const updated = await req.json();

    if (!updated || updated.id === undefined) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    const existing: any = await query("SELECT * FROM tasks WHERE id = ?", [
      updated.id,
    ]);

    if (!existing || existing.length === 0) {
      await query(
        `INSERT INTO tasks 
          (id, name, priority, dueDate, status, completed, assignedTo, assignedBy, type, completionNote, hasFile)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          updated.id,
          updated.name || "Untitled Task",
          updated.priority || "Medium",
          updated.dueDate || "",
          updated.status || "Pending",
          updated.completed ? 1 : 0,
          updated.assignedTo || "",
          updated.assignedBy || "",
          updated.type || "task",
          updated.completionNote || "",
          updated.hasFile ? 1 : 0,
        ]
      );
      return NextResponse.json({ message: "Task created" });
    }

    const current = existing[0];
    const name = updated.name !== undefined ? updated.name : current.name;
    const priority = updated.priority !== undefined ? updated.priority : current.priority;
    const dueDate = updated.dueDate !== undefined ? updated.dueDate : current.dueDate;
    const status = updated.status !== undefined ? updated.status : current.status;
    const completed = updated.completed !== undefined ? (updated.completed ? 1 : 0) : current.completed;
    const assignedTo = updated.assignedTo !== undefined ? updated.assignedTo : current.assignedTo;
    const assignedBy = updated.assignedBy !== undefined ? updated.assignedBy : current.assignedBy;
    const type = updated.type !== undefined ? updated.type : current.type;
    const completionNote = updated.completionNote !== undefined ? updated.completionNote : current.completionNote;
    const hasFile = updated.hasFile !== undefined ? (updated.hasFile ? 1 : 0) : current.hasFile;

    await query(
      `UPDATE tasks SET
        name = ?,
        priority = ?,
        dueDate = ?,
        status = ?,
        completed = ?,
        assignedTo = ?,
        assignedBy = ?,
        type = ?,
        completionNote = ?,
        hasFile = ?
       WHERE id = ?`,
      [
        name,
        priority,
        dueDate,
        status,
        completed,
        assignedTo,
        assignedBy,
        type,
        completionNote,
        hasFile,
        updated.id,
      ]
    );

    return NextResponse.json({ message: "Task updated" });
  } catch (error) {
    console.error("Error updating task in MySQL:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE /api/tasks
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (id === undefined) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    await query("DELETE FROM tasks WHERE id = ?", [id]);
    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("Error deleting task from MySQL:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

