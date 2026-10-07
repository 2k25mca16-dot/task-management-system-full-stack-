import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "tasks.json");

// GET
export async function GET() {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json([]);
  }
}

// POST
export async function POST(req: Request) {
  const newTask = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  const tasks = JSON.parse(data);

  tasks.push(newTask);

  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));

  return NextResponse.json({ message: "Task added" });
}

// PUT
export async function PUT(req: Request) {
  const updatedTask = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  let tasks = JSON.parse(data);

  tasks = tasks.map((t: any) =>
    t.id === updatedTask.id ? updatedTask : t
  );

  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));

  return NextResponse.json({ message: "Task updated" });
}

// DELETE
export async function DELETE(req: Request) {
  const { id } = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  let tasks = JSON.parse(data);

  tasks = tasks.filter((t: any) => t.id !== id);

  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));

  return NextResponse.json({ message: "Task deleted" });
}