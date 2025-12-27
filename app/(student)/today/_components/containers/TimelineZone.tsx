'use client';

import { cn } from '@/lib/cn';

// ============================================
// 타입 정의
// ============================================

export type ZoneType = 'study' | 'lunch' | 'transit' | 'academy' | 'free' | 'completed' | 'active';

// 오버레이 플랜 정보 (시간대 블록 내에 표시될 완료/진행 중인 플랜)
export interface OverlayPlan {
  id: string;
  title: string;
  chapter?: string;
  contentType?: 'book' | 'lecture' | 'custom';
  range?: string; // "p.1-10" 또는 "00:00-10:00"
  durationMinutes: number;
  startTime: string;
  endTime: string;
  status: 'completed' | 'active';
  isPaused?: boolean;
}

export interface TimeBlock {
  id: string;
  startTime: string; // HH:mm 형식
  endTime: string;
  zoneType: ZoneType;
  label: string;
  description?: string;
  // 시간대 내에 중첩 표시할 플랜들
  overlayPlans?: OverlayPlan[];
  // 완료된 학습 기록 (레거시 - 하위 호환성)
  completedPlan?: {
    id: string;
    title: string;
    durationMinutes: number;
  };
  // 진행 중인 학습 기록 (레거시 - 하위 호환성)
  activePlan?: {
    id: string;
    title: string;
    elapsedMinutes: number;
    isPaused?: boolean;
  };
}

interface TimelineZoneProps {
  blocks: TimeBlock[];
  currentTime?: string; // HH:mm 형식
}

// ============================================
// 설정
// ============================================

const zoneConfig: Record<ZoneType, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  pattern: 'solid' | 'striped' | 'dotted';
  icon: string;
}> = {
  study: {
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-700',
    textColor: 'text-blue-700 dark:text-blue-300',
    pattern: 'solid',
    icon: '📗',
  },
  lunch: {
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-700',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    pattern: 'striped',
    icon: '🍽️',
  },
  transit: {
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    textColor: 'text-gray-600 dark:text-gray-400',
    pattern: 'dotted',
    icon: '🚗',
  },
  academy: {
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    borderColor: 'border-purple-200 dark:border-purple-700',
    textColor: 'text-purple-700 dark:text-purple-300',
    pattern: 'striped',
    icon: '🏫',
  },
  free: {
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-700',
    textColor: 'text-green-700 dark:text-green-300',
    pattern: 'solid',
    icon: '📚',
  },
  completed: {
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-400 dark:border-emerald-600',
    textColor: 'text-emerald-800 dark:text-emerald-300',
    pattern: 'solid',
    icon: '✓',
  },
  active: {
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    borderColor: 'border-blue-500 dark:border-blue-400',
    textColor: 'text-blue-800 dark:text-blue-200',
    pattern: 'solid',
    icon: '▶',
  },
};

// ============================================
// 컴포넌트
// ============================================

