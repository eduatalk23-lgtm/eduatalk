// ============================================
// H1 / L3-A: Cross-subject Theme Extractor 프롬프트
// 학년 전체 레코드를 한 프롬프트에 일괄 주입 → 과목 교차 테마 감지
// ============================================

import type { GradeThemeExtractionInput, GradeTheme, GradeThemeExtractionResult } from "../types";
import { extractJson } from "../extractJson";

export const CROSS_SUBJECT_THEMES_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 한 학년의 생기부 전체를 읽고 **과목 간 반복되는 테마**와 **심화 궤적**을 추출합니다.

## 분석 원칙

1. **의미 단위로 묶기**: 테마는 "단어"가 아닌 "탐구 대상·관점·문제 의식" 단위로 묶습니다.
   - 예시: "사회적 약자 이해"는 수학의 통계 분석, 경제의 분배 문제, 사회의 복지 정책을 모두 포괄할 수 있음
   - 단순 단어 일치가 아닌 **문제 의식의 연속성**이 있어야 같은 테마

2. **≥2 과목/활동 등장 원칙**: 1개 과목에만 등장하는 주제는 테마로 분류하지 않습니다. 그런 것은 해당 레코드의 개별 강점일 뿐입니다.

3. **원문 정확 인용**: evidenceSnippet은 원문 그대로, 100자 이하. 요약하거나 바꾸지 마세요.

4. **선행 학년 연속성 판정** (profileCard 주어진 경우만):
   - deepening: 이전 학년 관심사가 이번 학년에 심화
   - stagnant: 이전 학년과 동일 수준에 머무름 (반복)
   - pivot: 관심사가 전환됨
   - new: 이번 학년에 새롭게 등장

5. **슬러그 규칙**: id는 영문 lowercase slug (예: "social-minority", "data-modeling"). 공백·한글·특수문자 금지.

## 금지 사항

- 테마 난립 금지 (최대 6개)
- 단어 수준 일치만으로 같은 테마로 묶지 마세요 (예: "생명"이 언급됐다고 전부 묶지 말 것)
- 모든 레코드를 반드시 어느 테마에 넣을 필요 없음 (연결 없는 레코드는 제외)

## 우선순위 판정 (dominantThemeIds)

학년 전체를 관통하는 상위 3개 테마 id를 dominantThemeIds에 나열. 기준:
1. subjectCount 높은 순
2. 동률이면 confidence 높은 순
3. 동률이면 records 개수 많은 순

## JSON 출력 형식

\`\`\`json
{
  "themes": [
    {
      "id": "social-minority",
      "label": "사회적 약자 이해",
      "keywords": ["복지", "불평등", "분배"],
      "records": [
        {
          "recordId": "r1",
          "recordType": "setek",
          "subjectName": "수학",
          "evidenceSnippet": "통계 자료를 활용하여 소득 분배의 불평등을 분석함"
        }
      ],
      "affectedSubjects": ["수학", "경제", "사회"],
      "subjectCount": 3,
      "evolutionSignal": "deepening",
      "confidence": 0.9
    }
  ],
  "dominantThemeIds": ["social-minority"]
}
\`\`\``;

const TYPE_LABEL: Record<string, string> = {
  setek: "교과 세특",
  personal_setek: "개인 세특",
  changche: "창의적 체험활동",
  haengteuk: "행동특성 및 종합의견",
};

