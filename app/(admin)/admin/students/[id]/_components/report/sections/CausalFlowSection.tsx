import { useMemo } from "react";
import type { DiagnosisTabData, RoadmapItem } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { PRIORITY_LABELS, PRIORITY_COLORS } from "../constants";
import { ArrowRightLeft } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";

interface CausalFlowSectionProps {
  diagnosisData: DiagnosisTabData;
  setekGuides: Array<{
    id: string;
    subject_id: string;
    subject_name?: string | null;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    overall_direction: string | null;
    created_at: string;
  }>;
  roadmapItems?: Array<Pick<RoadmapItem, "grade" | "area" | "plan_content" | "status">>;
  strategies?: Array<{ target_area: string; strategy_content: string; priority: string; status: string }>;
}

interface CausalChain {
  /** 진단 약점 텍스트 또는 역량 */
  diagnosis: { text: string; competencyLabel?: string; grade?: string };
  /** 설계 방향 (세특 가이드에서 매칭) */
  design: { subject: string; direction: string } | null;
  /** 실행 전략 */
  strategy: { content: string; priority: string } | null;
  /** 실행 로드맵 아이템 */
  execution: { content: string; status: string } | null;
}

/** 체인 완성도에 따른 색상: 완전(초록) / 전략까지(파란) / 약점만(빨간) */
function chainStatusColor(chain: CausalChain): string {
  if (chain.execution) return "border-l-4 border-l-emerald-400";
  if (chain.strategy) return "border-l-4 border-l-blue-400";
  return "border-l-4 border-l-red-400";
}

