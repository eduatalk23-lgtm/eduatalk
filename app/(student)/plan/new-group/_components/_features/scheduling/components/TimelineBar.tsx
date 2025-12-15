"use client";

type TimeSlot = {
  type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
  start: string;
  end: string;
  label?: string;
};

type TimelineBarProps = {
  timeSlots: TimeSlot[];
  totalHours: number;
};

// 시간 문자열(HH:mm)을 분으로 변환
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 각 타입별 색상 매핑
const slotColors: Record<TimeSlot["type"], string> = {
  학습시간: "bg-blue-500",
  점심시간: "bg-orange-400",
  학원일정: "bg-purple-500",
  이동시간: "bg-gray-400",
  자율학습: "bg-green-500",
};

// 각 타입별 라벨
const slotLabels: Record<TimeSlot["type"], string> = {
  학습시간: "학습",
  점심시간: "점심",
  학원일정: "학원",
  이동시간: "이동",
  자율학습: "자율",
};

export function TimelineBar({ timeSlots, totalHours }: TimelineBarProps) {
  if (!timeSlots || timeSlots.length === 0) {
    return null;
  }

  // 각 슬롯의 시간(분)과 비율 계산
  const slotData = timeSlots.map((slot) => {
    const startMinutes = timeToMinutes(slot.start);
    const endMinutes = timeToMinutes(slot.end);
    const durationMinutes = endMinutes - startMinutes;
    const durationHours = durationMinutes / 60;

    return {
      type: slot.type,
      durationMinutes,
      durationHours,
      label: slot.label,
      start: slot.start,
      end: slot.end,
    };
  });

  // 전체 시간(분)
  const totalMinutes = slotData.reduce((sum, slot) => sum + slot.durationMinutes, 0);

  // 비율 계산 및 최소 너비 적용 후 재정규화
  const minWidthPercentage = 3; // 최소 3%
  const rawPercentages = slotData.map((slot) => ({
    ...slot,
    rawPercentage: (slot.durationMinutes / totalMinutes) * 100,
  }));

  // 최소 너비 적용
  const adjustedPercentages = rawPercentages.map((item) => ({
    ...item,
    adjustedPercentage: Math.max(item.rawPercentage, minWidthPercentage),
  }));

  // 총합 계산
  const totalAdjusted = adjustedPercentages.reduce(
    (sum, item) => sum + item.adjustedPercentage,
    0
  );

  // 100%로 재정규화 (빈 공간 제거)
  const normalizedPercentages = adjustedPercentages.map((item) => ({
    ...item,
    finalPercentage: (item.adjustedPercentage / totalAdjusted) * 100,
  }));

  // grid-template-columns 문자열 생성 (fr 단위 사용)
  const gridTemplateColumns = normalizedPercentages
    .map((item) => `${item.finalPercentage}fr`)
    .join(" ");

  // aria-label용 설명 생성
  const ariaLabel = slotData
    .map((slot) => `${slotLabels[slot.type]} ${slot.durationHours.toFixed(1)}시간`)
    .join(", ");

  return (
    <div className="flex flex-col gap-1.5 w-full" aria-label={`일정 구성: ${ariaLabel}`}>
      <div 
        className="grid h-6 md:h-8 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
        style={{ gridTemplateColumns }}
      >
        {normalizedPercentages.map((item, index) => {
          // 30분 미만은 라벨 생략
          const showLabel = item.durationMinutes >= 30;
          
          // 시간 라벨 포맷 (1시간 미만은 분으로, 이상은 시간으로)
          const timeLabel = item.durationHours >= 1
            ? `${item.durationHours.toFixed(1)}h`
            : `${item.durationMinutes}m`;

          return (
            <div
              key={`${item.type}-${index}`}
              className={`flex items-center justify-center ${slotColors[item.type]} text-white transition-all`}
              title={`${slotLabels[item.type]}: ${item.durationHours.toFixed(1)}시간 (${item.start} - ${item.end})`}
            >
              {showLabel && (
                <span className="text-[10px] md:text-xs font-semibold truncate px-1">
                  {timeLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* 범례 (타입별 색상 안내) - 토글 버튼과 겹치지 않도록 제거하거나 최소화 */}
      {slotData.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-600 max-w-full">
          {Array.from(new Set(slotData.map(s => s.type))).map((type) => (
            <div key={type} className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-2 h-2 rounded-sm ${slotColors[type]}`} />
              <span className="whitespace-nowrap">{slotLabels[type]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

