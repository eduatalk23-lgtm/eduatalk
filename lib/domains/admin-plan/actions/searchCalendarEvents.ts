"use server";

/**
 * Calendar Events Search Action
 *
 * calendar_events + event_study_data를 텍스트 검색하는 서버 액션.
 * calendar_events.title, calendar_events.description은 DB 레벨에서 필터링하고,
 * event_study_data의 content_title, subject_name, subject_category는
 * 2차 쿼리(student 스코프 적용)로 매칭하여 합산합니다.
 *
 * @module lib/domains/admin-plan/actions/searchCalendarEvents
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAuthContext } from "@/lib/auth/strategies";
import { logActionError } from "@/lib/utils/serverActionLogger";
import type { CalendarEventWithStudyData } from "@/lib/domains/calendar/types";

const MAX_RESULTS = 200;

/**
 * PostgREST .or() 필터에 안전하게 사용할 수 있도록 특수 문자 제거
 * 허용: 알파벳, 숫자, 한글, 공백, 하이픈
 * 제거: 콤마(.or 구분자), 마침표(연산자), 괄호, 콜론, !, @, *, \ 등
 */
function sanitizeForPostgrest(s: string): string {
  return s.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣-]/g, "").trim();
}

/**
 * 캘린더 이벤트 텍스트 검색
 *
 * calendar_events.title, calendar_events.description,
 * event_study_data.content_title, event_study_data.subject_name,
 * event_study_data.subject_category 필드를 대소문자 무시하여 검색합니다.
 *
 * @param studentId - 학생 ID
 * @param calendarId - 캘린더 ID
 * @param query - 검색어 (빈 문자열이면 빈 배열 반환)
 * @returns 매칭된 calendar_events 행 (event_study_data JOIN 포함)
 */
export async function searchCalendarEventsAction(
  studentId: string,
  calendarId: string,
  query: string,
): Promise<CalendarEventWithStudyData[]> {
  if (!query.trim()) return [];

  try {
    await resolveAuthContext({ studentId });

    const supabase = await createSupabaseServerClient();
    const q = sanitizeForPostgrest(query.trim());
    if (!q) return [];

    // 1차: calendar_events.title / description에서 검색
    const { data: titleMatches, error: titleErr } = await supabase
      .from("calendar_events")
      .select("*, event_study_data(*)")
      .eq("student_id", studentId)
      .eq("calendar_id", calendarId)
      .is("deleted_at", null)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order("start_at", { ascending: false, nullsFirst: false })
      .limit(MAX_RESULTS);

    if (titleErr) {
      logActionError(
        "searchCalendarEvents",
        `title/description 검색 실패: ${titleErr.message}`,
      );
      return [];
    }

    // 2차: event_study_data (calendar_events INNER JOIN으로 student 스코프 적용)
    const { data: studyMatches, error: studyErr } = await supabase
      .from("event_study_data")
      .select("event_id, calendar_events!inner(id)")
      .eq("calendar_events.student_id", studentId)
      .eq("calendar_events.calendar_id", calendarId)
      .is("calendar_events.deleted_at", null)
      .or(
        `content_title.ilike.%${q}%,subject_name.ilike.%${q}%,subject_category.ilike.%${q}%`,
      )
      .limit(MAX_RESULTS);

    if (studyErr) {
      logActionError(
        "searchCalendarEvents",
        `event_study_data 검색 실패: ${studyErr.message}`,
      );
      return (titleMatches ?? []) as CalendarEventWithStudyData[];
    }

    // 1차 결과에 이미 포함된 ID 집합
    const existingIds = new Set(
      (titleMatches ?? []).map((e) => e.id),
    );

    // 2차에서 발견했지만 1차에 없는 event_id만 추가 조회
    const additionalEventIds = (studyMatches ?? [])
      .map((s) => s.event_id)
      .filter((id): id is string => id != null && !existingIds.has(id));

    let additionalEvents: CalendarEventWithStudyData[] = [];
    if (additionalEventIds.length > 0) {
      const { data: extra, error: extraErr } = await supabase
        .from("calendar_events")
        .select("*, event_study_data(*)")
        .eq("student_id", studentId)
        .eq("calendar_id", calendarId)
        .is("deleted_at", null)
        .in("id", additionalEventIds)
        .order("start_at", { ascending: false, nullsFirst: false })
        .limit(MAX_RESULTS);

      if (extraErr) {
        logActionError(
          "searchCalendarEvents",
          `추가 이벤트 조회 실패: ${extraErr.message}`,
        );
      } else {
        additionalEvents = (extra ?? []) as CalendarEventWithStudyData[];
      }
    }

    // 합산 후 start_at DESC 정렬, 최대 MAX_RESULTS개 반환
    const combined = [
      ...((titleMatches ?? []) as CalendarEventWithStudyData[]),
      ...additionalEvents,
    ]
      .sort((a, b) => {
        const aTime = a.start_at ?? "";
        const bTime = b.start_at ?? "";
        return bTime.localeCompare(aTime);
      })
      .slice(0, MAX_RESULTS);

    return combined;
  } catch (err) {
    logActionError(
      "searchCalendarEvents",
      err instanceof Error ? err.message : "알 수 없는 에러",
    );
    return [];
  }
}
