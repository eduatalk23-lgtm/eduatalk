/**
 * 에이전트 편집 프롬프트 — 자연어 instruction 기반 섹션 부분 수정
 *
 * improveGuide와 달리:
 * - 리뷰 피드백이 아닌 컨설턴트의 자연어 지시가 입력
 * - targetSectionKeys로 범위를 한정 가능
 * - 지시 범위 밖 섹션은 원본 유지
 */

import type { GuideType, OutlineItem } from "../../types";
import type { ContentSection } from "../../types";
import { buildBaseSystemPrompt } from "./common-prompt-builder";

const AGENT_EDIT_RULES = `
## 에이전트 편집 원칙

당신은 가이드를 수정하는 **자율 에이전트**입니다. 컨설턴트의 자연어 지시를 해석하여 판단하고 실행합니다.

### 수정 범위 규칙
1. **대상 섹션**에 표시된 섹션만 수정합니다
2. 대상 아닌 섹션은 **원본 그대로** 출력합니다 (1글자도 변경 금지)
3. 대상 섹션이 명시되지 않으면 지시 내용에 가장 적합한 섹션을 **자율 판단**하여 수정합니다
4. 구조적 변경(섹션 추가/삭제/병합)은 지시에 명시된 경우에만 수행합니다

### 자율 판단 기준
- 문장 다듬기, 구체화, 분량 보충 → 자율 수행
- 문체 통일, 오류 수정, 용어 일관성 → 자율 수행
- 섹션 구조 변경, 핵심 논지 전환 → 지시에 명시된 경우만

### 품질 유지
- 수정된 섹션도 원본의 논리적 흐름을 유지합니다
- outline이 있는 섹션 수정 시, **outline도 함께 갱신**합니다
- setekExamples(세특 예시)는 별도 지시 없으면 **원본 보존**합니다`;

/**
 * 에이전트 편집 시스템 프롬프트
 */
export function buildAgentEditSystemPrompt(
  guideType: GuideType,
): string {
  return `${buildBaseSystemPrompt(guideType)}\n${AGENT_EDIT_RULES}`;
}

/** outline 직렬화 */
function serializeOutline(items: OutlineItem[]): string {
  if (!items || items.length === 0) return "";
  const lines: string[] = ["[목차]"];
  for (const item of items) {
    const indent =
      item.depth === 0 ? "● " : item.depth === 1 ? "  ├─ " : "    · ";
    lines.push(`${indent}${item.text}`);
    if (item.tip) lines.push(`   [TIP] ${item.tip}`);
  }
  return lines.join("\n");
}

/** HTML 스트리핑 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 에이전트 편집 유저 프롬프트
 */
export function buildAgentEditUserPrompt(opts: {
  title: string;
  guideType: string;
  instruction: string;
  targetSectionKeys?: string[];
  contentSections: ContentSection[];
  motivation?: string;
  theorySections?: Array<{ title: string; content: string; outline?: OutlineItem[] }>;
  reflection?: string;
  impression?: string;
  summary?: string;
  followUp?: string;
  bookDescription?: string;
  setekExamples?: string[];
}): string {
  const lines: string[] = [];

  lines.push(`# 가이드 편집 지시\n`);
  lines.push(`## 가이드 정보`);
  lines.push(`- 제목: ${opts.title}`);
  lines.push(`- 유형: ${opts.guideType}\n`);

  // 수정 지시
  lines.push(`## 컨설턴트 지시`);
  lines.push(opts.instruction);
  lines.push("");

  // 대상 섹션
  if (opts.targetSectionKeys?.length) {
    lines.push(`## 대상 섹션 (이 섹션만 수정)`);
    for (const key of opts.targetSectionKeys) {
      lines.push(`- \`${key}\``);
    }
    lines.push("");
  } else {
    lines.push(
      `## 대상 섹션: 지시 내용에 따라 자율 판단\n`,
    );
  }

  // 현재 콘텐츠
  lines.push(`## 현재 가이드 콘텐츠\n`);

  // content_sections 우선
  if (opts.contentSections.length > 0) {
    for (const s of opts.contentSections) {
      lines.push(`### [key=${s.key}] ${s.label}`);
      if (s.items?.length) {
        for (const item of s.items) {
          lines.push(`- ${item}`);
        }
      } else {
        lines.push(stripHtml(s.content));
      }
      if (s.outline?.length) {
        lines.push(serializeOutline(s.outline));
      }
      lines.push("");
    }
  } else {
    // 레거시 필드 fallback
    if (opts.motivation) {
      lines.push(`### [key=motivation] 탐구 동기`);
      lines.push(stripHtml(opts.motivation));
      lines.push("");
    }
    if (opts.theorySections?.length) {
      for (const ts of opts.theorySections) {
        lines.push(`### [key=content_sections] ${ts.title}`);
        lines.push(stripHtml(ts.content));
        if (ts.outline?.length) {
          lines.push(serializeOutline(ts.outline));
        }
        lines.push("");
      }
    }
    if (opts.reflection) {
      lines.push(`### [key=reflection] 탐구 고찰 및 제언`);
      lines.push(stripHtml(opts.reflection));
      lines.push("");
    }
    if (opts.impression) {
      lines.push(`### [key=impression] 느낀점`);
      lines.push(stripHtml(opts.impression));
      lines.push("");
    }
    if (opts.summary) {
      lines.push(`### [key=summary] 탐구 요약`);
      lines.push(stripHtml(opts.summary));
      lines.push("");
    }
    if (opts.followUp) {
      lines.push(`### [key=follow_up] 후속 탐구`);
      lines.push(stripHtml(opts.followUp));
      lines.push("");
    }
    if (opts.bookDescription) {
      lines.push(`### [key=book_description] 도서 소개`);
      lines.push(stripHtml(opts.bookDescription));
      lines.push("");
    }
  }

  if (opts.setekExamples?.length) {
    lines.push(`### [key=setek_examples] 세특 예시`);
    for (const ex of opts.setekExamples) {
      lines.push(`- ${ex}`);
    }
    lines.push("");
  }

  lines.push(
    `---\n지시에 따라 수정된 전체 가이드를 sections 배열로 출력하세요. 수정하지 않은 섹션도 원본 그대로 포함합니다.`,
  );

  return lines.join("\n");
}
