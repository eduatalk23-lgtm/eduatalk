"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Plus, Play, AlertTriangle, Download } from "lucide-react";
import { PLACEMENT_LABELS, PLACEMENT_COLORS } from "@/lib/domains/admission";
import type { PlacementLevel } from "@/lib/domains/admission";
import { APPLICATION_ROUND_LABELS } from "@/lib/domains/student-record";
import type { RecordApplication } from "@/lib/domains/student-record";
import type {
  AllocationCandidate,
  AllocationRecommendation,
} from "@/lib/domains/admission/allocation/types";
import { TIER_LABELS } from "@/lib/domains/admission/allocation/types";
import { allocationSimulationQueryOptions, allocationKeys } from "@/lib/query-options/allocation";

const ALL_LEVELS: PlacementLevel[] = ["safe", "possible", "bold", "unstable", "danger"];

const EARLY_ROUNDS = Object.entries(APPLICATION_ROUND_LABELS).filter(([k]) =>
  k.startsWith("early_"),
);

type AllocationSimulatorProps = {
  studentId: string;
  existingApplications?: RecordApplication[];
};

export function AllocationSimulator({
  studentId,
  existingApplications = [],
}: AllocationSimulatorProps) {
  const [candidates, setCandidates] = useState<AllocationCandidate[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: recommendations, isFetching, error, refetch } = useQuery(
    allocationSimulationQueryOptions(studentId, candidates),
  );

  const handleSimulate = useCallback(() => {
    if (candidates.length === 0) return;
    queryClient.removeQueries({ queryKey: allocationKeys.simulation(studentId) });
    refetch();
  }, [candidates, refetch, queryClient, studentId]);

  const removeCandidate = useCallback((id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // 기존 수시 지원에서 가져오기
  const importFromApplications = useCallback(() => {
    const earlyApps = existingApplications.filter((a) => a.round.startsWith("early_"));
    const imported: AllocationCandidate[] = earlyApps.map((app) => ({
      id: app.id,
      universityName: app.university_name,
      department: app.department,
      round: app.round,
      placementLevel: "possible" as PlacementLevel, // 기본값 — 컨설턴트가 수정
      interviewDate: app.interview_date ?? null,
    }));

    // 중복 제거
    setCandidates((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newOnes = imported.filter((c) => !existingIds.has(c.id));
      return [...prev, ...newOnes];
    });
  }, [existingApplications]);

  const earlyAppsCount = existingApplications.filter((a) => a.round.startsWith("early_")).length;

  return (
    <div className="flex flex-col gap-6">
      {/* 후보 목록 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">
            후보 대학 ({candidates.length}개)
          </h4>
          <div className="flex gap-2">
            {earlyAppsCount > 0 && (
              <button
                type="button"
                onClick={importFromApplications}
                className="flex items-center gap-1 rounded-md border border-[var(--border-primary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
              >
                <Download size={12} />
                지원현황에서 가져오기 ({earlyAppsCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={12} />
              후보 추가
            </button>
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-[var(--text-tertiary)] dark:border-border">
            후보 대학을 추가하거나 기존 지원현황에서 가져오세요
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                candidate={c}
                onRemove={() => removeCandidate(c.id)}
                onUpdate={(updated) => {
                  setCandidates((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p)),
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 후보 추가 폼 */}
      {showAddForm && (
        <AddCandidateForm
          onAdd={(candidate) => {
            setCandidates((prev) => [...prev, candidate]);
            setShowAddForm(false);
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* 시뮬레이션 실행 버튼 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSimulate}
          disabled={candidates.length === 0 || isFetching}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
            candidates.length > 0 && !isFetching
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "cursor-not-allowed bg-gray-400",
          )}
        >
          <Play size={14} />
          {isFetching ? "시뮬레이션 중..." : "시뮬레이션 실행"}
        </button>
        {candidates.length > 0 && (
          <span className="text-xs text-[var(--text-tertiary)]">
            {candidates.length}개 후보에서 최적 6장 조합 추천
          </span>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          {(error as Error).message}
        </div>
      )}

      {/* 추천 결과 */}
      {recommendations && recommendations.length > 0 && (
        <RecommendationResults recommendations={recommendations} />
      )}
    </div>
  );
}

// ─── 후보 카드 ──────────────────────────────────

function CandidateCard({
  candidate,
  onRemove,
  onUpdate,
}: {
  candidate: AllocationCandidate;
  onRemove: () => void;
  onUpdate: (c: AllocationCandidate) => void;
}) {
  const colors = PLACEMENT_COLORS[candidate.placementLevel];

  return (
    <div className="rounded-lg border border-border bg-white p-3 dark:border-border dark:bg-bg-primary">
      <div className="flex items-start justify-between">
        <div className="flex-1 overflow-hidden">
          <span className="text-xs text-[var(--text-tertiary)]">
            {APPLICATION_ROUND_LABELS[candidate.round] ?? candidate.round}
          </span>
          <h4 className="text-sm font-medium text-[var(--text-primary)]">{candidate.universityName}</h4>
          <p className="text-xs text-[var(--text-secondary)]">{candidate.department}</p>
        </div>
        <select
          value={candidate.placementLevel}
          onChange={(e) =>
            onUpdate({ ...candidate, placementLevel: e.target.value as PlacementLevel })
          }
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            colors.bg, colors.text, colors.darkBg, colors.darkText,
          )}
        >
          {ALL_LEVELS.map((level) => (
            <option key={level} value={level}>{PLACEMENT_LABELS[level]}</option>
          ))}
        </select>
      </div>
      {candidate.interviewDate && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          면접: {candidate.interviewDate}
        </p>
      )}
      <div className="mt-2 border-t border-border pt-2 dark:border-border">
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">삭제</button>
      </div>
    </div>
  );
}