export function TimelineZone({ blocks, currentTime }: TimelineZoneProps) {
  if (blocks.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        <p>타임라인 정보가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <span>⏰</span>
        <span>오늘의 Timeline</span>
      </h3>

      <div className="relative">
        {/* 현재 시간 표시선 */}
        {currentTime && <CurrentTimeLine currentTime={currentTime} blocks={blocks} />}

        {/* 타임블록들 */}
        <div className="space-y-1">
          {blocks.map((block) => (
            <TimeBlockItem key={block.id} block={block} currentTime={currentTime} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeBlockItem({ block, currentTime }: { block: TimeBlock; currentTime?: string }) {
  const config = zoneConfig[block.zoneType];
  const isCurrentBlock = currentTime && isTimeInBlock(currentTime, block);
  const isPastBlock = currentTime && block.endTime < currentTime;

  // 분 단위 높이 계산 - overlayPlans가 있으면 더 높게
  const durationMinutes = calculateDurationMinutes(block.startTime, block.endTime);
  const overlayCount = block.overlayPlans?.length || 0;
  const baseHeight = Math.min(Math.max(durationMinutes * 0.8, 48), 120);
  const height = overlayCount > 0 ? Math.max(baseHeight, 80 + overlayCount * 60) : baseHeight;

  const getContentIcon = (contentType?: 'book' | 'lecture' | 'custom') => {
    if (contentType === 'book') return '📚';
    if (contentType === 'lecture') return '🎧';
    return '📝';
  };

  return (
    <div
      className={cn(
        'flex items-stretch rounded-md border overflow-hidden transition-all',
        config.bgColor,
        config.borderColor,
        isCurrentBlock && 'ring-2 ring-blue-400 ring-offset-1',
        isPastBlock && 'opacity-60'
      )}
      style={{ minHeight: `${height}px` }}
    >
      {/* 시간 표시 - 시작/끝 시간 모두 표시 */}
      <div className="w-20 flex-shrink-0 flex flex-col justify-between py-2 px-2 border-r border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50">
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 font-medium">{block.startTime}</span>
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">~</span>
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 font-medium">{block.endTime}</span>
      </div>

      {/* 콘텐츠 */}
      <div className={cn('flex-1 px-3 py-2 flex flex-col gap-2', getPatternClass(config.pattern))}>
        {/* 기본 블록 정보 */}
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-medium truncate', config.textColor)}>
              {block.label}
            </div>
            {block.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{block.description}</div>
            )}
            {/* 소요 시간 표시 */}
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {durationMinutes >= 60
                ? `${Math.floor(durationMinutes / 60)}시간 ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}분` : ''}`
                : `${durationMinutes}분`
              }
            </div>
          </div>
          {/* 비-학습 영역 표시 */}
          {(block.zoneType === 'lunch' || block.zoneType === 'transit' || block.zoneType === 'academy') && (
            <span className="text-xs text-gray-400" title="학습 가능하나 다른 일정 영역입니다">
              ⓘ
            </span>
          )}
        </div>

        {/* 오버레이 플랜 표시 (상세 정보 포함) */}
        {block.overlayPlans && block.overlayPlans.length > 0 && (
          <div className="space-y-2 mt-1">
            {block.overlayPlans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'rounded-md p-2 border',
                  plan.status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700'
                    : plan.isPaused
                    ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700'
                    : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700'
                )}
              >
                {/* 헤더: 상태 표시 + 시간 */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {plan.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 dark:bg-emerald-600">
                          <span className="text-white text-[10px]">✓</span>
                        </span>
                        완료됨
                      </span>
                    ) : (
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        plan.isPaused ? "text-yellow-700 dark:text-yellow-300" : "text-blue-700 dark:text-blue-300"
                      )}>
                        <span className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          plan.isPaused ? "bg-yellow-500" : "bg-blue-500 animate-pulse"
                        )} />
                        {plan.isPaused ? "일시정지" : "학습 중"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {plan.startTime} ~ {plan.endTime}
                  </span>
                </div>

                {/* 타이틀 */}
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getContentIcon(plan.contentType)}</span>
                  <span className={cn(
                    "font-medium text-sm",
                    plan.status === 'completed'
                      ? "text-emerald-800 dark:text-emerald-200"
                      : plan.isPaused
                      ? "text-yellow-800 dark:text-yellow-200"
                      : "text-blue-800 dark:text-blue-200"
                  )}>
                    {plan.title}
                  </span>
                </div>

                {/* 상세 정보 */}
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                  {plan.chapter && (
                    <span className="inline-flex items-center gap-1">
                      📖 {plan.chapter}
                    </span>
                  )}
                  {plan.range && (
                    <span className="inline-flex items-center gap-1">
                      📄 {plan.range}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    ⏱️ {plan.durationMinutes}분
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 레거시: completedPlan, activePlan (하위 호환성) */}
        {!block.overlayPlans?.length && block.completedPlan && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            ✓ {block.completedPlan.title} ({block.completedPlan.durationMinutes}분)
          </div>
        )}
        {!block.overlayPlans?.length && block.activePlan && (
          <div className={cn(
            "text-xs mt-0.5 flex items-center gap-1",
            block.activePlan.isPaused ? "text-yellow-600 dark:text-yellow-400" : "text-blue-600 dark:text-blue-400"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              block.activePlan.isPaused ? "bg-yellow-500" : "bg-blue-500 animate-pulse"
            )} />
            <span>
              {block.activePlan.isPaused ? "일시정지됨" : "학습 중"}
              ({block.activePlan.elapsedMinutes}분)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentTimeLine({ currentTime, blocks }: { currentTime: string; blocks: TimeBlock[] }) {
  // 현재 시간이 어느 블록 사이에 있는지 계산
  const firstStart = blocks[0]?.startTime ?? '00:00';
  const lastEnd = blocks[blocks.length - 1]?.endTime ?? '24:00';

  if (currentTime < firstStart || currentTime > lastEnd) {
    return null;
  }

  // 위치 계산 (간단한 비율 계산)
  const totalMinutes = calculateDurationMinutes(firstStart, lastEnd);
  const elapsedMinutes = calculateDurationMinutes(firstStart, currentTime);
  const position = (elapsedMinutes / totalMinutes) * 100;

  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
      style={{ top: `${position}%` }}
    >
      <div className="w-2 h-2 rounded-full bg-red-500" />
      <div className="flex-1 h-0.5 bg-red-500" />
      <span className="text-xs text-red-500 font-mono ml-1">{currentTime}</span>
    </div>
  );
}

// ============================================
// 헬퍼 함수
// ============================================

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

function isTimeInBlock(time: string, block: TimeBlock): boolean {
  return time >= block.startTime && time < block.endTime;
}

function getPatternClass(pattern: 'solid' | 'striped' | 'dotted'): string {
  switch (pattern) {
    case 'striped':
      return 'bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.03)_5px,rgba(0,0,0,0.03)_10px)]';
    case 'dotted':
      return 'bg-[radial-gradient(circle,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:8px_8px]';
    default:
      return '';
  }
}

// ============================================
// 유틸리티: 학생 일정에서 TimeBlock 생성
// ============================================

export function createTimeBlocksFromSchedule(
  academySchedules: Array<{
    start_time: string;
    end_time: string;
    name: string;
    transit_minutes?: number;
  }>,
  completedPlans: Array<{
    id: string;
    title: string;
    actual_start_time: string;
    actual_end_time: string;
  }>,
  options?: {
    studyStartTime?: string;
    studyEndTime?: string;
    lunchStartTime?: string;
    lunchEndTime?: string;
  }
): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const opts = {
    studyStartTime: options?.studyStartTime ?? '09:00',
    studyEndTime: options?.studyEndTime ?? '22:00',
    lunchStartTime: options?.lunchStartTime ?? '12:00',
    lunchEndTime: options?.lunchEndTime ?? '13:00',
  };

  // 기본 학습 시간 블록 생성
  blocks.push({
    id: 'study-morning',
    startTime: opts.studyStartTime,
    endTime: opts.lunchStartTime,
    zoneType: 'study',
    label: '학습시간 영역',
  });

  // 점심시간
  blocks.push({
    id: 'lunch',
    startTime: opts.lunchStartTime,
    endTime: opts.lunchEndTime,
    zoneType: 'lunch',
    label: '점심시간 영역',
  });

  // 오후 학습
  blocks.push({
    id: 'study-afternoon',
    startTime: opts.lunchEndTime,
    endTime: opts.studyEndTime,
    zoneType: 'study',
    label: '학습시간 영역',
  });

  // 학원 일정 삽입
  for (const schedule of academySchedules) {
    // 이동 시간
    if (schedule.transit_minutes) {
      const transitStartTime = subtractMinutes(schedule.start_time, schedule.transit_minutes);
      blocks.push({
        id: `transit-to-${schedule.name}`,
        startTime: transitStartTime,
        endTime: schedule.start_time,
        zoneType: 'transit',
        label: '이동시간',
      });
    }

    // 학원 시간
    blocks.push({
      id: `academy-${schedule.name}`,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      zoneType: 'academy',
      label: `학원 (${schedule.name})`,
    });

    // 복귀 이동 시간
    if (schedule.transit_minutes) {
      blocks.push({
        id: `transit-from-${schedule.name}`,
        startTime: schedule.end_time,
        endTime: addMinutes(schedule.end_time, schedule.transit_minutes),
        zoneType: 'transit',
        label: '이동시간',
      });
    }
  }

  // 완료된 학습 기록 추가
  for (const plan of completedPlans) {
    const startTime = new Date(plan.actual_start_time).toTimeString().slice(0, 5);
    const endTime = new Date(plan.actual_end_time).toTimeString().slice(0, 5);
    const durationMs = new Date(plan.actual_end_time).getTime() - new Date(plan.actual_start_time).getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    blocks.push({
      id: `completed-${plan.id}`,
      startTime,
      endTime,
      zoneType: 'completed',
      label: plan.title,
      completedPlan: {
        id: plan.id,
        title: plan.title,
        durationMinutes,
      },
    });
  }

  // 시간순 정렬
  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return blocks;
}

function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m - minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
