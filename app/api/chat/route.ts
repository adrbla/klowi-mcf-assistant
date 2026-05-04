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
import type { MessageAttachment } from "@/lib/db/schema";
import { buildAttachmentBlocks } from "@/lib/attachments";

export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    chatId?: string;
    message?: string;
    attachments?: MessageAttachment[];
  };
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
  await addUserMessage(chatId, userMessage, body.attachments);

  // The first user message of a chat sets the title (truncated for sidebar).
  const title =
    userMessage.length > 60 ? userMessage.slice(0, 57) + "…" : userMessage;
  await setTitleIfDefault(chatId, title);

  const systemText = await assembleSystemPrompt();

  // Re-fetch attachments listed on each historical message and rebuild the
  // Anthropic content array. This means the companion sees previously
  // shared documents on every turn — not just the turn they were sent.
  const historyForApi: Anthropic.MessageParam[] = await Promise.all(
    history.map(async (m) => {
      const baseText = m.content;
      const atts = (m.attachments ?? []) as MessageAttachment[];
      if (atts.length === 0) {
        return {
          role: m.role as "user" | "assistant",
          content: baseText,
        };
      }
      const blocks: Anthropic.ContentBlockParam[] = [];
      for (const att of atts) {
        const built = await buildAttachmentBlocks(att);
        if (built) blocks.push(...built);
      }
      blocks.push({ type: "text", text: baseText });
      return {
        role: m.role as "user" | "assistant",
        content: blocks,
      };
    }),
  );

  // Seeded conversations open with an assistant message (the welcome
  // opening). Without a prior user message, the model assumes there was
  // an earlier exchange it doesn't have access to, and may hallucinate
  // referencing it ("I wrote it above…"). Prepend a synthetic user
  // opener so the assistant's first turn is anchored as a true greeting,
  // not a continuation. Stays out of the DB and out of the UI.
  if (historyForApi.length > 0 && historyForApi[0].role === "assistant") {
    historyForApi.unshift({
      role: "user",
      content:
        "[Méta : début de conversation. Chloë vient d'ouvrir un lien dédié vers cette session, elle n'a encore rien écrit. Le message qui suit est ton accueil — pas une continuation.]",
    });
  }

  // Build the current user message — may include attachments uploaded
  // alongside this turn.
  const currentAttachments = body.attachments ?? [];
  const currentBlocks: Anthropic.ContentBlockParam[] = [];
  for (const att of currentAttachments) {
    const built = await buildAttachmentBlocks(att);
    if (built) currentBlocks.push(...built);
  }
  currentBlocks.push({ type: "text", text: userMessage });

  // Cache breakpoint: place it on the LAST content block of the LATEST
  // message that carries attachments. Anthropic caches everything up to
  // and including that block, so subsequent turns don't re-pay attachment
  // tokens. If no attachments anywhere in the conversation, no extra
  // breakpoint is added (the system prompt already has one).
  const currentUserContent: Anthropic.ContentBlockParam[] | string =
    currentAttachments.length > 0
      ? withCacheBreakpointOnLast(currentBlocks)
      : currentBlocks.length === 1
        ? userMessage
        : currentBlocks;

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...historyForApi,
    { role: "user", content: currentUserContent },
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

function withCacheBreakpointOnLast(
  blocks: Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam[] {
  if (blocks.length === 0) return blocks;
  const result = [...blocks];
  const last = result[result.length - 1];
  // Only attach cache_control on block types that support it (document, text).
  if (last.type === "document" || last.type === "text") {
    result[result.length - 1] = {
      ...last,
      cache_control: { type: "ephemeral" },
    };
  }
  return result;
}
