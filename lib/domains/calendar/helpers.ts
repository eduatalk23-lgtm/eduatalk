/**
 * Calendar 도메인 헬퍼 함수
 *
 * student_non_study_time → calendar_events 전환을 위한 공통 유틸리티.
 *
 * @module lib/domains/calendar/helpers
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventType } from "./types";

// ============================================
// planner → calendar_id resolve
// ============================================

/**
 * planner_id → primary calendar_id 해석 (서버용)
 *
 * 서버 액션 내에서 1회 조회 후 재사용하는 패턴 권장.
 * 캘린더가 없으면 null 반환.
 */
export async function resolvePrimaryCalendarId(
  plannerId: string
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("calendars")
    .select("id")
    .eq("planner_id", plannerId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

// ============================================
// 시간 변환 유틸리티
// ============================================

/**
 * plan_date + start_time (HH:mm) → TIMESTAMPTZ ISO 문자열
 *
 * @example toTimestamptz("2026-02-22", "09:00") → "2026-02-22T09:00:00+09:00"
 */
export function toTimestamptz(
  date: string,
  time: string,
  tz = "Asia/Seoul"
): string {
  // Asia/Seoul = +09:00
  const offsetMap: Record<string, string> = {
    "Asia/Seoul": "+09:00",
    UTC: "+00:00",
  };
  const offset = offsetMap[tz] ?? "+09:00";

  // HH:mm → HH:mm:ss 보정
  const normalizedTime = time.length === 5 ? `${time}:00` : time;

  return `${date}T${normalizedTime}${offset}`;
}

// ============================================
// type 매핑
// ============================================

/** Korean non-study type → calendar_events event_type + event_subtype */
export function mapNonStudyType(type: string): {
  eventType: EventType;
  eventSubtype: string;
} {
  switch (type) {
    case "학원":
      return { eventType: "academy", eventSubtype: "학원" };
    case "이동시간":
      return { eventType: "academy", eventSubtype: "이동시간" };
    case "아침식사":
      return { eventType: "non_study", eventSubtype: "아침식사" };
    case "점심식사":
      return { eventType: "non_study", eventSubtype: "점심식사" };
    case "저녁식사":
      return { eventType: "non_study", eventSubtype: "저녁식사" };
    case "수면":
      return { eventType: "non_study", eventSubtype: "수면" };
    case "제외일":
      return { eventType: "exclusion", eventSubtype: "기타" };
    default:
      return { eventType: "non_study", eventSubtype: type || "기타" };
  }
}

/** exclusion_type → event_subtype 변환 */
export function mapExclusionType(exclusionType: string): string {
  // exclusion_type 값은 그대로 event_subtype으로 매핑
  return exclusionType || "기타";
}
