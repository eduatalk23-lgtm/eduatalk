import { SectionCard } from "@/components/ui/SectionCard";
import type { InternalAnalysis } from "@/lib/types/scoreDashboard";
import { MetricCard } from "./MetricCard";
import { InfoMessage } from "./InfoMessage";

interface InternalAnalysisCardProps {
  analysis: InternalAnalysis;
}

export function InternalAnalysisCard({ analysis }: InternalAnalysisCardProps) {
  const { totalGpa, zIndex, subjectStrength } = analysis;

  // subjectStrength를 배열로 변환 (정렬)
  const subjectEntries = Object.entries(subjectStrength).sort(
    ([, gpaA], [, gpaB]) => gpaB - gpaA // 높은 GPA 순
  );

  return (
    <SectionCard
      title="내신 분석"
      description="전체 GPA 및 교과군별 성적"
    >
      {/* 전체 지표 */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="전체 GPA"
          value={totalGpa !== null ? totalGpa.toFixed(2) : "N/A"}
          color="indigo"
        />
        <MetricCard
          label="Z-Index"
          value={zIndex !== null ? zIndex.toFixed(2) : "N/A"}
          color="purple"
        />
      </div>

      {/* 교과군별 GPA */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-gray-700">
          교과군별 평점
        </div>
        {subjectEntries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {subjectEntries.map(([subjectName, gpa]) => (
              <div
                key={subjectName}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="text-sm font-medium text-gray-700">
                  {subjectName}
                </div>
                <div className="text-sm font-bold text-gray-900">
                  {gpa.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-8">
            <p className="text-sm text-gray-500">교과군 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      {totalGpa === null && zIndex === null && (
        <InfoMessage
          message="내신 성적 데이터가 없습니다. 성적을 입력해주세요."
          variant="warning"
        />
      )}
    </SectionCard>
  );
}

