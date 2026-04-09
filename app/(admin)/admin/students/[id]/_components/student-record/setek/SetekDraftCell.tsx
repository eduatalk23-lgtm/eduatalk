"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MultiRecordDraftBlock, DRAFT_BLOCK_STYLES } from "../shared/DraftBlocks";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import type { RecordSetek } from "@/lib/domains/student-record";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";

export function DraftExpandableCell({
  records,
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  perspective,
}: {
  records: RecordSetek[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  /** 관점별 표시 분기. AI=ai_draft만, consultant=content/confirmed만, null=전체. */
  perspective?: LayerPerspective | null;
}) {
  const queryClient = useQueryClient();
  const recordQk = ["studentRecord", "recordTab", studentId] as const;

  // 사용자 모델: 관점 = 단일 슬라이스. AI=ai_draft만, 컨설턴트=content만 (확정은 ConfirmStatusBadge sub-state).
  // 관점이 명시되지 않은 레거시 호출만 3블록 모두 표시.
  const showAi = perspective === "ai" || !perspective;
  const showConsultant = perspective === "consultant" || !perspective;
  const showConfirmed = !perspective; // 관점 지정 시 별도 확정 블록 숨김 (배지로 sub-state 표시)

  const [draftError, setDraftError] = useState<string | null>(null);

  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      for (const r of records) {
        if (!r.ai_draft_content) continue;
        const res = await acceptAiDraftAction(r.id, "setek");
        if (!res.success) {
          if ("error" in res && res.error === "CONTENT_EXISTS") {
            if (!confirm(`${r.semester}학기 세특에 기존 가안이 있습니다. AI 초안으로 덮어쓰시겠습니까?`)) continue;
            const forced = await acceptAiDraftAction(r.id, "setek", true);
            if (!forced.success && "error" in forced && forced.error === "CONFLICT") {
              throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
            }
          } else if ("error" in res && res.error === "CONFLICT") {
            throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
          } else {
            throw new Error("error" in res ? res.error : "수용 실패");
          }
        }
      }
    },
    onSuccess: async () => { setDraftError(null); await queryClient.invalidateQueries({ queryKey: recordQk }); },
    onError: (err: Error) => setDraftError(err.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      for (const r of records) {
        if (r.content?.trim()) {
          const res = await confirmDraftAction(r.id, "setek");
          if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
        }
      }
    },
    onSuccess: async () => { setDraftError(null); await queryClient.invalidateQueries({ queryKey: recordQk }); },
    onError: (err: Error) => setDraftError(err.message),
  });

  const handleSaveContent = useCallback(async (recordId: string, content: string) => {
    const setek = records.find((r) => r.id === recordId);
    if (!setek) return;
    await saveSetekAction({
      student_id: studentId,
      school_year: schoolYear,
      tenant_id: tenantId,
      grade,
      semester: setek.semester,
      subject_id: setek.subject_id,
      content,
      char_limit: charLimit,
    });
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [records, studentId, schoolYear, tenantId, grade, charLimit, queryClient, recordQk]);

  return (
    <div className="flex flex-col gap-1.5">
      {draftError && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {draftError}
          <button type="button" className="ml-2 underline" onClick={() => setDraftError(null)}>닫기</button>
        </p>
      )}
      <div className="flex flex-col gap-3">
        {showAi && (
          <MultiRecordDraftBlock
            label="AI 초안"
            style={DRAFT_BLOCK_STYLES.ai}
            records={records}
            getContent={(r) => r.ai_draft_content}
          />
        )}
        {showConsultant && (
          <MultiRecordDraftBlock
            label="컨설턴트 가안"
            style={DRAFT_BLOCK_STYLES.consultant}
            records={records}
            getContent={(r) => r.content}
            editable
            onSave={handleSaveContent}
            charLimit={charLimit}
            importAction={records.some((r) => r.ai_draft_content && !r.content?.trim()) ? () => acceptAiMutation.mutate() : undefined}
            importLabel={(() => {
              const acceptableCount = records.filter((r) => r.ai_draft_content && !r.content?.trim()).length;
              return acceptableCount > 1 ? `AI 초안 수용 (${acceptableCount}건)` : "AI 초안 수용";
            })()}
            isImporting={acceptAiMutation.isPending}
            neisHint
          />
        )}
        {showConfirmed && (
          <MultiRecordDraftBlock
            label="확정본"
            style={DRAFT_BLOCK_STYLES.confirmed}
            records={records}
            getContent={(r) => r.confirmed_content}
            importAction={records.some((r) => r.content?.trim()) ? () => confirmMutation.mutate() : undefined}
            importLabel={(() => {
              const confirmableCount = records.filter((r) => r.content?.trim()).length;
              return confirmableCount > 1 ? `가안 확정 (${confirmableCount}건)` : "가안 확정";
            })()}
            isImporting={confirmMutation.isPending}
            staleWarning={
              records.some(
                (r) => r.confirmed_content?.trim() && r.content?.trim() && r.content !== r.confirmed_content,
              ) ? "가안과 다름" : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
