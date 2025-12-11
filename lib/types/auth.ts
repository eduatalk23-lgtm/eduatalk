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