export function CausalFlowSection({ diagnosisData, setekGuides, roadmapItems = [], strategies = [] }: CausalFlowSectionProps) {
  const chains = useMemo(() => {
    const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
    if (!diagnosis) return [];

    const weaknesses = (diagnosis.weaknesses as string[]) ?? [];
    const allScores = [...diagnosisData.competencyScores.consultant, ...diagnosisData.competencyScores.ai];

    // 약점 역량 수집 (B- 이하)
    const weakItems = new Map<string, { label: string; grade: string; area: string }>();
    for (const s of allScores) {
      if (["B-", "C"].includes(s.grade_value) && !weakItems.has(s.competency_item)) {
        const item = COMPETENCY_ITEMS.find((i) => i.code === s.competency_item);
        if (item) weakItems.set(s.competency_item, { label: item.label, grade: s.grade_value, area: item.area });
      }
    }

    // setek_guides에서 subject_id → 방향 매핑
    // 키는 lookup용 UUID, 표시값은 과목명(없으면 UUID fallback)
    const focusToGuide = new Map<string, { subject: string; direction: string }>();
    for (const g of setekGuides) {
      if (g.direction) {
        focusToGuide.set(g.subject_id, {
          subject: g.subject_name ?? g.subject_id,
          direction: g.direction.length > 60 ? g.direction.slice(0, 60) + "…" : g.direction,
        });
      }
    }

    // 전략 풀 (props strategies 우선, 없으면 diagnosisData.strategies)
    const strategyPool = strategies.length > 0 ? strategies : diagnosisData.strategies.map((s) => ({
      target_area: s.target_area ?? "general",
      strategy_content: s.strategy_content,
      priority: s.priority ?? "low",
      status: s.status,
    }));

    // target_area → 전략 매핑
    const areaToStrategies = new Map<string, Array<{ content: string; priority: string; status: string }>>();
    for (const s of strategyPool) {
      const area = s.target_area ?? "general";
      const list = areaToStrategies.get(area) ?? [];
      list.push({ content: s.strategy_content, priority: s.priority ?? "low", status: s.status });
      areaToStrategies.set(area, list);
    }

    // 영역 → target_area 매핑 (역방향)
    const competencyAreaToTargetAreas: Record<string, string[]> = {
      academic: ["setek", "personal_setek", "score", "reading"],
      career: ["career"],
      community: ["changche", "club", "autonomy", "haengteuk"],
    };

    // 영역 → 로드맵 아이템 매핑
    const areaToRoadmap = new Map<string, Array<{ content: string; status: string }>>();
    for (const r of roadmapItems) {
      const area = r.area ?? "general";
      const list = areaToRoadmap.get(area) ?? [];
      list.push({ content: r.plan_content, status: r.status ?? "planning" });
      areaToRoadmap.set(area, list);
    }

    // 체인 빌드: 약점 역량 기반
    const result: CausalChain[] = [];

    for (const [code, info] of weakItems) {
      const guide = focusToGuide.get(code) ?? null;
      const targetAreas = competencyAreaToTargetAreas[info.area] ?? [];
      let strategy: { content: string; priority: string } | null = null;
      let execution: { content: string; status: string } | null = null;

      for (const ta of targetAreas) {
        if (!strategy) {
          const list = areaToStrategies.get(ta);
          if (list && list.length > 0) {
            const best = list.find((s) => s.status !== "done") ?? list[0];
            strategy = { content: best.content, priority: best.priority };
          }
        }
        if (!execution) {
          const rList = areaToRoadmap.get(ta);
          if (rList && rList.length > 0) {
            const active = rList.find((r) => r.status === "in_progress") ?? rList[0];
            execution = active;
          }
        }
        if (strategy && execution) break;
      }

      result.push({
        diagnosis: { text: "", competencyLabel: info.label, grade: info.grade },
        design: guide,
        strategy,
        execution,
      });
    }

    // 텍스트 약점 중 역량 체인에 포함되지 않은 것 추가
    for (const w of weaknesses) {
      if (result.length >= 6) break;
      result.push({
        diagnosis: { text: w },
        design: null,
        strategy: null,
        execution: null,
      });
    }

    return result.slice(0, 6);
  }, [diagnosisData, setekGuides, roadmapItems, strategies]);

const STATUS_ICON: Record<string, string> = {
  in_progress: "●",
  confirmed: "✓",
  completed: "✓✓",
  planning: "○",
};

  if (chains.length === 0) return null;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={ArrowRightLeft} title="약점 → 전략 → 실행 연결" />
      <p className="mb-3 text-xs text-gray-500">
        진단 약점이 전략과 실행 계획으로 어떻게 연결되는지 보여줍니다. 왼쪽 색 선: 초록=실행까지 연결, 파란=전략까지, 빨간=약점만.
      </p>

      <div className="space-y-2">
        {/* 헤더 — 모바일에서 숨김 */}
        <div className="hidden items-center gap-1 text-xs font-semibold text-gray-500 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <span className="px-2">진단 약점</span>
          <span />
          <span className="px-2">설계 방향</span>
          <span />
          <span className="px-2">실행 전략</span>
          <span />
          <span className="px-2">실행 계획</span>
        </div>

        {/* 체인 행 — 모바일: 세로 스택 / md+: 7열 가로 */}
        {chains.map((chain, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-1 rounded-l print-avoid-break md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch",
              chainStatusColor(chain),
            )}
          >
            {/* 진단 */}
            <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5">
              {chain.diagnosis.competencyLabel ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-red-800">
                    {chain.diagnosis.competencyLabel}
                  </span>
                  <span className="rounded bg-red-200 px-1 py-0.5 text-xs font-bold text-red-900">
                    {chain.diagnosis.grade}
                  </span>
                </div>
              ) : (
                <p className="text-xs leading-tight text-red-800">
                  {chain.diagnosis.text.length > 60 ? chain.diagnosis.text.slice(0, 60) + "…" : chain.diagnosis.text}
                </p>
              )}
            </div>

            {/* 화살표 */}
            <div className="flex items-center justify-center px-0.5 text-gray-300">
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </div>

            {/* 설계 */}
            <div className={`rounded border px-2 py-1.5 ${chain.design ? "border-indigo-200 bg-indigo-50" : "border-dashed border-gray-200 bg-gray-50"}`}>
              {chain.design ? (
                <>
                  <p className="text-xs font-semibold text-indigo-700">{chain.design.subject}</p>
                  <p className="text-xs leading-tight text-indigo-600">{chain.design.direction}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500">가이드 미생성</p>
              )}
            </div>

            {/* 화살표 */}
            <div className="flex items-center justify-center px-0.5 text-gray-300">
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </div>

            {/* 전략 */}
            <div className={`rounded border px-2 py-1.5 ${chain.strategy ? PRIORITY_COLORS[chain.strategy.priority] ?? "border-gray-200 bg-gray-50" : "border-dashed border-gray-200 bg-gray-50"}`}>
              {chain.strategy ? (
                <>
                  <span className="text-xs font-semibold">
                    [{PRIORITY_LABELS[chain.strategy.priority] ?? ""}]
                  </span>
                  <p className="text-xs leading-tight">
                    {chain.strategy.content.length > 60 ? chain.strategy.content.slice(0, 60) + "…" : chain.strategy.content}
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500">전략 미수립</p>
              )}
            </div>

            {/* 화살표 */}
            <div className="flex items-center justify-center px-0.5 text-gray-300">
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </div>

            {/* 실행 계획 */}
            <div className={`rounded border px-2 py-1.5 ${chain.execution ? "border-emerald-200 bg-emerald-50" : "border-dashed border-gray-200 bg-gray-50"}`}>
              {chain.execution ? (
                <div className="flex items-start gap-1">
                  <span className="mt-0.5 shrink-0 text-xs font-bold text-emerald-700">
                    {STATUS_ICON[chain.execution.status] ?? "○"}
                  </span>
                  <p className="text-xs leading-tight text-emerald-800">
                    {chain.execution.content.length > 60 ? chain.execution.content.slice(0, 60) + "…" : chain.execution.content}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">실행 미등록</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
