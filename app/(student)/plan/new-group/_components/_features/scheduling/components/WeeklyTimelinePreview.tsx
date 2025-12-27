"use client";

import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { WeeklyScheduleOverview } from "@/lib/domains/plan/actions/contentSchedule";

type WeeklyTimelinePreviewProps = {
  data: WeeklyScheduleOverview;
  /** 새 콘텐츠 제목 (하이라이트용) */
  newContentTitle?: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

export function WeeklyTimelinePreview({
  data,
  newContentTitle,
}: WeeklyTimelinePreviewProps) {
  const { contentSchedules, dailyTotals, warnings, recommendedMaxMinutes } = data;

  // 최대 학습 시간 계산 (그래프 스케일용)
  const maxMinutes = Math.max(
    ...Object.values(dailyTotals).map((d) => d.minutes),
    recommendedMaxMinutes
  );

  // 과부하 요일 체크
  const overloadDays = new Set(
    warnings.filter((w) => w.type === "overload").map((w) => w.weekday)
  );

  return (
    <div className="space-y-4">
      {/* 경고 메시지 */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 rounded-lg p-3 ${
                warning.type === "overload"
                  ? "bg-red-50 text-red-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="text-sm">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* 문제 없음 표시 */}
      {warnings.length === 0 && contentSchedules.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">일일 학습량이 적절합니다.</p>
        </div>
      )}

      {/* 주간 타임라인 그리드 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr>
              <th className="w-24 border-b border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-500">
                콘텐츠
              </th>
              {WEEKDAY_LABELS.map((label, idx) => (
                <th
                  key={idx}
                  className={`border-b border-gray-200 px-2 py-2 text-center text-xs font-medium ${
                    overloadDays.has(idx)
                      ? "bg-red-50 text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contentSchedules.map((content) => (
              <tr
                key={content.contentId}
                className={content.isNew ? "bg-blue-50/50" : ""}
              >
                <td className="border-b border-gray-100 px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: content.color }}
                    />
                    <span
                      className={`truncate text-sm ${
                        content.isNew
                          ? "font-medium text-blue-700"
                          : "text-gray-700"
                      }`}
                      title={content.contentTitle}
                    >
                      {content.contentTitle}
                      {content.isNew && (
                        <span className="ml-1 text-xs text-blue-500">
                          (신규)
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                {WEEKDAY_LABELS.map((_, weekday) => {
                  const minutes = content.weekdayMinutes[weekday] ?? 0;
                  const hasActivity = minutes > 0;

                  return (
                    <td
                      key={weekday}
                      className={`border-b border-gray-100 px-1 py-2 text-center ${
                        overloadDays.has(weekday) ? "bg-red-50/50" : ""
                      }`}
                    >
                      {hasActivity ? (
                        <div className="flex flex-col items-center">
                          <div
                            className="mb-1 rounded"
                            style={{
                              backgroundColor: content.color,
                              width: "100%",
                              height: `${Math.max(8, (minutes / maxMinutes) * 40)}px`,
                              opacity: content.isNew ? 0.7 : 1,
                            }}
                          />
                          <span className="text-xs text-gray-500">
                            {minutes}분
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* 합계 행 */}
            <tr className="bg-gray-50 font-medium">
              <td className="border-t-2 border-gray-200 px-2 py-2 text-sm text-gray-700">
                합계
              </td>
              {WEEKDAY_LABELS.map((_, weekday) => {
                const total = dailyTotals[weekday];
                const isOverload = overloadDays.has(weekday);

                return (
                  <td
                    key={weekday}
                    className={`border-t-2 border-gray-200 px-1 py-2 text-center text-sm ${
                      isOverload
                        ? "bg-red-100 text-red-700"
                        : total.minutes > 0
                          ? "text-gray-700"
                          : "text-gray-400"
                    }`}
                  >
                    {total.minutes > 0 ? (
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {formatMinutes(total.minutes)}
                        </span>
                        {isOverload && (
                          <AlertTriangle className="mx-auto mt-0.5 h-3 w-3 text-red-500" />
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        {contentSchedules.map((content) => (
          <div key={content.contentId} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: content.color }}
            />
            <span className={content.isNew ? "text-blue-600" : ""}>
              {content.contentTitle}
              {content.isNew && " (신규)"}
            </span>
          </div>
        ))}
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-gray-600">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="text-xs">
          <p>권장 일일 최대 학습 시간: {formatMinutes(recommendedMaxMinutes)}</p>
          <p className="mt-1 text-gray-500">
            요일별 학습량을 고르게 분배하면 학습 효율이 높아집니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 간단한 요약 뷰 (모달 미리보기용)
 */
type WeeklyTimelineSummaryProps = {
  data: WeeklyScheduleOverview;
  className?: string;
};

export function WeeklyTimelineSummary({
  data,
  className = "",
}: WeeklyTimelineSummaryProps) {
  const { dailyTotals, warnings, recommendedMaxMinutes } = data;
  const hasWarnings = warnings.some((w) => w.type === "overload");

  // 최대 분 계산
  const maxMinutes = Math.max(
    ...Object.values(dailyTotals).map((d) => d.minutes),
    60
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 막대 그래프 형태의 요약 */}
      <div className="flex items-end justify-between gap-1 h-16">
        {WEEKDAY_LABELS.map((label, idx) => {
          const total = dailyTotals[idx];
          const isOverload = total.minutes > recommendedMaxMinutes;
          const height = total.minutes > 0
            ? Math.max(8, (total.minutes / maxMinutes) * 56)
            : 0;

          return (
            <div key={idx} className="flex flex-col items-center flex-1">
              <div
                className={`w-full max-w-8 rounded-t transition-all ${
                  isOverload
                    ? "bg-red-400"
                    : total.minutes > 0
                      ? "bg-blue-400"
                      : "bg-gray-200"
                }`}
                style={{ height: `${height}px` }}
              />
              <span
                className={`mt-1 text-xs ${
                  isOverload ? "font-medium text-red-600" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 경고 요약 */}
      {hasWarnings && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>일부 요일의 학습량이 권장치를 초과합니다</span>
        </div>
      )}
    </div>
  );
}
