"use client";

import { useState, useTransition, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  updateCandidateStatusAction,
  saveCandidateNotesAction,
} from "@/lib/domains/bypass-major/actions/bypass";
import { bypassMajorKeys as bpKeys } from "@/lib/query-options/bypassMajor";
import type {
  BypassCandidateWithDetails,
  BypassCandidateStatus,
} from "@/lib/domains/bypass-major/types";
import { Plus, ArrowUpDown } from "lucide-react";
import {
  getUniversityTier,
  UNIVERSITY_TIER_LABELS,
  UNIVERSITY_TIER_ORDER,
  type UniversityTier,
} from "@/lib/constants/university-tiers";
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from "./bypass/bypass-constants";
import { CandidateGroup, RejectedGroup } from "./bypass/CandidateCard";
import { ManualAddForm } from "./bypass/ManualAddForm";

type SortKey = "composite" | "similarity" | "competency" | "university";
type FilterTier = "all" | UniversityTier;
type GroupMode = "status" | "tier";

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

  // 필터 / 정렬 / 그룹
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [filterTier, setFilterTier] = useState<FilterTier>("all");
  const [filterPlacement, setFilterPlacement] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("status");

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

  // ─── 필터링 + 정렬 (useMemo: 카드 펼침/노트 편집 시 재계산 방지) ──
  const filtered = useMemo(
    () =>
      candidates.filter((c) => {
        if (
          filterTier !== "all" &&
          getUniversityTier(c.candidate_department.university_name) !==
            filterTier
        )
          return false;
        if (filterPlacement && c.placement_grade !== filterPlacement)
          return false;
        return true;
      }),
    [candidates, filterTier, filterPlacement],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        switch (sortKey) {
          case "composite":
            return (
              Number(b.composite_score ?? 0) - Number(a.composite_score ?? 0)
            );
          case "similarity":
            return (
              Number(b.curriculum_similarity_score ?? 0) -
              Number(a.curriculum_similarity_score ?? 0)
            );
          case "competency":
            return (
              Number(b.competency_fit_score ?? 0) -
              Number(a.competency_fit_score ?? 0)
            );
          case "university":
            return a.candidate_department.university_name.localeCompare(
              b.candidate_department.university_name,
            );
          default:
            return 0;
        }
      }),
    [filtered, sortKey],
  );

  // 그룹 분류
  const shortlisted = useMemo(
    () => sorted.filter((c) => c.status === "shortlisted"),
    [sorted],
  );
  const active = useMemo(
    () => sorted.filter((c) => c.status === "candidate"),
    [sorted],
  );
  const rejected = useMemo(
    () => sorted.filter((c) => c.status === "rejected"),
    [sorted],
  );

  // 티어별 그룹
  const tierGroups = useMemo(
    () =>
      groupMode === "tier"
        ? UNIVERSITY_TIER_ORDER.map((tier) => ({
            tier,
            label: UNIVERSITY_TIER_LABELS[tier],
            items: sorted.filter(
              (c) =>
                getUniversityTier(c.candidate_department.university_name) ===
                tier,
            ),
          })).filter((g) => g.items.length > 0)
        : null,
    [sorted, groupMode],
  );

  // 배치 등급 종류 (필터 칩용)
  const availablePlacements = useMemo(
    () =>
      [
        ...new Set(candidates.map((c) => c.placement_grade).filter(Boolean)),
      ] as string[],
    [candidates],
  );

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-[var(--text-tertiary)]">
          우회학과 후보가 없습니다. 목표 학과를 선택 후 &ldquo;우회학과
          추천&rdquo; 버튼을 눌러주세요.
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

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      {/* ─── 필터 바 ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {/* 정렬 */}
        <div className="flex items-center gap-1 rounded-md border border-[var(--border-secondary)] px-2 py-1">
          <ArrowUpDown className="h-3 w-3 text-[var(--text-tertiary)]" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-transparent text-[var(--text-secondary)] outline-none"
          >
            <option value="composite">종합점수순</option>
            <option value="similarity">유사도순</option>
            <option value="competency">역량순</option>
            <option value="university">대학명순</option>
          </select>
        </div>

        {/* 그룹 모드 */}
        <div className="flex items-center gap-1 rounded-md border border-[var(--border-secondary)] px-2 py-1">
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="bg-transparent text-[var(--text-secondary)] outline-none"
          >
            <option value="status">상태별</option>
            <option value="tier">대학 티어별</option>
          </select>
        </div>

        {/* Quick Filter 칩 — 대학 티어 */}
        <div className="flex items-center gap-1">
          {(["all", ...UNIVERSITY_TIER_ORDER] as const).map((tier) => {
            const label =
              tier === "all" ? "전체" : UNIVERSITY_TIER_LABELS[tier as UniversityTier];
            const count =
              tier === "all"
                ? candidates.length
                : candidates.filter(
                    (c) =>
                      getUniversityTier(
                        c.candidate_department.university_name,
                      ) === tier,
                  ).length;
            if (tier !== "all" && count === 0) return null;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setFilterTier(tier as FilterTier)}
                className={cn(
                  "rounded-full px-2 py-0.5 transition-colors",
                  filterTier === tier
                    ? "bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                    : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                )}
              >
                {label}{" "}
                {count > 0 && <span className="opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* 배치 안전도 필터 */}
        {availablePlacements.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-tertiary)]">|</span>
            {availablePlacements.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  setFilterPlacement(filterPlacement === p ? null : p)
                }
                className={cn(
                  "rounded-full px-2 py-0.5 transition-colors",
                  filterPlacement === p
                    ? PLACEMENT_COLORS[p]
                    : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                )}
              >
                {PLACEMENT_LABELS[p] ?? p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── 요약 + 수동 추가 ────────────────────── */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span>
          {filtered.length !== candidates.length ? (
            <>
              <span className="font-semibold text-[var(--text-primary)]">
                {filtered.length}
              </span>
              /{candidates.length}건
            </>
          ) : (
            <>
              총{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {candidates.length}
              </span>
              건
            </>
          )}
        </span>
        {shortlisted.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            선별 {shortlisted.length}
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

      {/* ─── 그룹 렌더링 ────────────────────────── */}
      {groupMode === "tier" && tierGroups ? (
        /* 대학 티어별 그룹 */
        tierGroups.map((group) => (
          <CandidateGroup
            key={group.tier}
            heading={`${group.label} (${group.items.length})`}
            headingColor="text-[var(--text-secondary)]"
            candidates={group.items}
            expandedId={expandedId}
            onToggleExpand={(id) =>
              setExpandedId(expandedId === id ? null : id)
            }
            onStatusChange={handleStatusChange}
            onCompare={onCompare}
            editingNoteId={editingNoteId}
            noteText={noteText}
            onEditNote={startEditNote}
            onNoteTextChange={setNoteText}
            onSaveNote={handleSaveNotes}
            onCancelNote={() => setEditingNoteId(null)}
          />
        ))
      ) : (
        /* 상태별 그룹 (기본) */
        <>
          {shortlisted.length > 0 && (
            <CandidateGroup
              heading={`선별된 후보 (${shortlisted.length})`}
              headingColor="text-blue-600 dark:text-blue-400"
              candidates={shortlisted}
              expandedId={expandedId}
              onToggleExpand={(id) =>
                setExpandedId(expandedId === id ? null : id)
              }
              onStatusChange={handleStatusChange}
              onCompare={onCompare}
              editingNoteId={editingNoteId}
              noteText={noteText}
              onEditNote={startEditNote}
              onNoteTextChange={setNoteText}
              onSaveNote={handleSaveNotes}
              onCancelNote={() => setEditingNoteId(null)}
            />
          )}
          {active.length > 0 && (
            <CandidateGroup
              heading={
                shortlisted.length > 0
                  ? `후보 (${active.length})`
                  : undefined
              }
              headingColor="text-[var(--text-secondary)]"
              candidates={active}
              expandedId={expandedId}
              onToggleExpand={(id) =>
                setExpandedId(expandedId === id ? null : id)
              }
              onStatusChange={handleStatusChange}
              onCompare={onCompare}
              editingNoteId={editingNoteId}
              noteText={noteText}
              onEditNote={startEditNote}
              onNoteTextChange={setNoteText}
              onSaveNote={handleSaveNotes}
              onCancelNote={() => setEditingNoteId(null)}
            />
          )}
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
        </>
      )}
    </div>
  );
}
