"use client";

import { Play, Pause, CheckCircle } from "lucide-react";
import { formatTime, formatTimestamp } from "../_utils/planGroupUtils";
import type { TimerLog } from "../actions/timerLogActions";

type TimerLogSectionProps = {
  logs: TimerLog[];
};

export function TimerLogSection({ logs }: TimerLogSectionProps) {
  if (logs.length === 0) {
    return null;
  }

  // 최신순 정렬 (이미 서버에서 정렬되어 있지만 확실히 하기 위해)
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "start":
        return <Play className="h-4 w-4 text-green-600" />;
      case "pause":
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case "resume":
        return <Play className="h-4 w-4 text-blue-600" />;
      case "complete":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case "start":
        return "시작";
      case "pause":
        return "일시정지";
      case "resume":
        return "재개";
      case "complete":
        return "완료";
      default:
        return eventType;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "start":
        return "bg-green-50 border-green-200";
      case "pause":
        return "bg-yellow-50 border-yellow-200";
      case "resume":
        return "bg-blue-50 border-blue-200";
      case "complete":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span>📋</span>
        타이머 활동 로그
      </h3>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sortedLogs.map((log) => {
          const timeStr = formatTimestamp(log.timestamp);
          const timeOnly = timeStr.split(" ")[1] || timeStr; // 시간 부분만 추출
          
          return (
            <div
              key={log.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${getEventColor(log.event_type)}`}
            >
              <div className="flex items-center gap-3">
                {getEventIcon(log.event_type)}
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {getEventLabel(log.event_type)}
                  </div>
                  <div className="text-xs text-gray-600">{timeOnly}</div>
                </div>
              </div>
              {log.duration_seconds !== null && log.duration_seconds > 0 && (
                <div className="text-xs font-medium text-gray-700">
                  {formatTime(log.duration_seconds)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

