import { cn } from "@/lib/cn";
import type { StrategyTabData } from "@/lib/domains/student-record/types";
import { APPLICATION_ROUND_LABELS } from "@/lib/domains/student-record/constants";
import { Building2 } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { BADGE, TABLE, TYPO } from "@/lib/design-tokens/report";

const RESULT_LABELS: Record<string, string> = {
  pending: "대기",
  accepted: "합격",
  waitlisted: "예비",
  rejected: "불합격",
  registered: "등록",
};

interface ApplicationSectionProps {
  strategyData: StrategyTabData;
}

export function ApplicationSection({ strategyData }: ApplicationSectionProps) {
  const { applications, minScoreTargets, minScoreSimulations, interviewConflicts } =
    strategyData;

  // 시뮬레이션 결과를 target_id로 매핑 (최신 1개)
  const simByTarget = new Map(
    minScoreSimulations.map((s) => [s.target_id, s]),
  );

  // 지원 요약 통계
  const totalApps = applications.length;
  const suApps = applications.filter((a) => a.round?.startsWith("su")).length;
  const jungApps = applications.filter((a) => a.round?.startsWith("jung")).length;
  const metCount = minScoreSimulations.filter((s) => s.is_met === true).length;
  const notMetCount = minScoreSimulations.filter((s) => s.is_met === false).length;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Building2} title="지원 현황" subtitle="수시/정시 지원 · 면접 충돌 · 수능최저" />

      {/* 지원 요약 카드 */}
      {totalApps > 0 && (
        <div className="mt-4 mb-4 grid grid-cols-4 gap-3 print-avoid-break">
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalApps}</p>
            <p className={TYPO.caption}>총 지원</p>
          </div>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{suApps}</p>
            <p className={TYPO.caption}>수시</p>
          </div>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{jungApps}</p>
            <p className={TYPO.caption}>정시</p>
          </div>
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-sm text-center">
            <p className={`text-2xl font-bold ${notMetCount > 0 ? "text-red-600 dark:text-red-400" : metCount > 0 ? "text-emerald-600 dark:text-emerald-400" : TYPO.caption}`}>
              {metCount}/{metCount + notMetCount}
            </p>
            <p className={TYPO.caption}>최저 충족</p>
          </div>
        </div>
      )}

      {/* 지원 리스트 */}
      {applications.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>지원 현황이 아직 등록되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>수시/정시 지원 대학을 등록하면 수능최저 충족 분석과 면접 일정이 표시됩니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className={cn(TABLE.wrapper, "pt-4")}>
          <thead className={TABLE.thead}>
            <tr>
              <th className={TABLE.th}>전형</th>
              <th className={TABLE.th}>대학</th>
              <th className={TABLE.th}>학과</th>
              <th className={cn(TABLE.th, "text-center")}>경쟁률</th>
              <th className={cn(TABLE.th, "text-center")}>면접일</th>
              <th className={cn(TABLE.th, "text-center")}>결과</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} className={TABLE.tr}>
                <td className={cn(TABLE.td, "text-xs")}>
                  {APPLICATION_ROUND_LABELS[app.round] ?? app.round}
                </td>
                <td className={TABLE.td}>{app.university_name}</td>
                <td className={TABLE.td}>{app.department}</td>
                <td className={cn(TABLE.td, "text-center text-xs")}>
                  {app.current_competition_rate != null
                    ? `${app.current_competition_rate}:1`
                    : "-"}
                </td>
                <td className={cn(TABLE.td, "text-center text-xs")}>
                  {app.interview_date ?? "-"}
                </td>
                <td className={cn(TABLE.td, "text-center")}>
                  <span
                    className={
                      app.result === "accepted"
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : app.result === "rejected"
                          ? "text-red-600 dark:text-red-400"
                          : TYPO.caption
                    }
                  >
                    {RESULT_LABELS[app.result] ?? app.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* 면접 일정 충돌 */}
      {interviewConflicts.length > 0 && (
        <div className="pt-4 print-avoid-break">
          <p className={cn("font-medium text-red-600 dark:text-red-400", TYPO.caption)}>
            면접 일정 충돌 ({interviewConflicts.length}건)
          </p>
          {interviewConflicts.map((c, i) => (
            <p key={i} className="text-xs text-red-500 dark:text-red-400">
              {c.conflictDate}: {c.university1} vs {c.university2}
            </p>
          ))}
        </div>
      )}

      {/* 수능최저 시뮬레이션 */}
      {minScoreTargets.length > 0 && (
        <div className="pt-6 print-avoid-break">
          <h3 className={cn("mb-2", TYPO.subsectionTitle)}>
            수능최저 충족 현황
          </h3>
          <table className={cn(TABLE.wrapper, "text-xs")}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>대학</th>
                <th className={TABLE.th}>학과</th>
                <th className={cn(TABLE.th, "text-center")}>충족</th>
                <th className={cn(TABLE.th, "text-center")}>등급합</th>
                <th className={cn(TABLE.th, "text-center")}>갭</th>
                <th className={TABLE.th}>병목</th>
              </tr>
            </thead>
            <tbody>
              {minScoreTargets.map((target) => {
                const sim = simByTarget.get(target.id);
                return (
                  <tr key={target.id} className={TABLE.tr}>
                    <td className={TABLE.td}>{target.university_name}</td>
                    <td className={TABLE.td}>{target.department}</td>
                    <td className={cn(TABLE.td, "text-center")}>
                      {sim ? (
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5",
                            TYPO.label,
                            sim.is_met ? BADGE.emerald : BADGE.red,
                          )}
                        >
                          {sim.is_met ? "충족" : "미충족"}
                        </span>
                      ) : (
                        <span className={TYPO.caption}>-</span>
                      )}
                    </td>
                    <td className={cn(TABLE.td, "text-center")}>
                      {sim?.grade_sum ?? "-"}
                    </td>
                    <td className={cn(TABLE.td, "text-center")}>
                      {sim?.gap != null
                        ? sim.gap > 0
                          ? `+${sim.gap}`
                          : String(sim.gap)
                        : "-"}
                    </td>
                    <td className={cn(TABLE.td, TYPO.caption)}>
                      {sim?.bottleneck_subjects?.join(", ") ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
