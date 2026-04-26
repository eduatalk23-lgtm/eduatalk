// ============================================
// gradeThemes → 스토리라인 프롬프트 섹션 빌더
//
// P3.5 cross_subject_theme_extraction 이 ctx.belief.gradeThemes 에 저장한
// 학년별 지배 테마를 S1 storyline 생성 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
//
// 소비처:
//   pipeline/synthesis/phase-s1-storyline.ts → detectInquiryLinks extraContext
//
// 설계 원칙:
//   - gradeThemes undefined/null 또는 dominantThemeIds 비어있으면 undefined 반환 (graceful, 섹션 생략)
//   - 순수 함수 (LLM 호출 없음, 부수효과 없음)
// ============================================

import type { GradeThemeExtractionResult } from "./types";

/**
 * P3.5 에서 추출한 학년 지배 테마를 S1 storyline 프롬프트에 주입할 마크다운 섹션으로 렌더한다.
 *
 * @param gradeThemes - ctx.belief.gradeThemes (P3.5 cross_subject_theme_extraction 결과)
 * @returns 마크다운 섹션 문자열, 또는 undefined (gradeThemes 없거나 비어있으면 생략)
 */
export function buildGradeThemesSection(
  gradeThemes: GradeThemeExtractionResult | null | undefined,
): string | undefined {
  if (!gradeThemes) return undefined;

  const { dominantThemeIds, themes } = gradeThemes;
  if (!dominantThemeIds || dominantThemeIds.length === 0) return undefined;

  // dominantThemeIds 순서 유지하며 label/keywords 조회
  const themeMap = new Map(themes.map((t) => [t.id, t]));
  const lines: string[] = [];

  for (const id of dominantThemeIds) {
    const theme = themeMap.get(id);
    if (!theme) continue;
    const kwPart = theme.keywords.length > 0 ? ` (${theme.keywords.slice(0, 4).join(", ")})` : "";
    const subjectPart = theme.affectedSubjects.length > 0
      ? ` · 교과: ${theme.affectedSubjects.slice(0, 4).join(", ")}`
      : "";
    lines.push(`- ${theme.label}${kwPart}${subjectPart}`);
  }

  if (lines.length === 0) return undefined;

  return [
    "## 이번 실행 학년별 지배 교과 교차 테마",
    "**규칙**: 아래 테마들은 P3.5 에서 이미 추출된 학년 전체 레코드의 교과 교차 테마다.",
    "스토리라인 서사는 이 테마를 **전제**로 구성하고, 각 테마가 어떻게 학년을 관통하는지 내러티브에 반영하라.",
    ...lines,
  ].join("\n");
}
