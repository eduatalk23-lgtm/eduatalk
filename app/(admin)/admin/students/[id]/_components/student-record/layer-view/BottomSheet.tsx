"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { RecordTabData, DiagnosisTabData, StorylineTabData } from "@/lib/domains/student-record/types";
import type { RecordArea, LayerGuideAssignment, LayerActivityTag, LayerSetekGuide } from "./types";
import { FOCUS_RING } from "./types";

// ── 탭 정의 ──

// 카테고리별 그룹화
const TAB_GROUPS = [
  {
    label: "현황",
    tabs: [
      { id: "competency", emoji: "📊", label: "역량" },
      { id: "guide-rate", emoji: "📈", label: "이행률" },
      { id: "diff", emoji: "🔄", label: "가안 vs 실생기부" },
    ],
  },
  {
    label: "방향",
    tabs: [
      { id: "summary", emoji: "📋", label: "활동 요약" },
      { id: "teacher", emoji: "👩‍🏫", label: "교사 전달" },
      { id: "storyline", emoji: "📖", label: "스토리라인" },
    ],
  },
  {
    label: "분석",
    tabs: [
      { id: "diagnosis", emoji: "🔬", label: "진단" },
      { id: "edges", emoji: "🔗", label: "연결" },
      { id: "growth", emoji: "📈", label: "성장" },
    ],
  },
  {
    label: "입시",
    tabs: [
      { id: "career-fit", emoji: "🎯", label: "진로" },
      { id: "course-fit", emoji: "📚", label: "수강" },
      { id: "roadmap", emoji: "🗺️", label: "로드맵" },
      { id: "interview", emoji: "🎤", label: "면접" },
    ],
  },
] as const;

type TabId =
  | "competency" | "guide-rate" | "diff"
  | "summary" | "teacher" | "storyline"
  | "diagnosis" | "edges" | "growth"
  | "career-fit" | "course-fit" | "roadmap" | "interview";
type SheetHeight = "closed" | "peek" | "half" | "full";

const HEIGHT_CLASS: Record<SheetHeight, string> = {
  closed: "h-10",
  peek: "h-[30vh]",
  half: "h-[50vh]",
  full: "h-[80vh]",
};

// ── Props ──

interface BottomSheetProps {
  currentArea?: RecordArea | null;
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  diagnosisData?: DiagnosisTabData | null;
  storylineData?: StorylineTabData | null;
  tenantId?: string;
}

// ── 메인 컴포넌트 ──

