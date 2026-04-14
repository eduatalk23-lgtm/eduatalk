// ============================================
// 수강 계획 추천 엔진
//
// 순수 함수 부분: DB 없음, 테스트 용이
// 서비스에서 DB 데이터를 주입하여 호출
// ============================================

import { getMajorRecommendedCourses, LEARNING_SEQUENCE_CHAINS } from "../constants";
import { normalizeSubjectName } from "@/lib/domains/subject/normalize";
import type {
  RecommendedCourse,
  MatchedRecommendation,
  CourseRecommendation,
  OfferedSubjectInfo,
  CoursePlan,
} from "./types";

interface SubjectInfo {
  id: string;
  name: string;
  subjectType?: string | null;
  /**
   * Wave 5.1e: 동명 subject 가 여러 개인 경우 canonical 선정용.
   * `exploration_guide_subject_mappings` 참조 건수. 높을수록 실제로 쓰이는 subject.
   * 미지정 시 0 (레거시 호환).
   */
  guideMappingCount?: number;
}

// ============================================
// 1단계: 추천 과목명 추출
// ============================================

/**
 * 전공 계열에서 추천 과목명 추출
 * 복수 전공: 합집합 + 출처 태깅
 */
export function getRecommendedCourseNames(
  majorCategories: string[],
  curriculumYear?: number,
): RecommendedCourse[] {
  const seen = new Set<string>();
  const results: RecommendedCourse[] = [];

  for (const major of majorCategories) {
    const courses = getMajorRecommendedCourses(major, curriculumYear);
    if (!courses) continue;

    for (const name of courses.general) {
      const key = normalizeSubjectName(name);
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ name, type: "general", majorCategory: major });
      }
    }
    for (const name of courses.career) {
      const key = normalizeSubjectName(name);
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ name, type: "career", majorCategory: major });
      }
    }
    if (courses.fusion) {
      for (const name of courses.fusion) {
        const key = normalizeSubjectName(name);
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ name, type: "fusion", majorCategory: major });
        }
      }
    }
  }

  return results;
}

// ============================================
// 2단계: subject_id 매칭
// ============================================

/**
 * 추천 과목명을 DB subject_id에 매칭
 */
export function matchRecommendationsToSubjects(
  recommendations: RecommendedCourse[],
  allSubjects: SubjectInfo[],
): MatchedRecommendation[] {
  // 정규화 키 → subject 인덱스
  // Wave 5.1e: 동명 subject 가 여러 개일 때 `guideMappingCount` 가 가장 높은 쪽을
  //   canonical 로 선택해 결정적으로 만든다. 기존엔 "첫 만난 것" 이라 DB row
  //   순서에 따라 매 실행 다른 id 가 뽑혀 plans 가 뒤집히는 버그가 있었음.
  const subjectIndex = new Map<string, SubjectInfo>();
  for (const s of allSubjects) {
    const key = normalizeSubjectName(s.name);
    const existing = subjectIndex.get(key);
    const curScore = s.guideMappingCount ?? 0;
    const exScore = existing?.guideMappingCount ?? 0;
    if (!existing || curScore > exScore) {
      subjectIndex.set(key, s);
    }
  }

  const matched: MatchedRecommendation[] = [];
  for (const rec of recommendations) {
    const key = normalizeSubjectName(rec.name);
    const subject = subjectIndex.get(key);
    if (subject) {
      matched.push({
        ...rec,
        subjectId: subject.id,
        subjectName: subject.name,
        subjectType: subject.subjectType ?? null,
      });
    }
    // 미매칭은 조용히 skip (DB에 없는 과목)
  }

  return matched;
}

// ============================================
// 3단계: 학년/학기 배치 + 학교 개설 필터
// ============================================

