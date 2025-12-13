"use client";

import { getRiskColor } from "@/lib/constants/colors";
import ProgressBar, { type ProgressBarColor } from "@/components/atoms/ProgressBar";
import { Card, CardContent } from "@/components/molecules/Card";

type WeakSubjectsSectionProps = {
  subjects: Array<{
    subject: string;
    riskScore: number;
    trend: "improving" | "declining" | "stable";
    reason: string;
    studyTimeMinutes: number;
    studyTimeChange: number;
    scoreChange: number | null;
  }>;
};

const trendIcons: Record<string, string> = {
  improving: "📈",
  declining: "📉",
  stable: "➡️",
};

const trendLabels: Record<string, string> = {
  improving: "개선 중",
  declining: "하락 중",
  stable: "유지",
};

export function WeakSubjectsSection({ subjects }: WeakSubjectsSectionProps) {
  if (subjects.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <CardContent className="flex flex-col gap-4">
        <h3 className="text-h2 text-text-primary">취약과목 추천</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {subjects.map((subject) => {
            const riskColor = getRiskColor(subject.riskScore);
            
            // ProgressBar color 매핑
            const getProgressBarColor = (riskScore: number): ProgressBarColor => {
              if (riskScore >= 70) return "red";
              if (riskScore >= 50) return "orange";
              return "orange"; // 낮은 위험도도 orange 사용 (yellow가 없음)
            };

            return (
              <div key={subject.subject} className={`rounded-lg border p-4 ${riskColor.border} ${riskColor.bg}`}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-body-2-bold text-text-primary">{subject.subject}</h4>
                    <span className="text-h2">{trendIcons[subject.trend]}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-body-2">
                      <span className="text-text-secondary">위험도</span>
                      <span className="text-body-2-bold text-text-primary">{subject.riskScore}점</span>
                    </div>
                    <ProgressBar
                      value={subject.riskScore}
                      color={getProgressBarColor(subject.riskScore)}
                      height="sm"
                    />
                  </div>
                  <p className="text-body-2 text-text-secondary">{subject.reason}</p>
                  <div className="flex flex-col gap-1 text-body-2 text-text-secondary">
                <div>이번 주 학습: {subject.studyTimeMinutes}분</div>
                {subject.studyTimeChange !== 0 && (
                  <div
                    className={subject.studyTimeChange > 0 ? "text-success-600" : "text-error-600"}
                  >
                    {subject.studyTimeChange > 0 ? "▲" : "▼"} {Math.abs(subject.studyTimeChange)}분
                    (지난주 대비)
                  </div>
                )}
                {subject.scoreChange !== null && (
                  <div
                    className={subject.scoreChange < 0 ? "text-success-600" : "text-error-600"}
                  >
                    {subject.scoreChange < 0 ? "▲" : "▼"} 등급 변화
                  </div>
                )}
                    <div className="text-text-tertiary">트렌드: {trendLabels[subject.trend]}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

