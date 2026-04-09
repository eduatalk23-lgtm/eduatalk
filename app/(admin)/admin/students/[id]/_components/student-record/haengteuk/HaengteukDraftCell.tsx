"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveHaengteukAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordHaengteuk } from "@/lib/domains/student-record";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";
import { DraftBlock, DRAFT_BLOCK_STYLES } from "../shared/DraftBlocks";

export function HaengteukDraftCell({
  haengteuk, studentId, schoolYear, tenantId, grade, charLimit, perspective,
}: {
  haengteuk: RecordHaengteuk;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  /** 관점별 단일 슬라이스. AI=ai_draft, consultant=content, null=전체 (레거시). */
  perspective?: LayerPerspective | null;
}) {
  const queryClient = useQueryClient();
  const recordQk = studentRecordKeys.recordTab(studentId, schoolYear);

  const showAi = perspective === "ai" || !perspective;
  const showConsultant = perspective === "consultant" || !perspective;
  const showConfirmed = !perspective;

  // E1: content 보호, E4: 낙관적 잠금
  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await acceptAiDraftAction(haengteuk.id, "haengteuk");
      if (!res.success) {
        if ("error" in res && res.error === "CONTENT_EXISTS") {
          if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
          const forced = await acceptAiDraftAction(haengteuk.id, "haengteuk", true);
          if (!forced.success && "error" in forced && forced.error === "CONFLICT") {
            throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
          }
        } else if ("error" in res && res.error === "CONFLICT") {
          throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
        } else {
          throw new Error("error" in res ? res.error : "수용 실패");
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await confirmDraftAction(haengteuk.id, "haengteuk");
      if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSaveContent = useCallback(async (val: string) => {
    await saveHaengteukAction({ student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade, content: val, char_limit: charLimit }, schoolYear);
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [studentId, schoolYear, tenantId, grade, charLimit, queryClient, recordQk]);

  return (
    <div className="flex flex-col gap-3">
      {showAi && (
        <DraftBlock label="AI 초안" style={DRAFT_BLOCK_STYLES.ai} content={haengteuk.ai_draft_content} />
      )}
      {showConsultant && (
        <DraftBlock label="컨설턴트 가안" style={DRAFT_BLOCK_STYLES.consultant} content={haengteuk.content} editable charLimit={charLimit} onSave={handleSaveContent}
          importAction={haengteuk.ai_draft_content && !haengteuk.content?.trim() ? () => acceptAiMutation.mutate() : undefined}
          importLabel="AI 초안 수용" isImporting={acceptAiMutation.isPending}
          neisHint />
      )}
      {showConfirmed && (
        <DraftBlock label="확정본" style={DRAFT_BLOCK_STYLES.confirmed} content={haengteuk.confirmed_content}
          importAction={haengteuk.content?.trim() ? () => confirmMutation.mutate() : undefined}
          importLabel="가안 확정" isImporting={confirmMutation.isPending}
          staleWarning={
            haengteuk.confirmed_content?.trim() && haengteuk.content?.trim() && haengteuk.content !== haengteuk.confirmed_content
              ? "가안과 다름" : undefined
          }
        />
      )}
    </div>
  );
}
