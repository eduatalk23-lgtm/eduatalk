/**
 * PostgREST join 결과에서 user_profiles를 플랫하게 변환하는 헬퍼
 *
 * students/admin_users 테이블에서 공통 컬럼(name, phone, is_active, profile_image_url)이
 * user_profiles로 이동되었으므로, PostgREST join 결과를 기존 flat 구조로 변환합니다.
 *
 * @example
 * const { data } = await supabase
 *   .from("students")
 *   .select("id, grade, user_profiles!inner(name, phone, is_active, profile_image_url)");
 * const flat = data?.map(flattenUserProfile);
 * // { id, grade, name, phone, is_active, profile_image_url }
 */

/** user_profiles join 시 선택할 공통 필드 */
export const USER_PROFILE_FIELDS = "name, phone, is_active, profile_image_url";

/** PostgREST join select 문자열 (students/admin_users 쿼리에 추가) */
export const USER_PROFILE_JOIN = `user_profiles!inner(${USER_PROFILE_FIELDS})`;

/** user_profiles join 결과의 nested 타입 */
export type UserProfileJoinResult = {
  user_profiles: {
    name: string | null;
    phone: string | null;
    is_active: boolean;
    profile_image_url: string | null;
  };
};

/** 플랫하게 변환된 공통 필드 타입 */
export type UserProfileFlat = {
  name: string | null;
  phone: string | null;
  is_active: boolean;
  profile_image_url: string | null;
};

/**
 * PostgREST join 결과에서 user_profiles를 플랫하게 변환
 * PostgREST는 FK 방향에 따라 배열([{...}]) 또는 객체({...})를 반환할 수 있음
 * 이 함수는 두 경우 모두 처리
 *
 * { id, grade, user_profiles: { name, ... } } 또는
 * { id, grade, user_profiles: [{ name, ... }] }
 * → { id, grade, name, phone, is_active, profile_image_url }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenUserProfile(row: any): Record<string, unknown> & UserProfileFlat {
  if (!row) {
    return { name: null, phone: null, is_active: true, profile_image_url: null } as Record<string, unknown> & UserProfileFlat;
  }
  const { user_profiles: rawProfiles, ...rest } = row;
  // PostgREST may return array or object
  const up = Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles;
  return {
    ...rest,
    name: (up?.name as string) ?? null,
    phone: (up?.phone as string) ?? null,
    is_active: (up?.is_active as boolean) ?? true,
    profile_image_url: (up?.profile_image_url as string) ?? null,
  };
}

/**
 * 배열에 대한 flattenUserProfile 적용
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenUserProfiles(rows: any[] | null): (Record<string, unknown> & UserProfileFlat)[] {
  return (rows ?? []).map(flattenUserProfile);
}
