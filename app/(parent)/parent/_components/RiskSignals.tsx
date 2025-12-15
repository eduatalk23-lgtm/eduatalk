import type { SubjectRiskAnalysis } from "@/app/(student)/analysis/_utils";
import ProgressBar from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import { riskSignalStyles, textSecondary } from "@/lib/utils/darkMode";

type RiskSignalsProps = {
  signals: SubjectRiskAnalysis[];
};

export function RiskSignals({ signals }: RiskSignalsProps) {
  return (
    <div className={riskSignalStyles.container}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className={riskSignalStyles.title}>
            🚨 위험 신호
          </h3>
          <p className={riskSignalStyles.description}>
            다음 과목에서 위험 신호가 감지되었습니다. 상담이 필요할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {signals.map((signal) => (
            <div
              key={signal.subject}
              className={riskSignalStyles.card}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className={riskSignalStyles.cardTitle}>
                    {signal.subject}
                  </span>
                  <span className={riskSignalStyles.cardValue}>
                    위험도 {Math.round(signal.risk_score)}%
                  </span>
                </div>
                <ProgressBar
                  value={signal.risk_score}
                  max={100}
                  color="red"
                  height="sm"
                />
                <div className="flex flex-col gap-1">
                  <div className={cn("text-xs", textSecondary)}>
                    최근 평균 등급: {signal.recent3AvgGrade.toFixed(1)}등급
                  </div>
                  {signal.gradeChange > 0 && (
                    <div className="text-xs text-red-600 dark:text-red-400 font-semibold">
                      ⚠️ 등급 하락: +{signal.gradeChange.toFixed(1)}
                    </div>
                  )}
                  <div className={cn("text-xs", textSecondary)}>
                    일관성 점수: {signal.consistency_score.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

