/**
 * AI 리뷰 기반 가이드 개선 프롬프트
 * 공통 빌더 기반으로 유형별 섹션 구조 인식
 */

import type { GuideType, OutlineItem } from "../../types";
import type { ContentSection } from "../../types";
import type { StudentProfileContext } from "../types";
import { buildBaseSystemPrompt } from "./common-prompt-builder";

const IMPROVE_SPECIFIC_RULES = `
## 개선 원칙
1. 원본의 섹션 구조를 **유지**합니다
2. 리뷰 피드백의 각 항목을 **명확히 반영**하여 개선합니다
3. 강점으로 지적된 부분은 **보존**합니다 (훼손하지 않음)
4. 약점으로 지적된 부분만 **집중 개선**합니다
5. 이론 섹션 수와 제목은 **유지**합니다 (내용만 개선)
6. setekExamples(세특 예시)는 **원본 그대로 보존**합니다
7. 원본에 outline(목차) 데이터가 있으면 **산문 개선에 맞춰 outline도 함께 갱신**합니다 — [원본 목차] 블록을 참조하여 구조는 유지하되 내용을 보강합니다
8. 원본에 outline이 없으면 **새로 생성**합니다 (🗂️[outline 필수] 섹션) — 전체 30~60개 항목, depth=0 5개 이상

## 차원별 개선 기준
- **학술적 깊이**: 개념 정확성 강화, 학문적 근거 보충, 논리적 전개 보강
- **학생 접근성**: 어려운 용어 설명 추가, 비유/예시 보충, 자연스러운 학생 시점
- **구조적 완성도**: 부족한 섹션 분량 보충, 논리적 흐름 개선
- **실용적 연관성**: 생기부 활용도 향상, 후속 탐구 구체화, 교과 연계 강화`;

/**
 * 개선 시스템 프롬프트 (유형별 섹션 구조 인식)
 */
export function buildImproveSystemPrompt(
  guideType: GuideType,
  studentProfile?: StudentProfileContext,
): string {
  return `${buildBaseSystemPrompt(guideType, studentProfile)}\n${IMPROVE_SPECIFIC_RULES}`;
}

// 하위 호환
export const IMPROVE_SYSTEM_PROMPT = "";

// #4: 안전한 HTML 스트리핑 (script/style/comment 제거)
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** outline 배열을 텍스트로 직렬화 — improve 프롬프트에 원본 목차 전달 */
function serializeOutline(items: OutlineItem[]): string {
  if (!items || items.length === 0) return "";

  const lines: string[] = ["[원본 목차]"];
  for (const item of items) {
    const indent = item.depth === 0 ? "● " : item.depth === 1 ? "  ├─ " : "    · ";
    lines.push(`${indent}${item.text}`);
    if (item.tip) lines.push(`   [TIP] ${item.tip}`);
    if (item.resources?.length) {
      for (const r of item.resources) lines.push(`   [참고] ${r}`);
    }
  }
  return lines.join("\n");
}

export function buildImproveUserPrompt(input: {
  title: string;
  guideType: string;
  /** content_sections 기반 (우선) */
  contentSections?: ContentSection[];
  /** 레거시 fallback */
  motivation: string;
  theorySections: Array<{ title: string; content: string }>;
  reflection: string;
  impression: string;
  summary: string;
  followUp: string;
  bookDescription?: string;
  setekExamples?: string[];
  reviewResult: {
    dimensions: Record<string, number>;
    feedback: string[];
    strengths: string[];
  };
  qualityScore: number | null;
}): string {
  const parts: string[] = [];

  parts.push("## 원본 가이드");
  parts.push(`- **제목**: ${input.title}`);
  parts.push(`- **유형**: ${input.guideType}`);
  parts.push("");

  // content_sections가 있으면 유형별 구조로 전달
  if (input.contentSections && input.contentSections.length > 0) {
    for (const s of input.contentSections) {
      if (s.key === "setek_examples") continue;
      parts.push(`### ${s.label}`);
      parts.push(stripHtml(s.content).slice(0, 2000));
      // 원본 outline 전달 — AI가 기존 목차를 보고 갱신할 수 있도록
      if (s.outline && s.outline.length > 0) {
        parts.push("");
        parts.push(serializeOutline(s.outline));
      }
      parts.push("");
    }
  } else {
    // 레거시 fallback
    parts.push("### 탐구 동기");
    parts.push(stripHtml(input.motivation).slice(0, 1000));
    parts.push("");

    parts.push("### 탐구 이론");
    for (const s of input.theorySections) {
      parts.push(`**${s.title}**`);
      parts.push(stripHtml(s.content).slice(0, 2000));
      parts.push("");
    }

    parts.push("### 탐구 고찰");
    parts.push(stripHtml(input.reflection).slice(0, 1000));
    parts.push("");

    parts.push("### 느낀점");
    parts.push(stripHtml(input.impression).slice(0, 600));
    parts.push("");

    parts.push("### 탐구 요약");
    parts.push(stripHtml(input.summary).slice(0, 800));
    parts.push("");

    parts.push("### 후속 탐구");
    parts.push(stripHtml(input.followUp).slice(0, 600));
    parts.push("");

    if (input.bookDescription) {
      parts.push("### 도서 소개");
      parts.push(stripHtml(input.bookDescription).slice(0, 800));
      parts.push("");
    }
  }

  // AI 리뷰 결과
  parts.push("## AI 리뷰 결과");

  if (input.qualityScore !== null && input.qualityScore !== undefined) {
    parts.push(`- 종합 점수: ${input.qualityScore}/100`);
  } else {
    parts.push("- 종합 점수: 미평가");
  }

  const dimLabels: Record<string, string> = {
    academicDepth: "학술적 깊이",
    studentAccessibility: "학생 접근성",
    structuralCompleteness: "구조적 완성도",
    practicalRelevance: "실용적 연관성",
    outlineQuality: "탐구 로드맵 품질",
  };

  for (const [key, score] of Object.entries(input.reviewResult.dimensions)) {
    const label = dimLabels[key] ?? key;
    const status =
      score >= 80
        ? "✅"
        : score >= 60
          ? "⚠️ 개선 필요"
          : "❌ 대폭 개선 필요";
    parts.push(`- ${label}: ${score}/100 ${status}`);
  }
  parts.push("");

  parts.push("## 개선 요청");
  if (input.reviewResult.feedback.length > 0) {
    for (const f of input.reviewResult.feedback) {
      parts.push(`- ${f}`);
    }
    parts.push("");
    parts.push("위 피드백을 바탕으로 가이드를 개선해주세요.");
  } else {
    parts.push(
      "구체적인 피드백이 없습니다. 전반적인 품질 향상을 목표로 개선해주세요.",
    );
  }
  parts.push("");

  if (input.reviewResult.strengths.length > 0) {
    parts.push("## 강점 (보존)");
    for (const s of input.reviewResult.strengths) {
      parts.push(`- ${s}`);
    }
    parts.push("");
  }

  parts.push("setekExamples는 원본 그대로 유지하세요.");

  return parts.join("\n");
}
