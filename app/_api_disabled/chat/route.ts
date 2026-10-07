import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

// GET /api/chat
export async function GET() {
  try {
    const messages = await query(
      "SELECT id, sender, recipient, text, createdAt FROM chats ORDER BY createdAt ASC"
    );
    return NextResponse.json(messages, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching chats from MySQL:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/chat
export async function POST(req: Request) {
  try {
    const { sender, recipient, text } = await req.json();

    if (!sender || !recipient || !text || !text.trim()) {
      return NextResponse.json(
        { error: "Sender, recipient, and message text are required." },
        { status: 400 }
      );
    }

    const newMessage = {
      id: crypto.randomUUID(),
      sender: sender.trim(),
      recipient: recipient.trim(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    await query(
      "INSERT INTO chats (id, sender, recipient, text, createdAt) VALUES (?, ?, ?, ?, ?)",
      [
        newMessage.id,
        newMessage.sender,
        newMessage.recipient,
        newMessage.text,
        newMessage.createdAt,
      ]
    );

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error("Error saving chat in MySQL:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

