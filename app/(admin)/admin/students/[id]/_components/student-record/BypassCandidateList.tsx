"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  updateCandidateStatusAction,
  saveCandidateNotesAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import {
  BYPASS_CANDIDATE_STATUS_LABELS,
  BYPASS_CANDIDATE_SOURCE_LABELS,
} from "@/lib/domains/bypass-major/types";
import type {
  BypassCandidateWithDetails,
  BypassCandidateStatus,
} from "@/lib/domains/bypass-major/types";
import { bypassMajorKeys } from "@/lib/query-options/bypassMajor";
import {
  Star,
  XCircle,
  RotateCcw,
  ChevronDown,
  MessageSquare,
  GitCompare,
} from "lucide-react";

// ─── 상태 뱃지 색상 ─────────────────────────────────

const STATUS_COLORS: Record<BypassCandidateStatus, string> = {
  candidate: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  shortlisted:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const SOURCE_COLORS: Record<string, string> = {
  pre_mapped:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  similarity:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  manual:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

// ─── Props ──────────────────────────────────────────

interface BypassCandidateListProps {
  candidates: BypassCandidateWithDetails[];
  studentId: string;
  schoolYear: number;
  onCompare: (candidateDeptId: string, targetDeptId: string) => void;
}

export function BypassCandidateList({
  candidates,
  studentId,
  schoolYear,
  onCompare,
}: BypassCandidateListProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: bypassMajorKeys.candidates(studentId, schoolYear),
    });
  };

  function handleStatusChange(
    candidateId: string,
    status: BypassCandidateStatus,
  ) {
    startTransition(async () => {
      const result = await updateCandidateStatusAction(candidateId, status);
      if (result.success) invalidate();
    });
  }

  function handleSaveNotes(candidateId: string) {
    startTransition(async () => {
      const result = await saveCandidateNotesAction(candidateId, noteText);
      if (result.success) {
        setEditingNoteId(null);
        invalidate();
      }
    });
  }

  function startEditNote(candidate: BypassCandidateWithDetails) {
    setEditingNoteId(candidate.id);
    setNoteText(candidate.consultant_notes ?? "");
  }

  if (candidates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">
        우회학과 후보가 없습니다. 목표 학과를 선택하면 사전 매핑 후보가 표시됩니다.
      </p>
    );
  }

  // 상태별 그룹 분류
  const shortlisted = candidates.filter((c) => c.status === "shortlisted");
  const active = candidates.filter((c) => c.status === "candidate");
  const rejected = candidates.filter((c) => c.status === "rejected");

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      {/* 요약 */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span>
          총 <span className="font-semibold text-[var(--text-primary)]">{candidates.length}</span>건
        </span>
        {shortlisted.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            선별 {shortlisted.length}
          </span>
        )}
        {rejected.length > 0 && (
          <span className="text-[var(--text-tertiary)]">
            제외 {rejected.length}
          </span>
        )}
      </div>

      {/* 선별 후보 (상단 고정) */}
      {shortlisted.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            선별된 후보
          </h4>
          {shortlisted.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              isExpanded={expandedId === c.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === c.id ? null : c.id)
              }
              onStatusChange={handleStatusChange}
              onCompare={onCompare}
              onEditNote={() => startEditNote(c)}
              isEditingNote={editingNoteId === c.id}
              noteText={noteText}
              onNoteTextChange={setNoteText}
              onSaveNote={() => handleSaveNotes(c.id)}
              onCancelNote={() => setEditingNoteId(null)}
            />
          ))}
        </div>
      )}

      {/* 일반 후보 */}
      {active.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {shortlisted.length > 0 && (
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">
              후보
            </h4>
          )}
          {active.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              isExpanded={expandedId === c.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === c.id ? null : c.id)
              }
              onStatusChange={handleStatusChange}
              onCompare={onCompare}
              onEditNote={() => startEditNote(c)}
              isEditingNote={editingNoteId === c.id}
              noteText={noteText}
              onNoteTextChange={setNoteText}
              onSaveNote={() => handleSaveNotes(c.id)}
              onCancelNote={() => setEditingNoteId(null)}
            />
          ))}
        </div>
      )}

      {/* 제외 후보 (접혀있음) */}
      {rejected.length > 0 && (
        <RejectedGroup
          candidates={rejected}
          expandedId={expandedId}
          onToggleExpand={(id) =>
            setExpandedId(expandedId === id ? null : id)
          }
          onStatusChange={handleStatusChange}
          onCompare={onCompare}
        />
      )}
    </div>
  );
}

// ─── 후보 카드 ──────────────────────────────────────

