import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

type ChatMessage = {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
};

const filePath = path.join(process.cwd(), "data", "chat.json");
let writeQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMessages(): ChatMessage[] {
  const data: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(data)) {
    throw new Error("Chat data must be an array.");
  }
  return data as ChatMessage[];
}

export async function GET() {
  try {
    return NextResponse.json(readMessages(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to read chat messages:", error);
    return NextResponse.json(
      { error: "Unable to load chat messages." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Sender, recipient, and message text are required." },
      { status: 400 }
    );
  }

  if (
    typeof body.sender !== "string" ||
    typeof body.recipient !== "string" ||
    typeof body.text !== "string"
  ) {
    return NextResponse.json(
      { error: "Sender, recipient, and message text are required." },
      { status: 400 }
    );
  }

  const sender = body.sender.trim();
  const recipient = body.recipient.trim();
  const text = body.text.trim();
  if (!sender || !recipient || !text) {
    return NextResponse.json(
      { error: "Sender, recipient, and message text are required." },
      { status: 400 }
    );
  }

  const message: ChatMessage = {
    id: randomUUID(),
    sender,
    recipient,
    text,
    createdAt: new Date().toISOString(),
  };

  try {
    const write = writeQueue.then(() => {
      const messages = readMessages();
      messages.push(message);
      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    });
    writeQueue = write.catch(() => {});
    await write;
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json(
      { error: "Unable to send chat message." },
      { status: 500 }
    );
  }
}
