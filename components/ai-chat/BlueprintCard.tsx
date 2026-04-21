/**
 * Phase C-3 S3 Sprint G2 (2026-04-21): getBlueprint tool 출력 카드.
 *
 * 3 tier 탭(foundational/development/advanced). 각 tier 에:
 *  - theme (1줄)
 *  - keyQuestions[] (편집: 항목 추가·삭제·수정)
 *  - suggestedActivities[] (편집: 항목 추가·삭제·수정)
 *  - linkedIds (**read-only** 요약 배지 — 편집은 AI 파이프라인 소관)
 *
 * 편집 모드는 ArtifactPanel 의 editMode + onChange 로 활성화.
 * 저장 시 상위가 새 artifact_version 을 INSERT. 원본 DB(student_main_explorations)
 * 반영은 HITL applyArtifactEdit(type='blueprint') 호출로.
 */

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  GetBlueprintOutput,
  BlueprintTierProps,
  BlueprintTiers,
} from "@/lib/mcp/tools/getBlueprint";

type TierKey = keyof BlueprintTiers;

const TIERS: Array<{ key: TierKey; label: string; tone: string }> = [
  { key: "foundational", label: "기초", tone: "bg-blue-100 text-blue-700" },
  {
    key: "development",
    label: "발전",
    tone: "bg-emerald-100 text-emerald-700",
  },
  { key: "advanced", label: "심화", tone: "bg-purple-100 text-purple-700" },
];

const LINKED_LABELS: Array<{ key: keyof BlueprintTierProps["linkedIds"]; label: string }> = [
  { key: "storyline", label: "스토리라인" },
  { key: "roadmapItem", label: "로드맵" },
  { key: "narrativeArc", label: "내러티브" },
  { key: "hyperedge", label: "하이퍼엣지" },
  { key: "setekGuide", label: "세특 가이드" },
  { key: "changcheGuide", label: "창체 가이드" },
  { key: "haengteukGuide", label: "행특 가이드" },
  { key: "topicTrajectory", label: "주제 궤적" },
];

type Props = {
  output: GetBlueprintOutput;
  editable?: boolean;
  onChange?: (next: GetBlueprintOutput) => void;
};

export function BlueprintCard({ output, editable, onChange }: Props) {
  const [activeTier, setActiveTier] = useState<TierKey>("foundational");

  if (!output.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="text-xs font-medium text-rose-600">Blueprint 조회 실패</p>
        <p className="mt-1">{output.reason}</p>
      </div>
    );
  }

  const {
    studentName,
    themeLabel,
    themeKeywords,
    scope,
    trackLabel,
    direction,
    version,
    origin,
    tiers,
  } = output;
  const isEditing = Boolean(editable && onChange);

  const updateTier = (key: TierKey, patch: Partial<BlueprintTierProps>) => {
    if (!onChange) return;
    const next: GetBlueprintOutput = {
      ...output,
      tiers: {
        ...tiers,
        [key]: { ...tiers[key], ...patch },
      },
    };
    onChange(next);
  };

  const sliceLabel =
    scope === "track" && trackLabel
      ? `${trackLabel} 트랙`
      : scope === "overall"
        ? "전체"
        : "학년 슬라이스";
  const directionLabel = direction === "analysis" ? "분석" : "설계";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Blueprint · {studentName ?? "학생"} · {sliceLabel} · {directionLabel} · v{version}
        </span>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {themeLabel}
        </p>
        {themeKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {themeKeywords.map((k) => (
              <span
                key={k}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {k}
              </span>
            ))}
          </div>
        )}
        <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          origin: {origin}
        </span>
      </header>

      <div className="flex gap-1 border-b border-zinc-100 dark:border-zinc-800">
        {TIERS.map((t) => {
          const active = t.key === activeTier;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTier(t.key)}
              className={cn(
                "relative px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300",
              )}
              aria-pressed={active}
            >
              <span className={cn("rounded-md px-2 py-0.5", t.tone)}>
                {t.label}
              </span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-zinc-900 dark:bg-zinc-100" />
              )}
            </button>
          );
        })}
      </div>

      <TierPane
        tier={tiers[activeTier]}
        isEditing={isEditing}
        onChange={(patch) => updateTier(activeTier, patch)}
      />
    </div>
  );
}

function TierPane({
  tier,
  isEditing,
  onChange,
}: {
  tier: BlueprintTierProps;
  isEditing: boolean;
  onChange: (patch: Partial<BlueprintTierProps>) => void;
}) {
  const linkedTotal = LINKED_LABELS.reduce(
    (sum, { key }) => sum + tier.linkedIds[key].length,
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <Field label="테마">
        {isEditing ? (
          <input
            type="text"
            value={tier.theme ?? ""}
            onChange={(e) => onChange({ theme: e.currentTarget.value || null })}
            placeholder="tier 의 핵심 테마"
            aria-label="tier 테마"
            className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-zinc-900"
          />
        ) : (
          <p className="text-xs text-zinc-800 dark:text-zinc-200">
            {tier.theme ?? <span className="italic text-zinc-400">(미설정)</span>}
          </p>
        )}
      </Field>

      <EditableList
        label="핵심 질문"
        items={tier.keyQuestions}
        isEditing={isEditing}
        onChange={(next) => onChange({ keyQuestions: next })}
      />

      <EditableList
        label="추천 활동"
        items={tier.suggestedActivities}
        isEditing={isEditing}
        onChange={(next) => onChange({ suggestedActivities: next })}
      />

      <Field label="연결된 아티팩트">
        {linkedTotal === 0 ? (
          <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
            (연결 없음)
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {LINKED_LABELS.filter(({ key }) => tier.linkedIds[key].length > 0).map(
              ({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {label}
                  <span className="rounded bg-zinc-200 px-1 font-mono text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                    {tier.linkedIds[key].length}
                  </span>
                </span>
              ),
            )}
          </div>
        )}
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
          읽기 전용 — 연결은 AI 파이프라인이 관리합니다.
        </p>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function EditableList({
  label,
  items,
  isEditing,
  onChange,
}: {
  label: string;
  items: string[];
  isEditing: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <Field label={label}>
      {items.length === 0 && !isEditing ? (
        <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
          (없음)
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="text-zinc-400">·</span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = items.slice();
                      next[i] = e.currentTarget.value;
                      onChange(next);
                    }}
                    aria-label={`${label} ${i + 1}`}
                    className="flex-1 rounded-md border border-blue-300 bg-white px-2 py-0.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = items.slice();
                      next.splice(i, 1);
                      onChange(next);
                    }}
                    aria-label={`${label} ${i + 1} 삭제`}
                    className="rounded p-0.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <span className="text-xs text-zinc-800 dark:text-zinc-200">
                  {item}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {isEditing && (
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="mt-1 inline-flex items-center gap-1 rounded-md border border-dashed border-blue-300 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
        >
          <Plus size={11} />
          항목 추가
        </button>
      )}
    </Field>
  );
}
