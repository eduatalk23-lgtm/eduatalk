import type { SubjectRiskAnalysis } from "@/app/(student)/analysis/_utils";
import ProgressBar from "@/components/atoms/ProgressBar";

type RiskSignalsProps = {
  signals: SubjectRiskAnalysis[];
};

export function RiskSignals({ signals }: RiskSignalsProps) {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-red-900">
            🚨 위험 신호
          </h3>
          <p className="text-sm text-red-700">
            다음 과목에서 위험 신호가 감지되었습니다. 상담이 필요할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {signals.map((signal) => (
            <div
              key={signal.subject}
              className="rounded-lg border-2 border-red-300 bg-white p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-red-900">
                    {signal.subject}
                  </span>
                  <span className="text-lg font-bold text-red-600">
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
                  <div className="text-xs text-gray-700">
                    최근 평균 등급: {signal.recent3AvgGrade.toFixed(1)}등급
                  </div>
                  {signal.gradeChange > 0 && (
                    <div className="text-xs text-red-600 font-semibold">
                      ⚠️ 등급 하락: +{signal.gradeChange.toFixed(1)}
                    </div>
                  )}
                  <div className="text-xs text-gray-700">
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

