import { TrendingUp } from "lucide-react";

const DAYS = ["월", "화", "수"];
const HOURS = ["09", "10", "11", "12", "13"];

interface Block {
  day: number;
  hour: number;
  label: string;
  color: string;
  span?: number;
}

const BLOCKS: Block[] = [
  { day: 0, hour: 0, label: "수학 I", color: "bg-blue-500", span: 2 },
  { day: 0, hour: 3, label: "국어", color: "bg-amber-500" },
  { day: 0, hour: 4, label: "영어", color: "bg-emerald-500" },
  { day: 1, hour: 0, label: "영어", color: "bg-emerald-500" },
  { day: 1, hour: 1, label: "과학", color: "bg-purple-500", span: 2 },
  { day: 1, hour: 4, label: "수학 II", color: "bg-blue-500" },
  { day: 2, hour: 0, label: "과학", color: "bg-purple-500" },
  { day: 2, hour: 1, label: "수학 I", color: "bg-blue-500", span: 2 },
  { day: 2, hour: 4, label: "국어", color: "bg-amber-500" },
];

export function MobileProductMockup() {
  return (
    <div className="relative mx-auto max-w-[260px]">
      {/* Phone frame */}
      <div className="rounded-[28px] border-[3px] border-gray-800 bg-white shadow-xl overflow-hidden dark:border-slate-500 dark:bg-slate-800">
        {/* Notch */}
        <div className="flex justify-center bg-gray-800 dark:bg-slate-500">
          <div className="h-5 w-24 rounded-b-xl bg-gray-800 dark:bg-slate-500" />
        </div>

        {/* Screen content */}
        <div className="px-3 pt-3 pb-4">
          {/* Mini header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-gray-800 dark:text-white">
              이번 주 학습 플랜
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              AI 추천
            </span>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-[24px_repeat(3,1fr)] gap-0.5 text-center text-[8px] font-semibold text-gray-400 dark:text-slate-500">
            <span />
            {DAYS.map((d) => (
              <span key={d} className="py-0.5">{d}</span>
            ))}
          </div>

          {/* Schedule grid */}
          <div
            className="mt-0.5 grid grid-cols-[24px_repeat(3,1fr)] gap-0.5"
            style={{ gridTemplateRows: `repeat(${HOURS.length}, 20px)` }}
          >
            {HOURS.map((h, ri) => (
              <span
                key={h}
                className="flex items-center justify-end pr-0.5 text-[7px] text-gray-400 dark:text-slate-500"
                style={{ gridRow: ri + 1 }}
              >
                {h}
              </span>
            ))}

            {BLOCKS.map((block, i) => (
              <div
                key={i}
                className={`${block.color} rounded-sm px-1 flex items-center text-[7px] font-medium text-white truncate`}
                style={{
                  gridColumn: block.day + 2,
                  gridRow: `${block.hour + 1} / span ${block.span ?? 1}`,
                }}
              >
                {block.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating stat card */}
      <div className="absolute -bottom-2 -right-4 glass-card rounded-lg px-2.5 py-1.5 shadow-md dark:glass-card-dark">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
            <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+15%</p>
            <p className="text-[7px] text-gray-500 dark:text-slate-400">학습 효율</p>
          </div>
        </div>
      </div>
    </div>
  );
}
