/**
 * Targeted Repair — DeCRIM 패턴으로 위반 섹션만 부분 재생성
 *
 * Detect → Context → Re-generate → Integrate → Monitor
 *
 * error 심각도 위반이 있는 섹션만 골라서,
 * 나머지 섹션을 컨텍스트로 제공하고 위반 섹션만 재생성합니다.
 *
 * @since c3.3-v1
 */

import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { zodSchema } from "ai";
import { z } from "zod";
import type { GeneratedGuideOutput } from "../types";
import type { Violation } from "./deterministic-validator";

// ============================================================
// Types
// ============================================================

export interface RepairResult {
  /** 수리 성공 여부 */
  repaired: boolean;
  /** 수리된 출력 (실패 시 원본 그대로) */
  output: GeneratedGuideOutput;
  /** 수리 시도한 섹션 key 목록 */
  repairedSectionKeys: string[];
  /** 수리 후에도 남은 위반 (재검증 결과) */
  remainingViolations: Violation[];
  /** 사용 토큰 */
  usage: { inputTokens: number; outputTokens: number };
}

// ============================================================
// Constants
// ============================================================

/** 최대 repair 시도 횟수 (무한 루프 방지) */
const MAX_REPAIR_ATTEMPTS = 1;

// ============================================================
// Repair 스키마 — 섹션 단위 재생성
// ============================================================

