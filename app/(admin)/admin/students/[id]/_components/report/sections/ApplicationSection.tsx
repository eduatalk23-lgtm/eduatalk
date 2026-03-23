import type { StrategyTabData } from "@/lib/domains/student-record/types";
import { APPLICATION_ROUND_LABELS } from "@/lib/domains/student-record/constants";

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

  return (
    <section className="print-break-before">
      <h2 className="border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        지원 현황
      </h2>

      {/* 지원 리스트 */}
      {applications.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">지원 현황이 아직 등록되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">수시/정시 지원 대학을 등록하면 수능최저 충족 분석과 면접 일정이 표시됩니다.</p>
        </div>
      ) : (
        <table className="w-full border-collapse pt-4 text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="px-2 py-2 text-left font-medium text-gray-700">
                전형
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-700">
                대학
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-700">
                학과
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">
                경쟁률
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">
                면접일
              </th>
              <th className="px-2 py-2 text-center font-medium text-gray-700">
                결과
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} className="border-b border-gray-200">
                <td className="px-2 py-2 text-xs">
                  {APPLICATION_ROUND_LABELS[app.round] ?? app.round}
                </td>
                <td className="px-2 py-2">{app.university_name}</td>
                <td className="px-2 py-2">{app.department}</td>
                <td className="px-2 py-2 text-center text-xs">
                  {app.current_competition_rate != null
                    ? `${app.current_competition_rate}:1`
                    : "-"}
                </td>
                <td className="px-2 py-2 text-center text-xs">
                  {app.interview_date ?? "-"}
                </td>
                <td className="px-2 py-2 text-center">
                  <span
                    className={
                      app.result === "accepted"
                        ? "font-semibold text-emerald-700"
                        : app.result === "rejected"
                          ? "text-red-600"
                          : "text-gray-600"
                    }
                  >
                    {RESULT_LABELS[app.result] ?? app.result}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 면접 일정 충돌 */}
      {interviewConflicts.length > 0 && (
        <div className="pt-4 print-avoid-break">
          <p className="text-xs font-medium text-red-600">
            면접 일정 충돌 ({interviewConflicts.length}건)
          </p>
          {interviewConflicts.map((c, i) => (
            <p key={i} className="text-xs text-red-500">
              {c.conflictDate}: {c.university1} vs {c.university2}
            </p>
          ))}
        </div>
      )}

      {/* 수능최저 시뮬레이션 */}
      {minScoreTargets.length > 0 && (
        <div className="pt-6 print-avoid-break">
          <h3 className="text-sm font-semibold text-gray-700">
            수능최저 충족 현황
          </h3>
          <table className="w-full border-collapse pt-2 text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  대학
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  학과
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  충족
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  등급합
                </th>
                <th className="px-2 py-1.5 text-center font-medium text-gray-700">
                  갭
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                  병목
                </th>
              </tr>
            </thead>
            <tbody>
              {minScoreTargets.map((target) => {
                const sim = simByTarget.get(target.id);
                return (
                  <tr key={target.id} className="border-b border-gray-200">
                    <td className="px-2 py-1.5">{target.university_name}</td>
                    <td className="px-2 py-1.5">{target.department}</td>
                    <td className="px-2 py-1.5 text-center">
                      {sim ? (
                        <span
                          className={
                            sim.is_met
                              ? "font-semibold text-emerald-600"
                              : "font-semibold text-red-600"
                          }
                        >
                          {sim.is_met ? "충족" : "미충족"}
                        </span>
                      ) : (
                        <span className="text-gray-400">미시뮬</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {sim?.grade_sum ?? "-"}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {sim?.gap != null
                        ? sim.gap > 0
                          ? `+${sim.gap}`
                          : String(sim.gap)
                        : "-"}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600">
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
