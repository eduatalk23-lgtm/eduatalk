import type { GuideDetail, GuideType } from "../../types";
import { GUIDE_TYPE_LABELS } from "../../types";
import {
  getRequiredSectionKeys,
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "../../section-config";

/**
 * 유형별 리뷰 시스템 프롬프트 (동적 필수 섹션 목록)
 */
export function buildReviewSystemPrompt(guideType: GuideType): string {
  const requiredKeys = getRequiredSectionKeys(guideType);
  const requiredLabels = requiredKeys
    .map((key) => {
      const def = GUIDE_SECTION_CONFIG[guideType].find((s) => s.key === key);
      return def?.label ?? key;
    })
    .join(", ");

  return `당신은 한국 고등학교 탐구 가이드의 품질을 평가하는 교육 전문 리뷰어입니다.

## 평가 대상 유형: ${GUIDE_TYPE_LABELS[guideType]}

## 평가 기준

### 1. 학술적 깊이 (academicDepth, 0~100)
- 핵심 개념이 정확하게 설명되는가
- 학문적 근거가 충분한가
- 이론 섹션의 깊이와 논리적 전개
- 문제 상황에 맞는 적절한 지식 선택과 적용 능력

### 2. 학생 접근성 (studentAccessibility, 0~100)
- 고등학생이 이해할 수 있는 수준인가
- 어려운 용어에 대한 설명이 있는가
- 탐구 동기가 학생 시점에서 자연스러운가
- AI 의존적 관용 표현 없이 학생 고유의 사고가 드러나는가

### 3. 구조적 완성도 (structuralCompleteness, 0~100)
- 이 유형의 필수 섹션(${requiredLabels})이 모두 있는가
- 각 섹션의 분량이 적절한가
- 섹션 간 논리적 흐름이 자연스러운가 (동기→이론→고찰→느낀점 연계)
- 습니다 체가 일관되게 사용되는가

### 4. 실용적 연관성 (practicalRelevance, 0~100)
- 생기부 세특/창체에 활용 가능한가
- 교과 과목과의 연계가 명확한가
- 후속 탐구 방향이 구체적인가
- 세특 예시가 자기주도성/탐구력 서술어를 포함하는가

### 5. 탐구 로드맵 품질 (outlineQuality, 0~100) — outline이 없으면 0점
- 목차형 아웃라인(outline)이 존재하는가
- depth 계층(대주제→중주제→세부항목)이 적절히 분기되는가
- outline의 대주제 순서와 산문(content) 단락 순서가 일치하는가
- tip이 학생에게 실질적으로 유용한 안내인가 (행동 가능한 지시)
- resources가 접근 가능한 참고자료인가 (교과서, RISS, URL 등)
- 학생이 이 목차를 따라 실제 탐구를 수행할 수 있는가

## 점수 기준
- 80점 이상: 바로 사용 가능한 수준
- 60~79점: 약간의 수정 후 사용 가능
- 60점 미만: 상당한 수정 필요

## 피드백 규칙
- 구체적이고 실행 가능한 개선 제안
- 강점도 반드시 언급
- 한국어로 작성합니다`;
}

// 하위 호환
export const REVIEW_SYSTEM_PROMPT = "";

export function buildReviewUserPrompt(guide: GuideDetail): string {
  const lines: string[] = [];

  lines.push(`## 평가 대상 가이드`);
  lines.push(`- **제목**: ${guide.title}`);
  lines.push(`- **유형**: ${guide.guide_type}`);

  if (guide.book_title) {
    lines.push(`- **도서**: ${guide.book_title}`);
  }

  // content_sections 우선 사용 (레거시 fallback)
  if (guide.content) {
    const sections = resolveContentSections(
      guide.guide_type as GuideType,
      guide.content,
    );

    if (sections.length > 0) {
      for (const s of sections) {
        if (s.key === "setek_examples" && s.items?.length) {
          lines.push(`\n### ${s.label}`);
          for (const ex of s.items) {
            lines.push(`- ${ex}`);
          }
        } else if (s.content) {
          lines.push(`\n### ${s.label} (산문)\n${s.content}`);
          // outline 데이터가 있으면 리뷰에 포함
          if (s.outline && s.outline.length > 0) {
            lines.push(`\n### ${s.label} (목차형 아웃라인)`);
            for (const item of s.outline) {
              const indent = "  ".repeat(item.depth);
              let line = `${indent}- ${item.text}`;
              if (item.tip) line += ` [TIP: ${item.tip}]`;
              if (item.resources?.length)
                line += ` [참고: ${item.resources.join(", ")}]`;
              lines.push(line);
            }
          }
        }
      }
    }
  }

  lines.push(`\n위 가이드의 품질을 평가해주세요.`);

  return lines.join("\n");
}
