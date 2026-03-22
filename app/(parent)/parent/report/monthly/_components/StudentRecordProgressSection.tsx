import type { ParentRecordProgress } from "@/lib/domains/student-record/actions/parentRecord";
import { cn } from "@/lib/cn";

const STAGE_META = [
  { key: "record" as const, emoji: "📄", label: "기록" },
  { key: "diagnosis" as const, emoji: "🔍", label: "진단" },
  { key: "design" as const, emoji: "📐", label: "설계" },
  { key: "strategy" as const, emoji: "🎯", label: "전략" },
];

function getHint(progress: ParentRecordProgress): string {
  const { stages, details } = progress;
  if (stages.record.filled <= 1) return "세특/창체를 입력하면 진행률이 업데이트됩니다";
  if (stages.diagnosis.filled === 0) return `세특 ${details.setekCount}건 작성 완료. AI 진단을 실행하면 역량 분석을 확인할 수 있습니다`;
  if (stages.design.filled === 0) return "스토리라인과 로드맵을 설정하면 설계가 완성됩니다";
  if (stages.strategy.filled === 0) return "지원 현황을 입력하면 전략 분석이 시작됩니다";
  if (progress.overallRate >= 90) return "거의 모든 단계가 완료되었습니다";
  return "생기부 컨설팅이 진행 중입니다";
}

function rateColor(rate: number): string {
  if (rate >= 70) return "bg-emerald-500";
  if (rate >= 40) return "bg-amber-500";
  return "bg-gray-300 dark:bg-gray-600";
}

function rateTextColor(rate: number): string {
  if (rate >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500";
}

function detailText(key: string, progress: ParentRecordProgress): string {
  const d = progress.details;
  switch (key) {
    case "record": {
      const parts: string[] = [];
      if (d.setekCount > 0) parts.push(`세특${d.setekCount}`);
      if (d.changcheCount > 0) parts.push(`창체${d.changcheCount}`);
      if (d.haengteukExists) parts.push("행특");
      if (d.readingCount > 0) parts.push(`독서${d.readingCount}`);
      if (d.personalSetekCount > 0) parts.push(`개인세특${d.personalSetekCount}`);
      if (d.attendanceExists) parts.push("출결");
      return parts.join(" · ") || "-";
    }
    case "diagnosis":
      return progress.stages.diagnosis.filled > 0 ? "역량 분석 진행됨" : "-";
    case "design": {
      const parts: string[] = [];
      if (d.storylineCount > 0) parts.push(`스토리라인${d.storylineCount}`);
      if (d.roadmapItemCount > 0) parts.push(`로드맵${d.roadmapItemCount}`);
      if (d.guideAssignmentCount > 0) parts.push(`가이드${d.guideAssignmentCount}`);
      return parts.join(" · ") || "-";
    }
    case "strategy":
      return d.applicationCount > 0 ? `지원현황 ${d.applicationCount}건` : "-";
    default:
      return "-";
  }
}

export function StudentRecordProgressSection({
  progress,
}: {
  progress: ParentRecordProgress;
}) {
  const hint = getHint(progress);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">생기부 진행 현황</h3>

      {/* 전체 진행률 */}
      <div className="flex items-center gap-3 pt-4 pb-5">
        <div className="flex-1 rounded-full bg-gray-100" style={{ height: 10 }}>
          <div
            className={cn("h-full rounded-full transition-all", rateColor(progress.overallRate))}
            style={{ width: `${progress.overallRate}%` }}
          />
        </div>
        <span className={cn("text-sm font-semibold", rateTextColor(progress.overallRate))}>
          {progress.overallRate}%
        </span>
      </div>

      {/* 4단계 상세 */}
      <div className="flex flex-col gap-3">
        {STAGE_META.map(({ key, emoji, label }) => {
          const stage = progress.stages[key];
          const stageRate = stage.total > 0 ? Math.round((stage.filled / stage.total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm">{emoji}</span>
              <span className="w-10 shrink-0 text-sm font-medium text-gray-700">{label}</span>
              <div className="flex-1 rounded-full bg-gray-100" style={{ height: 6 }}>
                <div
                  className={cn("h-full rounded-full transition-all", rateColor(stageRate))}
                  style={{ width: `${stageRate}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-gray-500">
                {stage.filled}/{stage.total}
              </span>
              <span className="w-40 shrink-0 truncate text-[11px] text-gray-400">
                {detailText(key, progress)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 힌트 */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 mt-4">
        <span className="shrink-0 text-sm">💡</span>
        <p className="text-sm text-blue-800">{hint}</p>
      </div>
    </div>
  );
}
