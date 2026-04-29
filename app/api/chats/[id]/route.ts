import "server-only";
import type { NextRequest } from "next/server";
import { getChat, renameChat, deleteChat } from "@/lib/db/queries";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? "chloe";

type RouteContext = { params: Promise<{ id: string }> };

async function ownsChat(chatId: string): Promise<boolean> {
  const chat = await getChat(chatId);
  return chat !== undefined && chat.userId === DEFAULT_USER_ID;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  if (!(await ownsChat(id))) {
    return Response.json({ error: "chat not found" }, { status: 404 });
  }

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (title.length > 200) {
    return Response.json({ error: "title too long" }, { status: 400 });
  }

  const updated = await renameChat(id, title);
  if (!updated) {
    return Response.json({ error: "rename failed" }, { status: 500 });
  }
  return Response.json({
    chat: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt },
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  if (!(await ownsChat(id))) {
    return Response.json({ error: "chat not found" }, { status: 404 });
  }

  const ok = await deleteChat(id);
  if (!ok) {
    return Response.json({ error: "delete failed" }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
