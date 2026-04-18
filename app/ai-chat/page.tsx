import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { ChatShell, type ChatShellRole } from "@/components/ai-chat/ChatShell";
import {
  getConversationOrigin,
  listConversations,
  loadConversationMessages,
} from "@/lib/domains/ai-chat/persistence";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { initializeHandoff } from "@/lib/domains/ai-chat/handoff/initialize";
import { getHandoffSource } from "@/lib/domains/ai-chat/handoff/sources";

type SearchParams = {
  id?: string;
  from?: string;
  studentId?: string;
  grade?: string;
  semester?: string;
  subject?: string;
  seed?: string;
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const conversationId = params.id;

  if (!conversationId) {
    const newId = randomUUID();
    const preserved = new URLSearchParams();
    preserved.set("id", newId);
    for (const key of [
      "from",
      "studentId",
      "grade",
      "semester",
      "subject",
      "seed",
    ] as const) {
      const v = params[key];
      if (v) preserved.set(key, v);
    }
    redirect(`/ai-chat?${preserved.toString()}`);
  }

  const user = await getCurrentUser();

  let bannerOrigin: {
    source: string;
    label: string;
    originPath: string;
  } | null = null;
  let suggestionChips: Array<{ category: string; text: string }> = [];

  // 신규 핸드오프 진입 (from 쿼리 있음) → T-4 initialize 실행
  if (user && params.from) {
    const result = await initializeHandoff({
      conversationId,
      user,
      input: {
        from: params.from,
        studentId: params.studentId,
        grade: params.grade ? Number(params.grade) : undefined,
        semester: params.semester ? Number(params.semester) : undefined,
        subject: params.subject,
        seed: params.seed,
      },
    });

    if (result.ok) {
      // isExisting 시 label 은 source key 만 담겨 있음 → HANDOFF_SOURCES 에서 복원
      const source = getHandoffSource(result.bannerOrigin.source);
      bannerOrigin = {
        source: result.bannerOrigin.source,
        label: source?.label ?? result.bannerOrigin.label,
        originPath: result.bannerOrigin.originPath,
      };
      suggestionChips = result.suggestionChips.map((c) => ({
        category: c.category,
        text: c.text,
      }));
    }
  }

  // from 없이 재진입 → 저장된 origin 에서 배너 복원
  if (!bannerOrigin && user) {
    const stored = await getConversationOrigin(conversationId);
    if (stored) {
      const source = getHandoffSource(stored.source);
      bannerOrigin = {
        source: stored.source,
        label: source?.label ?? stored.source,
        originPath: stored.originPath,
      };
    }
  }

  const [initialMessages, conversations] = await Promise.all([
    loadConversationMessages(conversationId),
    user ? listConversations(user.userId) : Promise.resolve([]),
  ]);

  return (
    <ChatShell
      conversationId={conversationId}
      initialMessages={initialMessages}
      conversations={conversations}
      bannerOrigin={bannerOrigin}
      suggestionChips={suggestionChips.length > 0 ? suggestionChips : undefined}
      role={(user?.role as ChatShellRole | undefined) ?? "student"}
    />
  );
}
