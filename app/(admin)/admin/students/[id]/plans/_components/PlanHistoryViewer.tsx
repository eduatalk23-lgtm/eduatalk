'use client';

import { useEffect, useState } from 'react';
import { getStudentRecentEvents } from '@/lib/domains/admin-plan/actions';
import type { PlanEvent } from '@/lib/domains/admin-plan/types';
import { cn } from '@/lib/cn';

interface PlanHistoryViewerProps {
  studentId: string;
  limit?: number;
  className?: string;
  plannerId?: string;
}

export function PlanHistoryViewer({
  studentId,
  limit = 20,
  className,
  plannerId,
}: PlanHistoryViewerProps) {
  const [events, setEvents] = useState<PlanEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      const result = await getStudentRecentEvents(studentId, limit, plannerId);
      if (result.success && result.data) {
        setEvents(result.data);
      }
      setIsLoading(false);
    }

    fetchEvents();
  }, [studentId, limit, plannerId]);

  const getEventIcon = (eventType: string): string => {
    switch (eventType) {
      case 'plan_completed':
        return '✅';
      case 'plan_created':
        return '➕';
      case 'plan_deleted':
        return '🗑️';
      case 'container_moved':
        return '📦';
      case 'volume_adjusted':
        return '📊';
      case 'volume_redistributed':
        return '🔄';
      case 'plan_carryover':
        return '↩️';
      case 'timer_started':
        return '▶️';
      case 'timer_completed':
        return '⏱️';
      case 'adhoc_created':
        return '📝';
      case 'adhoc_completed':
        return '☑️';
      default:
        return '📌';
    }
  };

  const getEventLabel = (eventType: string): string => {
    switch (eventType) {
      case 'plan_completed':
        return '플랜 완료';
      case 'plan_created':
        return '플랜 생성';
      case 'plan_deleted':
        return '플랜 삭제';
      case 'container_moved':
        return '컨테이너 이동';
      case 'volume_adjusted':
        return '볼륨 조정';
      case 'volume_redistributed':
        return '볼륨 재분배';
      case 'plan_carryover':
        return '플랜 이월';
      case 'timer_started':
        return '타이머 시작';
      case 'timer_completed':
        return '타이머 완료';
      case 'adhoc_created':
        return '단발성 플랜 생성';
      case 'adhoc_completed':
        return '단발성 플랜 완료';
      default:
        return eventType;
    }
  };

  const getActorLabel = (actorType: string): string => {
    switch (actorType) {
      case 'student':
        return '학생';
      case 'admin':
        return '관리자';
      case 'system':
        return '시스템';
      case 'scheduler':
        return '스케줄러';
      default:
        return actorType;
    }
  };

  const formatEventPayload = (event: PlanEvent): string | null => {
    const payload = event.payload as Record<string, unknown>;

    switch (event.event_type) {
      case 'container_moved':
        return `${payload.from_container} → ${payload.to_container}`;
      case 'volume_adjusted':
        return `${payload.original_volume}p → ${payload.new_volume}p`;
      case 'plan_carryover':
        return `${payload.from_date} → ${payload.to_date}`;
      case 'timer_completed':
        const duration = (payload.duration_seconds as number) ?? 0;
        const minutes = Math.floor(duration / 60);
        return `${minutes}분 학습`;
      default:
        if (payload.plan_title) {
          return payload.plan_title as string;
        }
        if (payload.title) {
          return payload.title as string;
        }
        return null;
    }
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-24" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const displayEvents = isExpanded ? events : events.slice(0, 5);

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">📜 활동 히스토리</h3>
          <span className="text-xs text-gray-500">{events.length}개 이벤트</span>
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="divide-y divide-gray-50">
        {displayEvents.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            아직 기록된 활동이 없습니다
          </div>
        ) : (
          displayEvents.map((event) => {
            const payloadInfo = formatEventPayload(event);

            return (
              <div
                key={event.id}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 아이콘 */}
                  <span className="text-lg">{getEventIcon(event.event_type)}</span>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {getEventLabel(event.event_type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {getActorLabel(event.actor_type)}
                      </span>
                    </div>
                    {payloadInfo && (
                      <div className="text-sm text-gray-600 truncate">
                        {payloadInfo}
                      </div>
                    )}
                  </div>

                  {/* 시간 */}
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatTime(event.occurred_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 더보기 버튼 */}
      {events.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700"
          >
            {isExpanded ? '접기' : `더보기 (${events.length - 5}개)`}
          </button>
        </div>
      )}
    </div>
  );
}