// ─── 후보 추가 폼 ───────────────────────────────

function AddCandidateForm({
  onAdd,
  onClose,
}: {
  onAdd: (c: AllocationCandidate) => void;
  onClose: () => void;
}) {
  const [universityName, setUniversityName] = useState("");
  const [department, setDepartment] = useState("");
  const [round, setRound] = useState("early_comprehensive");
  const [level, setLevel] = useState<PlacementLevel>("possible");
  const [interviewDate, setInterviewDate] = useState("");

  const handleSubmit = () => {
    if (!universityName.trim() || !department.trim()) return;
    onAdd({
      id: `candidate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      universityName: universityName.trim(),
      department: department.trim(),
      round,
      placementLevel: level,
      interviewDate: interviewDate || null,
    });
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">후보 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)]">취소</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <input
          value={universityName}
          onChange={(e) => setUniversityName(e.target.value)}
          placeholder="대학명 *"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="학과 *"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
        />
        <select
          value={round}
          onChange={(e) => setRound(e.target.value)}
          className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
        >
          {EARLY_ROUNDS.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as PlacementLevel)}
          className="rounded-md border border-border bg-white px-2 py-2 text-sm dark:border-border dark:bg-bg-primary"
        >
          {ALL_LEVELS.map((l) => (
            <option key={l} value={l}>{PLACEMENT_LABELS[l]}</option>
          ))}
        </select>
        <input
          type="date"
          value={interviewDate}
          onChange={(e) => setInterviewDate(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          placeholder="면접일"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!universityName.trim() || !department.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}

// ─── 추천 결과 ──────────────────────────────────

function RecommendationResults({
  recommendations,
}: {
  recommendations: AllocationRecommendation[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">
        추천 조합 (상위 {recommendations.length}개)
      </h4>

      {recommendations.map((rec, idx) => (
        <RecommendationCard key={idx} recommendation={rec} rank={idx + 1} />
      ))}
    </div>
  );
}

function RecommendationCard({
  recommendation,
  rank,
}: {
  recommendation: AllocationRecommendation;
  rank: number;
}) {
  const { byTier, score, warnings, interviewConflicts } = recommendation;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {rank}
          </span>
          <span className="text-sm font-medium text-[var(--text-primary)]">추천 조합</span>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-xs font-bold",
          score >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : score >= 60 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : score >= 40 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
        )}>
          {score}점
        </span>
      </div>

      {/* 티어별 그룹 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["safety", "target", "reach"] as const).map((tier) => {
          const slots = byTier[tier];
          if (slots.length === 0) return null;
          const tierColors = {
            safety: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
            target: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
            reach: "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
          };
          return (
            <div key={tier} className={cn("rounded-md border p-2", tierColors[tier])}>
              <span className="mb-1.5 block text-3xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {TIER_LABELS[tier]} ({slots.length})
              </span>
              <div className="flex flex-col gap-1">
                {slots.map((s) => {
                  const colors = PLACEMENT_COLORS[s.placementLevel];
                  return (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <span className={cn("rounded-full px-1.5 py-0.5 text-3xs font-medium", colors.bg, colors.text, colors.darkBg, colors.darkText)}>
                        {PLACEMENT_LABELS[s.placementLevel]}
                      </span>
                      <span className="text-xs text-[var(--text-primary)]">{s.universityName}</span>
                      <span className="text-3xs text-[var(--text-tertiary)]">{s.department}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 경고 */}
      {warnings.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle size={12} />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
