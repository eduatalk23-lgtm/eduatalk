"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { BarChart3 } from "lucide-react";
import {
  PLACEMENT_LABELS,
  PLACEMENT_COLORS,
  convertToSuneungScores,
  createEmptyMockScoreInput,
} from "@/lib/domains/admission";
import type {
  PlacementLevel,
  PlacementAnalysisResult,
} from "@/lib/domains/admission";
import type { ExamType, PlacementSnapshot, PlacementChange } from "@/lib/domains/admission/placement/types";
import type { MockScoreInput } from "@/lib/domains/admission/placement/score-converter";
import { compareSnapshots } from "@/lib/domains/admission/placement/engine";
import { placementAnalysisQueryOptions } from "@/lib/query-options/placement";
import {
  SCIENCE_INQUIRY,
  SOCIAL_INQUIRY,
} from "@/lib/domains/admission/calculator/constants";
import { PlacementResults } from "./PlacementResults";

type PlacementDashboardProps = {
  studentId: string;
  tenantId?: string;
};

const ALL_LEVELS: PlacementLevel[] = ["safe", "possible", "bold", "unstable", "danger"];

const INQUIRY_SUBJECTS = [...SOCIAL_INQUIRY, ...SCIENCE_INQUIRY];

// ─── 메인 컴포넌트 ─────────────────────────────────

