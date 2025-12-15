/**
 * 전화번호 유틸리티 통합 모듈
 * 
 * 전화번호 관련 모든 기능을 통합했습니다:
 * - 포맷팅 (입력 중 실시간)
 * - 정규화 (DB 저장용)
 * - 마스킹 (UI 표시용)
 * - 검증
 */

/**
 * 전화번호에서 숫자만 추출
 * 
 * @param phone - 전화번호 문자열
 * @returns 숫자만 추출된 문자열
 */
export function extractPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * 전화번호 실시간 포맷팅 (입력 중 포맷팅)
 * - 숫자만 추출
 * - 입력 중에도 포맷팅 적용
 * - 010으로 시작하지 않으면 원본 반환 (입력 중일 수 있음)
 * 
 * @param phone - 입력 중인 전화번호
 * @returns 포맷팅된 전화번호 (예: "010-1234-5678")
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
 * 전화번호 정규화 (DB 저장용: 010-1234-5678)
 * - 숫자만 추출
 * - 010으로 시작하는 10~11자리만 허용
 * - 010-1234-5678 형식으로 변환
 * - 유효하지 않으면 null 반환
 * 
 * @param phone - 정규화할 전화번호
 * @returns 정규화된 전화번호 또는 null (유효하지 않은 경우)
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
 * 전화번호 마스킹 처리 (UI 표시용)
 * 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
 * 
 * @param phone - 마스킹할 전화번호
 * @returns 마스킹된 전화번호 (예: "010-****-1234")
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) {
    return phone;
  }

  // 하이픈 제거
  const cleaned = phone.replace(/-/g, "");
  
  if (cleaned.length <= 4) {
    return "****";
  }

  // 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-4);
  const masked = cleaned.slice(3, -4).replace(/\d/g, "*");

  return `${start}-${masked}-${end}`;
}

/**
 * 전화번호 유효성 검증
 * - 010으로 시작하는 10~11자리만 허용
 * - 빈 값은 유효 (선택사항)
 * 
 * @param phone - 검증할 전화번호
 * @returns 검증 결과 객체 { valid: boolean, error?: string }
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