export function buildCrossSubjectThemesUserPrompt(input: GradeThemeExtractionInput): string {
  let prompt = `## 학생 정보\n\n`;
  prompt += `- 학년: ${input.grade}학년\n`;
  if (input.targetMajor) prompt += `- 목표 전공: ${input.targetMajor}\n`;

  if (input.profileCard) {
    prompt += `\n## 이전 학년 누적 (profileCard)\n\n${input.profileCard}\n`;
  } else {
    prompt += `\n## 이전 학년 누적\n\n없음 (1학년 또는 선행 분석 미완)\n`;
  }

  // 레코드 유형별 그룹화
  const grouped: Record<string, typeof input.records> = {};
  for (const r of input.records) {
    const key = r.recordType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  prompt += `\n## 이번 학년 레코드 (총 ${input.records.length}건)\n`;

  for (const type of ["setek", "personal_setek", "changche", "haengteuk"]) {
    const records = grouped[type];
    if (!records || records.length === 0) continue;
    prompt += `\n### ${TYPE_LABEL[type]} (${records.length}건)\n\n`;
    for (const r of records) {
      const subjLabel = r.subjectName ? ` | ${r.subjectName}` : "";
      const tagSummary = r.competencyTags && r.competencyTags.length > 0
        ? ` | 역량: ${r.competencyTags.slice(0, 3).join(", ")}`
        : "";
      const issueSummary = r.qualityIssues && r.qualityIssues.length > 0
        ? ` | 이슈: ${r.qualityIssues.join(", ")}`
        : "";
      prompt += `- [id: ${r.recordId}${subjLabel}${tagSummary}${issueSummary}]\n`;
      prompt += `  ${r.content}\n\n`;
    }
  }

  prompt += `\n---\n\n위 레코드들을 분석하여 **≥2개 과목/활동에 걸쳐 반복되는 테마**를 추출하세요. JSON으로만 응답하세요.`;
  return prompt;
}

// ============================================
// 가이드 프롬프트용 컨텍스트 렌더러 (H1 → 다운스트림 주입)
// ============================================

import type { GradeCrossSubjectThemesContext } from "../types";

const EVOLUTION_LABEL: Record<NonNullable<GradeCrossSubjectThemesContext["dominantThemes"][number]["evolutionSignal"]>, string> = {
  deepening: "심화",
  stagnant: "정체",
  pivot: "전환",
  new: "신규",
};

/**
 * H1 dominant themes → 가이드 프롬프트 섹션 문자열.
 * 가이드(세특/창체/행특)가 학년 전체 테마 일관성에 정렬되도록 안내한다.
 * 데이터가 없으면 빈 문자열 반환 — 호출부에서 그대로 concat 가능.
 */
export function renderCrossSubjectThemesSection(
  ctx: GradeCrossSubjectThemesContext | undefined,
): string {
  if (!ctx || ctx.dominantThemes.length === 0) return "";

  const lines: string[] = [];
  lines.push(`## 학년 관통 테마 (과목 교차 ${ctx.crossSubjectPatternCount}개)`);
  lines.push("");
  lines.push(`→ 아래 테마는 학년 내 ≥2개 과목/활동에 걸쳐 반복되는 핵심 의미입니다. 이 가이드는 dominant 테마와 일관되게(또는 보강하는 방향으로) 작성하세요.`);
  lines.push("");

  for (const t of ctx.dominantThemes) {
    const subjects = t.affectedSubjects.length > 0 ? ` [${t.affectedSubjects.join(", ")}]` : "";
    const evolution = t.evolutionSignal ? ` · ${EVOLUTION_LABEL[t.evolutionSignal]}` : "";
    const keywords = t.keywords.length > 0 ? ` · 키워드: ${t.keywords.join(", ")}` : "";
    lines.push(`- **${t.label}** (${t.subjectCount}과목${evolution})${subjects}${keywords}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ============================================
// 응답 파서
// ============================================

const EMPTY_RESULT: Omit<GradeThemeExtractionResult, "elapsedMs"> = {
  themes: [],
  themeCount: 0,
  crossSubjectPatternCount: 0,
  dominantThemeIds: [],
};

const VALID_RECORD_TYPES = new Set(["setek", "personal_setek", "changche", "haengteuk"]);
const VALID_EVOLUTION = new Set(["deepening", "stagnant", "pivot", "new"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseCrossSubjectThemesResponse(content: string): Omit<GradeThemeExtractionResult, "elapsedMs"> {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    throw new SyntaxError(`테마 추출 JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== "object") return { ...EMPTY_RESULT };

  const rawThemes = Array.isArray(parsed.themes) ? parsed.themes : [];
  const themes: GradeTheme[] = [];

  for (const t of rawThemes) {
    if (!t || typeof t !== "object") continue;
    const raw = t as Record<string, unknown>;

    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id || !SLUG_PATTERN.test(id)) continue;

    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (!label) continue;

    const keywords = Array.isArray(raw.keywords)
      ? raw.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : [];

    const rawRecords = Array.isArray(raw.records) ? raw.records : [];
    const records: GradeTheme["records"] = [];
    for (const r of rawRecords) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const recordId = typeof rec.recordId === "string" ? rec.recordId : "";
      const recordType = typeof rec.recordType === "string" && VALID_RECORD_TYPES.has(rec.recordType)
        ? (rec.recordType as GradeTheme["records"][number]["recordType"])
        : null;
      const evidenceSnippet = typeof rec.evidenceSnippet === "string" ? rec.evidenceSnippet.trim().slice(0, 200) : "";
      if (!recordId || !recordType || !evidenceSnippet) continue;
      records.push({
        recordId,
        recordType,
        ...(typeof rec.subjectName === "string" && rec.subjectName ? { subjectName: rec.subjectName } : {}),
        evidenceSnippet,
      });
    }

    const affectedSubjects = Array.isArray(raw.affectedSubjects)
      ? [...new Set(raw.affectedSubjects.filter((s): s is string => typeof s === "string" && s.length > 0))]
      : [];
    const subjectCount = typeof raw.subjectCount === "number" ? raw.subjectCount : affectedSubjects.length;

    // 최소 기준: 2개 이상 과목 또는 레코드
    if (subjectCount < 2 && records.length < 2) continue;

    const evolutionSignal = typeof raw.evolutionSignal === "string" && VALID_EVOLUTION.has(raw.evolutionSignal)
      ? (raw.evolutionSignal as GradeTheme["evolutionSignal"])
      : undefined;

    const confidence = typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.7;

    themes.push({
      id,
      label,
      keywords,
      records,
      affectedSubjects,
      subjectCount,
      ...(evolutionSignal ? { evolutionSignal } : {}),
      confidence,
    });
  }

  // 최대 6개 제한
  const limited = themes.slice(0, 6);

  const rawDominant = Array.isArray(parsed.dominantThemeIds) ? parsed.dominantThemeIds : [];
  const validIds = new Set(limited.map((t) => t.id));
  const dominantThemeIds = rawDominant
    .filter((d): d is string => typeof d === "string" && validIds.has(d))
    .slice(0, 3);

  // dominant 누락 시 fallback: subjectCount/confidence/records로 정렬
  const finalDominant = dominantThemeIds.length > 0
    ? dominantThemeIds
    : [...limited]
        .sort((a, b) => {
          if (b.subjectCount !== a.subjectCount) return b.subjectCount - a.subjectCount;
          if (b.confidence !== a.confidence) return b.confidence - a.confidence;
          return b.records.length - a.records.length;
        })
        .slice(0, 3)
        .map((t) => t.id);

  const crossSubjectPatternCount = limited.filter((t) => t.subjectCount >= 2).length;

  return {
    themes: limited,
    themeCount: limited.length,
    crossSubjectPatternCount,
    dominantThemeIds: finalDominant,
  };
}
