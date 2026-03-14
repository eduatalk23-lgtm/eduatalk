/**
 * 발신자 정보 Repository
 * user_profiles 기반 통합 조회
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractProfileImageUrl } from "./_shared";
import type { ChatUserType } from "../types";

/** 학년 표시 변환 (예: HIGH + 2 → "고2") */
function formatGradeDisplay(
  schoolType: string | null,
  grade: number | null
): string | null {
  if (!grade) return null;

  const prefix: Record<string, string> = {
    ELEMENTARY: "초",
    MIDDLE: "중",
    HIGH: "고",
  };

  const p = schoolType ? prefix[schoolType] : null;
  return p ? `${p}${grade}` : `${grade}학년`;
}

/** 발신자 정보 타입 (학교/학년 포함) */
type SenderInfo = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  schoolName?: string | null;
  gradeDisplay?: string | null;
};

/**
 * 발신자 정보 배치 조회 (user_profiles 기반)
 * 기존 3-병렬 쿼리 → user_profiles 1쿼리 + students 1쿼리(학생 전용 데이터)
 */
export async function findSendersByIds(
  senderKeys: Array<{ id: string; type: ChatUserType }>
): Promise<Map<string, SenderInfo>> {
  if (senderKeys.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  // 중복 제거
  const uniqueKeys = Array.from(
    new Map(senderKeys.map((k) => [`${k.id}_${k.type}`, k])).values()
  );

  const allIds = uniqueKeys.map((k) => k.id);
  const studentIds = uniqueKeys.filter((k) => k.type === "student").map((k) => k.id);

  // 1. user_profiles에서 전체 발신자 정보 일괄 조회 (1-쿼리)
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, name, profile_image_url, role")
    .in("id", allIds);

  // 2. 학생 전용 데이터 (학교/학년) 추가 조회
  let studentExtras: Map<string, { schoolName: string | null; gradeDisplay: string | null }> | null = null;
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, grade, school_type, school_name")
      .in("id", studentIds);

    if (students) {
      studentExtras = new Map();
      for (const s of students) {
        studentExtras.set(s.id, {
          schoolName: s.school_name,
          gradeDisplay: formatGradeDisplay(s.school_type, s.grade),
        });
      }
    }
  }

  // 3. 결과 병합
  const result = new Map<string, SenderInfo>();
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const key of uniqueKeys) {
    const profile = profileMap.get(key.id);
    if (!profile) continue;

    const fallbackName = key.type === "parent" ? "학부모" : key.type === "admin" ? "관리자" : "알 수 없음";
    const extras = key.type === "student" ? studentExtras?.get(key.id) : null;

    result.set(`${key.id}_${key.type}`, {
      id: profile.id,
      name: profile.name || fallbackName,
      profileImageUrl: extractProfileImageUrl(profile.profile_image_url),
      schoolName: extras?.schoolName ?? null,
      gradeDisplay: extras?.gradeDisplay ?? null,
    });
  }

  return result;
}

/**
 * 단일 발신자 정보 조회 (실시간 이벤트에서 sender 정보 보강용)
 */
export async function findSenderById(
  senderId: string,
  senderType: ChatUserType
): Promise<{ id: string; name: string; profileImageUrl?: string | null } | null> {
  const supabase = await createSupabaseServerClient();

  // user_profiles에서 공통 정보 조회
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, name, profile_image_url")
    .eq("id", senderId)
    .maybeSingle();

  if (!profile) return null;

  const fallbackName = senderType === "parent" ? "학부모" : senderType === "admin" ? "관리자" : "알 수 없음";

  return {
    id: profile.id,
    name: profile.name || fallbackName,
    profileImageUrl: extractProfileImageUrl(profile.profile_image_url),
  };
}

/**
 * 메시지 삽입용 발신자 정보 조회
 * user_profiles에서 이름과 프로필 URL을 1-쿼리로 조회
 */
export async function getSenderInfoForInsert(
  senderId: string,
  senderType: ChatUserType
): Promise<{ name: string; profileImageUrl: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name, profile_image_url")
    .eq("id", senderId)
    .maybeSingle();

  const fallbackName = senderType === "parent" ? "학부모" : senderType === "admin" ? "관리자" : "알 수 없음";

  return {
    name: profile?.name || fallbackName,
    profileImageUrl: extractProfileImageUrl(profile?.profile_image_url),
  };
}
