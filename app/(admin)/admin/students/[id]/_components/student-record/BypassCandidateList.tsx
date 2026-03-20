"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  updateCandidateStatusAction,
  saveCandidateNotesAction,
  addManualCandidateAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import {
  departmentSearchQueryOptions,
  bypassMajorKeys as bpKeys,
} from "@/lib/query-options/bypassMajor";
import {
  BYPASS_CANDIDATE_STATUS_LABELS,
  BYPASS_CANDIDATE_SOURCE_LABELS,
} from "@/lib/domains/bypass-major/types";
import type {
  BypassCandidateWithDetails,
  BypassCandidateStatus,
  UniversityDepartment,
  DepartmentSearchFilter,
} from "@/lib/domains/bypass-major/types";
import {
  Star,
  XCircle,
  RotateCcw,
  ChevronDown,
  MessageSquare,
  GitCompare,
  Plus,
  Search,
  Building2,
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
  targetDeptId: string | null;
  tenantId: string;
}

export function BypassCandidateList({
  candidates,
  studentId,
  schoolYear,
  onCompare,
  targetDeptId,
  tenantId,
}: BypassCandidateListProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: bpKeys.candidates(studentId, schoolYear),
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
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-[var(--text-tertiary)]">
          우회학과 후보가 없습니다. 목표 학과를 선택 후 &ldquo;우회학과 추천&rdquo; 버튼을 눌러주세요.
        </p>
        {targetDeptId && (
          <>
            {!showManualAdd ? (
              <button
                type="button"
                onClick={() => setShowManualAdd(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Plus className="h-3.5 w-3.5" />
                수동 추가
              </button>
            ) : (
              <ManualAddForm
                studentId={studentId}
                targetDeptId={targetDeptId}
                schoolYear={schoolYear}
                tenantId={tenantId}
                onSuccess={() => {
                  setShowManualAdd(false);
                  invalidate();
                }}
                onCancel={() => setShowManualAdd(false)}
              />
            )}
          </>
        )}
      </div>
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
      {/* 요약 + 수동 추가 */}
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
        {targetDeptId && (
          <button
            type="button"
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--border-primary)] px-2 py-0.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <Plus className="h-3 w-3" />
            수동 추가
          </button>
        )}
      </div>

      {/* 수동 추가 폼 */}
      {showManualAdd && targetDeptId && (
        <ManualAddForm
          studentId={studentId}
          targetDeptId={targetDeptId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          onSuccess={() => {
            setShowManualAdd(false);
            invalidate();
          }}
          onCancel={() => setShowManualAdd(false)}
        />
      )}

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
            {c.competency_fit_score != null && (
              <span>
                역량{" "}
                <span className={cn(
                  "font-medium",
                  c.competency_fit_score >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                  c.competency_fit_score >= 50 ? "text-[var(--text-primary)]" :
                  "text-amber-600 dark:text-amber-400"
                )}>
                  {c.competency_fit_score}점
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
                <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
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

// ─── 수동 추가 폼 ───────────────────────────────────

function ManualAddForm({
  studentId,
  targetDeptId,
  schoolYear,
  tenantId,
  onSuccess,
  onCancel,
}: {
  studentId: string;
  targetDeptId: string;
  schoolYear: number;
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DepartmentSearchFilter>({
    page: 1,
    pageSize: 10,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchRes, isFetching, refetch } = useQuery(
    departmentSearchQueryOptions(filter),
  );

  const results =
    searchRes?.success === true ? searchRes.data?.data ?? [] : [];

  const debouncedSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (q.trim().length < 1) return;
        const newFilter: DepartmentSearchFilter = {
          query: q.trim(),
          page: 1,
          pageSize: 10,
        };
        setFilter(newFilter);
        queryClient.removeQueries({
          queryKey: bpKeys.search(newFilter),
        });
        setTimeout(() => refetch(), 0);
      }, 300);
    },
    [queryClient, refetch],
  );

  function handleSelect(dept: UniversityDepartment) {
    setIsOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await addManualCandidateAction({
        studentId,
        targetDeptId,
        candidateDeptId: dept.id,
        schoolYear,
        tenantId,
      });
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error ?? "추가에 실패했습니다.");
      }
    });
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          수동 후보 추가
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          취소
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            debouncedSearch(e.target.value);
          }}
          onFocus={() => query.trim().length >= 1 && setIsOpen(true)}
          placeholder="대학명 또는 학과명 검색..."
          disabled={isPending}
          className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        {(isFetching || isPending) && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </span>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && query.trim().length >= 1 && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-md">
          {results.length === 0 && !isFetching ? (
            <p className="px-3 py-2 text-center text-xs text-[var(--text-tertiary)]">
              검색 결과 없음
            </p>
          ) : (
            results.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => handleSelect(dept)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-primary)]">
                    <span className="font-medium">{dept.university_name}</span>{" "}
                    {dept.department_name}
                  </p>
                  {dept.major_classification && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {dept.major_classification}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
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
