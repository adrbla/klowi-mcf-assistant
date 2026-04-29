import "server-only";
import type { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { assembleSystemPrompt } from "@/lib/system-prompt";
import {
  createChat,
  getChat,
  listMessages,
  addUserMessage,
  addAssistantMessage,
  touchChat,
  setTitleIfDefault,
} from "@/lib/db/queries";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { chatId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  const userMessage = body.message?.trim();
  if (!userMessage) {
    return new Response("missing message", { status: 400 });
  }

  let chatId = body.chatId;
  let isNewChat = false;
  if (chatId) {
    const existing = await getChat(chatId);
    if (!existing) return new Response("chat not found", { status: 404 });
  } else {
    const created = await createChat();
    chatId = created.id;
    isNewChat = true;
  }

  const history = await listMessages(chatId);
  await addUserMessage(chatId, userMessage);

  // Skip auto-title for kickoff markers — otherwise the chat gets named
  // "[OPEN]" or "[FIRST]" and pollutes the sidebar. The first non-marker
  // user message picks up the title via setTitleIfDefault (covers both
  // fresh chats and post-welcome chats where turn 1 was [FIRST]).
  const isMarker =
    userMessage === "[OPEN]" || userMessage === "[FIRST]";
  if (!isMarker) {
    const title =
      userMessage.length > 60 ? userMessage.slice(0, 57) + "…" : userMessage;
    await setTitleIfDefault(chatId, title);
  }

  const systemText = await assembleSystemPrompt();

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...history.map((m): Anthropic.MessageParam => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    messages: anthropicMessages,
    cache_control: { type: "ephemeral" },
  });

  const encoder = new TextEncoder();
  let assistantText = "";

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (delta) => {
        assistantText += delta;
        controller.enqueue(encoder.encode(delta));
      });

      try {
        const final = await stream.finalMessage();
        await addAssistantMessage({
          chatId: chatId!,
          content: assistantText,
          blocks: final.content,
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
          cacheCreationTokens:
            final.usage.cache_creation_input_tokens ?? undefined,
          cacheReadTokens: final.usage.cache_read_input_tokens ?? undefined,
        });
        await touchChat(chatId!);
        controller.close();
      } catch (err) {
        console.error("chat stream error", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Chat-Id": chatId,
      "X-New-Chat": isNewChat ? "1" : "0",
      "Cache-Control": "no-store",
    },
  });
}
