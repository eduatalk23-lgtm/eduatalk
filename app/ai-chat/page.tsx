import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { ChatShell } from "@/components/ai-chat/ChatShell";
import {
  listConversations,
  loadConversationMessages,
} from "@/lib/domains/ai-chat/persistence";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const conversationId = params.id;

  if (!conversationId) {
    redirect(`/ai-chat?id=${randomUUID()}`);
  }

  const user = await getCurrentUser();

  // RLS로 타인 대화는 빈 배열 반환. 새 대화도 빈 배열.
  const [initialMessages, conversations] = await Promise.all([
    loadConversationMessages(conversationId),
    user ? listConversations(user.userId) : Promise.resolve([]),
  ]);

  return (
    <ChatShell
      conversationId={conversationId}
      initialMessages={initialMessages}
      conversations={conversations}
    />
  );
}
