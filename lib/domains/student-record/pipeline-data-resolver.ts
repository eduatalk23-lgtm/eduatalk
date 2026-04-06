// ============================================
// pipeline-data-resolver.ts
// NEIS 기반 레코드 해소 레이어 (Step 1: pipeline-neis-driven-redesign)
//
// 파이프라인 시작 시 1회 실행.
// 각 레코드의 imported_content(NEIS) 유무를 판정하고,
// 유효 콘텐츠(effectiveContent)를 결정한다.
//
// 콘텐츠 해소 우선순위 (4-layer):
//   imported_content(NEIS) > confirmed_content(확정본) > content(가안) > ""
//   grade-stage.ts의 4-stage 우선순위와 일치
// ============================================

import type {
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
  ResolvedRecord,
  ResolvedRecordsByGrade,
} from "./pipeline-types";

// ============================================
// resolveRecordData
// ============================================

/**
 * 세특/창체/행특 캐시 목록을 받아 학년별 해소 결과를 반환한다.
 *
 * - hasNeis = !!imported_content?.trim()
 * - effectiveContent = NEIS 있으면 imported_content, 없으면 confirmed_content → content(가안 또는 "")
 * - hasAnyNeis = 해당 학년의 세특/창체/행특 중 하나라도 NEIS가 있는지
 */
export function resolveRecordData(
  seteks: CachedSetek[],
  changche: CachedChangche[],
  haengteuk: CachedHaengteuk[],
): ResolvedRecordsByGrade {
  const result: ResolvedRecordsByGrade = {};

  // 세특 해소
  for (const s of seteks) {
    const grade = s.grade;
    ensureGrade(result, grade);

    const hasNeis = (s.imported_content?.trim()?.length ?? 0) > 20;
    const effectiveContent = hasNeis
      ? (s.imported_content ?? "")
      : (s.confirmed_content?.trim() || (s.content ?? ""));

    const record: ResolvedRecord = {
      id: s.id,
      grade,
      hasNeis,
      effectiveContent,
      subjectName: s.subject?.name ?? undefined,
    };

    result[grade].seteks.push(record);
    if (hasNeis) result[grade].hasAnyNeis = true;
  }

  // 창체 해소
  for (const c of changche) {
    const grade = c.grade;
    ensureGrade(result, grade);

    const hasNeis = (c.imported_content?.trim()?.length ?? 0) > 20;
    const effectiveContent = hasNeis
      ? (c.imported_content ?? "")
      : (c.confirmed_content?.trim() || (c.content ?? ""));

    const record: ResolvedRecord = {
      id: c.id,
      grade,
      hasNeis,
      effectiveContent,
      activityType: c.activity_type ?? undefined,
    };

    result[grade].changche.push(record);
    if (hasNeis) result[grade].hasAnyNeis = true;
  }

  // 행특 해소 (학년당 1건: 여러 건 있으면 마지막 것 사용)
  for (const h of haengteuk) {
    const grade = h.grade;
    ensureGrade(result, grade);

    const hasNeis = (h.imported_content?.trim()?.length ?? 0) > 20;
    const effectiveContent = hasNeis
      ? (h.imported_content ?? "")
      : (h.confirmed_content?.trim() || (h.content ?? ""));

    const record: ResolvedRecord = {
      id: h.id,
      grade,
      hasNeis,
      effectiveContent,
    };

    result[grade].haengteuk = record;
    if (hasNeis) result[grade].hasAnyNeis = true;
  }

  return result;
}

// ============================================
// deriveGradeCategories
// ============================================

/**
 * 해소된 학년 맵에서 NEIS 학년 목록과 컨설팅 학년 목록을 분리한다.
 *
 * - neisGrades: hasAnyNeis === true인 학년 (오름차순)
 * - consultingGrades: hasAnyNeis === false인 학년 (오름차순)
 */
export function deriveGradeCategories(
  resolved: ResolvedRecordsByGrade,
): { neisGrades: number[]; consultingGrades: number[] } {
  const neisGrades: number[] = [];
  const consultingGrades: number[] = [];

  const grades = Object.keys(resolved)
    .map(Number)
    .sort((a, b) => a - b);

  for (const grade of grades) {
    if (resolved[grade].hasAnyNeis) {
      neisGrades.push(grade);
    } else {
      consultingGrades.push(grade);
    }
  }

  return { neisGrades, consultingGrades };
}

// ============================================
// resolveRecordDataForGrade
// ============================================

/**
 * 특정 학년의 세특/창체/행특만 필터링하여 해소 결과를 반환한다.
 *
 * Grade 파이프라인에서 targetGrade에 해당하는 데이터만 처리할 때 사용.
 * 내부적으로 resolveRecordData를 위임하므로 동일한 해소 로직이 보장된다.
 */
export function resolveRecordDataForGrade(
  seteks: CachedSetek[],
  changche: CachedChangche[],
  haengteuk: CachedHaengteuk[],
  targetGrade: number,
): ResolvedRecordsByGrade {
  return resolveRecordData(
    seteks.filter(s => s.grade === targetGrade),
    changche.filter(c => c.grade === targetGrade),
    haengteuk.filter(h => h.grade === targetGrade),
  );
}

// ============================================
// 내부 유틸
// ============================================

function ensureGrade(resolved: ResolvedRecordsByGrade, grade: number): void {
  if (!resolved[grade]) {
    resolved[grade] = {
      seteks: [],
      changche: [],
      haengteuk: null,
      hasAnyNeis: false,
    };
  }
}
