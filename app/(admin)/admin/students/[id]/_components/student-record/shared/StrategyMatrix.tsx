import { PRIORITY_LABELS, STATUS_LABELS } from "../../report/constants";

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const AREA_LABELS: Record<string, string> = {
  setek: "세특", personal_setek: "개인세특", changche: "창체", career: "진로",
  reading: "독서", haengteuk: "행특", score: "성적", club: "동아리",
  autonomy: "자율", general: "종합",
};

interface StrategyMatrixProps {
  strategies: Array<{ target_area: string | null; priority: string | null; status: string }>;
}

export function StrategyMatrix({ strategies }: StrategyMatrixProps) {
  const usedAreas = [...new Set(strategies.map((s) => s.target_area).filter(Boolean))] as string[];
  if (usedAreas.length === 0) return null;

  const matrix = new Map<string, Array<{ priority: string; status: string }>>();
  for (const s of strategies) {
    const key = `${s.target_area}:${s.priority}`;
    const list = matrix.get(key) ?? [];
    list.push({ priority: s.priority ?? "low", status: s.status });
    matrix.set(key, list);
  }

  return (
    <div className="overflow-x-auto print-avoid-break">
      <h4 className="mb-2 text-xs font-semibold text-[var(--text-secondary,#6b7280)]">영역 × 우선순위 매트릭스</h4>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-border bg-bg-secondary px-2 py-1 text-left font-medium text-text-secondary dark:border-border dark:bg-bg-secondary/30 dark:text-text-tertiary">영역</th>
            {PRIORITIES.map((p) => (
              <th key={p} className="border border-border bg-bg-secondary px-2 py-1 text-center font-medium text-text-secondary dark:border-border dark:bg-bg-secondary/30 dark:text-text-tertiary">
                {PRIORITY_LABELS[p]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usedAreas.map((area) => (
            <tr key={area}>
              <td className="border border-border px-2 py-1 font-medium text-text-primary dark:border-border dark:text-text-disabled">
                {AREA_LABELS[area] ?? area}
              </td>
              {PRIORITIES.map((p) => {
                const items = matrix.get(`${area}:${p}`) ?? [];
                return (
                  <td key={p} className="border border-border px-2 py-1.5 text-center dark:border-border">
                    {items.length > 0 ? (
                      <div className="flex justify-center gap-1">
                        {items.map((item, i) => (
                          <span
                            key={i}
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white print:h-5 print:w-5 print:text-xs ${
                              item.status === "done"
                                ? "bg-green-500"
                                : item.status === "in_progress"
                                  ? "bg-blue-500"
                                  : "bg-gray-300"
                            }`}
                            title={STATUS_LABELS[item.status] ?? item.status}
                            aria-label={STATUS_LABELS[item.status] ?? item.status}
                          >
                            {item.status === "done" ? "V" : item.status === "in_progress" ? ">" : "·"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-200 dark:text-text-primary">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 flex gap-3 text-xs text-text-tertiary print:text-xs">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> 완료</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> 진행 중</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-gray-300" /> 예정</span>
      </div>
    </div>
  );
}