export function PlacementDashboard({ studentId, tenantId }: PlacementDashboardProps) {
  const [scoreInput, setScoreInput] = useState<MockScoreInput>(createEmptyMockScoreInput);
  const [examType, setExamType] = useState<ExamType>("estimated");
  const [estimatedSnapshot, setEstimatedSnapshot] = useState<PlacementSnapshot | null>(null);
  const [actualSnapshot, setActualSnapshot] = useState<PlacementSnapshot | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const queryClient = useQueryClient();

  // 최신 모의고사 자동 로드
  const { data: latestMockInput } = useQuery({
    queryKey: ["mockScores", "latestScoreInput", studentId, tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { fetchLatestMockScoreInputAction } = await import("@/lib/domains/score/actions/core");
      return fetchLatestMockScoreInputAction(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (latestMockInput && !autoLoaded && scoreInput.koreanRaw == null && scoreInput.mathRaw == null) {
      setScoreInput(latestMockInput.scoreInput);
      setAutoLoaded(true);
    }
  }, [latestMockInput, autoLoaded, scoreInput.koreanRaw, scoreInput.mathRaw]);

  const suneungScores = useMemo(() => {
    // 최소 국어 or 수학 입력 여부 확인
    if (scoreInput.koreanRaw == null && scoreInput.mathRaw == null) return null;
    return convertToSuneungScores(scoreInput);
  }, [scoreInput]);

  const { data, isFetching, error, refetch } = useQuery(
    placementAnalysisQueryOptions(studentId, suneungScores),
  );

  const handleAnalyze = useCallback(() => {
    if (!suneungScores) return;
    // queryKey 무효화 후 refetch
    queryClient.removeQueries({ queryKey: ["placement", "analysis", studentId] });
    refetch();
  }, [suneungScores, refetch, queryClient, studentId]);

  // 분석 완료 시 현재 examType에 맞는 스냅샷 저장
  useMemo(() => {
    if (!data) return;
    const snapshot: PlacementSnapshot = {
      examType,
      analyzedAt: new Date().toISOString(),
      result: data,
    };
    if (examType === "estimated") {
      setEstimatedSnapshot(snapshot);
    } else {
      setActualSnapshot(snapshot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 비교 결과
  const comparisonChanges = useMemo<PlacementChange[] | null>(() => {
    if (!estimatedSnapshot || !actualSnapshot) return null;
    return compareSnapshots(estimatedSnapshot, actualSnapshot);
  }, [estimatedSnapshot, actualSnapshot]);

  return (
    <div className="flex flex-col gap-6">
      {/* 가채점/실채점 토글 */}
      <div className="flex items-center gap-4">
        <div className="flex rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] p-0.5">
          {(["estimated", "actual"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setExamType(type)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                examType === type
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {type === "estimated" ? "가채점" : "실채점"}
            </button>
          ))}
        </div>
        {estimatedSnapshot && (
          <span className="text-xs text-emerald-600">가채점 저장됨</span>
        )}
        {actualSnapshot && (
          <span className="text-xs text-blue-600">실채점 저장됨</span>
        )}
      </div>

      {autoLoaded && latestMockInput && (
        <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          <span>최근 모의고사에서 불러옴 ({latestMockInput.examTitle}, {latestMockInput.examDate})</span>
          <button type="button" onClick={() => { setScoreInput(createEmptyMockScoreInput()); setAutoLoaded(false); }} className="underline">초기화</button>
        </div>
      )}

      <ScoreInputForm
        value={scoreInput}
        onChange={setScoreInput}
        onAnalyze={handleAnalyze}
        isLoading={isFetching}
        hasScores={suneungScores !== null}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
          {(error as Error).message}
        </div>
      )}

      {data && <PlacementResults data={data} />}

      {/* 가채점 ↔ 실채점 비교 뷰 */}
      {comparisonChanges && comparisonChanges.length > 0 && (
        <ComparisonView changes={comparisonChanges} />
      )}
    </div>
  );
}

// ─── 점수 입력 폼 ────────────────────────────────

function ScoreInputForm({
  value,
  onChange,
  onAnalyze,
  isLoading,
  hasScores,
}: {
  value: MockScoreInput;
  onChange: (v: MockScoreInput) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  hasScores: boolean;
}) {
  const update = (patch: Partial<MockScoreInput>) => onChange({ ...value, ...patch });

  const parseNum = (v: string): number | null => {
    if (v === "") return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const parseInt_ = (v: string): number | null => {
    if (v === "") return null;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  };

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        <BarChart3 size={16} />
        수능/모평 점수 입력
      </h4>

      {/* F5: 과목-점수 블록 그룹화 */}
      <div className="flex flex-col gap-3">
        {/* 주요 과목: 국어 + 수학 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 국어 블록 */}
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">국어 *</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">원점수</label>
                <input type="number" min={0} max={100} value={value.koreanRaw ?? ""}
                  onChange={(e) => update({ koreanRaw: parseNum(e.target.value) })}
                  className={cn("w-full rounded-md border px-2 py-1.5 text-sm bg-[var(--surface-primary)]",
                    !hasScores ? "border-amber-300" : "border-[var(--border-primary)]")}
                  placeholder="0~100" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">표준점수</label>
                <input type="number" value={value.korean ?? ""}
                  onChange={(e) => update({ korean: parseNum(e.target.value) })}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
                  placeholder="표준" />
              </div>
            </div>
          </fieldset>

          {/* 수학 블록 */}
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">수학 *</legend>
            <div className="mb-2">
              <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">선택과목</label>
              <select value={value.mathType}
                onChange={(e) => update({ mathType: e.target.value as MockScoreInput["mathType"] })}
                className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
                <option value="미적분">미적분</option>
                <option value="기하">기하</option>
                <option value="확률과통계">확률과통계</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">원점수</label>
                <input type="number" min={0} max={100} value={value.mathRaw ?? ""}
                  onChange={(e) => update({ mathRaw: parseNum(e.target.value) })}
                  className={cn("w-full rounded-md border px-2 py-1.5 text-sm bg-[var(--surface-primary)]",
                    !hasScores ? "border-amber-300" : "border-[var(--border-primary)]")}
                  placeholder="0~100" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">표준점수</label>
                <input type="number" value={value.math ?? ""}
                  onChange={(e) => update({ math: parseNum(e.target.value) })}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
                  placeholder="표준" />
              </div>
            </div>
          </fieldset>
        </div>

        {/* 등급 과목: 영어 + 한국사 + 제2외국어 */}
        <div className="grid grid-cols-3 gap-3">
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">영어</legend>
            <select value={value.english ?? ""}
              onChange={(e) => update({ english: parseInt_(e.target.value) })}
              className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
              <option value="">선택</option>
              {[1,2,3,4,5,6,7,8,9].map((g) => <option key={g} value={g}>{g}등급</option>)}
            </select>
          </fieldset>
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">한국사</legend>
            <select value={value.history ?? ""}
              onChange={(e) => update({ history: parseInt_(e.target.value) })}
              className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
              <option value="">선택</option>
              {[1,2,3,4,5,6,7,8,9].map((g) => <option key={g} value={g}>{g}등급</option>)}
            </select>
          </fieldset>
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">제2외국어</legend>
            <select value={value.foreignLang ?? ""}
              onChange={(e) => update({ foreignLang: parseInt_(e.target.value) })}
              className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
              <option value="">미응시</option>
              {[1,2,3,4,5,6,7,8,9].map((g) => <option key={g} value={g}>{g}등급</option>)}
            </select>
          </fieldset>
        </div>

        {/* 탐구 과목: 블록 그룹화 + 중복 선택 방지 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">탐구1</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">과목</label>
                <select value={value.inquiry1Subject}
                  onChange={(e) => {
                    update({ inquiry1Subject: e.target.value });
                    if (e.target.value && e.target.value === value.inquiry2Subject) {
                      update({ inquiry1Subject: e.target.value, inquiry2Subject: "" });
                    }
                  }}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
                  <option value="">선택</option>
                  {INQUIRY_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">원점수</label>
                <input type="number" min={0} max={50} value={value.inquiry1Raw ?? ""}
                  onChange={(e) => update({ inquiry1Raw: parseNum(e.target.value) })}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
                  placeholder="0~50" />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-lg border border-[var(--border-secondary)] p-3">
            <legend className="px-1 text-xs font-semibold text-[var(--text-secondary)]">탐구2</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">과목</label>
                <select value={value.inquiry2Subject}
                  onChange={(e) => {
                    update({ inquiry2Subject: e.target.value });
                    if (e.target.value && e.target.value === value.inquiry1Subject) {
                      update({ inquiry2Subject: e.target.value, inquiry1Subject: "" });
                    }
                  }}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm">
                  <option value="">선택</option>
                  {INQUIRY_SUBJECTS.filter((s) => s !== value.inquiry1Subject).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[var(--text-tertiary)]">원점수</label>
                <input type="number" min={0} max={50} value={value.inquiry2Raw ?? ""}
                  onChange={(e) => update({ inquiry2Raw: parseNum(e.target.value) })}
                  className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
                  placeholder="0~50" />
              </div>
            </div>
          </fieldset>
        </div>
      </div>

      {/* 실행 버튼 */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!hasScores || isLoading}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
            hasScores && !isLoading
              ? "bg-indigo-600 hover:bg-indigo-700"
              : "cursor-not-allowed bg-gray-400",
          )}
        >
          {isLoading ? "분석 중..." : "배치 분석 실행"}
        </button>
        {!hasScores && (
          <span className="text-xs text-[var(--text-tertiary)]">
            국어 또는 수학 점수를 입력하세요
          </span>
        )}
      </div>
    </div>
  );
}

// ─── 가채점/실채점 비교 뷰 ──────────────────────

function ComparisonView({ changes }: { changes: PlacementChange[] }) {
  const levelChanged = changes.filter((c) => c.levelChanged);
  const improved = changes.filter((c) => c.scoreDiff > 0);
  const declined = changes.filter((c) => c.scoreDiff < 0);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <h4 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
        가채점 → 실채점 비교
      </h4>

      {/* 요약 */}
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        <span className="text-[var(--text-secondary)]">총 {changes.length}개 학과</span>
        <span className="text-emerald-600">상승 {improved.length}</span>
        <span className="text-red-500">하락 {declined.length}</span>
        <span className="text-amber-600">레벨 변동 {levelChanged.length}</span>
      </div>

      {/* 변동 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-indigo-200 text-left text-[var(--text-tertiary)] dark:border-indigo-700">
              <th className="py-1.5 pr-3">대학</th>
              <th className="py-1.5 pr-3">학과</th>
              <th className="py-1.5 pr-3 text-center">가채점</th>
              <th className="py-1.5 pr-3 text-center">실채점</th>
              <th className="py-1.5 text-right">점수 변동</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change, idx) => {
              const estColors = PLACEMENT_COLORS[change.estimatedLevel];
              const actColors = PLACEMENT_COLORS[change.actualLevel];
              return (
                <tr
                  key={`${change.universityName}-${change.departmentName}-${idx}`}
                  className={cn(
                    "border-b border-indigo-100 last:border-0 dark:border-indigo-800",
                    change.levelChanged && "bg-amber-50/50 dark:bg-amber-950/10",
                  )}
                >
                  <td className="py-1.5 pr-3 font-medium text-[var(--text-primary)]">
                    {change.universityName}
                  </td>
                  <td className="py-1.5 pr-3 text-[var(--text-secondary)]">
                    {change.departmentName}
                  </td>
                  <td className="py-1.5 pr-3 text-center">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", estColors.bg, estColors.text, estColors.darkBg, estColors.darkText)}>
                      {PLACEMENT_LABELS[change.estimatedLevel]}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-center">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", actColors.bg, actColors.text, actColors.darkBg, actColors.darkText)}>
                      {PLACEMENT_LABELS[change.actualLevel]}
                    </span>
                  </td>
                  <td className={cn(
                    "py-1.5 text-right tabular-nums font-medium",
                    change.scoreDiff > 0 ? "text-emerald-600" : change.scoreDiff < 0 ? "text-red-500" : "text-[var(--text-tertiary)]",
                  )}>
                    {change.scoreDiff > 0 ? "+" : ""}{change.scoreDiff.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
