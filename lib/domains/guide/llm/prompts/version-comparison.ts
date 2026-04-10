/**
 * M2: 버전 비교 AI 분석 프롬프트
 *
 * diff 결과를 구조화하여 LLM에 전달, 변경 맥락을 분석하게 합니다.
 * @module lib/domains/guide/llm/prompts/version-comparison
 */

import type { VersionDiff, SectionDiff, MetaDiff } from "../../utils/versionDiff";
import {
  GUIDE_STATUS_LABELS,
  DIFFICULTY_LABELS,
} from "../../types";

// ============================================================
// 시스템 프롬프트
// ============================================================

export function buildVersionComparisonSystemPrompt(): string {
  return `당신은 한국 대입 교육 전문가이며, 학생 탐구 가이드의 품질을 분석하는 역할입니다.

두 버전 간의 변경사항(diff)을 받아, 편집의 의도와 영향을 분석합니다.

분석 원칙:
1. **맥락 추론**: 왜 이런 변경이 이루어졌는지 교육적/학술적 관점에서 추론
2. **개선 판단**: 학생의 세특(세부능력및특기사항) 작성에 도움이 되는 방향인지 평가
3. **구체적 제안**: 추상적 조언이 아닌 실행 가능한 다음 편집 방향 제시
4. **한국어**: 모든 응답은 자연스러운 한국어로 작성

평가 기준:
- 학술적 깊이 (탐구 내용의 전문성)
- 학생 접근성 (고교생이 이해하고 수행 가능한 수준)
- 구조적 완성도 (탐구 흐름의 논리성)
- 세특 연계성 (교과 세특으로 기록 가능한 내용)`;
}

// ============================================================
// 유저 프롬프트
// ============================================================

export function buildVersionComparisonUserPrompt(diff: VersionDiff): string {
  const parts: string[] = [];

  // 1. 메타 변경
  const metaChanges = formatMetaChanges(diff.meta);
  if (metaChanges) {
    parts.push(`## 메타 변경\n${metaChanges}`);
  }

  // 2. 요약 통계
  parts.push(`## 변경 통계
- 추가된 섹션: ${diff.stats.addedSections}개
- 삭제된 섹션: ${diff.stats.removedSections}개
- 수정된 섹션: ${diff.stats.modifiedSections}개
- 글자수 변화: ${diff.stats.totalCharDelta >= 0 ? "+" : ""}${diff.stats.totalCharDelta}자`);

  // 3. 섹션별 변경
  const sectionDetails = diff.sections
    .filter((s) => s.type !== "unchanged")
    .map(formatSectionDiff)
    .join("\n\n");

  if (sectionDetails) {
    parts.push(`## 섹션별 변경 상세\n${sectionDetails}`);
  }

  parts.push(`위 변경사항을 분석하여 편집의 맥락, 개선점, 퇴보 위험, 다음 편집 권장사항을 구조화하여 응답해주세요.`);

  return parts.join("\n\n");
}

// ============================================================
// 포맷 헬퍼
// ============================================================

function formatMetaChanges(meta: MetaDiff): string | null {
  const lines: string[] = [];

  if (meta.title) {
    lines.push(`- 제목: "${meta.title.old}" → "${meta.title.new}"`);
  }
  if (meta.status) {
    const oldLabel = GUIDE_STATUS_LABELS[meta.status.old] ?? meta.status.old;
    const newLabel = GUIDE_STATUS_LABELS[meta.status.new] ?? meta.status.new;
    lines.push(`- 상태: ${oldLabel} → ${newLabel}`);
  }
  if (meta.qualityScore) {
    lines.push(`- 품질 점수: ${meta.qualityScore.old ?? "없음"} → ${meta.qualityScore.new ?? "없음"}`);
  }
  if (meta.difficultyLevel) {
    const oldLabel = meta.difficultyLevel.old
      ? (DIFFICULTY_LABELS[meta.difficultyLevel.old] ?? meta.difficultyLevel.old)
      : "없음";
    const newLabel = meta.difficultyLevel.new
      ? (DIFFICULTY_LABELS[meta.difficultyLevel.new] ?? meta.difficultyLevel.new)
      : "없음";
    lines.push(`- 난이도: ${oldLabel} → ${newLabel}`);
  }
  if (meta.subjectArea) {
    lines.push(`- 교과: ${meta.subjectArea.old ?? "없음"} → ${meta.subjectArea.new ?? "없음"}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function formatSectionDiff(section: SectionDiff): string {
  const header = `### ${section.label} [${section.type}] (${section.charDelta >= 0 ? "+" : ""}${section.charDelta}자)`;

  if (!section.hunks || section.hunks.length === 0) {
    return header;
  }

  // 삭제/추가된 텍스트를 요약 (너무 길면 잘라냄)
  const removed = section.hunks
    .filter((h) => h.type === "remove")
    .map((h) => h.text)
    .join(" ");
  const added = section.hunks
    .filter((h) => h.type === "add")
    .map((h) => h.text)
    .join(" ");

  const lines = [header];
  if (removed) {
    lines.push(`삭제: ${truncate(removed, 300)}`);
  }
  if (added) {
    lines.push(`추가: ${truncate(added, 300)}`);
  }

  return lines.join("\n");
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}
