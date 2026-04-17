/**
 * Phase T-3: handoff 초기화 공용 함수
 *
 * page.tsx(T-1 완전 전환)와 /api/ai-chat/handoff/initialize(T-3 split 모드)가
 * 공통으로 호출. validateAndResolveHandoff + buildHandoffOpener + saveOpener
 * 순서를 한 곳에 집약.
 *
 * - 이미 대화가 존재(재진입)하면 opener 재생성·저장 X. 현 상태 그대로 반환
 * - 신규 대화면 origin 기록 + 선공 메시지 저장
 */

import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import type { HandoffSeed } from "./sources";
import { validateAndResolveHandoff, type HandoffInput } from "./validator";
import { buildHandoffOpener } from "./opener";
import type { AIConversationPersona } from "../types";
import {
  getConversationOrigin,
  saveOpener,
} from "../persistence";

export type HandoffBanner = {
  source: string;
  label: string;
  originPath: string;
};

export type HandoffInitializeResult =
  | {
      ok: true;
      isExisting: boolean;
      bannerOrigin: HandoffBanner;
      suggestionChips: readonly HandoffSeed[];
      resolvedStudentId: string | null;
    }
  | {
      ok: false;
      reason: string;
    };

export async function initializeHandoff(args: {
  conversationId: string;
  user: CurrentUser;
  input: HandoffInput;
}): Promise<HandoffInitializeResult> {
  // 이미 origin 이 저장된 대화면 재초기화 하지 않음
  const existing = await getConversationOrigin(args.conversationId);
  if (existing) {
    return {
      ok: true,
      isExisting: true,
      bannerOrigin: {
        source: existing.source,
        label: existing.source, // 라벨 복원은 호출자에서 source→label 매핑
        originPath: existing.originPath,
      },
      suggestionChips: [],
      resolvedStudentId:
        typeof existing.params?.studentId === "string"
          ? existing.params.studentId
          : null,
    };
  }

  const handoff = await validateAndResolveHandoff(args.input, args.user);
  if (!handoff.ok) {
    return { ok: false, reason: handoff.reason };
  }

  const { assistantMessage, suggestionChips } = buildHandoffOpener(
    handoff.source,
    handoff.resolved,
  );

  const persona = args.user.role as AIConversationPersona;
  const saveResult = await saveOpener({
    conversationId: args.conversationId,
    ownerUserId: args.user.userId,
    tenantId: args.user.tenantId,
    persona,
    subjectStudentId: handoff.resolved.resolvedStudentId,
    title: null,
    origin: {
      source: handoff.source.key,
      originPath: handoff.source.originPath,
      params: {
        studentId: args.input.studentId,
        grade: args.input.grade,
        semester: args.input.semester,
        subject: args.input.subject,
      },
      enteredAt: new Date().toISOString(),
    },
    assistantMessage,
  });

  if (!saveResult.ok) {
    return { ok: false, reason: saveResult.error ?? "save-failed" };
  }

  return {
    ok: true,
    isExisting: false,
    bannerOrigin: {
      source: handoff.source.key,
      label: handoff.source.label,
      originPath: handoff.source.originPath,
    },
    suggestionChips,
    resolvedStudentId: handoff.resolved.resolvedStudentId,
  };
}
