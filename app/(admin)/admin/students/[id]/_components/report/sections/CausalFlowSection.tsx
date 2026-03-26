import { useMemo } from "react";
import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { PRIORITY_LABELS, PRIORITY_COLORS } from "../constants";
import { ArrowRightLeft } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

interface CausalFlowSectionProps {
  diagnosisData: DiagnosisTabData;
  setekGuides: Array<{
    id: string;
    subject_id: string;
    source: string;
    status: string;
    direction: string;
    keywords: string[];
    overall_direction: string | null;
    created_at: string;
  }>;
}

interface CausalChain {
  /** 진단 약점 텍스트 또는 역량 */
  diagnosis: { text: string; competencyLabel?: string; grade?: string };
  /** 설계 방향 (세특 가이드에서 매칭) */
  design: { subject: string; direction: string } | null;
  /** 실행 전략 */
  strategy: { content: string; priority: string } | null;
}

export function CausalFlowSection({ diagnosisData, setekGuides }: CausalFlowSectionProps) {
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

    // setek_guides에서 subject_id → 방향 매핑 (subject_id를 임시 subject 이름으로 사용)
    const focusToGuide = new Map<string, { subject: string; direction: string }>();
    for (const g of setekGuides) {
      if (g.direction) {
        // 현재 subject_id만 있으므로, 임시로 subject_id를 키로 사용
        focusToGuide.set(g.subject_id, {
          subject: g.subject_id,
          direction: g.direction.length > 60 ? g.direction.slice(0, 60) + "…" : g.direction,
        });
      }
    }

    // 전략 → target_area → 역량 영역 매칭
    const areaToStrategies = new Map<string, Array<{ content: string; priority: string }>>();
    for (const s of diagnosisData.strategies) {
      const area = s.target_area ?? "general";
      const list = areaToStrategies.get(area) ?? [];
      list.push({ content: s.strategy_content, priority: s.priority ?? "low" });
      areaToStrategies.set(area, list);
    }

    // 영역 → target_area 매핑 (역방향)
    const competencyAreaToTargetAreas: Record<string, string[]> = {
      academic: ["setek", "personal_setek", "score", "reading"],
      career: ["career"],
      community: ["changche", "club", "autonomy", "haengteuk"],
    };

    // 체인 빌드: 약점 역량 기반
    const result: CausalChain[] = [];
    const usedWeaknesses = new Set<string>();

    for (const [code, info] of weakItems) {
      const guide = focusToGuide.get(code) ?? null;
      const targetAreas = competencyAreaToTargetAreas[info.area] ?? [];
      let strategy: { content: string; priority: string } | null = null;
      for (const ta of targetAreas) {
        const list = areaToStrategies.get(ta);
        if (list && list.length > 0) {
          strategy = list[0];
          break;
        }
      }

      result.push({
        diagnosis: { text: "", competencyLabel: info.label, grade: info.grade },
        design: guide,
        strategy,
      });
    }

    // 텍스트 약점 중 아직 매칭 안 된 것
    for (const w of weaknesses) {
      if (usedWeaknesses.has(w)) continue;
      if (result.length >= 6) break; // 최대 6개
      result.push({
        diagnosis: { text: w },
        design: null,
        strategy: null,
      });
    }

    return result.slice(0, 6);
  }, [diagnosisData, setekGuides]);

  if (chains.length === 0) return null;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={ArrowRightLeft} title="진단 → 설계 → 전략 연결" />
      <p className="mb-3 text-xs text-gray-500">
        진단에서 발견된 약점이 설계 방향과 실행 전략으로 어떻게 연결되는지 보여줍니다.
      </p>

      <div className="space-y-2">
        {/* 헤더 — 모바일에서 숨김 */}
        <div className="hidden items-center gap-1 text-xs font-semibold text-gray-500 md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <span className="px-2">진단 약점</span>
          <span />
          <span className="px-2">설계 방향</span>
          <span />
          <span className="px-2">실행 전략</span>
        </div>

        {/* 체인 행 — 모바일: 세로 스택 / md+: 5열 가로 */}
        {chains.map((chain, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 print-avoid-break md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch"
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

            {/* 화살표 — 모바일: ↓ / 데스크탑: → */}
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

            {/* 화살표 — 모바일: ↓ / 데스크탑: → */}
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
          </div>
        ))}
      </div>
    </section>
  );
}