const repairedSectionSchema = z.object({
  key: z.string().describe("섹션 key (요청된 것과 동일)"),
  label: z.string().describe("섹션 표시명"),
  content: z.string().describe("수리된 산문 내용 (HTML 형식)"),
  items: z
    .array(z.string())
    .optional()
    .describe("목록형 데이터 (필요 시)"),
  order: z.number().optional().describe("복수 섹션 순서"),
  outline: z
    .array(
      z.object({
        depth: z
          .enum(["0", "1", "2"])
          .transform((v): 0 | 1 | 2 => Number(v) as 0 | 1 | 2)
          .describe("계층 깊이"),
        text: z.string().describe("항목 텍스트"),
        tip: z.string().optional().describe("학생 행동 지시 팁"),
        resources: z
          .array(
            z.object({
              description: z.string().describe("참고 자료 설명"),
              consultantHint: z.string().optional(),
              url: z.string().optional(),
              citedText: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional()
    .describe("수리된 outline (content_sections인 경우)"),
});

const repairResponseSchema = z.object({
  sections: z
    .array(repairedSectionSchema)
    .min(1)
    .describe("수리된 섹션 목록"),
});

// ============================================================
// 프롬프트
// ============================================================

const SYSTEM_PROMPT = `당신은 고등학생 탐구 가이드의 품질 수리 전문가입니다.
주어진 가이드에서 특정 섹션이 품질 검증에 실패했습니다.
다른 섹션은 그대로 유지하면서, 실패한 섹션만 수리하세요.

## 수리 원칙

1. **DeCRIM**: 위반된 제약만 수리하고, 다른 제약은 보존합니다.
2. **컨텍스트 일관성**: 수리된 섹션은 나머지 섹션과 교차 참조가 유지되어야 합니다.
3. **최소 변경**: 위반을 해결하는 최소한의 변경만 합니다. 불필요한 확장/축소 금지.
4. **습니다 체**: 산문은 '~습니다' 경어체를 유지합니다.
5. **HTML 형식**: content는 HTML(<p>, <strong>, <em> 등) 형식을 유지합니다.

## outline 수리 시 추가 규칙

- depth=0 대주제는 "1. ...", "2. ..." 형식의 번호를 유지합니다.
- 전체 outline 항목 합계 40개 이상을 유지합니다.
- tip은 6개 이상, resources는 5개 이상을 유지합니다.
- depth=0 대주제는 5개 이상을 유지합니다.`;

function buildRepairUserPrompt(
  generated: GeneratedGuideOutput,
  targetKeys: string[],
  violations: Violation[],
): string {
  const parts: string[] = [];

  parts.push(`# 수리 대상 가이드\n`);
  parts.push(`**제목**: ${generated.title}`);
  parts.push(`**유형**: ${generated.guideType}`);
  if (generated.bookTitle) {
    parts.push(`**참고 도서**: ${generated.bookTitle}`);
  }

  // 컨텍스트: 수리 대상이 아닌 섹션 (참조용)
  parts.push(`\n## 유지되는 섹션 (수정 금지, 참조용)\n`);
  for (const section of generated.sections) {
    if (targetKeys.includes(section.key)) continue;
    const stripped = section.content.replace(/<[^>]*>/g, "").trim();
    parts.push(`### [${section.key}] ${section.label}`);
    if (stripped.length > 800) {
      parts.push(`${stripped.slice(0, 400)}... (중략) ...${stripped.slice(-400)}`);
    } else {
      parts.push(stripped);
    }
    parts.push("");
  }

  // 수리 대상 섹션 + 위반 내역
  parts.push(`\n## 수리 대상 섹션\n`);
  for (const key of targetKeys) {
    const section = generated.sections.find((s) => s.key === key);
    if (!section) continue;

    const relevantViolations = violations.filter(
      (v) =>
        v.sectionKey === key ||
        // 섹션 key가 없는 위반은 전체 구조적 위반 — outline 관련은 content_sections에 해당
        (!v.sectionKey && key === "content_sections" && v.rule.startsWith("OUTLINE")),
    );

    parts.push(`### [${key}] ${section.label}`);
    parts.push(`**현재 content**: ${section.content}`);
    if (section.outline?.length) {
      parts.push(`**현재 outline 항목 수**: ${section.outline.length}`);
      const depth0 = section.outline.filter((o) => o.depth === 0);
      parts.push(`**현재 depth-0 대주제**: ${depth0.map((o) => o.text).join(" / ")}`);
    }

    if (relevantViolations.length > 0) {
      parts.push(`\n**위반 내역:**`);
      for (const v of relevantViolations) {
        parts.push(
          `- [${v.severity}] ${v.rule}: ${v.message}${v.actual != null ? ` (현재: ${v.actual}, 기준: ${v.expected})` : ""}`,
        );
      }
    }
    parts.push("");
  }

  parts.push(
    `\n위 위반을 해결하도록 대상 섹션만 수리하여 반환하세요. 유지되는 섹션과의 일관성을 반드시 확인하세요.`,
  );

  return parts.join("\n");
}

// ============================================================
// 위반에서 수리 대상 섹션 추출
// ============================================================

function extractRepairTargetKeys(
  violations: Violation[],
  generated: GeneratedGuideOutput,
): string[] {
  const keys = new Set<string>();

  for (const v of violations) {
    if (v.severity !== "error") continue;

    if (v.sectionKey) {
      keys.add(v.sectionKey);
    } else if (v.rule.startsWith("OUTLINE")) {
      // outline 관련 위반은 content_sections 대상
      keys.add("content_sections");
    } else if (v.rule.startsWith("BOOK")) {
      // 도서 관련 — content_sections에서 다룸
      keys.add("content_sections");
    } else if (v.rule === "REQUIRED_SECTION_MISSING") {
      // 누락 섹션은 repair로 해결 불가 (생성해야 함) — 건너뜀
      continue;
    }
  }

  // 실제 존재하는 섹션만 필터
  const existingKeys = new Set(generated.sections.map((s) => s.key));
  return [...keys].filter((k) => existingKeys.has(k));
}

// ============================================================
// Main
// ============================================================

/**
 * error 위반이 있는 섹션을 부분 재생성합니다.
 *
 * @param generated 원본 AI 생성 결과
 * @param violations A-L1 + A-L2 검증에서 발견된 위반 목록
 * @returns 수리된 결과 (수리 불필요 시 원본 그대로 반환)
 */
export async function repairViolations(
  generated: GeneratedGuideOutput,
  violations: Violation[],
): Promise<RepairResult> {
  const errorViolations = violations.filter((v) => v.severity === "error");
  if (errorViolations.length === 0) {
    return {
      repaired: false,
      output: generated,
      repairedSectionKeys: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const targetKeys = extractRepairTargetKeys(errorViolations, generated);
  if (targetKeys.length === 0) {
    // error가 있지만 수리 가능한 섹션이 없음 (예: REQUIRED_SECTION_MISSING)
    return {
      repaired: false,
      output: generated,
      repairedSectionKeys: [],
      remainingViolations: violations,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const userPrompt = buildRepairUserPrompt(
    generated,
    targetKeys,
    errorViolations,
  );

  const result = await generateObjectWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    schema: zodSchema(repairResponseSchema),
    modelTier: "fast",
    temperature: 0.3,
    maxTokens: 40960,
    timeoutMs: 120_000,
  });

  // Integrate: 수리된 섹션을 원본에 병합
  const repaired = structuredClone(generated);
  const repairedKeys: string[] = [];

  for (const repairedSection of result.object.sections) {
    // 같은 key + order로 매칭
    const idx = repaired.sections.findIndex(
      (s) =>
        s.key === repairedSection.key &&
        (s.order ?? 0) === (repairedSection.order ?? 0),
    );
    if (idx !== -1) {
      repaired.sections[idx] = {
        ...repaired.sections[idx],
        content: repairedSection.content,
        items: repairedSection.items ?? repaired.sections[idx].items,
        outline: repairedSection.outline ?? repaired.sections[idx].outline,
      };
      if (!repairedKeys.includes(repairedSection.key)) {
        repairedKeys.push(repairedSection.key);
      }
    }
  }

  // Monitor: 수리 후 A-L1 재검증
  const { validateGuideOutput } = await import("./deterministic-validator");
  const guideType = repaired.guideType as import("../../types").GuideType;
  const revalidation = validateGuideOutput(repaired, guideType);

  return {
    repaired: true,
    output: repaired,
    repairedSectionKeys: repairedKeys,
    remainingViolations: revalidation.violations,
    usage: result.usage,
  };
}

export { MAX_REPAIR_ATTEMPTS };
