/**
 * Phase δ-6 (G11) — 메인 탐구 → 4 산출물 프롬프트 섹션 빌더.
 *
 * 활성 메인 탐구(`student_main_explorations`) 1건을 받아 마크다운 섹션을 반환.
 * - 진단(generateAiDiagnosis): tier 정합성 평가용
 * - 전략(suggestStrategies): tier_plan 빈 셀 우선 채움 안내
 * - 면접(generateInterviewQuestions): record 의 tier 컨텍스트
 * - 로드맵(generateAiRoadmap): 학기별 missions 와 tier_plan 정합
 *
 * 입력이 null/빈 상태면 빈 문자열 반환 (호출부에서 그대로 concat 가능).
 */

import type { MainExploration } from "@/lib/domains/student-record/types/db-models";

const TIER_LABELS: Record<string, string> = {
  foundational: "1) 기초",
  development: "2) 발전",
  advanced: "3) 심화",
};

interface TierEntry {
  theme?: string;
  key_questions?: string[];
  suggested_activities?: string[];
}

export function buildMainExplorationSection(
  active: MainExploration | null | undefined,
): string {
  if (!active) return "";

  const lines: string[] = [];
  lines.push("## 메인 탐구 (5축 진단 / G11)");

  // 메타 헤더
  const direction =
    active.direction === "design" ? "설계(prospective)" : "분석(retrospective)";
  const role = active.semantic_role ?? "n/a";
  const themeKeywords = Array.isArray(active.theme_keywords)
    ? (active.theme_keywords as string[])
    : [];
  lines.push(
    `- 테마: ${active.theme_label ?? "(미정)"} (${direction}, semantic_role=${role})`,
  );
  if (themeKeywords.length > 0) {
    lines.push(`- 키워드: ${themeKeywords.join(", ")}`);
  }
  if (active.career_field) {
    lines.push(`- 진로: ${active.career_field}`);
  }

  // tier_plan
  const tierPlan = (active.tier_plan ?? {}) as Record<string, TierEntry | undefined>;
  const tierEntries: Array<[string, TierEntry]> = [];
  for (const tier of ["foundational", "development", "advanced"]) {
    const entry = tierPlan[tier];
    if (entry && (entry.theme || entry.key_questions?.length || entry.suggested_activities?.length)) {
      tierEntries.push([tier, entry]);
    }
  }

  if (tierEntries.length > 0) {
    lines.push("");
    lines.push("### tier_plan");
    for (const [tier, entry] of tierEntries) {
      lines.push(`- ${TIER_LABELS[tier] ?? tier}`);
      if (entry.theme) lines.push(`  · 주제: ${entry.theme}`);
      if (entry.key_questions?.length) {
        for (const q of entry.key_questions) lines.push(`  · 질문: ${q}`);
      }
      if (entry.suggested_activities?.length) {
        for (const a of entry.suggested_activities) lines.push(`  · 활동: ${a}`);
      }
    }
    // 빈 tier 안내 (전략·로드맵에서 보강 우선순위)
    const filled = new Set(tierEntries.map(([t]) => t));
    const empty = ["foundational", "development", "advanced"].filter((t) => !filled.has(t));
    if (empty.length > 0) {
      lines.push("");
      lines.push(
        `> 빈 tier(${empty.map((t) => TIER_LABELS[t] ?? t).join(", ")})는 보완전략/로드맵에서 우선 채울 후보입니다.`,
      );
    }
  } else {
    lines.push("> tier_plan 비어있음. 보완전략/로드맵에서 3 tier 모두 설계 대상.");
  }

  return lines.join("\n");
}
