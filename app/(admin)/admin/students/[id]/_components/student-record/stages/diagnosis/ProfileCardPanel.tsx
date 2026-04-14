"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { profileCardsQueryOptions } from "@/lib/query-options/studentRecord";
import type { PersistedProfileCard } from "@/lib/domains/student-record/repository/profile-card-repository";

interface Props {
  studentId: string;
  tenantId: string;
}

const TREND_META = {
  rising: { label: "상승", Icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  falling: { label: "하락", Icon: TrendingDown, color: "text-red-600 dark:text-red-400" },
  stable: { label: "안정", Icon: Minus, color: "text-blue-600 dark:text-blue-400" },
} as const;

export function ProfileCardPanel({ studentId, tenantId }: Props) {
  const { data: cards, isLoading } = useQuery(profileCardsQueryOptions(studentId, tenantId));

  if (isLoading) {
    return <p className="text-xs text-[var(--text-tertiary)]">프로필 카드 불러오는 중…</p>;
  }
  if (!cards || cards.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        저장된 프로필 카드가 없습니다. 2·3학년 역량 분석 파이프라인 실행 시 생성됩니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {cards.map((card) => (
        <GradeCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function GradeCard({ card }: { card: PersistedProfileCard }) {
  return (
    <article className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-primary)] pb-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          {card.target_grade}학년 프로필 카드
        </h4>
        <div className="flex gap-3 text-xs text-[var(--text-tertiary)]">
          <span>이전 학년 {card.prior_school_years.join(", ") || "없음"}</span>
          <span>평균 등급 <strong className="text-[var(--text-secondary)]">{card.overall_average_grade}</strong></span>
          {card.average_quality_score != null && (
            <span>
              품질 <strong className="text-[var(--text-secondary)]">{card.average_quality_score.toFixed(1)}</strong>
            </span>
          )}
        </div>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <CompetencyList title="지속 강점" items={card.persistent_strengths.map((s) => ({
          primary: s.competencyItem,
          secondary: `${s.bestGrade} · ${s.years.join("·")}`,
        }))} tone="good" />
        <CompetencyList title="지속 약점" items={card.persistent_weaknesses.map((w) => ({
          primary: w.competencyItem,
          secondary: `${w.worstGrade} · ${w.years.join("·")}`,
        }))} tone="bad" />
      </div>

      {card.recurring_quality_issues.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">반복 품질 이슈</p>
          <div className="flex flex-wrap gap-1">
            {card.recurring_quality_issues.map((issue) => (
              <span
                key={issue.code}
                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
              >
                {issue.code} ×{issue.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {(card.career_trajectory || card.depth_progression) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {card.career_trajectory && (
            <TrendBox
              label="진로역량 추이"
              trend={card.career_trajectory.trend}
              detail={`Δ ${card.career_trajectory.growthDelta >= 0 ? "+" : ""}${card.career_trajectory.growthDelta.toFixed(2)}`}
              points={card.career_trajectory.byYear.map((p) => ({
                year: p.year,
                value: p.averageNumericGrade.toFixed(2),
              }))}
            />
          )}
          {card.depth_progression && (
            <TrendBox
              label="심화도 추이"
              trend={card.depth_progression.trend}
              points={card.depth_progression.byYear.map((p) => ({
                year: p.year,
                value: p.averageDepth.toFixed(2),
              }))}
            />
          )}
        </div>
      )}

      {card.cross_grade_themes && card.cross_grade_themes.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">학년 간 공통 테마</p>
          <ul className="flex flex-col gap-1">
            {card.cross_grade_themes.map((theme) => (
              <li
                key={theme.id}
                className="rounded-md border border-[var(--border-primary)] bg-white px-2 py-1 text-xs dark:bg-secondary-900"
              >
                <span className="font-medium text-[var(--text-primary)]">{theme.label}</span>
                <span className="ml-2 text-[var(--text-tertiary)]">
                  {theme.years.join("·")} · {theme.affectedSubjects.slice(0, 3).join(", ")}
                  {theme.affectedSubjects.length > 3 && " 외"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {card.interest_consistency && (
        <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">AI 일관성 서사</span>
            <span className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">
              신뢰도 {Math.round(card.interest_consistency.confidence * 100)}%
            </span>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {card.interest_consistency.narrative}
          </p>
        </div>
      )}
    </article>
  );
}

function CompetencyList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ primary: string; secondary: string }>;
  tone: "good" | "bad";
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{title}</p>
        <p className="text-xs text-[var(--text-tertiary)]">해당 없음</p>
      </div>
    );
  }
  const toneColor = tone === "good"
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
    : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20";
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.primary} className={cn("rounded-md border px-2 py-1 text-xs", toneColor)}>
            <span className="font-medium text-[var(--text-primary)]">{it.primary}</span>
            <span className="ml-2 text-[var(--text-tertiary)]">{it.secondary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendBox({
  label,
  trend,
  detail,
  points,
}: {
  label: string;
  trend: "rising" | "stable" | "falling";
  detail?: string;
  points: Array<{ year: number; value: string }>;
}) {
  const meta = TREND_META[trend];
  return (
    <div className="rounded-md border border-[var(--border-primary)] bg-white p-2 dark:bg-secondary-900">
      <div className="mb-1 flex items-center gap-1.5">
        <meta.Icon size={12} className={meta.color} />
        <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
        <span className={cn("text-[10px]", meta.color)}>{meta.label}</span>
        {detail && <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{detail}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {points.map((p) => (
          <span key={p.year} className="text-[10px] text-[var(--text-secondary)]">
            {p.year}: <strong>{p.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