export function BottomSheet({
  currentArea,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  diagnosisData,
  storylineData,
  tenantId,
}: BottomSheetProps) {
  const params = useParams();
  const studentId = params.id as string;
  const [height, setHeight] = useState<SheetHeight>("closed");
  const [activeTab, setActiveTab] = useState<TabId>("competency");

  const isOpen = height !== "closed";

  const cycleHeight = useCallback(() => {
    const cycle: SheetHeight[] = ["closed", "peek", "half", "full"];
    const idx = cycle.indexOf(height);
    setHeight(cycle[(idx + 1) % cycle.length]);
  }, [height]);

  return (
    <div
      className={cn(
        "mt-4 overflow-hidden rounded-t-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)] transition-all duration-300",
        HEIGHT_CLASS[height],
      )}
    >
      {/* 핸들 바 */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`전체 맥락 패널 (${isOpen ? "열림" : "닫힘"})`}
        onClick={cycleHeight}
        onKeyDown={(e) => {
          const cycle: SheetHeight[] = ["closed", "peek", "half", "full"];
          const idx = cycle.indexOf(height);
          if (e.key === "ArrowUp" && idx < cycle.length - 1) { e.preventDefault(); setHeight(cycle[idx + 1]); }
          if (e.key === "ArrowDown" && idx > 0) { e.preventDefault(); setHeight(cycle[idx - 1]); }
        }}
        className={cn("flex w-full items-center justify-center gap-2 border-b border-[var(--border-secondary)] py-2 text-xs text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]", FOCUS_RING)}
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        <span className="font-medium">전체 맥락</span>
        {currentArea && isOpen && (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {currentArea.label}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="flex h-[calc(100%-40px)] flex-col">
          {/* 탭 바 (카테고리 그룹) */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[var(--border-secondary)] px-3 py-1.5">
            {TAB_GROUPS.map((group, gi) => (
              <div key={group.label} className="flex shrink-0 items-center gap-0.5">
                {gi > 0 && <div className="mx-1 h-4 w-px bg-[var(--border-secondary)]" />}
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    {tab.emoji} {tab.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 overflow-y-auto p-3">
            <TabContent
              tabId={activeTab}
              studentId={studentId}
              currentArea={currentArea}
              recordByGrade={recordByGrade}
              guideAssignments={guideAssignments}
              activityTags={activityTags}
              setekGuides={setekGuides}
              diagnosisData={diagnosisData}
              storylineData={storylineData}
              tenantId={tenantId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 탭 콘텐츠 라우터 ──

function TabContent({
  tabId,
  studentId,
  currentArea,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  diagnosisData,
  storylineData,
  tenantId,
}: {
  tabId: TabId;
  studentId: string;
  currentArea?: RecordArea | null;
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  diagnosisData?: DiagnosisTabData | null;
  storylineData?: StorylineTabData | null;
  tenantId?: string;
}) {
  switch (tabId) {
    case "competency":
      return <CompetencyTab tags={activityTags} currentArea={currentArea} />;
    case "guide-rate":
      return <GuideRateTab assignments={guideAssignments} />;
    case "teacher":
      return <TeacherTab guides={setekGuides} currentArea={currentArea} />;
    case "diff":
      return <DiffTab recordByGrade={recordByGrade} currentArea={currentArea} />;
    case "summary":
      return <SummaryTab studentId={studentId} />;
    case "storyline":
      return <StorylineTab data={storylineData} />;
    case "diagnosis":
      return <DiagnosisTab data={diagnosisData} />;
    case "edges":
      return <EdgesTab studentId={studentId} tenantId={tenantId} />;
    case "growth":
      return <GrowthTab data={diagnosisData} />;
    case "career-fit":
      return <CareerFitTab data={diagnosisData} />;
    case "course-fit":
      return <CourseFitTab data={diagnosisData} />;
    case "roadmap":
      return <RoadmapTab data={storylineData} />;
    case "interview":
      return <InterviewTab studentId={studentId} />;
    default:
      return <PlaceholderTab />;
  }
}

// ── 1. 역량 분포 탭 ──

function CompetencyTab({ tags, currentArea }: { tags: LayerActivityTag[]; currentArea?: RecordArea | null }) {
  // 역량별 그룹화
  const grouped = new Map<string, { count: number; ai: number; manual: number; confirmed: number }>();
  for (const t of tags) {
    const item = t.competency_item ?? "미분류";
    const entry = grouped.get(item) ?? { count: 0, ai: 0, manual: 0, confirmed: 0 };
    entry.count++;
    if (t.source === "ai") entry.ai++;
    if (t.source === "manual") entry.manual++;
    if (t.status === "confirmed") entry.confirmed++;
    grouped.set(item, entry);
  }

  const sorted = [...grouped.entries()].sort((a, b) => b[1].count - a[1].count);

  if (sorted.length === 0) {
    return <EmptyMessage>역량 태그가 없습니다.</EmptyMessage>;
  }

  // 현재 영역 태그 ID 집합 (하이라이트용)
  const currentRecordId = currentArea?.recordId;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[var(--text-tertiary)]">전체 {tags.length}개 태그, {sorted.length}개 역량</p>
      {sorted.map(([item, stat]) => {
        const isHighlighted = currentRecordId && tags.some((t) => t.record_id === currentRecordId && t.competency_item === item);
        return (
          <div
            key={item}
            className={cn(
              "flex items-center justify-between rounded px-2 py-1.5 text-xs",
              isHighlighted ? "bg-indigo-50 dark:bg-indigo-900/20" : "",
            )}
          >
            <span className="text-[var(--text-primary)]">{item}</span>
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
              <span>🤖{stat.ai}</span>
              <span>👤{stat.manual}</span>
              <span>✅{stat.confirmed}</span>
              <span className="font-medium text-[var(--text-secondary)]">{stat.count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 2. 가이드 이행률 탭 ──

function GuideRateTab({ assignments }: { assignments: LayerGuideAssignment[] }) {
  if (assignments.length === 0) {
    return <EmptyMessage>배정된 가이드가 없습니다.</EmptyMessage>;
  }

  const statusCount = { assigned: 0, in_progress: 0, submitted: 0, completed: 0, cancelled: 0 };
  for (const a of assignments) {
    const s = a.status as keyof typeof statusCount;
    if (s in statusCount) statusCount[s]++;
  }

  const total = assignments.length;
  const confirmed = assignments.filter((a) => a.confirmed_at != null).length;
  const rate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 진행률 바 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">확정 이행률</span>
          <span className="font-medium text-[var(--text-primary)]">{rate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* 상태별 카운트 */}
      <div className="flex flex-wrap gap-2">
        {STATUS_LABELS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1 text-[10px]">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            <span className="text-[var(--text-tertiary)]">{label}</span>
            <span className="font-medium text-[var(--text-secondary)]">{statusCount[key]}</span>
          </div>
        ))}
      </div>

      {/* 배정 목록 */}
      <div className="space-y-1">
        {assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border border-[var(--border-secondary)] px-2 py-1.5">
            <span className="truncate text-xs text-[var(--text-primary)]">
              {a.exploration_guides?.title ?? "가이드"}
            </span>
            <span className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              a.confirmed_at ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
            )}>
              {a.confirmed_at ? "확정" : a.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABELS = [
  { key: "assigned" as const, label: "배정", color: "bg-blue-400" },
  { key: "in_progress" as const, label: "진행", color: "bg-amber-400" },
  { key: "submitted" as const, label: "제출", color: "bg-violet-400" },
  { key: "completed" as const, label: "완료", color: "bg-emerald-400" },
  { key: "cancelled" as const, label: "취소", color: "bg-gray-400" },
];

// ── 3. 교사 전달 탭 ──

function TeacherTab({ guides, currentArea }: { guides: LayerSetekGuide[]; currentArea?: RecordArea | null }) {
  // 교사 포인트가 있는 가이드만
  const withPoints = guides.filter((g) => g.teacher_points && g.teacher_points.length > 0);

  if (withPoints.length === 0) {
    return <EmptyMessage>교사 전달 포인트가 없습니다.</EmptyMessage>;
  }

  return (
    <div className="space-y-3">
      {withPoints.map((guide, idx) => {
        const isHighlighted = currentArea?.type === "setek" && currentArea?.subjectId === guide.subject_id;
        return (
          <div
            key={idx}
            className={cn(
              "rounded border border-[var(--border-secondary)] p-2",
              isHighlighted && "ring-1 ring-indigo-400",
            )}
          >
            {/* 키워드 */}
            {guide.keywords.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {guide.keywords.map((kw) => (
                  <span key={kw} className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    {kw}
                  </span>
                ))}
              </div>
            )}
            {/* 교사 포인트 */}
            <ul className="space-y-0.5">
              {guide.teacher_points!.map((tp, i) => (
                <li key={i} className="text-xs text-[var(--text-secondary)]">· {tp}</li>
              ))}
            </ul>
            {/* 주의사항 */}
            {guide.cautions && (
              <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">⚠ {guide.cautions}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 4. 가안 vs 실생기부 탭 ──

function DiffTab({
  recordByGrade,
  currentArea,
}: {
  recordByGrade: Map<number, { data: RecordTabData }>;
  currentArea?: RecordArea | null;
}) {
  const diffs: Array<{ label: string; grade: number; confirmed: number; imported: number; match: boolean; isCurrent: boolean }> = [];

  for (const [grade, entry] of recordByGrade) {
    for (const s of entry.data.seteks) {
      const draft = s.confirmed_content ?? s.ai_draft_content;
      const imported = s.imported_content;
      if (!draft && !imported) continue;
      const isCurrent = currentArea?.type === "setek" && currentArea?.subjectId === s.subject_id && currentArea?.grade === grade;
      diffs.push({
        label: `${grade}학년 세특`,
        grade,
        confirmed: draft?.length ?? 0,
        imported: imported?.length ?? 0,
        match: draft === imported,
        isCurrent,
      });
    }
  }

  if (diffs.length === 0) {
    return <EmptyMessage>비교할 가안/실생기부 데이터가 없습니다.</EmptyMessage>;
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-[var(--text-tertiary)]">{diffs.length}개 영역</p>
      {diffs.map((d, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between rounded px-2 py-1.5 text-xs",
            d.isCurrent && "bg-indigo-50 dark:bg-indigo-900/20",
          )}
        >
          <span className="text-[var(--text-primary)]">{d.label}</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[var(--text-tertiary)]">가안 {d.confirmed}자</span>
            <span className="text-[var(--text-tertiary)]">임포트 {d.imported}자</span>
            <span className={d.match ? "text-emerald-600" : "text-amber-600"}>
              {d.match ? "✓ 일치" : "≠ 불일치"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 5. 활동 요약 탭 (lazy fetch) ──

interface SummaryData {
  id: string;
  summary_title: string;
  summary_text: string;
  status: string;
  created_at: string;
}

function SummaryTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<SummaryData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchActivitySummaries } = await import("@/lib/domains/student-record/actions/activitySummary");
        const result = await fetchActivitySummaries(studentId);
        if (!cancelled) {
          if (result.success && result.data) {
            setData(result.data);
          } else if (!result.success) {
            setError(result.error ?? "조회 실패");
          }
        }
      } catch {
        if (!cancelled) setError("요약서를 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data || data.length === 0) return <EmptyMessage>활동 요약서가 없습니다.</EmptyMessage>;

  const latest = data[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span className="font-medium text-[var(--text-secondary)]">{latest.summary_title}</span>
        <span>{new Date(latest.created_at).toLocaleDateString("ko-KR")} · {latest.status}</span>
      </div>
      <div className="max-h-[300px] overflow-y-auto rounded border border-[var(--border-secondary)] p-2">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
          {latest.summary_text}
        </p>
      </div>
      {data.length > 1 && (
        <p className="text-[10px] text-[var(--text-tertiary)]">이전 버전 {data.length - 1}건</p>
      )}
    </div>
  );
}

// ── 6. 스토리라인 탭 ──

function StorylineTab({ data }: { data?: StorylineTabData | null }) {
  if (!data) return <EmptyMessage>스토리라인 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { storylines } = data;
  if (storylines.length === 0) return <EmptyMessage>등록된 스토리라인이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">{storylines.length}개 스토리라인</p>
      {storylines.map((s) => (
        <div key={s.id} className="rounded border border-[var(--border-secondary)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">{s.title}</span>
            {s.career_field && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                {s.career_field}
              </span>
            )}
          </div>
          {s.keywords.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {s.keywords.map((kw) => (
                <span key={kw} className="rounded bg-[var(--surface-hover)] px-1 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                  {kw}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-[10px] text-[var(--text-tertiary)]">
            {s.grade_1_theme && <span>1학년: {s.grade_1_theme}</span>}
            {s.grade_2_theme && <span>2학년: {s.grade_2_theme}</span>}
            {s.grade_3_theme && <span>3학년: {s.grade_3_theme}</span>}
          </div>
          {s.strength && (
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{s.strength}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 7. 진단 탭 ──

function DiagnosisTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>진단 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { aiDiagnosis, consultantDiagnosis, strategies } = data;
  if (!aiDiagnosis && !consultantDiagnosis) return <EmptyMessage>생성된 진단이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {/* AI 진단 */}
      {aiDiagnosis && (
        <DiagnosisCard label="AI 진단" source="ai" diagnosis={aiDiagnosis} />
      )}
      {/* 컨설턴트 진단 */}
      {consultantDiagnosis && (
        <DiagnosisCard label="컨설턴트 진단" source="consultant" diagnosis={consultantDiagnosis} />
      )}
      {/* 전략 요약 */}
      {strategies.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">보완 전략 ({strategies.length}건)</p>
          <div className="space-y-1">
            {strategies.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded bg-[var(--surface-hover)] px-2 py-1 text-xs">
                <span className="truncate text-[var(--text-primary)]">{s.target_area}: {s.strategy_content}</span>
                <span className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[10px]",
                  s.priority === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                  s.priority === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
                )}>
                  {s.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ label, source, diagnosis }: {
  label: string;
  source: string;
  diagnosis: {
    overall_grade?: string | null;
    record_direction?: string | null;
    direction_strength?: string | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    status?: string | null;
  };
}) {
  const summary = diagnosis.record_direction ?? diagnosis.direction_strength;
  return (
    <div className="rounded border border-[var(--border-secondary)] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
        <div className="flex items-center gap-1.5">
          {diagnosis.overall_grade && (
            <span className="rounded bg-[var(--surface-hover)] px-1 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
              {diagnosis.overall_grade}
            </span>
          )}
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            source === "ai" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
          )}>
            {source === "ai" ? "🤖 AI" : "👤 수동"}
          </span>
        </div>
      </div>
      {summary && (
        <p className="mb-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          {summary.length > 200 ? summary.slice(0, 200) + "..." : summary}
        </p>
      )}
      <div className="flex gap-4 text-[10px]">
        {diagnosis.strengths && diagnosis.strengths.length > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400">+ 강점 {diagnosis.strengths.length}</span>
        )}
        {diagnosis.weaknesses && diagnosis.weaknesses.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400">- 약점 {diagnosis.weaknesses.length}</span>
        )}
      </div>
    </div>
  );
}

// ── 8. 연결(엣지) 탭 (lazy fetch) ──

const EDGE_LABELS: Record<string, { label: string; color: string }> = {
  COMPETENCY_SHARED: { label: "역량 공유", color: "bg-blue-400" },
  CONTENT_REFERENCE: { label: "내용 연결", color: "bg-purple-400" },
  TEMPORAL_GROWTH: { label: "성장 경로", color: "bg-teal-400" },
  COURSE_SUPPORTS: { label: "교과 뒷받침", color: "bg-amber-400" },
  READING_ENRICHES: { label: "독서 보강", color: "bg-rose-400" },
  THEME_CONVERGENCE: { label: "주제 수렴", color: "bg-cyan-400" },
  TEACHER_VALIDATION: { label: "교사 검증", color: "bg-green-400" },
};

interface EdgeRow {
  edge_type: string;
  source_label: string;
  target_label: string;
  reason: string;
  confidence: number;
  is_stale: boolean;
}

function EdgesTab({ studentId, tenantId }: { studentId: string; tenantId?: string }) {
  const [edges, setEdges] = useState<EdgeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { fetchPersistedEdges } = await import("@/lib/domains/student-record/actions/diagnosis");
        const result = await fetchPersistedEdges(studentId, tenantId);
        if (!cancelled) setEdges(result);
      } catch {
        if (!cancelled) setError("연결 데이터를 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, tenantId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!tenantId) return <EmptyMessage>테넌트 정보가 없습니다.</EmptyMessage>;
  if (!edges || edges.length === 0) return <EmptyMessage>감지된 연결이 없습니다.</EmptyMessage>;

  // 유형별 그룹화
  const grouped = new Map<string, EdgeRow[]>();
  for (const e of edges) {
    const arr = grouped.get(e.edge_type) ?? [];
    arr.push(e);
    grouped.set(e.edge_type, arr);
  }
  const staleCount = edges.filter((e) => e.is_stale).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>총 {edges.length}개 연결, {grouped.size}개 유형</span>
        {staleCount > 0 && <span className="text-amber-600">⚠ {staleCount}건 갱신 필요</span>}
      </div>
      {[...grouped.entries()].sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
        const meta = EDGE_LABELS[type] ?? { label: type, color: "bg-gray-400" };
        const maxWidth = Math.round((items.length / edges.length) * 100);
        return (
          <div key={type} className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 rounded-full", meta.color)} />
              <span className="text-[var(--text-primary)]">{meta.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{items.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className={cn("h-full rounded-full", meta.color)} style={{ width: `${maxWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 9. 성장 탭 ──

function GrowthTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>역량 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { competencyScores } = data;
  const allScores = [...competencyScores.ai, ...competencyScores.consultant];
  if (allScores.length === 0) return <EmptyMessage>역량 점수가 없습니다.</EmptyMessage>;

  // 역량 항목별 AI vs 컨설턴트 등급 비교
  const byItem = new Map<string, { area: string; ai: string | null; consultant: string | null }>();
  for (const s of competencyScores.ai) {
    const key = s.competency_item;
    const entry = byItem.get(key) ?? { area: s.competency_area, ai: null, consultant: null };
    entry.ai = s.grade_value;
    byItem.set(key, entry);
  }
  for (const s of competencyScores.consultant) {
    const key = s.competency_item;
    const entry = byItem.get(key) ?? { area: s.competency_area, ai: null, consultant: null };
    entry.consultant = s.grade_value;
    byItem.set(key, entry);
  }

  // 영역별 그룹
  const byArea = new Map<string, Array<[string, { ai: string | null; consultant: string | null }]>>();
  for (const [item, val] of byItem) {
    const arr = byArea.get(val.area) ?? [];
    arr.push([item, { ai: val.ai, consultant: val.consultant }]);
    byArea.set(val.area, arr);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-tertiary)]">{byItem.size}개 역량 항목, {byArea.size}개 영역</p>
      {[...byArea.entries()].map(([area, items]) => (
        <div key={area}>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">{area}</p>
          <div className="space-y-1">
            {items.map(([item, grades]) => (
              <div key={item} className="flex items-center justify-between rounded px-2 py-1 text-xs">
                <span className="text-[var(--text-primary)]">{item}</span>
                <div className="flex gap-2 text-[10px]">
                  {grades.ai && (
                    <span className="rounded bg-blue-100 px-1 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      🤖 {grades.ai}
                    </span>
                  )}
                  {grades.consultant && (
                    <span className="rounded bg-violet-100 px-1 py-0.5 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      👤 {grades.consultant}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 10. 진로 적합도 탭 ──

function CareerFitTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>진로 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { targetMajor, targetSubClassificationName, courseAdequacy } = data;
  if (!targetMajor && !courseAdequacy) return <EmptyMessage>진로 목표가 설정되지 않았습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {/* 진로 목표 */}
      {targetMajor && (
        <div className="rounded border border-[var(--border-secondary)] p-2">
          <p className="text-[10px] text-[var(--text-tertiary)]">진로 목표</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">{targetMajor}</p>
          {targetSubClassificationName && (
            <p className="text-[10px] text-[var(--text-tertiary)]">계열: {targetSubClassificationName}</p>
          )}
        </div>
      )}

      {/* 교과 적합도 */}
      {courseAdequacy && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">교과 이수 적합도</span>
            <span className={cn(
              "text-sm font-bold",
              courseAdequacy.score >= 70 ? "text-emerald-600" : courseAdequacy.score >= 40 ? "text-amber-600" : "text-red-600",
            )}>
              {courseAdequacy.score}점
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className={cn(
                "h-full rounded-full",
                courseAdequacy.score >= 70 ? "bg-emerald-500" : courseAdequacy.score >= 40 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${courseAdequacy.score}%` }}
            />
          </div>
          <div className="flex gap-3 text-[10px] text-[var(--text-tertiary)]">
            <span>일반선택 {Math.round(courseAdequacy.generalRate * 100)}%</span>
            <span>진로선택 {Math.round(courseAdequacy.careerRate * 100)}%</span>
            <span>이수 {courseAdequacy.taken.length}/{courseAdequacy.totalRecommended}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 11. 수강 탭 ──

function CourseFitTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>수강 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { courseAdequacy, takenSubjects } = data;
  if (!courseAdequacy) return <EmptyMessage>교과 이수 분석이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {/* 이수 과목 */}
      {courseAdequacy.taken.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            ✓ 이수 추천과목 ({courseAdequacy.taken.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.taken.map((s) => (
              <span key={s} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 미이수 */}
      {courseAdequacy.notTaken.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            ✗ 미이수 ({courseAdequacy.notTaken.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.notTaken.map((s) => (
              <span key={s} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 미개설 */}
      {courseAdequacy.notOffered.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-tertiary)]">
            학교 미개설 ({courseAdequacy.notOffered.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.notOffered.map((s) => (
              <span key={s} className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 전체 이수 과목 */}
      {takenSubjects.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] text-[var(--text-tertiary)]">전체 이수 {takenSubjects.length}과목</p>
        </div>
      )}
    </div>
  );
}

// ── 12. 로드맵 탭 ──

function RoadmapTab({ data }: { data?: StorylineTabData | null }) {
  if (!data) return <EmptyMessage>로드맵 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { roadmapItems } = data;
  if (roadmapItems.length === 0) return <EmptyMessage>등록된 로드맵이 없습니다.</EmptyMessage>;

  // 학년별 그룹
  const byGrade = new Map<number, typeof roadmapItems>();
  for (const item of roadmapItems) {
    const arr = byGrade.get(item.grade) ?? [];
    arr.push(item);
    byGrade.set(item.grade, arr);
  }

  const executed = roadmapItems.filter((r) => r.executed_at).length;
  const rate = Math.round((executed / roadmapItems.length) * 100);

  return (
    <div className="space-y-3">
      {/* 실행률 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">실행률</span>
          <span className="font-medium text-[var(--text-primary)]">{rate}% ({executed}/{roadmapItems.length})</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* 학년별 아이템 */}
      {[...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, items]) => (
        <div key={grade}>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">{grade}학년</p>
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border border-[var(--border-secondary)] px-2 py-1">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-xs text-[var(--text-primary)]">{item.plan_content}</span>
                  {item.plan_keywords && item.plan_keywords.length > 0 && (
                    <div className="mt-0.5 flex gap-1">
                      {item.plan_keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[9px] text-[var(--text-tertiary)]">#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={cn(
                  "ml-2 shrink-0 rounded px-1 py-0.5 text-[10px]",
                  item.executed_at
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
                )}>
                  {item.executed_at ? "완료" : "예정"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 13. 면접 탭 (lazy fetch) ──

interface InterviewRow {
  question: string;
  question_type: string;
  difficulty: string | null;
  suggested_answer: string | null;
}

const Q_TYPE_LABELS: Record<string, string> = {
  factual: "사실", reasoning: "추론", application: "적용",
  value: "가치", controversial: "논쟁",
};

function InterviewTab({ studentId }: { studentId: string }) {
  const [questions, setQuestions] = useState<InterviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchInterviewQuestions } = await import("@/lib/domains/student-record/actions/diagnosis");
        const result = await fetchInterviewQuestions(studentId);
        if (!cancelled) setQuestions(result);
      } catch {
        if (!cancelled) setError("면접 질문을 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!questions || questions.length === 0) return <EmptyMessage>면접 예상 질문이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">{questions.length}개 질문</p>
      {questions.map((q, i) => (
        <div key={i} className="rounded border border-[var(--border-secondary)] p-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {Q_TYPE_LABELS[q.question_type] ?? q.question_type}
            </span>
            {q.difficulty && (
              <span className="text-[10px] text-[var(--text-tertiary)]">{q.difficulty}</span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-primary)]">{q.question}</p>
          {q.suggested_answer && (
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
              A: {q.suggested_answer.length > 150 ? q.suggested_answer.slice(0, 150) + "..." : q.suggested_answer}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 공통 ──

function PlaceholderTab() {
  return <p className="py-8 text-center text-xs text-[var(--text-tertiary)]">준비 중</p>;
}

function EmptyMessage({ children }: { children: string }) {
  return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">{children}</p>;
}

function LoadingMessage() {
  return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">로드 중...</p>;
}

function ErrorMessage({ children }: { children: string }) {
  return <p className="py-4 text-center text-xs text-red-500">{children}</p>;
}
