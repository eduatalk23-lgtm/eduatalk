/**
 * 학생 프로필 관련 유틸리티 함수
 */

import { logActionDebug } from "@/lib/logging/actionLogger";
import { CAREER_TIER1 } from "@/lib/constants/career-classification";

/**
 * 학년 문자열에서 숫자 추출
 * 예: "중3" -> 3, "고2" -> 2
 */
function extractGradeNumber(grade: string | null | undefined): number | null {
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return null;
  }
  const match = grade.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * 입시년도 자동 계산
 * @param grade 학년 (예: "중3", "고1", "고2", "고3")
 * @returns 입시년도 (예: 2025, 2026)
 */
export function calculateExamYear(grade: string | null | undefined, schoolType?: "중학교" | "고등학교"): number {
  const currentYear = new Date().getFullYear();
  
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return currentYear + 1; // 기본값: 내년
  }

  // 숫자만 있는 경우와 중3/고1 형식 모두 처리
  let gradeNumber: number | null;
  if (/^\d+$/.test(grade.trim())) {
    // 숫자만 있는 경우
    gradeNumber = parseInt(grade.trim(), 10);
  } else {
    // 중3/고1 형식인 경우
    gradeNumber = extractGradeNumber(grade);
  }
  
  // schoolType이 있으면 사용
  const isMiddleSchool = schoolType === "중학교" || grade.includes("중");

  if (!gradeNumber) {
    return currentYear + 1; // 기본값: 내년
  }

  if (isMiddleSchool || grade.includes("중")) {
    // 중3 → 고등학교 입학 후 3년 = 현재년도 + 4년
    // 중2 → 현재년도 + 5년
    // 중1 → 현재년도 + 6년
    return currentYear + (7 - gradeNumber);
  }

  // 고등학교 (기본값)
  // 고1 → 현재년도 + 3년
  // 고2 → 현재년도 + 2년
  // 고3 → 현재년도 + 1년
  return currentYear + (4 - gradeNumber);
}

// ============================================
// 수능 타임라인 통합 산출
// ============================================

export type StudentExamTimeline = {
  /** 현재 학년 표시 (예: "고2") */
  gradeLabel: string;
  /** 학년도 = 대학 입학 연도 (예: 2028) */
  examYear: number;
  /** 수능 시행 시기 (예: "2027년 11월") */
  examDate: string;
  /** 학년도 명칭 (예: "2028학년도 수능") */
  examLabel: string;
  /** 대학 입학 시기 (예: "2028년 3월") */
  universityEntrance: string;
  /** 적용 교육과정 (예: "2022 개정") */
  curriculumRevision: "2009 개정" | "2015 개정" | "2022 개정";
};

/**
 * 학년 정보로 수능 타임라인 전체를 산출
 *
 * @param grade 학년 문자열 (예: "고2", "중3", "2")
 * @param schoolType 학교 유형
 * @param currentYear 기준 연도 (테스트용, 기본값 올해)
 */
export function getStudentExamTimeline(
  grade: string | null | undefined,
  schoolType?: "중학교" | "고등학교",
  currentYear?: number,
): StudentExamTimeline | null {
  if (!grade) return null;

  const gradeNumber = extractGradeNumber(grade);
  if (!gradeNumber) return null;

  const year = currentYear ?? new Date().getFullYear();
  const examYear = calculateExamYear(grade, schoolType);
  const examTestYear = examYear - 1; // 시행 연도 = 학년도 - 1

  const isMiddle = schoolType === "중학교" || grade.includes("중");
  const gradeLabel = isMiddle ? `중${gradeNumber}` : `고${gradeNumber}`;

  // 교육과정: 고1 입학 연도 기준
  const highSchoolStartYear = isMiddle
    ? year + (4 - gradeNumber) // 중3→내년 고1, 중2→2년후 고1, 중1→3년후 고1
    : year - (gradeNumber - 1); // 고2→작년 고1, 고3→재작년 고1
  let curriculumRevision: "2009 개정" | "2015 개정" | "2022 개정";
  if (highSchoolStartYear >= 2025) curriculumRevision = "2022 개정";
  else if (highSchoolStartYear >= 2018) curriculumRevision = "2015 개정";
  else curriculumRevision = "2009 개정";

  return {
    gradeLabel,
    examYear,
    examDate: `${examTestYear}년 11월`,
    examLabel: `${examYear}학년도 수능`,
    universityEntrance: `${examYear}년 3월`,
    curriculumRevision,
  };
}

/**
 * 생년월일로 입학년도 계산 (초등학교 입학 기준)
 * @param birthDate 생년월일 (YYYY-MM-DD 형식)
 * @returns 초등학교 입학년도
 */
export function calculateEntranceYear(birthDate: string | null | undefined): number {
  if (!birthDate || typeof birthDate !== "string") {
    const currentYear = new Date().getFullYear();
    return currentYear - 6; // 기본값: 현재년도 - 6년
  }
  const year = parseInt(birthDate.split("-")[0], 10);
  // 만 6세 기준으로 입학 (3월 기준)
  return year + 6;
}

/**
 * 개정교육과정 자동 계산
 * 학년 정보를 우선시하여 계산합니다. (개인 사정: 유급, 조기입학 등 반영)
 * @param grade 현재 학년 (예: "중3", "고1")
 * @param birthDate 생년월일 (YYYY-MM-DD 형식, 선택사항 - 참고용)
 * @param schoolType 학교 유형 (중학교 또는 고등학교)
 * @returns 개정교육과정 ("2009 개정", "2015 개정", "2022 개정")
 */
