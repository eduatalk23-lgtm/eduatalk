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

/** subject_type → 기본 배치 학년 (fallback) */
const TYPE_DEFAULT_GRADES: Record<string, number[]> = {
  "공통": [1],
  "일반선택": [2],
  "진로선택": [2, 3],
  "융합선택": [2, 3],
};

/**
 * 추천 과목에 학년/학기를 배정
 *
 * 우선순위:
 * 1. school_offered_subjects.grades[] 사용
 * 2. subject_type 기반 fallback
 * 3. 정적 기본값 (2학년 1학기)
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

  const results: CourseRecommendation[] = [];

  for (const rec of matched) {
    // 이미 이수한 과목은 skip
    if (takenSet.has(rec.subjectId)) continue;

    const offered = offeredMap.get(rec.subjectId);
    const isSchoolOffered = offered ? true : (offeredSubjects.length === 0 ? null : false);

    // 학년 결정
    let targetGrades: number[];
    if (offered && offered.grades.length > 0) {
      // 학교에서 제공하는 학년 정보 사용
      targetGrades = offered.grades.filter((g) => g >= studentCurrentGrade);
      if (targetGrades.length === 0) targetGrades = offered.grades;
    } else {
      // subject_type fallback
      const defaults = TYPE_DEFAULT_GRADES[rec.subjectType ?? ""] ?? [2];
      targetGrades = defaults.filter((g) => g >= studentCurrentGrade);
      if (targetGrades.length === 0) targetGrades = defaults;
    }

    // 학기 결정
    let targetSemesters: number[];
    if (offered && offered.semesters.length > 0) {
      targetSemesters = offered.semesters;
    } else {
      targetSemesters = [1]; // 기본 1학기
    }

    const grade = targetGrades[0];
    const semester = targetSemesters[0];

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
