"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { ChevronDown, Search, BarChart3 } from "lucide-react";
import {
  PLACEMENT_LABELS,
  PLACEMENT_COLORS,
  convertToSuneungScores,
  createEmptyMockScoreInput,
} from "@/lib/domains/admission";
import type {
  PlacementLevel,
  PlacementVerdict,
  PlacementAnalysisResult,
} from "@/lib/domains/admission";
import type { ExamType, PlacementSnapshot, PlacementChange, ReplacementInfo } from "@/lib/domains/admission/placement/types";
import type { MockScoreInput } from "@/lib/domains/admission/placement/score-converter";
import { filterVerdicts, compareSnapshots } from "@/lib/domains/admission/placement/engine";
import { placementAnalysisQueryOptions } from "@/lib/query-options/placement";
import {
  SCIENCE_INQUIRY,
  SOCIAL_INQUIRY,
} from "@/lib/domains/admission/calculator/constants";

type PlacementDashboardProps = {
  studentId: string;
};

const ALL_LEVELS: PlacementLevel[] = ["safe", "possible", "bold", "unstable", "danger"];

const INQUIRY_SUBJECTS = [...SOCIAL_INQUIRY, ...SCIENCE_INQUIRY];

// ─── 메인 컴포넌트 ─────────────────────────────────

