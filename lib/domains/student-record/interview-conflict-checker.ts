// ============================================
// 면접일 겹침 체크
// 수시 6장 면접일 겹침/연일 감지
// 순수 계산 함수 — DB 의존 없음
// ============================================

import type { InterviewConflict, RecordApplication } from "./types";

const ONE_DAY_MS = 86_400_000;

/**
 * 수시 지원 중 면접일 겹침 체크
 *
 * @param applications - 지원 목록 (interview_date 있는 것만 대상)
 * @returns 겹침 목록 (critical=동일일, warning=전일/다음날)
 */
export function checkInterviewConflicts(
  applications: Pick<RecordApplication, "id" | "university_name" | "interview_date" | "round">[],
): InterviewConflict[] {
  const withDates = applications.filter(
    (a): a is typeof a & { interview_date: string } =>
      a.interview_date != null && a.round.startsWith("early_"),
  );

  const conflicts: InterviewConflict[] = [];

  for (let i = 0; i < withDates.length; i++) {
    for (let j = i + 1; j < withDates.length; j++) {
      const a = withDates[i];
      const b = withDates[j];
      const dateA = new Date(a.interview_date).getTime();
      const dateB = new Date(b.interview_date).getTime();
      const diff = Math.abs(dateA - dateB);

      if (diff === 0) {
        conflicts.push({
          applicationId1: a.id,
          applicationId2: b.id,
          university1: a.university_name,
          university2: b.university_name,
          conflictDate: a.interview_date,
          severity: "critical",
        });
      } else if (diff === ONE_DAY_MS) {
        const earlier = dateA < dateB ? a.interview_date : b.interview_date;
        conflicts.push({
          applicationId1: a.id,
          applicationId2: b.id,
          university1: a.university_name,
          university2: b.university_name,
          conflictDate: earlier,
          severity: "warning",
        });
      }
    }
  }

  return conflicts;
}
