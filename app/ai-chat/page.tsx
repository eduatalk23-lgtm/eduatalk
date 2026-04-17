import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { ChatShell } from "@/components/ai-chat/ChatShell";
import {
  getConversationOrigin,
  listConversations,
  loadConversationMessages,
  saveOpener,
} from "@/lib/domains/ai-chat/persistence";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { validateAndResolveHandoff } from "@/lib/domains/ai-chat/handoff/validator";
import { buildHandoffOpener } from "@/lib/domains/ai-chat/handoff/opener";
import type { AIConversationPersona } from "@/lib/domains/ai-chat/types";

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
    // from 등 핸드오프 파라미터를 새 UUID 로 이어 전달
    const newId = randomUUID();
    const preserved = new URLSearchParams();
    preserved.set("id", newId);
    for (const key of ["from", "studentId", "grade", "semester", "subject", "seed"] as const) {
      const v = params[key];
      if (v) preserved.set(key, v);
    }
    redirect(`/ai-chat?${preserved.toString()}`);
  }

  const user = await getCurrentUser();

  // 핸드오프 처리: 유효하고 신규 대화면 선공 메시지 + origin 영속화
  let bannerOrigin: {
    source: string;
    label: string;
    originPath: string;
  } | null = null;
  let suggestionChips: Array<{ category: string; text: string }> = [];

  if (user && params.from) {
    const handoff = await validateAndResolveHandoff(
      {
        from: params.from,
        studentId: params.studentId,
        grade: params.grade ? Number(params.grade) : undefined,
        semester: params.semester ? Number(params.semester) : undefined,
        subject: params.subject,
        seed: params.seed,
      },
      user,
    );

    if (handoff.ok) {
      const { assistantMessage, suggestionChips: chips } = buildHandoffOpener(
        handoff.source,
        handoff.resolved,
      );
      suggestionChips = chips.map((c) => ({ category: c.category, text: c.text }));

      const persona = user.role as AIConversationPersona;
      await saveOpener({
        conversationId,
        ownerUserId: user.userId,
        tenantId: user.tenantId,
        persona,
        subjectStudentId: handoff.resolved.resolvedStudentId,
        title: null,
        origin: {
          source: handoff.source.key,
          originPath: handoff.source.originPath,
          params: {
            studentId: params.studentId,
            grade: params.grade ? Number(params.grade) : undefined,
            semester: params.semester ? Number(params.semester) : undefined,
            subject: params.subject,
          },
          enteredAt: new Date().toISOString(),
        },
        assistantMessage,
      });

      bannerOrigin = {
        source: handoff.source.key,
        label: handoff.source.label,
        originPath: handoff.source.originPath,
      };
    }
  }

  // from 없이 재진입 시 저장된 origin 에서 배너 복원
  if (!bannerOrigin && user) {
    const stored = await getConversationOrigin(conversationId);
    if (stored) {
      bannerOrigin = {
        source: stored.source,
        label: stored.source === "scores" ? "성적 화면" : stored.source,
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
    />
  );
}
