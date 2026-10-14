import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "users.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const data = fs.readFileSync(filePath, "utf-8");
  const users: unknown = JSON.parse(data);
  if (!Array.isArray(users)) {
    throw new Error("User data must be an array.");
  }
  const seenEmails = new Set<string>();
  const uniqueUsers = users.filter((user: unknown) => {
    if (!isRecord(user) || typeof user.email !== "string") return true;
    const email = user.email.trim().toLowerCase();
    if (!email) return true;
    if (seenEmails.has(email)) return false;
    seenEmails.add(email);
    return true;
  });

  return NextResponse.json(uniqueUsers);
}

export async function POST(req: Request) {
  const newUser = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  const users = JSON.parse(data);

  users.push(newUser);

  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

  return NextResponse.json({ message: "User added" });
}

export async function PUT(req: Request) {
  const { email, role } = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  const users = JSON.parse(data);

  const updatedUsers = users.map((user: any) =>
    user.email?.trim().toLowerCase() === email?.trim().toLowerCase()
      ? { ...user, role: role?.trim().toLowerCase() }
      : user
  );

  fs.writeFileSync(filePath, JSON.stringify(updatedUsers, null, 2));

  return NextResponse.json({ message: "User role updated" });
}

export async function DELETE(req: Request) {
  const { email } = await req.json();

  const data = fs.readFileSync(filePath, "utf-8");
  const users = JSON.parse(data);

  const filteredUsers = users.filter(
    (user: any) => user.email?.trim().toLowerCase() !== email?.trim().toLowerCase()
  );

  fs.writeFileSync(filePath, JSON.stringify(filteredUsers, null, 2));

  return NextResponse.json({ message: "User deleted" });
}