interface CandidateCardProps {
  candidate: BypassCandidateWithDetails;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (id: string, status: BypassCandidateStatus) => void;
  onCompare: (candidateDeptId: string, targetDeptId: string) => void;
  onEditNote?: () => void;
  isEditingNote?: boolean;
  noteText?: string;
  onNoteTextChange?: (text: string) => void;
  onSaveNote?: () => void;
  onCancelNote?: () => void;
}

function CandidateCard({
  candidate: c,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onCompare,
  onEditNote,
  isEditingNote,
  noteText,
  onNoteTextChange,
  onSaveNote,
  onCancelNote,
}: CandidateCardProps) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] transition-shadow hover:shadow-sm">
      {/* 헤더 */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {c.candidate_department.university_name}
            </span>
            <span className="text-sm text-[var(--text-primary)]">
              {c.candidate_department.department_name}
            </span>
            {/* 상태 뱃지 */}
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                STATUS_COLORS[c.status],
              )}
            >
              {BYPASS_CANDIDATE_STATUS_LABELS[c.status]}
            </span>
            {/* 출처 뱃지 */}
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                SOURCE_COLORS[c.source] ??
                  "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
              )}
            >
              {BYPASS_CANDIDATE_SOURCE_LABELS[c.source]}
            </span>
          </div>
          {/* 점수 */}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
            {c.curriculum_similarity_score != null && (
              <span>
                유사도{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {c.curriculum_similarity_score}%
                </span>
              </span>
            )}
            {c.placement_grade && (
              <span>
                배치{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {c.placement_grade}
                </span>
              </span>
            )}
            {c.competency_fit_score != null && (
              <span>
                역량{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {c.competency_fit_score}
                </span>
              </span>
            )}
            {c.composite_score != null && (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                종합 {c.composite_score}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* 상세 */}
      {isExpanded && (
        <div className="border-t border-[var(--border-secondary)] px-4 py-3">
          <div className="flex flex-col gap-3">
            {/* 근거 */}
            {c.rationale && (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                  추천 근거
                </p>
                <p className="text-sm text-[var(--text-primary)]">
                  {c.rationale}
                </p>
              </div>
            )}

            {/* 학과 정보 */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {c.candidate_department.college_name && (
                <InfoItem
                  label="단과대학"
                  value={c.candidate_department.college_name}
                />
              )}
              {c.candidate_department.major_classification && (
                <InfoItem
                  label="대분류"
                  value={c.candidate_department.major_classification}
                />
              )}
              {c.candidate_department.mid_classification && (
                <InfoItem
                  label="중분류"
                  value={c.candidate_department.mid_classification}
                />
              )}
              {c.candidate_department.campus && (
                <InfoItem
                  label="캠퍼스"
                  value={c.candidate_department.campus}
                />
              )}
            </div>

            {/* 컨설턴트 메모 */}
            {isEditingNote ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={noteText ?? ""}
                  onChange={(e) => onNoteTextChange?.(e.target.value)}
                  rows={3}
                  placeholder="컨설턴트 메모를 입력하세요..."
                  className="w-full resize-none rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelNote}
                    className="rounded-md px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={onSaveNote}
                    className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : c.consultant_notes ? (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                  컨설턴트 메모
                </p>
                <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
                  {c.consultant_notes}
                </p>
              </div>
            ) : null}

            {/* 액션 버튼 */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-secondary)] pt-3">
              {c.status !== "shortlisted" && (
                <button
                  type="button"
                  onClick={() => onStatusChange(c.id, "shortlisted")}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  <Star className="h-3 w-3" />
                  선별
                </button>
              )}
              {c.status !== "rejected" && (
                <button
                  type="button"
                  onClick={() => onStatusChange(c.id, "rejected")}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                >
                  <XCircle className="h-3 w-3" />
                  제외
                </button>
              )}
              {c.status !== "candidate" && (
                <button
                  type="button"
                  onClick={() => onStatusChange(c.id, "candidate")}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] dark:border-gray-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  복원
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onCompare(
                    c.candidate_department_id,
                    c.target_department_id,
                  )
                }
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <GitCompare className="h-3 w-3" />
                커리큘럼 비교
              </button>
              <button
                type="button"
                onClick={onEditNote}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] dark:border-gray-700"
              >
                <MessageSquare className="h-3 w-3" />
                메모
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 제외 후보 그룹 ─────────────────────────────────

function RejectedGroup({
  candidates,
  expandedId,
  onToggleExpand,
  onStatusChange,
  onCompare,
}: {
  candidates: BypassCandidateWithDetails[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onStatusChange: (id: string, status: BypassCandidateStatus) => void;
  onCompare: (candidateDeptId: string, targetDeptId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
        />
        제외된 후보 ({candidates.length}건)
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5 opacity-60">
          {candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              isExpanded={expandedId === c.id}
              onToggleExpand={() => onToggleExpand(c.id)}
              onStatusChange={onStatusChange}
              onCompare={onCompare}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 정보 표시 아이템 ───────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
