import { BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import { BADGE, TABLE, SPACING, TYPO } from "@/lib/design-tokens/report";

interface CoursePlanItem {
  subject_id: string;
  grade: number;
  semester: number;
  plan_status: string;
  recommendation_reason: string | null;
  subject?: {
    name: string;
    subject_type?: { name: string } | null;
  } | null;
}

interface CoursePlanSectionProps {
  grade: number;
  plans: CoursePlanItem[];
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  recommended: "추천",
  confirmed: "확정",
  completed: "이수",
};

const PLAN_STATUS_BADGE: Record<string, string> = {
  recommended: BADGE.violet,
  confirmed: BADGE.blue,
  completed: BADGE.emerald,
};

export function CoursePlanSection({ grade, plans }: CoursePlanSectionProps) {
  const filtered = plans.filter((p) => p.grade === grade);

  if (filtered.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={BookOpen} title={`${grade}학년 수강 계획`} subtitle="교과 선택 현황" />
        <EmptyState title="수강 계획이 없습니다" description="수강 계획을 추가하면 여기에 표시됩니다." />
      </section>
    );
  }

  // 학기별 그룹핑
  const bySemester: Record<number, CoursePlanItem[]> = {};
  for (const p of filtered) {
    if (!bySemester[p.semester]) bySemester[p.semester] = [];
    bySemester[p.semester].push(p);
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={BookOpen} title={`${grade}학년 수강 계획`} subtitle="교과 선택 현황" />

      <div className={SPACING.sectionGap}>
        {Object.entries(bySemester)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([sem, semPlans]) => (
            <div key={sem}>
              <h3 className={cn("mb-2", TYPO.subsectionTitle)}>{sem}학기</h3>
              <table className={TABLE.wrapper}>
                <caption className="sr-only">수강 계획 목록</caption>
                <thead className={TABLE.thead}>
                  <tr>
                    <th className={TABLE.th}>과목명</th>
                    <th className={TABLE.th}>과목 유형</th>
                    <th className={cn(TABLE.th, "text-center")}>상태</th>
                    <th className={TABLE.th}>추천 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {semPlans.map((p) => (
                    <tr key={p.subject_id} className={TABLE.tr}>
                      <td className={cn(TABLE.td, "font-medium")}>
                        {p.subject?.name ?? p.subject_id}
                      </td>
                      <td className={TABLE.td}>
                        {p.subject?.subject_type?.name ?? "-"}
                      </td>
                      <td className={cn(TABLE.td, "text-center")}>
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5",
                            TYPO.label,
                            PLAN_STATUS_BADGE[p.plan_status] ?? BADGE.gray,
                          )}
                        >
                          {PLAN_STATUS_LABELS[p.plan_status] ?? p.plan_status}
                        </span>
                      </td>
                      <td className={cn(TABLE.td, TYPO.caption)}>
                        {p.recommendation_reason ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </section>
  );
}
