import type { DiagnosisTabData } from "@/lib/domains/student-record/types";

const PRIORITY_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
};

interface StrategySectionProps {
  diagnosisData: DiagnosisTabData;
}

export function StrategySection({ diagnosisData }: StrategySectionProps) {
  const { strategies } = diagnosisData;

  return (
    <section className="print-break-before">
      <h2 className="mb-4 border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        보완 전략
      </h2>

      {strategies.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 전략이 없습니다.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                우선순위
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                영역
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">
                내용
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-700">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => (
              <tr key={s.id} className="border-b border-gray-200">
                <td className="px-3 py-2">
                  <span
                    className={
                      s.priority === "critical"
                        ? "font-semibold text-red-600"
                        : s.priority === "high"
                          ? "font-medium text-orange-600"
                          : "text-gray-700"
                    }
                  >
                    {PRIORITY_LABELS[s.priority ?? ""] ?? "-"}
                  </span>
                </td>
                <td className="px-3 py-2">{s.target_area ?? "-"}</td>
                <td className="px-3 py-2">{s.strategy_content}</td>
                <td className="px-3 py-2 text-center">
                  {STATUS_LABELS[s.status] ?? s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
