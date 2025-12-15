import { getStudentRiskScore } from "@/lib/risk/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { riskLevelColors, textPrimary, textSecondary, textTertiary, textMuted, bgSurface } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type RiskCardProps = {
  studentId: string;
};

export async function RiskCard({ studentId }: RiskCardProps) {
  const supabase = await createSupabaseServerClient();
  const risk = await getStudentRiskScore(supabase, studentId);

  // levelColors는 유틸리티 함수로 대체 가능하지만, 
  // 현재 구조상 border와 bg가 함께 필요한 경우이므로 유지
  // 다만 다크 모드 클래스는 이미 포함되어 있음
  const levelColors = {
    high: "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/30",
    medium: "border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/30",
    low: "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/30",
  };

  const levelLabels = {
    high: "높음",
    medium: "보통",
    low: "낮음",
  };

  const { thisWeekMinutes, lastWeekMinutes, changePercent, changeMinutes } = risk.metrics.studyTime;
  const studyTimeChange = changeMinutes > 0 ? `+${changeMinutes}` : `${changeMinutes}`;
  const studyTimeChangePercent = changePercent > 0 ? `+${changePercent}` : `${changePercent}`;

  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border-2 p-6 shadow-sm", levelColors[risk.level])}>
      <div className="flex items-center justify-between">
        <h2 className={cn("text-xl font-semibold", textPrimary)}>위험도 평가</h2>
        <span
          className={cn("rounded-full px-3 py-1 text-sm font-semibold", riskLevelColors[risk.level])}
        >
          {levelLabels[risk.level]}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-medium", textSecondary)}>위험 점수</span>
          <span className={cn("text-2xl font-bold", textPrimary)}>{risk.riskScore}</span>
        </div>
        <ProgressBar
          value={risk.riskScore}
          max={100}
          variant={
            risk.level === "high"
              ? "error"
              : risk.level === "medium"
              ? "warning"
              : "success"
          }
          size="sm"
        />
      </div>

      {risk.reasons.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={cn("text-sm font-semibold", textSecondary)}>위험 요인</h3>
          <ul className="flex flex-col gap-1">
            {risk.reasons.map((reason, index) => (
              <li key={index} className={cn("flex items-start gap-2 text-sm", textTertiary)}>
                <span className="text-red-500 dark:text-red-400">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("flex flex-col gap-2 rounded-lg p-3", bgSurface)}>
        <h3 className={cn("text-sm font-semibold", textSecondary)}>지난주 대비 학습 변화</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className={textMuted}>이번주</span>
            <p className={cn("font-semibold", textPrimary)}>{Math.floor(thisWeekMinutes / 60)}시간</p>
          </div>
          <div>
            <span className={textMuted}>지난주</span>
            <p className={cn("font-semibold", textPrimary)}>{Math.floor(lastWeekMinutes / 60)}시간</p>
          </div>
          <div className="col-span-2">
            <span className={textMuted}>변화</span>
            <p
              className={cn(
                "font-semibold",
                changeMinutes > 0
                  ? "text-green-600 dark:text-green-400"
                  : changeMinutes < 0
                  ? "text-red-600 dark:text-red-400"
                  : textTertiary
              )}
            >
              {studyTimeChange}분 ({studyTimeChangePercent}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

