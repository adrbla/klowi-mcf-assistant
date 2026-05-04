import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";

export type MessageAttachment = {
  id: string;          // UUID generated server-side at upload
  name: string;        // original filename
  mediaType: string;   // "application/pdf" | "text/markdown" | "text/plain"
  sizeBytes: number;
  blobPath: string;    // path within Vercel Blob, e.g. "attachments/<uuid>.pdf"
};

export const chats = pgTable("chats", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("Nouvelle conversation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  // Optional: store raw Anthropic content blocks (tool_use, tool_result, etc.) for replay
  blocks: jsonb("blocks"),
  attachments: jsonb("attachments").$type<MessageAttachment[]>(),
  // Token accounting (filled when streaming completes)
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cacheCreationTokens: integer("cache_creation_tokens"),
  cacheReadTokens: integer("cache_read_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
