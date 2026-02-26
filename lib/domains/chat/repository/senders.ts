/**
 * 발신자 정보 Repository
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
 * 발신자 정보 배치 조회 (N+1 쿼리 최적화)
 * sender_id + sender_type 조합으로 한 번에 조회
 * 병렬 쿼리로 성능 최적화 (3개 순차 쿼리 → 2개 병렬 쿼리)
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

  // student, admin, parent 분리
  const studentIds = uniqueKeys.filter((k) => k.type === "student").map((k) => k.id);
  const adminIds = uniqueKeys.filter((k) => k.type === "admin").map((k) => k.id);
  const parentIds = uniqueKeys.filter((k) => k.type === "parent").map((k) => k.id);

  const result = new Map<string, SenderInfo>();

  // 병렬로 학생 + 관리자 + 학부모 정보 조회
  const [studentsResult, adminsResult, parentsResult] = await Promise.all([
    // 학생 정보 + 프로필 이미지 + 학교/학년 정보
    studentIds.length > 0
      ? supabase
          .from("students")
          .select("id, name, grade, school_type, school_name, profile_image_url")
          .in("id", studentIds)
      : Promise.resolve({ data: null, error: null }),
    // 관리자 정보 + 프로필 이미지
    adminIds.length > 0
      ? supabase
          .from("admin_users")
          .select("id, name, profile_image_url")
          .in("id", adminIds)
      : Promise.resolve({ data: null, error: null }),
    // 학부모 정보 + 프로필 이미지
    parentIds.length > 0
      ? supabase
          .from("parent_users")
          .select("id, name, profile_image_url")
          .in("id", parentIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  // 학생 결과 처리
  if (studentsResult.data) {
    for (const student of studentsResult.data) {
      const profileImageUrl = extractProfileImageUrl(student.profile_image_url);
      const schoolName = student.school_name;
      const gradeDisplay = formatGradeDisplay(student.school_type, student.grade);

      result.set(`${student.id}_student`, {
        id: student.id,
        name: student.name,
        profileImageUrl,
        schoolName,
        gradeDisplay,
      });
    }
  }

  // 관리자 결과 처리
  if (adminsResult.data) {
    for (const admin of adminsResult.data) {
      result.set(`${admin.id}_admin`, {
        id: admin.id,
        name: admin.name ?? "관리자",
        profileImageUrl: admin.profile_image_url,
      });
    }
  }

  // 학부모 결과 처리
  if (parentsResult.data) {
    for (const parent of parentsResult.data) {
      result.set(`${parent.id}_parent`, {
        id: parent.id,
        name: parent.name ?? "학부모",
        profileImageUrl: parent.profile_image_url ?? null,
      });
    }
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

  if (senderType === "student") {
    const { data } = await supabase
      .from("students")
      .select("id, name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      profileImageUrl: extractProfileImageUrl(data.profile_image_url),
    };
  } else if (senderType === "parent") {
    const { data } = await supabase
      .from("parent_users")
      .select("id, name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name ?? "학부모",
      profileImageUrl: data.profile_image_url ?? null,
    };
  } else {
    const { data } = await supabase
      .from("admin_users")
      .select("id, name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name ?? "관리자",
      profileImageUrl: data.profile_image_url,
    };
  }
}

/**
 * 메시지 삽입용 발신자 정보 조회
 * 비정규화 스냅샷 저장을 위해 발신자 이름과 프로필 URL을 조회
 */
export async function getSenderInfoForInsert(
  senderId: string,
  senderType: ChatUserType
): Promise<{ name: string; profileImageUrl: string | null }> {
  const supabase = await createSupabaseServerClient();

  if (senderType === "student") {
    const { data } = await supabase
      .from("students")
      .select("name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    return {
      name: data?.name ?? "알 수 없음",
      profileImageUrl: extractProfileImageUrl(data?.profile_image_url),
    };
  } else if (senderType === "parent") {
    const { data } = await supabase
      .from("parent_users")
      .select("name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    return {
      name: data?.name ?? "학부모",
      profileImageUrl: data?.profile_image_url ?? null,
    };
  } else {
    const { data } = await supabase
      .from("admin_users")
      .select("name, profile_image_url")
      .eq("id", senderId)
      .maybeSingle();

    return {
      name: data?.name ?? "관리자",
      profileImageUrl: data?.profile_image_url ?? null,
    };
  }
}
