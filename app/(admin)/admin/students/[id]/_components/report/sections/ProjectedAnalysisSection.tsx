"use client";

import { Compass, AlertTriangle, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import { DIFFICULTY_LABELS } from "@/lib/domains/student-record/leveling/types";
import type { CompetencyScore } from "@/lib/domains/student-record/types";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import type { LevelingResult, DifficultyLevel } from "@/lib/domains/student-record/leveling/types";
import type { NarrativeContext } from "@/lib/domains/record-analysis/pipeline/narrative-context";

interface ContentQualityRow {
  record_type: string;
  overall_score: number;
  issues: string[];
  feedback: string | null;
}

interface ProjectedAnalysisSectionProps {
  projectedScores: CompetencyScore[];
  projectedEdges: PersistedEdge[];
  leveling: LevelingResult | null;
  designGrades: number[];
  contentQuality?: ContentQualityRow[];
  /** L4-E: 서사 기반 설계 우선순위 */
  narrativeContext?: NarrativeContext;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-700 bg-emerald-50",
  "A-": "text-emerald-600 bg-emerald-50",
  "B+": "text-blue-700 bg-blue-50",
  "B": "text-blue-600 bg-blue-50",
  "B-": "text-amber-700 bg-amber-50",
  "C": "text-red-600 bg-red-50",
};

// B- 이상이면 충족으로 판정
const MET_GRADES = new Set(["A+", "A-", "B+", "B"]);

export function ProjectedAnalysisSection({
  projectedScores,
  projectedEdges,
  leveling,
  designGrades,
  contentQuality,
  narrativeContext,
}: ProjectedAnalysisSectionProps) {
  if (projectedScores.length === 0 && !leveling) return null;

  const gradeLabel = designGrades.map((g) => `${g}학년`).join(", ");

  return (
    <div>
      <ReportSectionHeader
        icon={Compass}
        title="설계 방향 분석"
        subtitle={`${gradeLabel} | NEIS 미입력 학년 예상 분석`}
      />

      {/* 고지문 */}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">예상 데이터 안내</p>
            <p className="mt-1">
              아래 분석은 희망 진로 및 학교권 기준의 AI 예상 결과이며, NEIS 기록 확정 전까지 실제와 다를 수 있습니다.
              확정된 분석 결과는 NEIS 기록 입력 후 재분석을 통해 생성됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 갭 분석 (레벨링 결과) */}
      {leveling && <GapAnalysis leveling={leveling} />}

      {/* L4-E: 설계 우선순위 TOP 3 */}
      {narrativeContext && (
        <DesignPriorityPanel narrativeContext={narrativeContext} />
      )}

      {/* 항목별 충족 요약 (M2) */}
      {projectedScores.length > 0 && (() => {
        const met = projectedScores.filter((s) => MET_GRADES.has(s.grade_value as string)).length;
        const unmet = projectedScores.length - met;
        return (
          <div className="mt-4 rounded-lg border border-border p-3 text-sm">
            <span className="font-semibold">{projectedScores.length}개 역량 항목 중 </span>
            <span className="font-bold text-emerald-600">{met}개 충족</span>
            <span className="mx-1">/</span>
            <span className="font-bold text-amber-600">{unmet}개 미충족</span>
            {unmet > 0 && (
              <span className="text-text-tertiary ml-2">
                ({projectedScores
                  .filter((s) => !MET_GRADES.has(s.grade_value as string))
                  .map((s) => COMPETENCY_ITEMS.find((i) => i.code === s.competency_item)?.label ?? s.competency_item)
                  .join(", ")} 보강 필요)
              </span>
            )}
          </div>
        );
      })()}

      {/* 예상 역량 등급 */}
      {projectedScores.length > 0 && (
        <div className="mt-6">
          <h3 className="report-subsection-title mb-3">예상 역량 등급</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium text-text-secondary">영역</th>
                  <th className="py-2 text-left font-medium text-text-secondary">역량 항목</th>
                  <th className="py-2 text-center font-medium text-text-secondary">예상 등급</th>
                </tr>
              </thead>
              <tbody>
                {COMPETENCY_ITEMS.map((item) => {
                  const score = projectedScores.find((s) => s.competency_item === item.code);
                  if (!score) return null;
                  return (
                    <tr key={item.code} className="border-b border-border">
                      <td className="py-2 text-text-tertiary">{COMPETENCY_AREA_LABELS[item.area]}</td>
                      <td className="py-2">{item.label}</td>
                      <td className="py-2 text-center">
                        <span className={cn(
                          "inline-block rounded px-2 py-0.5 text-xs font-semibold",
                          GRADE_COLORS[score.grade_value as string] ?? "text-text-secondary bg-bg-secondary",
                        )}>
                          {score.grade_value}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 예상 연결 요약 */}
      {projectedEdges.length > 0 && (
        <div className="mt-6">
          <h3 className="report-subsection-title mb-3">예상 활동 연결</h3>
          <p className="text-sm text-text-secondary mb-2">
            설계 모드 가안 기반 예상 연결 {projectedEdges.length}건
          </p>
          <div className="space-y-2">
            {projectedEdges.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-text-primary">{e.source_label}</span>
                <span className="text-text-tertiary">&rarr;</span>
                <span className="font-medium text-text-primary">{e.target_label}</span>
                <span className="text-xs text-text-tertiary">({e.edge_type})</span>
              </div>
            ))}
            {projectedEdges.length > 5 && (
              <p className="text-xs text-text-tertiary">... 외 {projectedEdges.length - 5}건</p>
            )}
          </div>
        </div>
      )}
      {/* 가안 품질 요약 (M3) */}
      {contentQuality && contentQuality.length > 0 && (() => {
        const avgScore = Math.round(
          contentQuality.reduce((sum, cq) => sum + (cq.overall_score ?? 0), 0) / contentQuality.length,
        );
        const allIssues = contentQuality.flatMap((cq) => cq.issues ?? []);
        const issueFreq = new Map<string, number>();
        for (const issue of allIssues) issueFreq.set(issue, (issueFreq.get(issue) ?? 0) + 1);
        const topIssues = [...issueFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

        return (
          <div className="mt-6">
            <h3 className="report-subsection-title mb-3">가안 품질</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="rounded-lg border border-border px-4 py-2">
                <span className="text-text-tertiary">평균 품질 점수</span>
                <span className={cn(
                  "ml-2 font-bold",
                  avgScore >= 70 ? "text-emerald-600" : avgScore >= 50 ? "text-amber-600" : "text-red-600",
                )}>
                  {avgScore}/100
                </span>
                <span className="text-text-tertiary ml-1">({contentQuality.length}건)</span>
              </div>
              {topIssues.length > 0 && (
                <div className="text-text-tertiary">
                  주요 이슈: {topIssues.map(([issue, count]) => `${issue}(${count})`).join(", ")}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── 갭 분석 서브 컴포넌트 ──

function GapAnalysis({ leveling }: { leveling: LevelingResult }) {
  const { expectedLevel, adequateFromGpa, adequateLevel, currentLevel, gap, tierLabel, levelLabel, hasGpaData } = leveling;

  const GapIcon = gap > 0 ? TrendingUp : gap < 0 ? TrendingDown : Minus;
  const gapColor = gap > 0 ? "text-amber-600" : gap < 0 ? "text-emerald-600" : "text-text-secondary";
  const gapText = gap > 0
    ? `목표 대비 ${gap}단계 부족`
    : gap < 0
      ? `목표 대비 ${Math.abs(gap)}단계 초과`
      : "목표와 일치";

  return (
    <div>
      <h3 className="report-subsection-title mb-3">갭 분석</h3>

      {/* 요약 */}
      <div className="flex items-center gap-3 rounded-lg border border-border p-4 mb-4">
        <GapIcon className={cn("h-6 w-6", gapColor)} />
        <div>
          <p className="font-semibold text-text-primary">
            적정 레벨: {levelLabel} (L{adequateLevel})
          </p>
          <p className={cn("text-sm", gapColor)}>{gapText}</p>
        </div>
        <div className="ml-auto text-right text-sm text-text-tertiary">
          <p>목표: {tierLabel}</p>
          {hasGpaData && <p>내신 기반 레벨: L{adequateFromGpa}</p>}
        </div>
      </div>

      {/* 상세 3값 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium text-text-secondary">항목</th>
              <th className="py-2 text-center font-medium text-text-secondary">레벨</th>
              <th className="py-2 text-left font-medium text-text-secondary">설명</th>
            </tr>
          </thead>
          <tbody>
            <LevelRow
              label="기대 수준"
              level={expectedLevel}
              desc={`${tierLabel} 합격자 기준`}
              highlight={false}
            />
            <LevelRow
              label="적정 수준"
              level={adequateFromGpa}
              desc={hasGpaData ? "현재 내신 기반 현실적 수준" : "내신 데이터 없음 (기대=적정)"}
              highlight={false}
            />
            {currentLevel !== null && (
              <LevelRow
                label="현재 수준"
                level={currentLevel}
                desc="최신 분석 결과 (예상 역량 등급 평균)"
                highlight={false}
              />
            )}
            <LevelRow
              label="적용 레벨"
              level={adequateLevel}
              desc="P7/P8 분석에 적용된 난이도"
              highlight
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── L4-E: 설계 우선순위 패널 ──

const SEVERITY_BADGE: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-bg-tertiary text-text-primary border-border",
};

const RECORD_TYPE_LABEL: Record<"setek" | "changche" | "haengteuk", string> = {
  setek: "세특",
  changche: "창체",
  haengteuk: "행특",
};

function DesignPriorityPanel({ narrativeContext }: { narrativeContext: NarrativeContext }) {
  const top = narrativeContext.recordPriorityOrder.slice(0, 3);
  const weaknessTop = narrativeContext.prioritizedWeaknesses.slice(0, 3);
  if (top.length === 0 && weaknessTop.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-text-primary">설계 우선순위</h3>
        <span className="text-xs text-text-tertiary">서사·약점 기반 자동 산출</span>
      </div>

      {weaknessTop.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-text-secondary mb-2">우선 보강 약점</p>
          <div className="flex flex-wrap gap-2">
            {weaknessTop.map((w) => (
              <span
                key={`${w.source}:${w.code}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs",
                  SEVERITY_BADGE[w.severity],
                )}
                title={w.rationale}
              >
                <span className="font-medium">{w.label}</span>
                <span className="text-3xs uppercase opacity-70">{w.severity}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {top.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">레코드 작성 순서 TOP 3</p>
          <ol className="space-y-2">
            {top.map((rec, idx) => (
              <li
                key={rec.recordId}
                className="flex items-start gap-3 rounded-md bg-white border border-border px-3 py-2"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-3xs font-medium text-text-secondary">
                      {RECORD_TYPE_LABEL[rec.recordType]}
                    </span>
                    <span className="font-medium text-text-primary truncate">{rec.label}</span>
                    <span className="text-xs text-text-tertiary">{rec.grade}학년</span>
                    <span className="ml-auto text-xs font-semibold text-indigo-700">{rec.priority}</span>
                  </div>
                  {rec.reasons.length > 0 && (
                    <p className="mt-0.5 text-xs text-text-secondary">{rec.reasons.join(" · ")}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function LevelRow({ label, level, desc, highlight }: {
  label: string;
  level: DifficultyLevel;
  desc: string;
  highlight: boolean;
}) {
  return (
    <tr className={cn("border-b border-border", highlight && "bg-indigo-50")}>
      <td className={cn("py-2", highlight && "font-semibold")}>{label}</td>
      <td className="py-2 text-center">
        <span className={cn(
          "inline-block rounded px-2 py-0.5 text-xs font-bold",
          highlight ? "bg-indigo-100 text-indigo-700" : "bg-bg-tertiary text-text-primary",
        )}>
          L{level} {DIFFICULTY_LABELS[level]}
        </span>
      </td>
      <td className="py-2 text-text-tertiary">{desc}</td>
    </tr>
  );
}
