import "server-only";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "./client";
import { chats, messages, type Chat, type Message } from "./schema";

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID ?? "chloe";

export async function createChat(userId: string = DEFAULT_USER_ID): Promise<Chat> {
  const [chat] = await db.insert(chats).values({ userId }).returning();
  return chat;
}

export async function getChat(chatId: string): Promise<Chat | undefined> {
  const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
  return chat;
}

export async function listChatsForUser(userId: string = DEFAULT_USER_ID): Promise<Chat[]> {
  return db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));
}

export async function listMessages(chatId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));
}

export async function addUserMessage(chatId: string, content: string): Promise<Message> {
  const [m] = await db
    .insert(messages)
    .values({ chatId, role: "user", content })
    .returning();
  return m;
}

export type AssistantMessageInput = {
  chatId: string;
  content: string;
  blocks?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
};

export async function addAssistantMessage(input: AssistantMessageInput): Promise<Message> {
  const [m] = await db
    .insert(messages)
    .values({
      chatId: input.chatId,
      role: "assistant",
      content: input.content,
      blocks: input.blocks,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheCreationTokens: input.cacheCreationTokens,
      cacheReadTokens: input.cacheReadTokens,
    })
    .returning();
  return m;
}

export async function touchChat(chatId: string, title?: string): Promise<void> {
  const update: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
  if (title) update.title = title;
  await db.update(chats).set(update).where(eq(chats.id, chatId));
}

const DEFAULT_CHAT_TITLE = "Nouvelle conversation";

/**
 * Set the chat's title only if it's still the schema default. Used to
 * pick up the first non-marker user message as the chat title — covers
 * both fresh chats and post-welcome chats where the very first user
 * message was a [FIRST] marker that we deliberately didn't title-from.
 */
export async function setTitleIfDefault(
  chatId: string,
  title: string,
): Promise<void> {
  await db
    .update(chats)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.title, DEFAULT_CHAT_TITLE)));
}

export async function renameChat(
  chatId: string,
  title: string,
): Promise<Chat | undefined> {
  const [updated] = await db
    .update(chats)
    .set({ title, updatedAt: new Date() })
    .where(eq(chats.id, chatId))
    .returning();
  return updated;
}

export async function deleteChat(chatId: string): Promise<boolean> {
  const result = await db
    .delete(chats)
    .where(eq(chats.id, chatId))
    .returning({ id: chats.id });
  return result.length > 0;
}
