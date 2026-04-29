import "server-only";
import type { NextRequest } from "next/server";
import { getChat, listMessages } from "@/lib/db/queries";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return Response.json({ error: "missing chatId" }, { status: 400 });
  }

  const chat = await getChat(chatId);
  if (!chat) {
    return Response.json({ error: "chat not found" }, { status: 404 });
  }

  const messages = await listMessages(chatId);

  return Response.json({
    chat: { id: chat.id, title: chat.title, updatedAt: chat.updatedAt },
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
