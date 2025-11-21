/**
 * 학생 폼 관련 유틸리티 함수
 */

/**
 * 학교 타입 감지 (중학교/고등학교)
 */
export function detectSchoolType(
  school: string | null | undefined
): "중학교" | "고등학교" | "" {
  if (!school || typeof school !== "string") return "";
  if (school.includes("중") || school.includes("중학교")) return "중학교";
  if (school.includes("고") || school.includes("고등학교")) return "고등학교";
  return "";
}

/**
 * 학년을 숫자 형식으로 변환 (중3/고1 -> 숫자만)
 */
export function parseGradeNumber(
  grade: string | number | null | undefined
): string {
  if (!grade) return "";
  if (typeof grade === "number") return grade.toString();
  if (typeof grade === "string") {
    const match = grade.match(/\d+/);
    return match ? match[0] : grade;
  }
  return "";
}

/**
 * 학년을 표시 형식으로 변환 (숫자 -> 중3/고1 형식)
 */
export function formatGradeDisplay(
  grade: string | null | undefined,
  schoolType?: "중학교" | "고등학교" | ""
): string {
  if (!grade || grade.trim() === "") return "";
  
  const gradeNum = parseInt(grade, 10);
  if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 3) return grade;
  
  if (schoolType === "중학교") {
    return `중${gradeNum}학년`;
  }
  if (schoolType === "고등학교") {
    return `고${gradeNum}학년`;
  }
  return `${gradeNum}학년`;
}

/**
 * 전화번호 자동 포맷팅 (01012345678 -> 010-1234-5678)
 */
export function formatPhoneNumber(phone: string): string {
  // 숫자만 추출
  const cleaned = phone.replace(/\D/g, "");
  
  // 11자리 (010-1234-5678 형식)
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  
  // 10자리 (010-123-4567 형식, 일반 전화번호)
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  
  // 그 외는 원본 반환 (입력 중일 수 있음)
  return phone;
}

/**
 * 전화번호 유효성 검증
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || phone.trim() === "") return true; // 선택사항이므로 빈 값은 유효
  const cleaned = phone.replace(/\D/g, "");
  return /^01[0-9]\d{7,8}$/.test(cleaned);
}

/**
 * 폼 필드별 유효성 검증
 */
export type ValidationErrors = Partial<Record<keyof {
  name: string;
  school: string;
  grade: string;
  birth_date: string;
  gender: string;
  phone: string;
  mother_phone: string;
  father_phone: string;
  exam_year: string;
  curriculum_revision: string;
  desired_university_1: string;
  desired_university_2: string;
  desired_university_3: string;
  desired_career_field: string;
}, string>>;

export function validateFormField(
  field: string,
  value: string
): string | null {
  switch (field) {
    case "name":
      if (!value.trim()) return "이름을 입력해주세요";
      if (value.trim().length < 2) return "이름은 2자 이상 입력해주세요";
      if (value.trim().length > 20) return "이름은 20자 이하로 입력해주세요";
      break;
    case "phone":
    case "mother_phone":
    case "father_phone":
      if (value && !validatePhoneNumber(value)) {
        return "올바른 전화번호 형식이 아닙니다 (010-1234-5678)";
      }
      break;
    case "birth_date":
      if (!value) return "생년월일을 선택해주세요";
      const birthYear = new Date(value).getFullYear();
      const currentYear = new Date().getFullYear();
      if (birthYear < 2000 || birthYear > currentYear) {
        return "올바른 생년월일을 선택해주세요";
      }
      break;
    case "grade":
      if (!value) return "학년을 입력해주세요";
      const gradeNum = parseInt(value, 10);
      if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 3) {
        return "학년은 1-3 사이의 숫자여야 합니다";
      }
      break;
  }
  return null;
}

