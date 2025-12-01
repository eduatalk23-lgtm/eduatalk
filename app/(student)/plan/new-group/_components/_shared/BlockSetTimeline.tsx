"use client";

interface Block {
  day_of_week: number;
  start_time: string; // "HH:mm"
  end_time: string;
  block_index: number;
}

interface BlockSetTimelineProps {
  blocks: Block[];
  name?: string;
}

export function BlockSetTimeline({ blocks, name }: BlockSetTimelineProps) {
  if (blocks.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        이 블록 세트에는 등록된 시간 블록이 없습니다.
      </p>
    );
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const hours = Array.from({ length: 25 }, (_, i) => i); // 0-24시

  // 요일별로 그룹화
  const blocksByDay = blocks.reduce((acc, block) => {
    const day = block.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(block);
    return acc;
  }, {} as Record<number, Block[]>);

  // 시간을 숫자로 변환 (HH:mm -> 시간의 소수점)
  const timeToNumber = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours + minutes / 60;
  };

  // 블록의 위치와 높이 계산 (0-24시 기준, 백분율)
  const getBlockStyle = (block: Block) => {
    const startHour = timeToNumber(block.start_time);
    const endHour = timeToNumber(block.end_time);
    const top = (startHour / 24) * 100;
    const height = ((endHour - startHour) / 24) * 100;
    return { top: `${top}%`, height: `${height}%` };
  };

  // 블록 색상 (block_index에 따라)
  const getBlockColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-cyan-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {name || "선택된 블록 세트"}
        </p>
        <p className="text-xs font-medium text-gray-700">
          등록된 시간 블록 ({blocks.length}개)
        </p>
      </div>

      {/* 타임라인 시각화 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex gap-1">
          {/* 시간 축 (왼쪽) */}
          <div className="flex w-12 flex-col justify-between py-2 text-right">
            <div className="text-[10px] font-medium text-gray-400">0시</div>
            <div className="text-[10px] font-medium text-gray-600">6시</div>
            <div className="border-t border-gray-300 text-[10px] font-semibold text-gray-900">
              12시
            </div>
            <div className="text-[10px] font-medium text-gray-600">18시</div>
            <div className="text-[10px] font-medium text-gray-400">24시</div>
          </div>

          {/* 요일별 타임라인 */}
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const dayBlocks = blocksByDay[day] || [];
              const hasBlocks = dayBlocks.length > 0;

              return (
                <div key={day} className="flex flex-1 flex-col items-center">
                  {/* 요일 라벨 */}
                  <div
                    className={`mb-1 text-xs font-semibold ${
                      hasBlocks ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {dayNames[day]}
                  </div>

                  {/* 타임라인 컨테이너 */}
                  <div className="relative h-48 w-full rounded border border-gray-200 bg-gray-50">
                    {/* 12시 기준선 */}
                    <div
                      className="absolute left-0 right-0 border-t border-gray-300"
                      style={{ top: "50%" }}
                    />

                    {/* 오전/오후 라벨 */}
                    <div className="absolute left-1 top-1 text-[9px] text-gray-400">
                      오전
                    </div>
                    <div className="absolute bottom-1 left-1 text-[9px] text-gray-400">
                      오후
                    </div>

                    {/* 블록 표시 */}
                    {dayBlocks.map((block, idx) => {
                      const style = getBlockStyle(block);
                      const colorClass = getBlockColor(block.block_index);

                      return (
                        <div
                          key={idx}
                          className={`group absolute left-0 right-0 mx-1 rounded ${colorClass} cursor-pointer opacity-80 transition-opacity hover:opacity-100`}
                          style={style}
                          title={`${block.start_time} ~ ${block.end_time}`}
                        >
                          {/* 호버 시 시간 표시 */}
                          <div className="invisible absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[9px] text-white opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                            {block.start_time}
                            <br />~<br />
                            {block.end_time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 범례 */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 text-xs text-gray-600">
          <span className="font-medium">블록 색상:</span>
          {Array.from(new Set(blocks.map((b) => b.block_index)))
            .sort((a, b) => a - b)
            .map((index) => (
              <div key={index} className="flex items-center gap-1">
                <div
                  className={`h-3 w-3 rounded ${getBlockColor(index)}`}
                ></div>
                <span>블록 {index}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

