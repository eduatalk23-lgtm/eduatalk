/**
 * 블록 통계 계산 유틸리티
 */

type Block = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/**
 * 시간 문자열을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환 (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * 블록의 길이 계산 (분 단위)
 * 유효하지 않은 블록(종료 시간 <= 시작 시간)은 0을 반환
 */
function calculateBlockDuration(block: Block): number {
  const start = timeToMinutes(block.start_time);
  const end = timeToMinutes(block.end_time);
  const duration = end - start;
  
  // 유효하지 않은 블록 (종료 시간이 시작 시간보다 작거나 같음)
  if (duration <= 0) {
    return 0;
  }
  
  return duration;
}

/**
 * 블록이 유효한지 검증
 */
export function isValidBlock(block: Block): boolean {
  const start = timeToMinutes(block.start_time);
  const end = timeToMinutes(block.end_time);
  return end > start;
}

/**
 * 잘못된 블록들을 찾아서 반환
 */
export function findInvalidBlocks(blocks: Block[]): Block[] {
  return blocks.filter((block) => !isValidBlock(block));
}

/**
 * 요일별 학습 시간 분포 계산
 */
export function calculateDayDistribution(blocks: Block[]) {
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  
  const distribution = DAYS.map((day, index) => {
    const dayBlocks = blocks.filter((b) => b.day_of_week === index);
    const totalMinutes = dayBlocks.reduce((acc, block) => {
      return acc + calculateBlockDuration(block);
    }, 0);
    
    return {
      day,
      dayIndex: index,
      minutes: totalMinutes,
      hours: Math.floor(totalMinutes / 60),
      remainingMinutes: totalMinutes % 60,
      blockCount: dayBlocks.length,
    };
  });

  const totalMinutes = distribution.reduce((acc, d) => acc + d.minutes, 0);
  const maxMinutes = Math.max(...distribution.map((d) => d.minutes), 1);

  return {
    distribution,
    totalMinutes,
    maxMinutes,
  };
}

/**
 * 시간대별 학습 패턴 분석
 */
export function calculateTimeDistribution(blocks: Block[]) {
  const timeSlots: Record<string, number> = {};
  
  blocks.forEach((block) => {
    const duration = calculateBlockDuration(block);
    if (duration <= 0) return; // 유효하지 않은 블록은 제외
    
    const start = timeToMinutes(block.start_time);
    // 시간대별로 분류 (0-6시, 6-12시, 12-18시, 18-24시)
    const startHour = Math.floor(start / 60);
    const timeSlot = Math.floor(startHour / 6);
    
    const slotKey = `${timeSlot * 6}-${(timeSlot + 1) * 6}시`;
    
    if (!timeSlots[slotKey]) {
      timeSlots[slotKey] = 0;
    }
    timeSlots[slotKey] += duration;
  });

  const slots = Object.entries(timeSlots).map(([label, minutes]) => ({
    label,
    minutes,
    hours: Math.floor(minutes / 60),
    remainingMinutes: minutes % 60,
  }));

  const maxMinutes = Math.max(...slots.map((s) => s.minutes), 1);

  return {
    slots,
    maxMinutes,
  };
}

/**
 * 시간대별 상세 분석 (1시간 단위)
 */
export function calculateHourlyDistribution(blocks: Block[]) {
  const hourlyData: Record<number, number> = {};
  
  // 0-23시 초기화
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = 0;
  }

  blocks.forEach((block) => {
    const duration = calculateBlockDuration(block);
    if (duration <= 0) return; // 유효하지 않은 블록은 제외
    
    const start = timeToMinutes(block.start_time);
    // 시작 시간의 시간대에 전체 블록 시간을 할당
    const startHour = Math.floor(start / 60);
    hourlyData[startHour] += duration;
  });

  const hours = Object.entries(hourlyData).map(([hour, minutes]) => ({
    hour: Number(hour),
    minutes,
    hours: Math.floor(minutes / 60),
    remainingMinutes: minutes % 60,
  }));

  const maxMinutes = Math.max(...hours.map((h) => h.minutes), 1);

  return {
    hours,
    maxMinutes,
  };
}

/**
 * 블록 통계 요약
 */
export function calculateBlockStatistics(blocks: Block[]) {
  const totalBlocks = blocks.length;
  const totalMinutes = blocks.reduce((acc, block) => {
    return acc + calculateBlockDuration(block);
  }, 0);
  
  const totalHours = Math.floor(Math.max(0, totalMinutes) / 60);
  const remainingMinutes = Math.max(0, totalMinutes % 60); // 음수 방지
  
  const averageBlockDuration = totalBlocks > 0 ? Math.max(0, totalMinutes) / totalBlocks : 0;
  
  const dayDistribution = calculateDayDistribution(blocks);
  const mostActiveDay = dayDistribution.distribution.reduce((max, day) => 
    day.minutes > max.minutes ? day : max
  , dayDistribution.distribution[0]);

  return {
    totalBlocks,
    totalMinutes,
    totalHours,
    remainingMinutes,
    averageBlockDuration: Math.round(averageBlockDuration),
    mostActiveDay,
  };
}

