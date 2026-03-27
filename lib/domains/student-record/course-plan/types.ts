// ============================================
// 수강 계획 타입
// ============================================

/** DB 행 타입 */
export interface CoursePlan {
  id: string;
  tenant_id: string;
  student_id: string;
  subject_id: string;
  grade: number;
  semester: number;
  plan_status: CoursePlanStatus;
  source: CoursePlanSource;
  recommendation_reason: string | null;
  is_school_offered: boolean | null;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CoursePlanStatus = "recommended" | "confirmed" | "completed";
export type CoursePlanSource = "auto" | "consultant" | "student" | "import";

/** DB 행 + subject 정보 JOIN */
export interface CoursePlanWithSubject extends CoursePlan {
  subject: {
    id: string;
    name: string;
    subject_type?: { name: string } | null;
    subject_group?: { name: string } | null;
  };
}

/** 추천 엔진 출력: DB 저장 전 단계 */
export interface CourseRecommendation {
  subjectId: string;
  subjectName: string;
  subjectType: string | null; // 공통/일반선택/진로선택/융합선택
  grade: number;
  semester: number;
  reason: string;
  isSchoolOffered: boolean | null;
  priority: number;
  majorCategory: string; // 어떤 전공 계열에서 추천했는지
}

/** 추천 과목명 + 출처 정보 */
export interface RecommendedCourse {
  name: string;
  type: "general" | "career" | "fusion";
  majorCategory: string;
}

/** subject_id 매칭된 추천 */
export interface MatchedRecommendation extends RecommendedCourse {
  subjectId: string;
  subjectName: string;
  subjectType: string | null;
}

/** 학교 개설 과목 정보 */
export interface OfferedSubjectInfo {
  subjectId: string;
  grades: number[];
  semesters: number[];
}

/** 수강 계획 탭 전체 데이터 */
export interface CoursePlanTabData {
  plans: CoursePlanWithSubject[];
  targetMajor: string | null;
  targetMajor2: string | null;
  studentGrade: number;
  offeredSubjects: OfferedSubjectInfo[];
  /** 학교 개설 과목명 목록 (적합도 계산용, null이면 학교 미등록) */
  offeredSubjectNames: string[] | null;
  /** 적용 교육과정 연도 (2015 또는 2022) */
  curriculumYear: number;
  schoolName: string | null;
}

/** 저장 입력 */
export interface CoursePlanInput {
  tenantId: string;
  studentId: string;
  subjectId: string;
  grade: number;
  semester: number;
  planStatus?: CoursePlanStatus;
  source?: CoursePlanSource;
  recommendationReason?: string;
  isSchoolOffered?: boolean | null;
  priority?: number;
  notes?: string;
}
