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
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">보완 전략이 아직 수립되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">종합 진단 후 AI 전략 제안을 활용하여 보완 전략을 등록하세요.</p>
        </div>
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
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      s.priority === "critical"
                        ? "bg-red-100 text-red-700"
                        : s.priority === "high"
                          ? "bg-orange-100 text-orange-700"
                          : s.priority === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                    }`}
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