export function PlacementDashboard({ studentId }: PlacementDashboardProps) {
  const [scoreInput, setScoreInput] = useState<MockScoreInput>(createEmptyMockScoreInput);
  const [examType, setExamType] = useState<ExamType>("estimated");
  const [estimatedSnapshot, setEstimatedSnapshot] = useState<PlacementSnapshot | null>(null);
  const [actualSnapshot, setActualSnapshot] = useState<PlacementSnapshot | null>(null);
  const queryClient = useQueryClient();

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

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* 국어 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">국어 원점수</label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.koreanRaw ?? ""}
            onChange={(e) => update({ koreanRaw: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="원점수"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">국어 표준점수</label>
          <input
            type="number"
            value={value.korean ?? ""}
            onChange={(e) => update({ korean: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="표준점수"
          />
        </div>

        {/* 수학 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">수학 선택과목</label>
          <select
            value={value.mathType}
            onChange={(e) => update({ mathType: e.target.value as MockScoreInput["mathType"] })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="미적분">미적분</option>
            <option value="기하">기하</option>
            <option value="확률과통계">확률과통계</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">수학 원점수</label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.mathRaw ?? ""}
            onChange={(e) => update({ mathRaw: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="원점수"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">수학 표준점수</label>
          <input
            type="number"
            value={value.math ?? ""}
            onChange={(e) => update({ math: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="표준점수"
          />
        </div>

        {/* 영어 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">영어 등급</label>
          <select
            value={value.english ?? ""}
            onChange={(e) => update({ english: parseInt_(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>{g}등급</option>
            ))}
          </select>
        </div>

        {/* 한국사 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">한국사 등급</label>
          <select
            value={value.history ?? ""}
            onChange={(e) => update({ history: parseInt_(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>{g}등급</option>
            ))}
          </select>
        </div>

        {/* 탐구1 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">탐구1 과목</label>
          <select
            value={value.inquiry1Subject}
            onChange={(e) => update({ inquiry1Subject: e.target.value })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {INQUIRY_SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">탐구1 원점수</label>
          <input
            type="number"
            min={0}
            max={50}
            value={value.inquiry1Raw ?? ""}
            onChange={(e) => update({ inquiry1Raw: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="원점수"
          />
        </div>

        {/* 탐구2 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">탐구2 과목</label>
          <select
            value={value.inquiry2Subject}
            onChange={(e) => update({ inquiry2Subject: e.target.value })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {INQUIRY_SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">탐구2 원점수</label>
          <input
            type="number"
            min={0}
            max={50}
            value={value.inquiry2Raw ?? ""}
            onChange={(e) => update({ inquiry2Raw: parseNum(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
            placeholder="원점수"
          />
        </div>

        {/* 제2외국어 */}
        <div>
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">제2외국어 등급</label>
          <select
            value={value.foreignLang ?? ""}
            onChange={(e) => update({ foreignLang: parseInt_(e.target.value) })}
            className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1.5 text-sm"
          >
            <option value="">미응시</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>{g}등급</option>
            ))}
          </select>
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

// ─── 분석 결과 영역 ────────────────────────────────

function PlacementResults({ data }: { data: PlacementAnalysisResult }) {
  const [filterLevels, setFilterLevels] = useState<PlacementLevel[]>([]);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterDeptType, setFilterDeptType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 고유 지역/계열 추출
  const regions = useMemo(
    () => [...new Set(data.verdicts.map((v) => v.region).filter(Boolean))] as string[],
    [data.verdicts],
  );
  const deptTypes = useMemo(
    () => [...new Set(data.verdicts.map((v) => v.departmentType).filter(Boolean))] as string[],
    [data.verdicts],
  );

  const filtered = useMemo(
    () =>
      filterVerdicts(data.verdicts, {
        levels: filterLevels.length > 0 ? filterLevels : undefined,
        region: filterRegion || undefined,
        departmentType: filterDeptType || undefined,
        search: searchQuery || undefined,
      }),
    [data.verdicts, filterLevels, filterRegion, filterDeptType, searchQuery],
  );

  const toggleLevel = (level: PlacementLevel) => {
    setFilterLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 바 */}
      <PlacementSummaryBar summary={data.summary} total={data.verdicts.length} />

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 레벨 필터 토글 */}
        {ALL_LEVELS.map((level) => {
          const colors = PLACEMENT_COLORS[level];
          const active = filterLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                active
                  ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} ring-1 ring-current`
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
              )}
            >
              {PLACEMENT_LABELS[level]} ({data.summary.byLevel[level]})
            </button>
          );
        })}

        {/* 지역 */}
        {regions.length > 0 && (
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1 text-xs"
          >
            <option value="">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}

        {/* 계열 */}
        {deptTypes.length > 0 && (
          <select
            value={filterDeptType}
            onChange={(e) => setFilterDeptType(e.target.value)}
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] px-2 py-1 text-xs"
          >
            <option value="">전체 계열</option>
            {deptTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* 검색 */}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="대학/학과 검색"
            className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] py-1 pl-7 pr-2 text-xs"
          />
        </div>
      </div>

      {/* 결과 카드 목록 */}
      <div className="text-xs text-[var(--text-tertiary)]">
        {filtered.length}개 / {data.verdicts.length}개
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((verdict, idx) => (
          <PlacementCard key={`${verdict.universityName}-${verdict.departmentName}-${idx}`} verdict={verdict} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
          조건에 맞는 결과가 없습니다
        </div>
      )}
    </div>
  );
}

// ─── 요약 바 ────────────────────────────────────

function PlacementSummaryBar({
  summary,
  total,
}: {
  summary: PlacementAnalysisResult["summary"];
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
        <span>총 {summary.total}개 학과</span>
        {summary.disqualified > 0 && (
          <span className="text-red-500">(결격 {summary.disqualified})</span>
        )}
      </div>

      {/* 컬러 바 */}
      <div className="flex h-3 overflow-hidden rounded-full">
        {ALL_LEVELS.map((level) => {
          const count = summary.byLevel[level];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          const colorMap: Record<PlacementLevel, string> = {
            safe: "bg-emerald-500",
            possible: "bg-blue-500",
            bold: "bg-amber-500",
            unstable: "bg-orange-500",
            danger: "bg-red-500",
          };
          return (
            <div
              key={level}
              className={cn(colorMap[level], "transition-all")}
              style={{ width: `${pct}%` }}
              title={`${PLACEMENT_LABELS[level]}: ${count}개 (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs">
        {ALL_LEVELS.map((level) => {
          const count = summary.byLevel[level];
          if (count === 0) return null;
          const colors = PLACEMENT_COLORS[level];
          return (
            <span key={level} className="flex items-center gap-1">
              <span className={cn("inline-block size-2.5 rounded-full", colors.bg)} />
              <span className="text-[var(--text-secondary)]">
                {PLACEMENT_LABELS[level]} {count}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── 카드 ────────────────────────────────────────

function PlacementCard({ verdict }: { verdict: PlacementVerdict }) {
  const [expanded, setExpanded] = useState(false);
  const colors = PLACEMENT_COLORS[verdict.level];

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] transition-colors hover:bg-[var(--surface-hover)]">
      {/* 카드 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {/* 판정 배지 */}
        <span
          className={cn(
            "inline-flex min-w-[3.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
            colors.bg,
            colors.text,
            colors.darkBg,
            colors.darkText,
          )}
        >
          {PLACEMENT_LABELS[verdict.level]}
        </span>

        {/* 대학/학과 */}
        <div className="flex-1 overflow-hidden">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {verdict.universityName}
          </span>
          <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
            {verdict.departmentName}
          </span>
        </div>

        {/* 점수/차이 */}
        <div className="flex items-center gap-2 text-right">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
              {verdict.studentScore.toFixed(1)}
            </span>
            {verdict.scoreDiff !== null && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  verdict.scoreDiff >= 0 ? "text-emerald-600" : "text-red-500",
                )}
              >
                {verdict.scoreDiff >= 0 ? "+" : ""}
                {verdict.scoreDiff.toFixed(1)}
              </span>
            )}
          </div>

          <ChevronDown
            size={14}
            className={cn(
              "flex-shrink-0 text-[var(--text-tertiary)] transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* 펼침: 입결 비교 */}
      {expanded && (
        <div className="border-t border-[var(--border-secondary)] px-3 py-2.5">
          <div className="flex flex-wrap gap-4 text-xs">
            {/* 메타 정보 */}
            <div className="flex gap-3 text-[var(--text-tertiary)]">
              {verdict.region && <span>{verdict.region}</span>}
              {verdict.departmentType && <span>{verdict.departmentType}</span>}
              <span>신뢰도: {verdict.confidence}%</span>
            </div>
          </div>

          {/* 입결 비교 테이블 */}
          {verdict.historicalComparisons.length > 0 && (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-secondary)] text-left text-[var(--text-tertiary)]">
                  <th className="py-1 pr-3">연도</th>
                  <th className="py-1 pr-3">기준</th>
                  <th className="py-1 pr-3">등급</th>
                  <th className="py-1 text-right">입결 점수</th>
                  <th className="py-1 text-right">차이</th>
                </tr>
              </thead>
              <tbody>
                {verdict.historicalComparisons.map((comp) => {
                  const diff = comp.score != null ? verdict.studentScore - comp.score : null;
                  return (
                    <tr key={comp.year} className="border-b border-[var(--border-secondary)] last:border-0">
                      <td className="py-1 pr-3 font-medium text-[var(--text-primary)]">{comp.year}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)]">{comp.basis ?? "-"}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)]">{comp.grade ?? "-"}</td>
                      <td className="py-1 text-right tabular-nums text-[var(--text-primary)]">
                        {comp.score?.toFixed(1) ?? "-"}
                      </td>
                      <td
                        className={cn(
                          "py-1 text-right tabular-nums",
                          diff != null && diff >= 0 ? "text-emerald-600" : "text-red-500",
                        )}
                      >
                        {diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 비고 */}
          {verdict.notes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {verdict.notes.map((note, i) => (
                <span
                  key={i}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                >
                  {note}
                </span>
              ))}
            </div>
          )}

          {/* 충원 분석 */}
          {verdict.replacementInfo && (
            <ReplacementSection info={verdict.replacementInfo} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── 충원 분석 섹션 ─────────────────────────────

const REPLACEMENT_PROB_COLORS: Record<
  ReplacementInfo["probabilityLevel"],
  { bg: string; text: string; darkBg: string; darkText: string }
> = {
  high: { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "dark:bg-emerald-900/30", darkText: "dark:text-emerald-300" },
  moderate: { bg: "bg-amber-100", text: "text-amber-700", darkBg: "dark:bg-amber-900/30", darkText: "dark:text-amber-300" },
  low: { bg: "bg-red-100", text: "text-red-700", darkBg: "dark:bg-red-900/30", darkText: "dark:text-red-300" },
  none: { bg: "bg-gray-100", text: "text-gray-500", darkBg: "dark:bg-gray-800", darkText: "dark:text-gray-400" },
};

const REPLACEMENT_PROB_LABELS: Record<ReplacementInfo["probabilityLevel"], string> = {
  high: "높음",
  moderate: "보통",
  low: "낮음",
  none: "없음",
};

function ReplacementSection({ info }: { info: ReplacementInfo }) {
  const colors = REPLACEMENT_PROB_COLORS[info.probabilityLevel];

  return (
    <div className="mt-2 rounded-md border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          충원
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            colors.bg, colors.text, colors.darkBg, colors.darkText,
          )}
        >
          {REPLACEMENT_PROB_LABELS[info.probabilityLevel]}
          {info.probabilityLevel !== "none" && ` ${Math.round(info.probability * 100)}%`}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{info.message}</span>
      </div>

      {/* 연도별 충원 인원 */}
      <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
        {info.historicalCounts.map((c) => (
          <span key={c.year}>{c.year}: {c.count}명</span>
        ))}
        <span className="text-[var(--text-tertiary)]">평균 {info.averageCount}명</span>
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
