import { redirect } from "next/navigation";

export const metadata = {
  title: "타임존 관리 | 플랜",
  description: "달력 기반 플랜 생성 시스템 (플랜 캘린더로 이동됨)",
};

/**
 * 타임존 기능은 플랜 캘린더로 통합되었습니다.
 * 기존 URL 접근 시 플랜 캘린더로 리디렉션합니다.
 */
export default function TimezonePage() {
  redirect("/plan/calendar");
}
