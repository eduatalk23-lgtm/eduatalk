/**
 * 시간표 형식 마크다운 생성 유틸리티
 *
 * 시간(행) x 요일(열) 그리드 레이아웃으로 마크다운 테이블을 생성한다.
 * 진도관리 탭과 Admin 마크다운 내보내기 모달에서 공유한다.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimetableEntry {
  /** "2026-01-19" */
  date: string;
  /** "월" */
  dayOfWeek: string;
  /** "09:00" — 없으면 "시간 미배정" 섹션으로 분리 */
  startTime: string | null;
  /** "10:30" */
  endTime: string | null;
  /** 사전 포맷팅된 셀 내용 (예: "수학 1-15p") */
  label: string;
  /** 점심, 학원 등 비학습 항목 */
  isNonStudy?: boolean;
  /** "completed" | "pending" — 진도관리용 */
  status?: string;
}

export interface TimetableWeek {
  /** "1주차" 또는 "미배정" */
  weekLabel: string;
  /** "2026-01-19 ~ 2026-01-25" */
  dateRange: string;
  entries: TimetableEntry[];
  /** 매일 반복되는 비학습 슬롯 (점심 등) */
  dailyNonStudy?: Array<{ startTime: string; endTime: string; label: string }>;
}

export interface TimetableOptions {
  /** 완료 상태 표시 — 완료 항목에 ~~취소선~~ 적용 (기본: false) */
  showStatus?: boolean;
  /** 셀 최대 글자수 (0 = 제한 없음, 기본: 0) */
  cellMaxLength?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"] as const;

function dayIndex(dayOfWeek: string): number {
  const idx = DAY_ORDER.indexOf(dayOfWeek as (typeof DAY_ORDER)[number]);
  return idx === -1 ? 99 : idx;
}

/** 파이프 문자 이스케이프 */
function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** 셀 내용을 최대 길이로 트렁케이션 (0이면 제한 없음) */
function truncate(text: string, maxLen: number): string {
  if (maxLen <= 0 || text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "\u2026"; // ellipsis
}

/** startTime에서 시(hour) 문자열 추출: "09:30" → "09:00" */
function hourKey(time: string): string {
  const h = time.slice(0, 2);
  return `${h}:00`;
}

/** "09:00" → 9 (정렬용 숫자) */
function hourNum(hourStr: string): number {
  return parseInt(hourStr.slice(0, 2), 10);
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * TimetableWeek 배열로부터 시간표 형식 마크다운을 생성한다.
 */
export function generateTimetableMarkdown(
  weeks: TimetableWeek[],
  title: string,
  options: TimetableOptions = {}
): string {
  const { showStatus = false, cellMaxLength = 0 } = options;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");

  for (const week of weeks) {
    if (week.entries.length === 0) continue;

    // --- 1. 열(columns): 고유 날짜 추출, 날짜순 정렬 ---
    const dateSet = new Map<string, { date: string; dayOfWeek: string }>();
    for (const e of week.entries) {
      if (!dateSet.has(e.date)) {
        dateSet.set(e.date, { date: e.date, dayOfWeek: e.dayOfWeek });
      }
    }
    const columns = Array.from(dateSet.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    if (columns.length === 0) continue;

    // --- 2. 행(rows): 모든 startTime hour 추출 ---
    const hourSet = new Set<string>();

    for (const e of week.entries) {
      if (e.startTime) {
        hourSet.add(hourKey(e.startTime));
      }
    }
    // dailyNonStudy 시간도 행에 포함
    if (week.dailyNonStudy) {
      for (const ns of week.dailyNonStudy) {
        hourSet.add(hourKey(ns.startTime));
      }
    }

    const rows = Array.from(hourSet).sort(
      (a, b) => hourNum(a) - hourNum(b)
    );

    // --- 시간 미배정 항목 분리 ---
    const unscheduled = week.entries.filter((e) => !e.startTime);

    // --- 3. 그리드 구성 ---
    // grid[hourKey][date] = label[]
    const grid = new Map<string, Map<string, string[]>>();
    for (const h of rows) {
      grid.set(h, new Map());
    }

    // entries 배치
    for (const e of week.entries) {
      if (!e.startTime) continue;
      const h = hourKey(e.startTime);
      const cellMap = grid.get(h)!;
      const existing = cellMap.get(e.date) ?? [];

      let label = truncate(e.label, cellMaxLength);
      if (showStatus && e.status === "completed") {
        label = `~~${label}~~`;
      }

      existing.push(escapeCell(label));
      cellMap.set(e.date, existing);
    }

    // dailyNonStudy → 모든 날짜 열에 배치
    if (week.dailyNonStudy) {
      for (const ns of week.dailyNonStudy) {
        const h = hourKey(ns.startTime);
        const cellMap = grid.get(h);
        if (!cellMap) continue;
        const label = truncate(ns.label, cellMaxLength);
        for (const col of columns) {
          const existing = cellMap.get(col.date) ?? [];
          existing.push(escapeCell(`*${label}*`));
          cellMap.set(col.date, existing);
        }
      }
    }

    // --- 4. 마크다운 테이블 렌더링 ---
    lines.push(`## ${week.weekLabel} 시간표 (${week.dateRange})`);
    lines.push("");

    // 헤더: 날짜 표시 - "월 (1/19)" 형식
    const headerCells = columns.map((col) => {
      const md = col.date.slice(5); // "01-19"
      const m = parseInt(md.slice(0, 2), 10);
      const d = parseInt(md.slice(3, 5), 10);
      return `${col.dayOfWeek} (${m}/${d})`;
    });

    lines.push(`| 시간 | ${headerCells.join(" | ")} |`);
    lines.push(`|------${columns.map(() => "|----------").join("")}|`);

    for (const h of rows) {
      const cellMap = grid.get(h)!;
      const cells = columns.map((col) => {
        const items = cellMap.get(col.date);
        if (!items || items.length === 0) return "-";
        return items.join(" / ");
      });
      lines.push(`| ${h} | ${cells.join(" | ")} |`);
    }

    lines.push("");

    // --- 시간 미배정 항목 ---
    if (unscheduled.length > 0) {
      lines.push("**시간 미배정:**");
      for (const e of unscheduled) {
        let label = e.label;
        if (showStatus && e.status === "completed") {
          label = `~~${label}~~`;
        }
        lines.push(`- ${e.date} (${e.dayOfWeek}): ${label}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
