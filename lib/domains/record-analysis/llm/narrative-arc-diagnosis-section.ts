/**
 * 세특 서사 완성도(8단계) → 진단 프롬프트 섹션 빌더.
 *
 * `student_record_narrative_arc` 테이블에서 해당 학생의 모든 narrative_arc 행을 조회하여
 * 핵심 4단계(①호기심 ②주제 ③탐구 ⑤결론) 충족 현황을 마크다운 섹션으로 반환.
 *
 * 데이터 없거나 조회 실패 시 undefined 반환 → 호출부에서 graceful 생략.
 *
 * 사용처:
 *   - S3 진단 (`phase-s3-diagnosis.ts`) → `generateAiDiagnosis()` → `buildDiagnosisUserPrompt()`
 */

import type { PersistedNarrativeArc } from "@/lib/domains/student-record/repository/narrative-arc-repository";

// ── 핵심 4단계 정의 ──
const CORE_STAGES: Array<{ key: keyof PersistedNarrativeArc; label: string }> = [
  { key: "curiosity_present",       label: "①호기심" },
  { key: "topic_selection_present", label: "②주제" },
  { key: "inquiry_content_present", label: "③탐구" },
  { key: "conclusion_present",      label: "⑤결론" },
];

// ── 전체 8단계 정의 (누락 현황 상세 출력용) ──
const ALL_STAGES: Array<{ key: keyof PersistedNarrativeArc; label: string; isCore: boolean }> = [
  { key: "curiosity_present",          label: "①호기심",    isCore: true  },
  { key: "topic_selection_present",    label: "②주제",      isCore: true  },
  { key: "inquiry_content_present",    label: "③탐구",      isCore: true  },
  { key: "references_present",         label: "④참고문헌",  isCore: false },
  { key: "conclusion_present",         label: "⑤결론",      isCore: true  },
  { key: "teacher_observation_present",label: "⑥교사관찰",  isCore: false },
  { key: "growth_narrative_present",   label: "⑦성장서사",  isCore: false },
  { key: "reinquiry_present",          label: "⑧재탐구",    isCore: false },
];

/** 단일 레코드에서 누락된 핵심 단계 라벨 배열을 반환 */
function getMissingCoreStages(arc: PersistedNarrativeArc): string[] {
  return CORE_STAGES
    .filter(({ key }) => !arc[key])
    .map(({ label }) => label);
}

/**
 * narrative_arc 행 배열 → 마크다운 섹션 문자열.
 * 외부에서 미리 조회한 결과를 받아 순수 함수로 처리 (testable).
 *
 * 행이 0건이면 undefined 반환.
 */
export function buildNarrativeArcSection(
  arcs: PersistedNarrativeArc[],
): string | undefined {
  if (arcs.length === 0) return undefined;

  const total = arcs.length;

  // 핵심 4단계 모두 충족
  const fullyCoreArcs = arcs.filter((a) => getMissingCoreStages(a).length === 0);
  const fullyCount = fullyCoreArcs.length;
  const partialCount = total - fullyCount;
  const fullyPct = Math.round((fullyCount / total) * 100);

  // 누락이 있는 레코드를 누락 단계 수 내림차순 정렬 → 상위 5건
  const deficient = arcs
    .map((a) => ({ arc: a, missingCore: getMissingCoreStages(a) }))
    .filter(({ missingCore }) => missingCore.length > 0)
    .sort((a, b) => b.missingCore.length - a.missingCore.length)
    .slice(0, 5);

  const lines: string[] = [];
  lines.push("## 세특 서사 완성도 (8단계 분석)");
  lines.push("**8단계 중 ①호기심 ②주제 ③탐구 ⑤결론은 입시 평가의 핵심 단계입니다.**");
  lines.push("");

  lines.push("### 전체 통계");
  lines.push(`- 총 세특: ${total}건`);
  lines.push(`- 핵심 4단계 모두 충족: ${fullyCount}건 (${fullyPct}%)`);
  lines.push(`- 핵심 단계 1개 이상 누락: ${partialCount}건`);

  if (deficient.length > 0) {
    lines.push("");
    lines.push("### 핵심 단계 누락 사례 (상위 5건)");
    for (const { arc, missingCore } of deficient) {
      // 식별자: record_id 앞 8자 + record_type + 학년 정보
      const shortId = arc.record_id.slice(0, 8);
      const typeLabel = arc.record_type === "setek" ? "세특" : arc.record_type === "changche" ? "창체" : arc.record_type;
      const gradeLabel = `${arc.grade}학년`;
      const missingAll = ALL_STAGES
        .filter(({ key }) => !arc[key])
        .map(({ label }) => label);
      lines.push(`- [${typeLabel} ${gradeLabel} #${shortId}]: 누락 핵심 = ${missingCore.join(", ")} | 전체 누락 = ${missingAll.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("위 통계와 누락 패턴을 강점/약점 진단에 직접 반영하세요.");
  lines.push("- 핵심 4단계 충족률 70% 미만은 세특 품질의 구조적 결함으로 약점에 명시하세요.");
  lines.push("- ①호기심·②주제 누락이 많으면 탐구 동기 부재(P3 키워드만 패턴) 위험 신호입니다.");
  lines.push("- ⑤결론 누락이 많으면 탐구 완결성 부족(F2 인과단절 패턴) 위험 신호입니다.");

  return lines.join("\n");
}

/**
 * studentId + tenantId 기반으로 DB 조회 후 섹션 문자열 반환.
 * best-effort: 조회 실패 시 undefined 반환 → 진단 생성은 계속.
 *
 * `supabase` 클라이언트는 optional — 미제공 시 `createSupabaseServerClient()` 사용.
 * (pipeline 에서 adminClient 주입 시 전달 가능)
 */
export async function buildNarrativeArcDiagnosisSection(
  studentId: string,
  tenantId: string,
  supabase?: import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/database.types").Database>,
): Promise<string | undefined> {
  try {
    const { findNarrativeArcsByStudent } = await import(
      "@/lib/domains/student-record/repository/narrative-arc-repository"
    );
    const arcs = await findNarrativeArcsByStudent(studentId, tenantId, { source: "ai" }, supabase);
    return buildNarrativeArcSection(arcs);
  } catch {
    return undefined;
  }
}
