/**
 * 학생 프로필 관련 유틸리티 함수
 */

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

  return currentYear + 1; // 기본값
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
 * @param grade 현재 학년 (예: "중3", "고1")
 * @param birthDate 생년월일 (YYYY-MM-DD 형식, 선택사항)
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
  
  // 숫자만 있는 경우 schoolType으로 판단
  const isMiddleSchool = schoolType === "중학교" || grade.includes("중");

  const gradeNumber = extractGradeNumber(grade);

  if (!gradeNumber) {
    return "2022 개정"; // 기본값
  }

  let entranceYear: number;

  if (birthDate) {
    entranceYear = calculateEntranceYear(birthDate);
  } else {
    // 생년월일이 없으면 현재 학년 기준으로 역산
    if (grade.includes("중")) {
      entranceYear = currentYear - (gradeNumber - 1) - 3; // 중학교 입학년도
    } else if (grade.includes("고")) {
      entranceYear = currentYear - (gradeNumber - 1) - 6; // 고등학교 입학년도
    } else {
      return "2022 개정"; // 기본값
    }
  }

  if (grade.includes("중")) {
    const middleSchoolStartYear = entranceYear + 6; // 초등학교 6년 후
    // 2022 개정: 2024년 중1부터
    if (middleSchoolStartYear >= 2024) return "2022 개정";
    // 2015 개정: 2015년 중1부터
    if (middleSchoolStartYear >= 2015) return "2015 개정";
    return "2009 개정";
  }

  // 고등학교 (기본값)
  const highSchoolStartYear = entranceYear + 9; // 초등학교 6년 + 중학교 3년 후
  // 2022 개정: 2027년 고1부터 (예상, 실제로는 2024년 중1이 2027년 고1)
  if (highSchoolStartYear >= 2027) return "2022 개정";
  // 2015 개정: 2018년 고1부터 (2015년 중1이 2018년 고1)
  if (highSchoolStartYear >= 2018) return "2015 개정";
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
 * 희망 진로 계열 선택 옵션
 */
export const CAREER_FIELD_OPTIONS = [
  { value: "인문계열", label: "인문계열" },
  { value: "사회계열", label: "사회계열" },
  { value: "자연계열", label: "자연계열" },
  { value: "공학계열", label: "공학계열" },
  { value: "의약계열", label: "의약계열" },
  { value: "예체능계열", label: "예체능계열" },
  { value: "교육계열", label: "교육계열" },
  { value: "농업계열", label: "농업계열" },
  { value: "해양계열", label: "해양계열" },
  { value: "기타", label: "기타" },
] as const;