export function calculateCurriculumRevision(
  grade: string | null | undefined,
  birthDate?: string | null,
  schoolType?: "중학교" | "고등학교"
): "2009 개정" | "2015 개정" | "2022 개정" {
  const currentYear = new Date().getFullYear();
  
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return "2022 개정"; // 기본값
  }

  const gradeNumber = extractGradeNumber(grade);

  if (!gradeNumber) {
    return "2022 개정"; // 기본값
  }

  // 학년 정보를 우선시하여 입학년도 계산 (개인 사정 반영)
  let schoolStartYear: number;
  
  if (grade.includes("중")) {
    // 중학교 입학년도 = 현재년도 - (학년 - 1)
    // 예: 2025년 중3 → 2025 - (3 - 1) = 2023년 중1 입학
    schoolStartYear = currentYear - (gradeNumber - 1);
  } else if (grade.includes("고")) {
    // 고등학교 입학년도 = 현재년도 - (학년 - 1)
    // 예: 2025년 고2 → 2025 - (2 - 1) = 2024년 고1 입학
    schoolStartYear = currentYear - (gradeNumber - 1);
  } else {
    return "2022 개정"; // 기본값
  }

  // 생년월일이 있으면 검증 (참고용)
  if (birthDate) {
    const birthYear = parseInt(birthDate.split("-")[0], 10);
    const expectedEntranceYear = birthYear + 6; // 만 6세 입학 기준
    const expectedSchoolStartYear = grade.includes("중") 
      ? expectedEntranceYear + 6  // 초등학교 6년 후
      : expectedEntranceYear + 9; // 초등학교 6년 + 중학교 3년 후
    
    // 차이가 2년 이상이면 경고 (개인 사정 가능성)
    const diff = Math.abs(schoolStartYear - expectedSchoolStartYear);
    if (diff >= 2) {
      logActionDebug(
        { domain: "utils", action: "calculateCurriculumRevision" },
        "학년과 생년월일이 크게 다릅니다. 학년 정보를 우선 사용합니다.",
        { gradeYear: schoolStartYear, birthYear: expectedSchoolStartYear, diff }
      );
    }
  }

  // 중학교 개정교육과정 판단
  if (grade.includes("중")) {
    // 2022 개정: 2025년 중1부터
    if (schoolStartYear >= 2025) return "2022 개정";
    // 2015 개정: 2018년 중1부터
    if (schoolStartYear >= 2018) return "2015 개정";
    return "2009 개정";
  }

  // 고등학교 개정교육과정 판단
  // 2022 개정: 2025년 고1부터
  if (schoolStartYear >= 2025) return "2022 개정";
  // 2015 개정: 2018년 고1부터
  if (schoolStartYear >= 2018) return "2015 개정";
  return "2009 개정";
}

/**
 * 학년 선택 옵션 (중3 ~ 고3) - 숫자 형식으로 저장
 */
export const GRADE_OPTIONS = [
  { value: "3", label: "중3", schoolType: "중학교" },
  { value: "1", label: "고1", schoolType: "고등학교" },
  { value: "2", label: "고2", schoolType: "고등학교" },
  { value: "3", label: "고3", schoolType: "고등학교" },
] as const;

/**
 * 학년을 표시 형식으로 변환 (숫자 -> 중3/고1 형식)
 */
export function formatGradeDisplay(grade: string | null | undefined, schoolType?: "중학교" | "고등학교"): string {
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return "";
  }
  
  const gradeNum = parseInt(grade, 10);
  if (isNaN(gradeNum)) {
    return grade; // 이미 형식화된 경우 그대로 반환
  }
  
  // schoolType이 있으면 사용, 없으면 grade 값으로 추론
  if (schoolType === "중학교" || grade.includes("중")) {
    return `중${gradeNum}`;
  } else if (schoolType === "고등학교" || grade.includes("고")) {
    return `고${gradeNum}`;
  }
  
  // 기본값: 고등학교로 가정
  return `고${gradeNum}`;
}

/**
 * 학년을 숫자 형식으로 변환 (중3/고1 -> 숫자만)
 */
export function parseGradeNumber(grade: string | null | undefined): string {
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return "";
  }
  
  const match = grade.match(/\d+/);
  return match ? match[0] : "";
}

/**
 * 학년 숫자만 추출 (예: "중3" -> "3", "고2" -> "2")
 */
export function extractGradeNumberOnly(grade: string | null | undefined): string {
  if (!grade || typeof grade !== "string" || grade.trim() === "") {
    return "";
  }
  const match = grade.match(/\d+/);
  return match ? match[0] : "";
}

/**
 * 성별 선택 옵션
 */
export const GENDER_OPTIONS = [
  { value: "남", label: "남" },
  { value: "여", label: "여" },
] as const;

/**
 * 개정교육과정 선택 옵션
 */
export const CURRICULUM_REVISION_OPTIONS = [
  { value: "2009 개정", label: "2009 개정" },
  { value: "2015 개정", label: "2015 개정" },
  { value: "2022 개정", label: "2022 개정" },
] as const;

/**
 * 희망 진로 계열 선택 옵션 — KEDI 7대계열 기반
 */
export const CAREER_FIELD_OPTIONS = CAREER_TIER1.map((t) => ({
  value: t.code,
  label: t.label,
}));

