"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  BYPASS_CANDIDATE_STATUS_LABELS,
  BYPASS_CANDIDATE_SOURCE_LABELS,
} from "@/lib/domains/bypass-major/types";
import type {
  BypassCandidateWithDetails,
  BypassCandidateStatus,
} from "@/lib/domains/bypass-major/types";
import {
  Star,
  XCircle,
  RotateCcw,
  ChevronDown,
  MessageSquare,
  GitCompare,
} from "lucide-react";
import {
  getUniversityTier,
  UNIVERSITY_TIER_LABELS,
} from "@/lib/constants/university-tiers";
import {
  STATUS_COLORS,
  SOURCE_COLORS,
  PLACEMENT_LABELS,
  PLACEMENT_COLORS,
  PLACE_SOURCE_LABEL,
} from "./bypass-constants";

// ─── InfoItem ──────────────────────────────────────

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

// ─── CandidateCard ──────────────────────────────────────

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

export function CandidateCard({
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
  // Supabase numeric 컬럼은 문자열로 반환될 수 있으므로 명시적 변환
  const simScore =
    c.curriculum_similarity_score != null
      ? Number(c.curriculum_similarity_score)
      : null;
  const compScore =
    c.competency_fit_score != null ? Number(c.competency_fit_score) : null;
  const totalScore =
    c.composite_score != null ? Number(c.composite_score) : null;
  const placeScore =
    c.placement_score != null ? Number(c.placement_score) : null;
  const placeSource = c.placement_source as "mock" | "gpa" | "none" | null;

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
          {/* 점수 + 배치 뱃지 */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            {totalScore != null && (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                종합 {totalScore}
              </span>
            )}
            {(() => {
              const pg = String(c.placement_grade ?? "");
              const label = PLACEMENT_LABELS[pg];
              if (!label) return null;
              return (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    PLACEMENT_COLORS[pg],
                  )}
                >
                  {label}
                </span>
              );
            })()}
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {
                UNIVERSITY_TIER_LABELS[
                  getUniversityTier(c.candidate_department.university_name)
                ]
              }
            </span>
          </div>
          {/* 3축 미니 바 (펼치지 않아도 한눈에) */}
          {(simScore != null || compScore != null || placeScore != null) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              {simScore != null && (
                <div className="flex items-center gap-1">
                  <span className="w-7 text-[var(--text-tertiary)]">유사</span>
                  <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(simScore, 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-[var(--text-secondary)]">
                    {simScore}%
                  </span>
                </div>
              )}
              {compScore != null && (
                <div className="flex items-center gap-1">
                  <span className="w-7 text-[var(--text-tertiary)]">역량</span>
                  <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(compScore, 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-[var(--text-secondary)]">
                    {compScore}점
                  </span>
                </div>
              )}
              {placeScore != null && placeSource !== "none" && (
                <div className="flex items-center gap-1">
                  <span className="w-7 text-[var(--text-tertiary)]">배치</span>
                  <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-amber-500"
                      style={{ width: `${Math.min(placeScore, 100)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-medium text-[var(--text-secondary)]">
                    {placeScore}점
                  </span>
                  <span className="text-[9px] text-[var(--text-tertiary)]">
                    {placeSource ? PLACE_SOURCE_LABEL[placeSource] : ""}
                  </span>
                </div>
              )}
            </div>
          )}
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
            {/* 3축 분석 근거 */}
            {c.curriculum_rationale ||
            c.competency_rationale ||
            c.placement_rationale ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  분석 근거
                </p>
                <div className="grid gap-1.5 text-xs">
                  {c.curriculum_rationale && (
                    <div className="flex items-start gap-2 rounded-md bg-[var(--surface-secondary)] px-2.5 py-1.5">
                      <span className="shrink-0 font-medium text-indigo-600 dark:text-indigo-400">
                        유사도
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {c.curriculum_rationale}
                      </span>
                    </div>
                  )}
                  {c.competency_rationale && (
                    <div className="flex items-start gap-2 rounded-md bg-[var(--surface-secondary)] px-2.5 py-1.5">
                      <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                        역량
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {c.competency_rationale}
                      </span>
                    </div>
                  )}
                  {c.placement_rationale && (
                    <div className="flex items-start gap-2 rounded-md bg-[var(--surface-secondary)] px-2.5 py-1.5">
                      <span className="shrink-0 font-medium text-amber-600 dark:text-amber-400">
                        배치
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {c.placement_rationale}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : c.rationale ? (
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
                  추천 근거
                </p>
                <p className="whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
                  {c.rationale}
                </p>
              </div>
            ) : null}

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

// ─── CandidateGroup ──────────────────────────────────────

interface CandidateGroupProps {
  heading?: string;
  headingColor?: string;
  candidates: BypassCandidateWithDetails[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onStatusChange: (id: string, status: BypassCandidateStatus) => void;
  onCompare: (candidateDeptId: string, targetDeptId: string) => void;
  editingNoteId: string | null;
  noteText: string;
  onEditNote: (c: BypassCandidateWithDetails) => void;
  onNoteTextChange: (text: string) => void;
  onSaveNote: (id: string) => void;
  onCancelNote: () => void;
}

export function CandidateGroup({
  heading,
  headingColor,
  candidates: items,
  expandedId,
  onToggleExpand,
  onStatusChange,
  onCompare,
  editingNoteId,
  noteText,
  onEditNote,
  onNoteTextChange,
  onSaveNote,
  onCancelNote,
}: CandidateGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {heading && (
        <h4 className={cn("text-xs font-semibold", headingColor)}>{heading}</h4>
      )}
      {items.map((c) => (
        <CandidateCard
          key={c.id}
          candidate={c}
          isExpanded={expandedId === c.id}
          onToggleExpand={() => onToggleExpand(c.id)}
          onStatusChange={onStatusChange}
          onCompare={onCompare}
          onEditNote={() => onEditNote(c)}
          isEditingNote={editingNoteId === c.id}
          noteText={noteText}
          onNoteTextChange={onNoteTextChange}
          onSaveNote={() => onSaveNote(c.id)}
          onCancelNote={onCancelNote}
        />
      ))}
    </div>
  );
}

// ─── RejectedGroup ──────────────────────────────────────

interface RejectedGroupProps {
  candidates: BypassCandidateWithDetails[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onStatusChange: (id: string, status: BypassCandidateStatus) => void;
  onCompare: (candidateDeptId: string, targetDeptId: string) => void;
}

export function RejectedGroup({
  candidates,
  expandedId,
  onToggleExpand,
  onStatusChange,
  onCompare,
}: RejectedGroupProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
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