/**
 * 선택과목 타입별 기본 배치 슬롯 (라운드로빈 순서대로 채움)
 *
 * 교육적 우선순위 반영:
 * - 일반선택: 기초 학력 → 2학년 (1/2학기 라운드로빈)
 * - 진로선택: 전공 심화 → 3학년 우선, 넘치면 2-2
 * - 융합선택: 통합 사고 → 3학년 (1/2학기 라운드로빈)
 *
 * 학교 개설 정보(`school_offered_subjects.grades/semesters`)가 있으면 그 값을
 * 우선 존중한다 (1학년 개설 정보 포함). 이 슬롯은 정보가 없을 때만 fallback.
 */
const SELECTIVE_SLOTS: Record<"general" | "career" | "fusion", Array<[number, number]>> = {
  general: [[2, 1], [2, 2]],
  career: [[3, 1], [3, 2], [2, 2]],
  fusion: [[3, 1], [3, 2]],
};

/**
 * 추천 과목에 학년/학기를 배정
 *
 * 우선순위:
 * 1. school_offered_subjects.grades/semesters (학교 실제 개설 정보)
 * 2. SELECTIVE_SLOTS 라운드로빈 (타입별 교육적 분산)
 *
 * 공통과목(subjectType === "공통" 또는 "공통(성취평가)")은 이 함수에서 제외하고
 * common-courses.ts 의 고정 시드로 별도 처리한다.
 */
export function assignGradeSemesters(
  matched: MatchedRecommendation[],
  offeredSubjects: OfferedSubjectInfo[],
  existingPlans: CoursePlan[],
  takenSubjectIds: string[],
  studentCurrentGrade: number,
): CourseRecommendation[] {
  const offeredMap = new Map(offeredSubjects.map((o) => [o.subjectId, o]));
  const existingSet = new Set(
    existingPlans.map((p) => `${p.subject_id}:${p.grade}:${p.semester}`),
  );
  const takenSet = new Set(takenSubjectIds);

  // 타입별 라운드로빈 카운터
  const counters: Record<"general" | "career" | "fusion", number> = {
    general: 0,
    career: 0,
    fusion: 0,
  };

  const results: CourseRecommendation[] = [];

  for (const rec of matched) {
    // 이미 이수한 과목은 skip
    if (takenSet.has(rec.subjectId)) continue;

    // 공통과목은 별도 시드 경로 → 여기서 제외
    if (rec.subjectType === "공통" || rec.subjectType === "공통(성취평가)") continue;

    const offered = offeredMap.get(rec.subjectId);
    const isSchoolOffered = offered ? true : (offeredSubjects.length === 0 ? null : false);

    let grade: number;
    let semester: number;

    if (offered && offered.grades.length > 0) {
      // 학교 실제 개설 정보 우선 (1학년 개설 포함 가능)
      const validGrades = offered.grades.filter((g) => g >= studentCurrentGrade);
      const gradePool = validGrades.length > 0 ? validGrades : offered.grades;
      grade = gradePool[0];
      semester = offered.semesters.length > 0 ? offered.semesters[0] : 1;
    } else {
      // SELECTIVE_SLOTS 라운드로빈 (타입별 교육적 분산)
      const slots = SELECTIVE_SLOTS[rec.type];
      const validSlots = slots.filter(([g]) => g >= studentCurrentGrade);
      const pool = validSlots.length > 0 ? validSlots : slots;
      const idx = counters[rec.type] % pool.length;
      counters[rec.type]++;
      [grade, semester] = pool[idx];
    }

    // 중복 체크
    const key = `${rec.subjectId}:${grade}:${semester}`;
    if (existingSet.has(key)) continue;

    const typeLabel = rec.type === "general" ? "일반선택" :
      rec.type === "career" ? "진로선택" : "융합선택";

    results.push({
      subjectId: rec.subjectId,
      subjectName: rec.subjectName,
      subjectType: rec.subjectType,
      grade,
      semester,
      reason: `${rec.majorCategory} 계열 추천 ${typeLabel}`,
      isSchoolOffered: isSchoolOffered,
      priority: rec.type === "general" ? 2 : rec.type === "career" ? 1 : 0,
      majorCategory: rec.majorCategory,
    });

    existingSet.add(key);
  }

  return results.sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.semester !== b.semester) return a.semester - b.semester;
    return b.priority - a.priority;
  });
}

