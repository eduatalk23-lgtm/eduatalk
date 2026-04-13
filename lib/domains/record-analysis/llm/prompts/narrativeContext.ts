// ============================================
// L4-E / Phase 2-1: Narrative Context 가이드 프롬프트 섹션
// 보강 우선순위(severity 정렬) + 설계 모드 레코드 우선순위 → 가이드 LLM 프롬프트 주입
// ============================================

import type { GuideAnalysisContext } from "../types";

const SEVERITY_LABEL = { high: "최우선", medium: "중요", low: "확인" } as const;
const RECORD_TYPE_LABEL = { setek: "세특", changche: "창체", haengteuk: "행특" } as const;

/**
 * narrativeContext → 프롬프트 섹션 문자열.
 * 데이터 없으면 빈 문자열 반환 (호출부에서 그대로 concat 가능).
 *
 * 토큰 절감 정책:
 * - prioritizedWeaknesses: 상위 5개만 (severity 정렬 → 동률 시 competency 우선)
 * - recordPriorityOrder: 상위 5개만, reasons는 처음 2개만
 *
 * 기존 섹션과의 역할 분담:
 * - "감지된 경고 패턴" → 패턴별 suggestion (행동 지침)
 * - "약점 역량" → 항목별 reasoning (분석 결과)
 * - 본 섹션 → severity 통합 우선순위 + 어떤 레코드를 먼저 작성할지 (의사결정 가이드)
 */
export function renderNarrativeContextSection(
  ctx: GuideAnalysisContext["narrativeContext"] | undefined,
): string {
  if (!ctx) return "";
  const weaknesses = ctx.prioritizedWeaknesses ?? [];
  const records = ctx.recordPriorityOrder ?? [];
  if (weaknesses.length === 0 && records.length === 0) return "";

  const lines: string[] = [];
  lines.push("## 보강 우선순위 (서사·약점 통합)");
  lines.push("");

  if (weaknesses.length > 0) {
    lines.push(`### 약점 — 시급도 순 (상위 ${Math.min(weaknesses.length, 5)}개)`);
    for (const w of weaknesses.slice(0, 5)) {
      const tag = SEVERITY_LABEL[w.severity];
      const areaSuffix = w.area ? ` · ${w.area}` : "";
      lines.push(`- **[${tag}]** ${w.label}${areaSuffix} — ${w.rationale}`);
    }
    lines.push("");
  }

  if (records.length > 0) {
    lines.push(`### 우선 작성 레코드 (설계 모드 · 상위 ${Math.min(records.length, 5)}개)`);
    for (const r of records.slice(0, 5)) {
      const reasonText = r.reasons.length > 0 ? ` — ${r.reasons.slice(0, 2).join(" · ")}` : "";
      lines.push(`- [${RECORD_TYPE_LABEL[r.recordType]}] ${r.label} (${r.grade}학년, 점수 ${r.priority})${reasonText}`);
    }
    lines.push("");
  }

  lines.push("→ 위 우선순위에 따라 가이드 작성 시 **'최우선' 항목을 가장 구체적으로** 다루세요. '우선 작성 레코드'가 있으면 해당 항목의 방향·키워드를 우선 채워넣으세요.");
  lines.push("");
  return lines.join("\n");
}
