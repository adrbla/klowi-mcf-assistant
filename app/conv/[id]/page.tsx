import "server-only";
import { notFound } from "next/navigation";
import Chat from "../../Chat";
import type { Message } from "../../components/MessageBubble";
import { getChat, listMessages } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ConvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const chat = await getChat(id);
  if (!chat) notFound();

  const rawMessages = await listMessages(id);
  const initialMessages: Message[] = rawMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <Chat key={id} initialChatId={id} initialMessages={initialMessages} />
  );
}
