// ============================================
// H2 / L3-B: Interest Consistency Narrative 프롬프트
// 이전 학년 누적 데이터 → 관심 일관성 서사 (한국어 2~3문장)
// ============================================

import type { InterestConsistencyInput, InterestConsistencyResult } from "../types";
import { extractJson } from "../extractJson";

export const INTEREST_CONSISTENCY_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 학생의 이전 학년 누적 데이터를 읽고 **관심 일관성 서사**를 한국어 2~3문장으로 작성합니다.

## 작성 원칙

1. **사실 기반**: 입력에 등장한 테마·역량·세특 단서만 인용하세요. 새로운 주제·전공·진로를 만들어내지 마세요.
2. **2~3문장 엄수**: 한 문장은 60자 내외, 전체는 250자 이하. 긴 도입부·미사여구 금지.
3. **궤적 명시**: 학년이 2개 이상이면 변화 방향(심화/유지/전환)을 한 문장에 포함하세요.
4. **약점 통합**: 지속 약점이 있고 관심사와 충돌(예: 진로역량 하락 + 진로 테마 부재)하면 1문장으로 신중히 짚어주세요. 단정·낙인 금지.
5. **테마 부재 시**: themes가 비었으면 "특정 관심사가 안정화되지 않았다" 등 사실 그대로 서술하세요. 임의로 만들어내지 마세요.

## 출력 JSON 형식

\`\`\`json
{
  "narrative": "2024년 사회적 약자 통계 분석에서 시작된 관심이 2025년 분배 정책 탐구로 심화되며, 진로역량도 B+→A-로 상승했습니다. 다만 학업역량의 표현 구체성은 두 학년 모두 약점으로 남아 있습니다.",
  "sourceThemeIds": ["social-minority"],
  "confidence": 0.82
}
\`\`\`

- \`sourceThemeIds\`: 서사의 근거가 된 themes id (없으면 빈 배열).
- \`confidence\`: 입력 신호량 대비 서사 확신도 0.0~1.0.

JSON 외 텍스트·코드펜스 외 본문은 금지.`;

const TREND_LABEL: Record<"rising" | "stable" | "falling", string> = {
  rising: "상승",
  stable: "정체",
  falling: "하락",
};

export function buildInterestConsistencyUserPrompt(input: InterestConsistencyInput): string {
  const lines: string[] = [];
  const yrs = input.priorSchoolYears;
  const yearLabel = yrs.length === 1 ? `${yrs[0]}학년도` : `${yrs[0]}~${yrs.at(-1)}학년도`;
  lines.push(`## 분석 범위`);
  lines.push(`- 학년도: ${yearLabel} (총 ${yrs.length}년)`);
  if (input.targetMajor) lines.push(`- 목표 전공: ${input.targetMajor}`);

  if (input.themes.length > 0) {
    lines.push(``);
    lines.push(`## 학년 관통 테마 (cross-grade)`);
    for (const t of input.themes) {
      const subj = t.affectedSubjects.length > 0 ? ` [${t.affectedSubjects.join(", ")}]` : "";
      lines.push(`- \`${t.id}\` ${t.label} — ${t.years.join("/")}학년${subj}`);
    }
  } else {
    lines.push(``);
    lines.push(`## 학년 관통 테마`);
    lines.push(`- 없음 (이전 학년 dominant 테마 미감지)`);
  }

  if (input.careerTrajectory) {
    const ct = input.careerTrajectory;
    const yearsText = ct.byYear.map((p) => `${p.year}=${p.averageNumericGrade.toFixed(1)}`).join(" → ");
    const deltaText = ct.growthDelta !== 0
      ? ` (Δ ${ct.growthDelta > 0 ? "+" : ""}${ct.growthDelta.toFixed(1)})`
      : "";
    lines.push(``);
    lines.push(`## 진로역량 추이 (1~6 numeric)`);
    lines.push(`- ${yearsText} [${TREND_LABEL[ct.trend]}]${deltaText}`);
  }

  if (input.persistentStrengths.length > 0) {
    lines.push(``);
    lines.push(`## 지속 강점`);
    for (const s of input.persistentStrengths) {
      lines.push(`- ${s.competencyItem} (${s.bestGrade})`);
    }
  }

  if (input.persistentWeaknesses.length > 0) {
    lines.push(``);
    lines.push(`## 지속 약점`);
    for (const w of input.persistentWeaknesses) {
      lines.push(`- ${w.competencyItem} (${w.worstGrade})`);
    }
  }

  if (input.priorSetekHighlights && input.priorSetekHighlights.length > 0) {
    lines.push(``);
    lines.push(`## 이전 학년 세특 단서 (요약)`);
    for (const r of input.priorSetekHighlights) {
      const subj = r.subjectName ? `${r.subjectName} | ` : "";
      lines.push(`- ${r.schoolYear} | ${subj}${r.snippet}`);
    }
  }

  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`위 자료만으로 한국어 2~3문장 관심 일관성 서사를 작성하세요. JSON으로만 응답.`);
  return lines.join("\n");
}

// ============================================
// 응답 파서
// ============================================

const NARRATIVE_MAX_CHARS = 400;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseInterestConsistencyResponse(
  content: string,
  validThemeIds: ReadonlySet<string>,
): Omit<InterestConsistencyResult, "elapsedMs"> | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const narrative = typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
  if (!narrative) return null;
  const safeNarrative = narrative.length > NARRATIVE_MAX_CHARS
    ? narrative.slice(0, NARRATIVE_MAX_CHARS)
    : narrative;

  const rawIds = Array.isArray(parsed.sourceThemeIds) ? parsed.sourceThemeIds : [];
  const sourceThemeIds = rawIds
    .filter((x): x is string => typeof x === "string" && SLUG_PATTERN.test(x))
    .filter((id) => validThemeIds.has(id));

  const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.6;
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  return { narrative: safeNarrative, sourceThemeIds, confidence };
}