// ============================================
// P2-A: 수강 계획 충돌 감지
// ============================================

export interface PlanConflict {
  type: "overload" | "not_offered" | "duplicate" | "prerequisite";
  grade: number;
  semester: number;
  message: string;
  subjectIds: string[];
}

const CAREER_TYPES = new Set(["진로선택", "진로 선택"]);
const MAX_CAREER_PER_SEMESTER = 3;

/** 수강 계획의 충돌/경고 감지 */
export function detectPlanConflicts(
  plans: Array<{
    id: string;
    subject_id: string;
    grade: number;
    semester: number;
    plan_status: string;
    is_school_offered: boolean | null;
    subject: { name: string; subject_type?: { name: string } | null };
  }>,
): PlanConflict[] {
  const conflicts: PlanConflict[] = [];
  const active = plans.filter((p) => p.plan_status !== "completed");

  // 1. 과부하: 같은 학기에 진로선택 과목 4개 이상
  const bySemester = new Map<string, typeof active>();
  for (const p of active) {
    const key = `${p.grade}-${p.semester}`;
    const arr = bySemester.get(key) ?? [];
    arr.push(p);
    bySemester.set(key, arr);
  }

  for (const [key, semPlans] of bySemester) {
    const careerPlans = semPlans.filter(
      (p) => CAREER_TYPES.has(p.subject.subject_type?.name ?? ""),
    );
    if (careerPlans.length > MAX_CAREER_PER_SEMESTER) {
      const [grade, semester] = key.split("-").map(Number);
      conflicts.push({
        type: "overload",
        grade,
        semester,
        message: `${grade}학년 ${semester}학기 진로선택 ${careerPlans.length}개 — 과부하 가능`,
        subjectIds: careerPlans.map((p) => p.subject_id),
      });
    }
  }

  // 2. 미개설: confirmed인데 is_school_offered === false
  for (const p of active) {
    if (p.plan_status === "confirmed" && p.is_school_offered === false) {
      conflicts.push({
        type: "not_offered",
        grade: p.grade,
        semester: p.semester,
        message: `${p.subject.name} — 학교 미개설 과목`,
        subjectIds: [p.subject_id],
      });
    }
  }

  // 3. 중복: 같은 과목이 2회 이상
  const subjectCount = new Map<string, typeof active>();
  for (const p of active) {
    const arr = subjectCount.get(p.subject_id) ?? [];
    arr.push(p);
    subjectCount.set(p.subject_id, arr);
  }
  for (const [subjectId, dups] of subjectCount) {
    if (dups.length >= 2) {
      conflicts.push({
        type: "duplicate",
        grade: dups[0].grade,
        semester: dups[0].semester,
        message: `${dups[0].subject.name} — ${dups.length}회 중복`,
        subjectIds: [subjectId],
      });
    }
  }

  // 4. 선수 과목: 후수 과목이 선수 과목보다 빠르거나 같은 학기에 배치됨
  const nameToGradeSemester = new Map<string, { grade: number; semester: number; id: string }>();
  for (const p of active) {
    const norm = normalizeSubjectName(p.subject.name);
    nameToGradeSemester.set(norm, { grade: p.grade, semester: p.semester, id: p.subject_id });
  }

  for (const [prereq, followup] of LEARNING_SEQUENCE_CHAINS as [string, string][]) {
    const pre = nameToGradeSemester.get(prereq);
    const fol = nameToGradeSemester.get(followup);
    if (!pre || !fol) continue;
    const preOrder = pre.grade * 10 + (pre.semester ?? 0);
    const folOrder = fol.grade * 10 + (fol.semester ?? 0);
    if (folOrder <= preOrder) {
      conflicts.push({
        type: "prerequisite",
        grade: fol.grade,
        semester: fol.semester,
        message: `${followup} — 선수 과목(${prereq}) 이수 전 배치됨`,
        subjectIds: [fol.id],
      });
    }
  }

  return conflicts;
}
