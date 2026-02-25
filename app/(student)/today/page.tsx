import { redirect } from 'next/navigation';

/**
 * /today → /plan/calendar redirect
 *
 * 캘린더가 1급 메뉴로 승격됨에 따라, 기존 /today URL 접속 시
 * /plan/calendar로 자동 리다이렉트합니다. (북마크 호환)
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // calendarId, date 파라미터가 있으면 전달
  const queryParts: string[] = [];
  if (typeof params.calendarId === 'string') {
    queryParts.push(`calendarId=${params.calendarId}`);
  }
  if (typeof params.date === 'string') {
    queryParts.push(`date=${params.date}`);
  }

  const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  redirect(`/plan/calendar${query}`);
}
