import { redirect } from "next/navigation";

/**
 * 캠프 Calendar 페이지 - /plan/calendar로 리다이렉트
 *
 * 캠프/일반 플랜 통합으로 인해 이 페이지는 더 이상 별도로 존재하지 않습니다.
 * 모든 플랜은 /plan/calendar 페이지에서 통합 관리됩니다.
 */
export default async function CampCalendarPage() {
  redirect("/plan/calendar");
}
