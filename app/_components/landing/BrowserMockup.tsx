import { TrendingUp, Users } from "lucide-react";

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

interface ScheduleBlock {
  day: number; // 0-4
  hour: number; // 0-5
  label: string;
  color: string;
  span?: number; // row span (default 1)
}

const SCHEDULE: ScheduleBlock[] = [
  { day: 0, hour: 0, label: "수학 I", color: "bg-blue-500", span: 2 },
  { day: 0, hour: 3, label: "국어", color: "bg-amber-500" },
  { day: 0, hour: 4, label: "영어", color: "bg-emerald-500", span: 2 },
  { day: 1, hour: 0, label: "영어", color: "bg-emerald-500" },
  { day: 1, hour: 1, label: "과학", color: "bg-purple-500", span: 2 },
  { day: 1, hour: 4, label: "수학 II", color: "bg-blue-500" },
  { day: 2, hour: 0, label: "과학", color: "bg-purple-500" },
  { day: 2, hour: 1, label: "수학 I", color: "bg-blue-500", span: 2 },
  { day: 2, hour: 4, label: "국어", color: "bg-amber-500" },
  { day: 3, hour: 0, label: "국어", color: "bg-amber-500", span: 2 },
  { day: 3, hour: 3, label: "영어", color: "bg-emerald-500" },
  { day: 3, hour: 4, label: "과학", color: "bg-purple-500" },
  { day: 4, hour: 0, label: "영어", color: "bg-emerald-500" },
  { day: 4, hour: 1, label: "수학 II", color: "bg-blue-500" },
  { day: 4, hour: 3, label: "복습", color: "bg-rose-400", span: 2 },
];

export function BrowserMockup() {
  return (
    <div className="relative">
      {/* Soft glow behind mockup */}
      <div
        className="absolute -inset-4 rounded-2xl opacity-30 blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,116,244,0.15) 0%, transparent 70%)" }}
        aria-hidden
      />

      <div className="relative rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="mx-auto flex-1 max-w-[260px]">
            <div className="rounded-md bg-white px-3 py-1 text-center text-xs text-gray-400 dark:bg-slate-800 dark:text-slate-500">
              app.timelevelup.com
            </div>
          </div>
        </div>

        {/* Weekly schedule grid */}
        <div className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-[48px_repeat(5,1fr)] gap-1 text-center text-[10px] font-semibold text-gray-400 uppercase dark:text-slate-500">
            <span />
            {DAYS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>

          {/* Time grid */}
          <div className="mt-1 grid grid-cols-[48px_repeat(5,1fr)] grid-rows-6 gap-1" style={{ gridAutoRows: "32px" }}>
            {HOURS.map((h, ri) => (
              <span
                key={h}
                className="flex items-center text-[10px] text-gray-400 dark:text-slate-500 pr-1 justify-end"
                style={{ gridRow: ri + 1 }}
              >
                {h}
              </span>
            ))}

            {SCHEDULE.map((block, i) => (
              <div
                key={i}
                className={`${block.color} rounded px-1.5 flex items-center text-[9px] font-medium text-white truncate animate-reveal-up`}
                style={{
                  gridColumn: block.day + 2,
                  gridRow: `${block.hour + 1} / span ${block.span ?? 1}`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {block.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating glass stat cards */}
      <div
        className="absolute -top-3 -right-3 glass-card rounded-xl px-3.5 py-2.5 shadow-lg animate-reveal-up [animation-delay:600ms] dark:glass-card-dark"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+15%</p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">학습 효율</p>
          </div>
        </div>
      </div>

      <div
        className="absolute -bottom-3 -left-3 glass-card rounded-xl px-3.5 py-2.5 shadow-lg animate-reveal-up [animation-delay:700ms] dark:glass-card-dark"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">2,000+</p>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">누적 사용자</p>
          </div>
        </div>
      </div>
    </div>
  );
}
