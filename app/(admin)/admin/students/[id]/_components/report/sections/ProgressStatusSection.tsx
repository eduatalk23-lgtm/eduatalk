"use client";

import { ClipboardList, Sparkles, AlertCircle } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import type { RecordTabData } from "@/lib/domains/student-record/types";
import type { ContentQualityRow } from "@/lib/domains/student-record/warnings/engine";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record/constants";

// ─── 콘텐츠 4-layer 기반 slot 상태 ──────────────────

type SlotState = "neis" | "confirmed" | "writing" | "ai_draft" | "empty";

interface SlotMeta {
  label: string;
  color: string;
  bg: string;
  dot: string;
}

const SLOT_META: Record<SlotState, SlotMeta> = {
  neis: { label: "NEIS 반영", color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500" },
  confirmed: { label: "컨설턴트 확정", color: "text-blue-700", bg: "bg-blue-100", dot: "bg-blue-500" },
  writing: { label: "작성 중", color: "text-amber-700", bg: "bg-amber-100", dot: "bg-amber-500" },
  ai_draft: { label: "AI 가안", color: "text-indigo-700", bg: "bg-indigo-100", dot: "bg-indigo-500" },
  empty: { label: "공백", color: "text-text-tertiary", bg: "bg-bg-tertiary", dot: "bg-gray-300" },
};

const SLOT_ORDER: SlotState[] = ["neis", "confirmed", "writing", "ai_draft", "empty"];

// ─── 1 레코드에 대한 slot 상태 계산 (4-layer 우선순위) ──

interface RecordLike {
  imported_content?: string | null;
  confirmed_content?: string | null;
  content?: string | null;
  ai_draft_content?: string | null;
}

function computeSlotState(record: RecordLike): SlotState {
  if (record.imported_content?.trim()) return "neis";
  if (record.confirmed_content?.trim()) return "confirmed";
  if (record.content?.trim()) return "writing";
  if (record.ai_draft_content?.trim()) return "ai_draft";
  return "empty";
}

// ─── Props ─────────────────────────────────────

interface ProgressStatusSectionProps {
  recordDataByGrade: Record<number, RecordTabData>;
  contentQuality: ContentQualityRow[];
  studentGrade: number;
  /** 세특/개인세특 record의 subject_id(UUID) → 과목명 매핑. 없으면 fallback "세특". */
  subjectNamesById?: Record<string, string>;
}

// ─── 한 레코드의 slot 정보 (matrix + action list용) ──

interface SlotEntry {
  grade: number;
  category: "setek" | "changche" | "haengteuk";
  label: string; // 과목명(세특) 또는 한글 활동유형(창체) 또는 "행특"
  recordId: string | null;
  state: SlotState;
  hasQualityIssue: boolean;
}

// ─── 메인 컴포넌트 ───────────────────────────────

export function ProgressStatusSection({
  recordDataByGrade,
  contentQuality,
  studentGrade,
  subjectNamesById,
}: ProgressStatusSectionProps) {
  const grades = Array.from({ length: studentGrade }, (_, i) => i + 1);

  // 품질 이슈가 있는 record_id 집합
  const issueRecordIds = new Set(
    contentQuality.filter((q) => q.issues && q.issues.length > 0).map((q) => q.record_id),
  );

  // 모든 slot 엔트리 구축
  const slots: SlotEntry[] = [];

  for (const grade of grades) {
    const tab = recordDataByGrade[grade];
    if (!tab) continue;

    // 세특 + 개인 세특
    for (const s of [...(tab.seteks ?? []), ...(tab.personalSeteks ?? [])]) {
      const subjectId = s.subject_id as string | undefined;
      const subjectName = subjectId ? subjectNamesById?.[subjectId] : undefined;
      slots.push({
        grade,
        category: "setek",
        label: subjectName ?? "세특",
        recordId: (s.id as string | undefined) ?? null,
        state: computeSlotState(s),
        hasQualityIssue: !!s.id && issueRecordIds.has(s.id as string),
      });
    }

    // 창체 (자율/동아리/진로)
    for (const c of tab.changche ?? []) {
      const actType = (c.activity_type as string | undefined) ?? "";
      const actLabel = CHANGCHE_TYPE_LABELS[actType] ?? (actType || "창체");
      slots.push({
        grade,
        category: "changche",
        label: actLabel,
        recordId: (c.id as string | undefined) ?? null,
        state: computeSlotState(c),
        hasQualityIssue: !!c.id && issueRecordIds.has(c.id as string),
      });
    }

    // 행특 (학년당 1건)
    if (tab.haengteuk) {
      slots.push({
        grade,
        category: "haengteuk",
        label: "행특",
        recordId: (tab.haengteuk.id as string | undefined) ?? null,
        state: computeSlotState(tab.haengteuk),
        hasQualityIssue: !!tab.haengteuk.id && issueRecordIds.has(tab.haengteuk.id as string),
      });
    }
  }

  // 빈 매트릭스 (데이터 없음)
  if (slots.length === 0) {
    return (
      <div>
        <ReportSectionHeader
          icon={ClipboardList}
          title="생기부 진행 상태"
          subtitle="기록이 아직 없습니다"
        />
        <p className="text-sm text-text-tertiary">
          세특·창체·행특 기록을 입력하거나 가져오면 진행 상태가 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  // 상태별 집계
  const stateCounts: Record<SlotState, number> = {
    neis: 0, confirmed: 0, writing: 0, ai_draft: 0, empty: 0,
  };
  for (const s of slots) stateCounts[s.state]++;

  const total = slots.length;
  const neisCount = stateCounts.neis;
  const filledCount = total - stateCounts.empty;
  const reviewPendingCount = stateCounts.ai_draft;

  const neisPct = Math.round((neisCount / total) * 100);
  const filledPct = Math.round((filledCount / total) * 100);

  // 액션 아이템
  const aiDraftSlots = slots.filter((s) => s.state === "ai_draft");
  const writingWithIssueSlots = slots.filter((s) => s.state === "writing" && s.hasQualityIssue);
  const emptySlots = slots.filter((s) => s.state === "empty");

  return (
    <div>
      <ReportSectionHeader
        icon={ClipboardList}
        title="생기부 진행 상태"
        subtitle={`NEIS 반영 ${neisPct}% · 작성 진척 ${filledPct}%`}
      />

      {/* ① 헤더 — 진행 요약 배지 */}
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">확정분 + 작성 중 + 가안 통합 현황</h3>
        <ProgressBadge filledPct={filledPct} />
      </div>

      {/* ② 메트릭 3종 카드 (마스터 패턴 ②) */}
      <MetricTripleCard
        neisCount={neisCount}
        total={total}
        filledCount={filledCount}
        reviewPendingCount={reviewPendingCount}
      />

      {/* ③ 시각화 — 학년 × 기록 매트릭스 (마스터 패턴 ③) */}
      <div className="mt-4">
        <ProgressMatrix grades={grades} slots={slots} />
      </div>

      {/* ④ 근거 — 가안 활동 인용 (마스터 패턴 ④) */}
      {aiDraftSlots.length > 0 && (
        <EvidenceBlock
          title="검토 대기 중인 AI 가안 요약"
          slots={aiDraftSlots.slice(0, 5)}
        />
      )}

      {/* ⑤ 다음 액션 — 컨설턴트 할 일 (마스터 패턴 ⑤) */}
      <ActionChecklist
        aiDraftSlots={aiDraftSlots}
        writingIssueSlots={writingWithIssueSlots}
        emptySlots={emptySlots}
      />
    </div>
  );
}

// ─── 하위 컴포넌트 ─────────────────────────────

function ProgressBadge({ filledPct }: { filledPct: number }) {
  const tone: "positive" | "neutral" | "caution" =
    filledPct >= 80 ? "positive" : filledPct >= 50 ? "neutral" : "caution";
  const classes: Record<typeof tone, string> = {
    positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
    neutral: "bg-bg-secondary text-text-primary border-border",
    caution: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const label = filledPct >= 80 ? "작성 양호" : filledPct >= 50 ? "진행 중" : "작성 부족";
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", classes[tone])}>
      {label}
    </span>
  );
}

interface MetricTripleCardProps {
  neisCount: number;
  total: number;
  filledCount: number;
  reviewPendingCount: number;
}

function MetricTripleCard({ neisCount, total, filledCount, reviewPendingCount }: MetricTripleCardProps) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-white p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-text-tertiary">NEIS 반영</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-emerald-700">{neisCount}</span>
          <span className="text-xs text-text-tertiary">/ {total}</span>
        </div>
        <p className="text-3xs text-text-tertiary">확정된 기록 건수</p>
      </div>

      <div className="flex flex-col gap-1 border-l border-border pl-3">
        <p className="text-xs text-text-tertiary">작성 진척</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-text-primary">{filledCount}</span>
          <span className="text-xs text-text-tertiary">/ {total}</span>
        </div>
        <p className="text-3xs text-text-tertiary">NEIS + 확정 + 작성중 + 가안</p>
      </div>

      <div className="flex flex-col gap-1 border-l border-border pl-3">
        <p className="text-xs text-text-tertiary">검토 대기</p>
        <div className="flex items-baseline gap-1.5">
          <span className={cn(
            "text-2xl font-bold",
            reviewPendingCount > 0 ? "text-indigo-700" : "text-text-tertiary",
          )}>
            {reviewPendingCount}
          </span>
          <span className="text-xs text-text-tertiary">건</span>
        </div>
        <p className="text-3xs text-text-tertiary">AI 가안 → 컨설턴트 검토</p>
      </div>
    </div>
  );
}

interface ProgressMatrixProps {
  grades: number[];
  slots: SlotEntry[];
}

function ProgressMatrix({ grades, slots }: ProgressMatrixProps) {
  const categories: Array<{ key: SlotEntry["category"]; label: string }> = [
    { key: "setek", label: "세특" },
    { key: "changche", label: "창체" },
    { key: "haengteuk", label: "행특" },
  ];

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 text-left text-xs font-medium text-text-tertiary">기록</th>
              {grades.map((g) => (
                <th key={g} className="py-2 px-2 text-center text-xs font-medium text-text-tertiary">
                  {g}학년
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.key} className="border-b border-gray-50">
                <td className="py-2.5 pr-3 text-sm font-medium text-text-primary">{cat.label}</td>
                {grades.map((g) => {
                  const cellSlots = slots.filter((s) => s.grade === g && s.category === cat.key);
                  return (
                    <td key={g} className="py-2.5 px-2">
                      <div className="flex flex-wrap justify-center gap-1">
                        {cellSlots.length === 0 ? (
                          <span className="text-3xs text-text-disabled">—</span>
                        ) : (
                          cellSlots.map((s, idx) => (
                            <SlotChip key={`${s.recordId ?? idx}`} state={s.state} />
                          ))
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        {SLOT_ORDER.map((state) => {
          const meta = SLOT_META[state];
          return (
            <span key={state} className="flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-full", meta.dot)} />
              <span className="text-text-primary">{meta.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SlotChip({ state }: { state: SlotState }) {
  const meta = SLOT_META[state];
  return (
    <span
      className={cn("inline-block size-4 rounded", meta.dot)}
      title={meta.label}
      aria-label={meta.label}
    />
  );
}

function EvidenceBlock({ title, slots }: { title: string; slots: SlotEntry[] }) {
  return (
    <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50/30 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-indigo-600" />
        <p className="text-xs font-semibold text-indigo-700">{title}</p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {slots.map((s, idx) => (
          <li key={idx} className="flex items-center gap-2 text-xs text-text-primary">
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-700">
              {s.grade}학년
            </span>
            <span className="font-medium text-text-primary">{categoryLabel(s.category)}</span>
            <span className="text-text-tertiary">· {s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ActionChecklistProps {
  aiDraftSlots: SlotEntry[];
  writingIssueSlots: SlotEntry[];
  emptySlots: SlotEntry[];
}

function ActionChecklist({ aiDraftSlots, writingIssueSlots, emptySlots }: ActionChecklistProps) {
  const hasAny = aiDraftSlots.length > 0 || writingIssueSlots.length > 0 || emptySlots.length > 0;

  if (!hasAny) {
    return (
      <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
        <p className="text-sm text-emerald-700">
          ✓ 모든 기록이 NEIS 반영 또는 컨설턴트 확정 상태입니다. 추가 액션 없음.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-bg-secondary/50 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4 text-text-secondary" />
        <p className="text-xs font-semibold text-text-primary">컨설턴트 다음 액션</p>
      </div>
      <ul className="flex flex-col gap-3">
        {aiDraftSlots.length > 0 && (
          <ActionItem
            icon="🟨"
            title={`AI 가안 ${aiDraftSlots.length}건 검토 대기`}
            items={aiDraftSlots.slice(0, 5).map((s) => `${s.grade}학년 ${categoryLabel(s.category)} (${s.label})`)}
            hint="열람 후 채택·수정·반려 판단이 필요합니다."
          />
        )}
        {writingIssueSlots.length > 0 && (
          <ActionItem
            icon="🟧"
            title={`작성 중 ${writingIssueSlots.length}건에 품질 이슈 있음`}
            items={writingIssueSlots.slice(0, 5).map((s) => `${s.grade}학년 ${categoryLabel(s.category)} (${s.label})`)}
            hint="품질 점수 기반 피드백을 확인하고 보완이 필요합니다."
          />
        )}
        {emptySlots.length > 0 && (
          <ActionItem
            icon="⬜"
            title={`공백 ${emptySlots.length}건 — 가안 생성 필요`}
            items={emptySlots.slice(0, 5).map((s) => `${s.grade}학년 ${categoryLabel(s.category)} (${s.label})`)}
            hint="AI 가안 생성을 실행하거나 수동 작성을 시작해주세요."
          />
        )}
      </ul>

      <p className="mt-4 border-t border-border pt-3 text-2xs text-text-tertiary">
        ⚠ 진척 상태는 NEIS 확정 전 참고용이며, 실제 최종 반영은 학년 말 NEIS 입력 시점에 결정됩니다.
      </p>
    </div>
  );
}

function ActionItem({ icon, title, items, hint }: {
  icon: string;
  title: string;
  items: string[];
  hint: string;
}) {
  return (
    <li>
      <p className="text-sm font-medium text-text-primary">
        <span className="mr-1.5">{icon}</span>
        {title}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 pl-6">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-text-secondary">
            · {item}
          </li>
        ))}
      </ul>
      <p className="mt-1 pl-6 text-2xs text-text-tertiary">{hint}</p>
    </li>
  );
}

function categoryLabel(cat: SlotEntry["category"]): string {
  switch (cat) {
    case "setek": return "세특";
    case "changche": return "창체";
    case "haengteuk": return "행특";
  }
}
