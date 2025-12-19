/**
 * 인증 관련 타입 정의
 */

/**
 * 회원가입 시 선택할 수 있는 역할
 */
export type SignupRole = "student" | "parent";

/**
 * 회원가입 시 user_metadata에 저장되는 데이터 타입
 */
export interface SignupMetadata {
  display_name?: string | null;
  tenant_id?: string | null;
  signup_role?: SignupRole | null;
}

/**
 * Supabase Auth User에 metadata가 포함된 타입
 */
export interface UserWithSignupMetadata {
  id: string;
  user_metadata?: SignupMetadata | null;
}

/**
 * SignupMetadata에서 특정 필드를 안전하게 추출하는 헬퍼 타입
 */
export type ExtractMetadata<T extends keyof SignupMetadata> = SignupMetadata[T];

/**
 * 약관 동의 유형
 */
export type ConsentType = "terms" | "privacy" | "marketing";

/**
 * 약관 동의 정보
 */
export interface UserConsent {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  consented: boolean;
  consented_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/**
 * 약관 동의 저장을 위한 데이터 타입
 */
export interface ConsentData {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

/**
 * 약관 동의 저장 시 메타데이터
 */
export interface ConsentMetadata {
  ip_address?: string;
  user_agent?: string;
}

/**
 * user_metadata가 SignupMetadata 타입인지 확인하는 타입 가드
 */
export function isSignupMetadata(
  metadata: unknown
): metadata is SignupMetadata {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const m = metadata as Record<string, unknown>;

  // signup_role이 유효한 값인지 확인
  if (m.signup_role !== undefined && m.signup_role !== null) {
    if (m.signup_role !== "student" && m.signup_role !== "parent") {
      return false;
    }
  }

  // tenant_id가 문자열이거나 null인지 확인
  if (
    m.tenant_id !== undefined &&
    m.tenant_id !== null &&
    typeof m.tenant_id !== "string"
  ) {
    return false;
  }

  // display_name이 문자열이거나 null인지 확인
  if (
    m.display_name !== undefined &&
    m.display_name !== null &&
    typeof m.display_name !== "string"
  ) {
    return false;
  }

  return true;
}

/**
 * user_metadata에서 signup_role을 안전하게 추출
 */
export function extractSignupRole(
  metadata: unknown
): SignupRole | null | undefined {
  if (!isSignupMetadata(metadata)) {
    return undefined;
  }
  return metadata.signup_role ?? null;
}

/**
 * user_metadata에서 tenant_id를 안전하게 추출
 */
export function extractTenantId(
  metadata: unknown
): string | null | undefined {
  if (!isSignupMetadata(metadata)) {
    return undefined;
  }
  return metadata.tenant_id ?? null;
}

/**
 * user_metadata에서 display_name을 안전하게 추출
 */
export function extractDisplayName(
  metadata: unknown
): string | null | undefined {
  if (!isSignupMetadata(metadata)) {
    return undefined;
  }
  return metadata.display_name ?? null;
}

