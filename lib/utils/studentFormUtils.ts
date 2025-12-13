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
 * 전화번호에서 숫자만 추출
 */
export function extractPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 전화번호 정규화 (최종 저장 형식: 010-1234-5678)
 * - 숫자만 추출
 * - 010으로 시작하는 10~11자리만 허용
 * - 010-1234-5678 형식으로 변환
 */
export function normalizePhoneNumber(phone: string): string | null {
  if (!phone || phone.trim() === "") return null; // 빈 값은 null 반환
  
  const cleaned = extractPhoneDigits(phone);
  
  // 010으로 시작하는지 확인
  if (!cleaned.startsWith("010")) {
    return null; // 유효하지 않음
  }
  
  // 10~11자리 확인
  if (cleaned.length === 10) {
    // 010-123-4567 형식 (10자리)
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  
  if (cleaned.length === 11) {
    // 010-1234-5678 형식 (11자리)
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  
  // 길이가 맞지 않으면 null 반환
  return null;
}

/**
 * 전화번호 실시간 포맷팅 (입력 중 포맷팅)
 * - 숫자만 추출
 * - 입력 중에도 포맷팅 적용
 * - 010으로 시작하지 않으면 원본 반환 (입력 중일 수 있음)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = extractPhoneDigits(phone);
  
  // 010으로 시작하지 않으면 원본 반환 (입력 중일 수 있음)
  if (cleaned.length > 0 && !cleaned.startsWith("010")) {
    // 010으로 시작하지 않지만 입력 중일 수 있으므로 포맷팅만 적용
    if (cleaned.length <= 3) {
      return cleaned;
    }
    if (cleaned.length <= 7) {
      return cleaned.replace(/(\d{3})(\d+)/, "$1-$2");
    }
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
    }
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  
  // 010으로 시작하는 경우
  if (cleaned.length === 0) {
    return "";
  }
  
  if (cleaned.length <= 3) {
    return cleaned;
  }
  
  if (cleaned.length <= 7) {
    return cleaned.replace(/(\d{3})(\d+)/, "$1-$2");
  }
  
  if (cleaned.length === 10) {
    // 010-123-4567 형식
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  }
  
  if (cleaned.length === 11) {
    // 010-1234-5678 형식
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  
  // 11자리 초과는 앞 11자리만 포맷팅
  if (cleaned.length > 11) {
    return cleaned.slice(0, 11).replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }
  
  // 그 외는 원본 반환
  return phone;
}

/**
 * 전화번호 유효성 검증
 * - 010으로 시작하는 10~11자리만 허용
 * - 빈 값은 유효 (선택사항)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim() === "") {
    return { valid: true }; // 선택사항이므로 빈 값은 유효
  }
  
  const cleaned = extractPhoneDigits(phone);
  
  // 010으로 시작하는지 확인
  if (!cleaned.startsWith("010")) {
    return { 
      valid: false, 
      error: "010으로 시작하는 휴대폰 번호만 입력 가능합니다" 
    };
  }
  
  // 10~11자리 확인
  if (cleaned.length < 10) {
    return { 
      valid: false, 
      error: "전화번호는 10자리 이상 입력해주세요" 
    };
  }
  
  if (cleaned.length > 11) {
    return { 
      valid: false, 
      error: "전화번호는 11자리 이하로 입력해주세요" 
    };
  }
  
  // 010으로 시작하고 10~11자리면 유효
  return { valid: true };
}

/**
 * 폼 필드별 유효성 검증
 */
export type ValidationErrors = Partial<Record<keyof {
  name: string;
  school_id: string;
  grade: string;
  birth_date: string;
  gender: string;
  phone: string;
  mother_phone: string;
  father_phone: string;
  exam_year: string;
  curriculum_revision: string;
  desired_university_ids: string;
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
      if (value) {
        const validation = validatePhoneNumber(value);
        if (!validation.valid) {
          return validation.error || "올바른 전화번호 형식이 아닙니다 (010-1234-5678)";
        }
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

