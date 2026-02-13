"use client";

import type { ComputationMeta } from "@/lib/domains/score/computation";

type ConfidencePanelProps = {
  meta: ComputationMeta;
};

const CONFIDENCE_STYLES: Record<
  ComputationMeta["confidence"],
  { label: string; bg: string; text: string }
> = {
  precise: { label: "정밀", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300" },
  estimated: { label: "추정", bg: "bg-yellow-50 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300" },
  reference: { label: "참고", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400" },
};

const INPUT_LABELS: Record<string, string> = {
  rawScore: "원점수",
  avgScore: "평균",
  stdDev: "표준편차",
  rankGrade: "석차등급",
  achievementLevel: "성취도",
  ratioA: "비율A",
  ratioB: "비율B",
  ratioC: "비율C",
  ratioD: "비율D",
  ratioE: "비율E",
  totalStudents: "수강자수",
  classRank: "석차",
};

const RATIO_KEYS = ["ratioA", "ratioB", "ratioC", "ratioD", "ratioE"];

type ChipData = {
  label: string;
  used: boolean;
};

function buildChips(inputsUsed: string[]): ChipData[] {
  const usedSet = new Set(inputsUsed);
  const chips: ChipData[] = [];

  const nonRatioKeys = ["rawScore", "avgScore", "achievementLevel", "rankGrade", "stdDev", "totalStudents", "classRank"];
  for (const key of nonRatioKeys) {
    chips.push({
      label: INPUT_LABELS[key] ?? key,
      used: usedSet.has(key),
    });
  }

  const ratioUsed = RATIO_KEYS.some((k) => usedSet.has(k));
  chips.push({
    label: "비율 A~E",
    used: ratioUsed,
  });

  return chips;
}

const CONFIDENCE_HINT: Record<ComputationMeta["confidence"], string> = {
  precise: "성취도비율 + 석차등급/석차 교차 검증으로 산출된 높은 신뢰도의 추정입니다.",
  estimated: "단일 경로(석차 또는 비율)만으로 추정된 값입니다. 추가 데이터 입력 시 정밀도가 향상됩니다.",
  reference: "등급 중앙값 기반의 대략적인 추정이므로 참고용으로만 활용해주세요.",
};

export default function ConfidencePanel({ meta }: ConfidencePanelProps) {
  const style = CONFIDENCE_STYLES[meta.confidence];
  const chips = buildChips(meta.inputsUsed);

  const usedChips = chips.filter((c) => c.used);
  const unusedChips = chips.filter((c) => !c.used);

  return (
    <div className="space-y-4">
      {/* 상단: 신뢰도 + 경로 + 과정을 2열 그리드로 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 좌측: 신뢰도 + 산출 경로 */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                신뢰도
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {CONFIDENCE_HINT[meta.confidence]}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              산출 경로
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {meta.methodLabel}
            </p>
          </div>
        </div>

        {/* 우측: 산출 과정 (steps) */}
        {meta.steps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              산출 과정
            </p>
            <ol className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              {meta.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-gray-300 dark:text-gray-600">
                    {i + 1}.
                  </span>
                  <span className="break-all">
                    {formatStep(step)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 투입 데이터 칩 — 사용/미사용 분리 */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          투입 데이터
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {usedChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <span className="mr-1 text-indigo-400">●</span>
              {chip.label}
            </span>
          ))}
          {unusedChips.length > 0 && usedChips.length > 0 && (
            <span className="mx-1 text-gray-300 dark:text-gray-600">|</span>
          )}
          {unusedChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center rounded-full border border-dashed border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
            >
              <span className="mr-1 opacity-40">○</span>
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 산출 과정 텍스트에서 수식 부분만 mono 스타일 적용.
 * split의 캡처 그룹을 사용하여 홀수 인덱스가 매칭된 수식 부분.
 */
function formatStep(step: string): React.ReactNode {
  const mathPattern = /(\d[\d.,]*%?\s*[+\-×*/=~≈]\s*[\d.,]+%?(?:\s*[+\-×*/=~≈]\s*[\d.,]+%?)*)/;
  const parts = step.split(mathPattern);

  if (parts.length <= 1) return step;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-mono tabular-nums">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
