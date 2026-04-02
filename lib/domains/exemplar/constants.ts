// ============================================
// 합격 생기부 레퍼런스 (Exemplar) 상수
// ============================================

import type { ActivityType, CurriculumRevision, SchoolCategory } from "./types";

// ============================================
// 1. 교육과정별 생기부 구조 차이
// ============================================

/** 교육과정별 존재하는 NEIS 섹션 */
export const CURRICULUM_SECTIONS: Record<
  CurriculumRevision,
  {
    hasCareerAspiration: boolean;       // 진로희망사항
    hasVolunteerInChangche: boolean;    // 창체에 봉사활동 포함
    hasSelfGovernance: boolean;         // 자치활동 분리
    hasReadingForAdmission: boolean;    // 독서활동 대입 반영
    hasAwardsForAdmission: boolean;     // 수상경력 대입 반영
    hasCertificationsForAdmission: boolean;
    activityTypes: ActivityType[];
    gradeSystem: "9등급" | "5등급+9등급";
    maxHaengteukBytes: number;
  }
> = {
  "2009": {
    hasCareerAspiration: true,
    hasVolunteerInChangche: true,
    hasSelfGovernance: false,
    hasReadingForAdmission: true,
    hasAwardsForAdmission: true,
    hasCertificationsForAdmission: true,
    activityTypes: ["autonomy", "club", "volunteer", "career"],
    gradeSystem: "9등급",
    maxHaengteukBytes: 1500,
  },
  "2015": {
    hasCareerAspiration: false,       // 2018년부터 삭제
    hasVolunteerInChangche: true,
    hasSelfGovernance: false,
    hasReadingForAdmission: false,    // 2021년부터 미반영
    hasAwardsForAdmission: false,     // 2024년부터 학기당 1건만
    hasCertificationsForAdmission: false,
    activityTypes: ["autonomy", "club", "volunteer", "career"],
    gradeSystem: "9등급",
    maxHaengteukBytes: 1500,
  },
  "2022": {
    hasCareerAspiration: false,
    hasVolunteerInChangche: false,    // 봉사 독립 영역 폐지
    hasSelfGovernance: true,          // 자율+자치 분리
    hasReadingForAdmission: false,
    hasAwardsForAdmission: false,     // 전면 미반영
    hasCertificationsForAdmission: false,
    activityTypes: ["autonomy", "self_governance", "club", "career"],
    gradeSystem: "5등급+9등급",
    maxHaengteukBytes: 900,           // 300자 × 3B
  },
};

// ============================================
// 2. 입학년도 → 교육과정 매핑
// ============================================

/** 고1 입학 연도 기준으로 적용 교육과정 결정 */
export function getCurriculumRevision(enrollmentYear: number): CurriculumRevision {
  if (enrollmentYear >= 2025) return "2022";
  if (enrollmentYear >= 2018) return "2015";
  return "2009";
}

/** 합격 연도 → 대략적 입학 연도 추정 (합격 연도 - 3) */
export function estimateEnrollmentYear(admissionYear: number): number {
  return admissionYear - 3;
}

// ============================================
// 3. 파일명 파싱 패턴
// ============================================

/** 대학 약칭 → 정식 명칭 */
export const UNIVERSITY_ALIASES: Record<string, string> = {
  서울대: "서울대학교",
  연세대: "연세대학교",
  고려대: "고려대학교",
  성균관: "성균관대학교",
  성균관대: "성균관대학교",
  한양대: "한양대학교",
  서강대: "서강대학교",
  중앙대: "중앙대학교",
  경희대: "경희대학교",
  이화여대: "이화여자대학교",
  이화여: "이화여자대학교",
  숙명여대: "숙명여자대학교",
  숙명여: "숙명여자대학교",
  덕성여대: "덕성여자대학교",
  덕성여: "덕성여자대학교",
  서울여대: "서울여자대학교",
  서울여: "서울여자대학교",
  동덕여: "동덕여자대학교",
  성신여대: "성신여자대학교",
  성신여: "성신여자대학교",
  건국대: "건국대학교",
  동국대: "동국대학교",
  홍익대: "홍익대학교",
  국민대: "국민대학교",
  숭실대: "숭실대학교",
  가천대: "가천대학교",
  인천대: "인천대학교",
  항공대: "한국항공대학교",
  한외대: "한국외국어대학교",
  한국외대: "한국외국어대학교",
  서울과기: "서울과학기술대학교",
  서울과기대: "서울과학기술대학교",
  서울시립: "서울시립대학교",
  서울시립대: "서울시립대학교",
  카이스트: "KAIST",
  유니스트: "UNIST",
  포항공대: "포항공과대학교",
  을지대: "을지대학교",
};

// ============================================
// 4. 학교 유형 키워드
// ============================================

export const SCHOOL_CATEGORY_KEYWORDS: Record<string, SchoolCategory> = {
  외고: "외고",
  외국어고: "외고",
  국제고: "국제고",
  과학고: "과학고",
  과고: "과학고",
  예술고: "예술고",
  예고: "예술고",
  체육고: "체육고",
  체고: "체육고",
  마이스터: "마이스터고",
  특성화고: "특성화고",
  자사고: "자사고",
  자율형사립: "자사고",
};

// ============================================
// 5. 파싱 품질 기준
// ============================================

/** 파싱 품질 점수 임계값 */
export const PARSE_QUALITY_THRESHOLDS = {
  /** 이 이상이면 자동 저장 */
  AUTO_ACCEPT: 80,
  /** 이 이상이면 수동 검토 후 저장 */
  MANUAL_REVIEW: 50,
  /** 이 미만이면 재파싱 필요 */
  REJECT: 50,
} as const;

/** 필수 섹션 (이 중 하나라도 없으면 품질 감점) */
export const REQUIRED_SECTIONS = [
  "grades",
  "seteks",
  "haengteuk",
] as const;

/** 중요 섹션 (없으면 경고) */
export const IMPORTANT_SECTIONS = [
  "creativeActivities",
  "attendance",
  "reading",
] as const;

// ============================================
// 6. 임베딩 대상 테이블
// ============================================

/** 벡터 임베딩을 생성할 서술형 필드 */
export const EMBEDDABLE_SOURCES = [
  "exemplar_seteks",
  "exemplar_creative_activities",
  "exemplar_haengteuk",
  "exemplar_reading",
] as const;

export type EmbeddableSource = (typeof EMBEDDABLE_SOURCES)[number];
