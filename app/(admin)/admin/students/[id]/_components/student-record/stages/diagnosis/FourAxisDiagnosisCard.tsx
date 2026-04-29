"use client";

// ============================================
// 4축 합격 진단 프로필 카드 (F1-3)
// 파이프라인 synthesis 완료 후 _fourAxisDiagnosis 결과를 시각화
// ============================================

import { cn } from "@/lib/cn";
import type { FourAxisDiagnosis } from "@/lib/domains/admission/prediction/profile-diagnosis";

interface FourAxisDiagnosisCardProps {
  diagnosis: FourAxisDiagnosis;
}

// ─── 등급/점수 색상 헬퍼 ──────────────────────────

type ProfileGrade = "S" | "A" | "B" | "C" | "D";

function profileGradeClass(grade: ProfileGrade): string {
  switch (grade) {
    case "S":
    case "A":
      return "text-emerald-700 dark:text-emerald-400";
    case "B":
      return "text-blue-700 dark:text-blue-400";
    case "C":
      return "text-amber-700 dark:text-amber-400";
    case "D":
      return "text-red-700 dark:text-red-400";
  }
}

function profileGradeBadgeClass(grade: ProfileGrade): string {
  switch (grade) {
    case "S":
    case "A":
      return "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400";
    case "B":
      return "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400";
    case "C":
      return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400";
    case "D":
      return "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400";
  }
}

function courseScoreClass(score: number): string {
  if (score >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function flowTierClass(avgPercent: number): string {
  if (avgPercent >= 70) return "text-emerald-700 dark:text-emerald-400";
  if (avgPercent >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

type AdmissionLevel = "above" | "within" | "below" | "unknown";

function admissionLevelClass(level: AdmissionLevel): string {
  switch (level) {
    case "above":
      return "text-emerald-700 dark:text-emerald-400";
    case "within":
      return "text-blue-700 dark:text-blue-400";
    case "below":
      return "text-red-700 dark:text-red-400";
    case "unknown":
      return "text-[var(--text-tertiary)]";
  }
}

function admissionLevelLabel(level: AdmissionLevel): string {
  switch (level) {
    case "above":
      return "입결 초과";
    case "within":
      return "입결 이내";
    case "below":
      return "입결 미달";
    case "unknown":
      return "데이터 없음";
  }
}

// ─── 축별 카드 아이템 ─────────────────────────────

function AxisItem({
  label,
  icon,
  valueNode,
  descNode,
  isWeakest,
}: {
  label: string;
  icon: string;
  valueNode: React.ReactNode;
  descNode: React.ReactNode;
  isWeakest: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3",
        isWeakest
          ? "border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20"
          : "border-[var(--border-secondary)] bg-[var(--surface-primary)]",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none" aria-hidden="true">{icon}</span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
        </div>
        {isWeakest && (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-3xs font-semibold text-amber-700 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            주의
          </span>
        )}
      </div>
      <div className="text-sm font-bold leading-tight">{valueNode}</div>
      <div className="text-2xs leading-snug text-[var(--text-secondary)]">{descNode}</div>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────

export function FourAxisDiagnosisCard({ diagnosis }: FourAxisDiagnosisCardProps) {
  const { profileMatch, courseAdequacy, flowCompletion, admissionReference, summary, weakestAxis } = diagnosis;

  // 1축: 계열 적합도
  const axis1 = (
    <AxisItem
      label="계열 적합도"
      icon="🎯"
      isWeakest={weakestAxis === "profileMatch"}
      valueNode={
        <span className={cn("inline-flex items-center gap-1", profileGradeClass(profileMatch.grade))}>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-1.5 py-0.5 text-2xs font-bold",
              profileGradeBadgeClass(profileMatch.grade),
            )}
          >
            {profileMatch.grade}
          </span>
          <span>{profileMatch.score}점</span>
        </span>
      }
      descNode={
        <span>{profileMatch.topTrack.label} 계열</span>
      }
    />
  );

  // 2축: 교과 이수
  const axis2 = (
    <AxisItem
      label="교과 이수"
      icon="📚"
      isWeakest={weakestAxis === "courseAdequacy"}
      valueNode={
        courseAdequacy ? (
          <span className={courseScoreClass(courseAdequacy.score)}>
            {courseAdequacy.score}%
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">-</span>
        )
      }
      descNode={
        courseAdequacy ? (
          <span>
            이수 {courseAdequacy.taken.length}과목 · 미이수 {courseAdequacy.notTaken.length}과목
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">전공 미설정</span>
        )
      }
    />
  );

  // 3축: 세특 완성도
  const axis3 = (
    <AxisItem
      label="세특 완성도"
      icon="✍️"
      isWeakest={weakestAxis === "flowCompletion"}
      valueNode={
        <span className={flowTierClass(flowCompletion.avgPercent)}>
          {flowCompletion.avgPercent}%
        </span>
      }
      descNode={
        <span>
          {flowCompletion.tier.label}
          {flowCompletion.careerAvg !== null && (
            <> · 진로교과 {flowCompletion.careerAvg}%</>
          )}
        </span>
      }
    />
  );

  // 4축: 학종 입결
  const axis4 = (
    <AxisItem
      label="학종 입결"
      icon="📊"
      isWeakest={weakestAxis === "admissionReference"}
      valueNode={
        admissionReference ? (
          <span className={admissionLevelClass(admissionReference.level)}>
            {admissionReference.level !== "unknown" && admissionReference.studentAvgGrade !== null
              ? `내신 ${admissionReference.studentAvgGrade}등급`
              : admissionLevelLabel(admissionReference.level)}
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">-</span>
        )
      }
      descNode={
        admissionReference ? (
          admissionReference.level !== "unknown" && admissionReference.avgAdmissionGrade !== null ? (
            <span>
              입결 기준 {admissionReference.avgAdmissionGrade}등급 · {admissionLevelLabel(admissionReference.level)}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">{admissionLevelLabel(admissionReference.level)}</span>
          )
        ) : (
          <span className="text-[var(--text-tertiary)]">입결 데이터 없음</span>
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--surface-primary)] p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-[var(--text-primary)]">4축 합격 진단</span>
        <span className="rounded-full bg-[var(--surface-secondary,#f3f4f6)] px-2 py-0.5 text-2xs text-[var(--text-tertiary)]">
          파이프라인 결과
        </span>
      </div>

      {/* 4축 그리드 — 데스크톱 4열, 태블릿 2열, 모바일 1열 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {axis1}
        {axis2}
        {axis3}
        {axis4}
      </div>

      {/* 희망 진로 정합성 경고 */}
      {diagnosis.careerAlignment && diagnosis.careerAlignment.status !== "aligned" && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2.5",
            diagnosis.careerAlignment.status === "divergent"
              ? "border-red-200 bg-red-50/60 dark:border-red-700 dark:bg-red-900/20"
              : "border-amber-200 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/20",
          )}
        >
          <span className="mt-px text-sm leading-none" aria-hidden="true">
            {diagnosis.careerAlignment.status === "divergent" ? "\u26A0\uFE0F" : "\u2139\uFE0F"}
          </span>
          <p
            className={cn(
              "text-xs leading-relaxed",
              diagnosis.careerAlignment.status === "divergent"
                ? "text-red-700 dark:text-red-400"
                : "text-amber-700 dark:text-amber-400",
            )}
          >
            {diagnosis.careerAlignment.message}
          </p>
        </div>
      )}

      {/* 종합 의견 */}
      <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary,#f9fafb)] px-3 py-2.5">
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{summary}</p>
      </div>
    </div>
  );
}
