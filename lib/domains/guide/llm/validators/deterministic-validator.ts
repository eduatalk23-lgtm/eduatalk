/**
 * Deterministic Validator — LLM 호출 없이 코드로 가이드 출력 품질 검증
 *
 * generateGuideCore 생성 직후 실행되어 규칙 위반을 구조적으로 감지합니다.
 * 기존 warn-only 검사를 구조화하고, 산문 글자수·섹션 누락·번호 연속성 검사를 추가합니다.
 *
 * @since c3.2-v1
 */

import type { GeneratedGuideOutput } from "../types";
import type { GuideType } from "../../types";
import {
  GUIDE_SECTION_CONFIG,
  getCoreSections,
} from "../../section-config";

// ============================================================
// Types
// ============================================================

export type ViolationSeverity = "error" | "warning";

export interface Violation {
  /** 규칙 ID (로깅/디버깅용) */
  rule: string;
  /** 위반 심각도: error=재생성 트리거 가능, warning=로그만 */
  severity: ViolationSeverity;
  /** 사람이 읽을 수 있는 위반 설명 */
  message: string;
  /** 위반된 섹션 key (있을 때) */
  sectionKey?: string;
  /** 현재 값 */
  actual?: number | string;
  /** 기준 값 */
  expected?: number | string;
}

export interface ValidationResult {
  /** 모든 error 없이 통과했는지 */
  passed: boolean;
  /** 감지된 위반 목록 */
  violations: Violation[];
  /** error 수 */
  errorCount: number;
  /** warning 수 */
  warningCount: number;
  /** 검증에 사용된 통계 */
  stats: OutlineStats & ProseStats;
}

interface OutlineStats {
  outlineTotal: number;
  outlineDepth0: number;
  outlineTips: number;
  outlineResources: number;
}

interface ProseStats {
  /** 섹션별 산문 글자수 (HTML 태그 제외) */
  sectionCharCounts: Record<string, number>;
}

// ============================================================
// Thresholds (프롬프트 규칙과 동기화)
// ============================================================

const OUTLINE_MIN = {
  total: 40,
  depth0: 5,
  tips: 6,
  resources: 5,
} as const;

const PROSE_MIN_CHARS: Record<string, number> = {
  content_sections: 800,
  motivation: 200,
  reflection: 300,
  impression: 200,
  summary: 200,
  follow_up: 300,
};

// ============================================================
// HTML 태그 제거 유틸리티
// ============================================================

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

// ============================================================
// Validator
// ============================================================

export function validateGuideOutput(
  generated: GeneratedGuideOutput,
  guideType: GuideType,
  selectedSectionKeys?: string[],
): ValidationResult {
  const violations: Violation[] = [];

  // 1. Outline 밀도 검증
  checkOutlineDensity(generated, violations);

  // 2. 산문 글자수 검증
  checkProseLength(generated, violations);

  // 3. 필수 섹션 누락 검증
  checkRequiredSections(generated, guideType, selectedSectionKeys, violations);

  // 4. Outline depth-0 연속 번호 검증
  checkOutlineNumbering(generated, violations);

  // 5. 도서 confidence 검증 (reading 타입)
  checkBookConfidence(generated, violations);

  // 6. 논문 confidence 검증
  checkPaperConfidence(generated, violations);

  // 통계 수집
  const outlineItems = generated.sections
    .filter((s) => s.key === "content_sections" && s.outline?.length)
    .flatMap((s) => s.outline ?? []);

  const stats: OutlineStats & ProseStats = {
    outlineTotal: outlineItems.length,
    outlineDepth0: outlineItems.filter((o) => o.depth === 0).length,
    outlineTips: outlineItems.filter((o) => o.tip).length,
    outlineResources: outlineItems.filter((o) => o.resources?.length).length,
    sectionCharCounts: Object.fromEntries(
      generated.sections.map((s) => [
        `${s.key}${s.order != null ? `_${s.order}` : ""}`,
        stripHtmlTags(s.content).length,
      ]),
    ),
  };

  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;

  return {
    passed: errorCount === 0,
    violations,
    errorCount,
    warningCount,
    stats,
  };
}

// ============================================================
// 개별 검증 함수
// ============================================================

function checkOutlineDensity(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): void {
  const outlineItems = generated.sections
    .filter((s) => s.key === "content_sections" && s.outline?.length)
    .flatMap((s) => s.outline ?? []);

  const total = outlineItems.length;
  const depth0 = outlineItems.filter((o) => o.depth === 0).length;
  const tips = outlineItems.filter((o) => o.tip).length;
  const resources = outlineItems.filter((o) => o.resources?.length).length;

  if (total < OUTLINE_MIN.total) {
    violations.push({
      rule: "OUTLINE_TOTAL_MIN",
      severity: "error",
      message: `outline 항목 합계 ${total}개 — 최소 ${OUTLINE_MIN.total}개 필요`,
      actual: total,
      expected: OUTLINE_MIN.total,
    });
  }
  if (depth0 < OUTLINE_MIN.depth0) {
    violations.push({
      rule: "OUTLINE_DEPTH0_MIN",
      severity: "error",
      message: `depth=0 대주제 ${depth0}개 — 최소 ${OUTLINE_MIN.depth0}개 필요`,
      actual: depth0,
      expected: OUTLINE_MIN.depth0,
    });
  }
  if (tips < OUTLINE_MIN.tips) {
    violations.push({
      rule: "OUTLINE_TIPS_MIN",
      severity: "warning",
      message: `tip ${tips}개 — 최소 ${OUTLINE_MIN.tips}개 권장`,
      actual: tips,
      expected: OUTLINE_MIN.tips,
    });
  }
  if (resources < OUTLINE_MIN.resources) {
    violations.push({
      rule: "OUTLINE_RESOURCES_MIN",
      severity: "warning",
      message: `resources ${resources}개 — 최소 ${OUTLINE_MIN.resources}개 권장`,
      actual: resources,
      expected: OUTLINE_MIN.resources,
    });
  }
}

