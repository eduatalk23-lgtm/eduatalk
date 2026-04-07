"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveChangcheAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordChangche } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import { DraftBlock, DRAFT_BLOCK_STYLES } from "../shared/DraftBlocks";

export function ChangcheDraftCell({
  record,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  record: RecordChangche;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const charLimit = getCharLimit(record.activity_type as "autonomy" | "club" | "career", schoolYear);
  const recordQk = studentRecordKeys.recordTab(studentId, schoolYear);

  const hasAny = !!(record.ai_draft_content || record.content?.trim() || record.confirmed_content?.trim());
  const summaryParts: string[] = [];
  if (record.ai_draft_content) summaryParts.push("AI");
  if (record.content?.trim()) summaryParts.push("가안");
  if (record.confirmed_content?.trim()) summaryParts.push("확정");

  // E1: content 보호, E4: 낙관적 잠금
  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      if (!record.ai_draft_content) return;
      const res = await acceptAiDraftAction(record.id, "changche");
      if (!res.success) {
        if ("error" in res && res.error === "CONTENT_EXISTS") {
          if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
          const forced = await acceptAiDraftAction(record.id, "changche", true);
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
      if (record.content?.trim()) {
        const res = await confirmDraftAction(record.id, "changche");
        if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSaveContent = useCallback(async (content: string) => {
    await saveChangcheAction({
      student_id: studentId, school_year: schoolYear, tenant_id: tenantId,
      grade, activity_type: record.activity_type, content, char_limit: charLimit,
    }, schoolYear);
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [studentId, schoolYear, tenantId, grade, record.activity_type, charLimit, queryClient, recordQk]);

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        <span className="flex-1 text-xs text-[var(--text-secondary)]">
          {hasAny ? summaryParts.join(" / ") : "가안 없음"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-3">
          {/* AI 초안 */}
          <DraftBlock
            label="AI 초안" style={DRAFT_BLOCK_STYLES.ai}
            content={record.ai_draft_content}
          />
          {/* 컨설턴트 가안 */}
          <DraftBlock
            label="컨설턴트 가안" style={DRAFT_BLOCK_STYLES.consultant}
            content={record.content} editable charLimit={charLimit}
            onSave={handleSaveContent}
            importAction={record.ai_draft_content && !record.content?.trim() ? () => acceptAiMutation.mutate() : undefined}
            importLabel="AI 초안 수용" isImporting={acceptAiMutation.isPending}
            neisHint
          />
          {/* 확정본 */}
          <DraftBlock
            label="확정본" style={DRAFT_BLOCK_STYLES.confirmed}
            content={record.confirmed_content}
            importAction={record.content?.trim() ? () => confirmMutation.mutate() : undefined}
            importLabel="가안 확정" isImporting={confirmMutation.isPending}
            staleWarning={
              // E5: 확정본이 있으나 현재 가안과 다르면 경고
              record.confirmed_content?.trim() && record.content?.trim() && record.content !== record.confirmed_content
                ? "가안과 다름" : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