function checkProseLength(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): void {
  for (const section of generated.sections) {
    const minChars = PROSE_MIN_CHARS[section.key];
    if (!minChars) continue;

    const charCount = stripHtmlTags(section.content).length;
    if (charCount < minChars) {
      violations.push({
        rule: "PROSE_LENGTH_MIN",
        severity: section.key === "content_sections" ? "error" : "warning",
        message: `${section.label} 산문 ${charCount}자 — 최소 ${minChars}자 필요`,
        sectionKey: section.key,
        actual: charCount,
        expected: minChars,
      });
    }
  }
}

function checkRequiredSections(
  generated: GeneratedGuideOutput,
  guideType: GuideType,
  selectedSectionKeys: string[] | undefined,
  violations: Violation[],
): void {
  const coreSections = getCoreSections(guideType);
  const selectedSet = selectedSectionKeys
    ? new Set(selectedSectionKeys)
    : null;

  // Core 섹션 + 사용자 선택 섹션이 모두 있어야 함
  const requiredKeys = coreSections.map((s) => s.key);
  if (selectedSet) {
    for (const key of selectedSet) {
      if (!requiredKeys.includes(key)) {
        requiredKeys.push(key);
      }
    }
  }

  const presentKeys = new Set(generated.sections.map((s) => s.key));

  for (const key of requiredKeys) {
    if (!presentKeys.has(key)) {
      const def = GUIDE_SECTION_CONFIG[guideType]?.find((s) => s.key === key);
      violations.push({
        rule: "REQUIRED_SECTION_MISSING",
        severity: "error",
        message: `필수 섹션 "${def?.label ?? key}" 누락`,
        sectionKey: key,
      });
    }
  }
}

function checkOutlineNumbering(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): void {
  const contentSections = generated.sections
    .filter((s) => s.key === "content_sections" && s.outline?.length)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (contentSections.length === 0) return;

  // 전체 depth-0 항목의 번호 패턴 검증 (1., 2., 3., ...)
  let expectedIndex = 1;
  for (const section of contentSections) {
    const depth0Items = (section.outline ?? []).filter((o) => o.depth === 0);
    for (const item of depth0Items) {
      const match = item.text.match(/^(\d+)\./);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num !== expectedIndex) {
          violations.push({
            rule: "OUTLINE_NUMBERING_DISCONTINUOUS",
            severity: "warning",
            message: `depth-0 번호 불연속: "${item.text}" — 예상 ${expectedIndex}번`,
            actual: num,
            expected: expectedIndex,
          });
        }
      }
      expectedIndex++;
    }
  }
}

function checkBookConfidence(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): void {
  if (generated.guideType !== "reading") return;

  if (!generated.bookTitle?.trim()) {
    violations.push({
      rule: "BOOK_TITLE_MISSING",
      severity: "error",
      message: "독서탐구인데 bookTitle이 비어 있음",
    });
  }

  if (generated.bookConfidence === "low") {
    violations.push({
      rule: "BOOK_CONFIDENCE_LOW",
      severity: "error",
      message: `도서 신뢰도 low — 할루시네이션 위험: "${generated.bookTitle}"`,
      actual: "low",
      expected: "high 또는 medium",
    });
  }

  if (!generated.bookConfidence && generated.bookTitle) {
    violations.push({
      rule: "BOOK_CONFIDENCE_MISSING",
      severity: "warning",
      message: "bookTitle 존재하지만 bookConfidence 미지정",
    });
  }
}

function checkPaperConfidence(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): void {
  if (!generated.relatedPapers?.length) return;

  const lowPapers = generated.relatedPapers.filter(
    (p) => p.confidence === "low",
  );
  if (lowPapers.length > 0) {
    violations.push({
      rule: "PAPER_CONFIDENCE_LOW",
      severity: "error",
      message: `논문 ${lowPapers.length}건 low confidence: ${lowPapers.map((p) => p.title).join(", ")}`,
      actual: lowPapers.length,
      expected: 0,
    });
  }

  const noPapers = generated.relatedPapers.filter((p) => !p.confidence);
  if (noPapers.length > 0) {
    violations.push({
      rule: "PAPER_CONFIDENCE_MISSING",
      severity: "warning",
      message: `논문 ${noPapers.length}건 confidence 미지정`,
      actual: noPapers.length,
      expected: 0,
    });
  }
}
