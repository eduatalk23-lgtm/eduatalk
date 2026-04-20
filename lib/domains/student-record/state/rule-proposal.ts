// ============================================
// α4 Proposal Engine — rule_v1 순수 함수 (Sprint 2, 2026-04-20)
//
// Perception signal × BlueprintGap axisGap → ProposalItem[] (3~5개)
//
// 설계:
//   1. Perception signals 와 gap.axisGaps 에서 후보 제안을 각각 수집
//   2. targetArea / roadmapArea / template 으로 결정적 매핑
//   3. 영역 다양성 가드: 같은 targetArea 4개 이상 금지 (F16 진로도배 방지)
//   4. 우선순위: severity 가중치(3) + gap 가중치(2) + freshness(signal/gap 순서)
//   5. 최대 5개 반환. 후보 0개면 빈 배열
//
// 원칙:
//   - 순수 함수 / I/O 없음 / LLM 호출 없음
//   - 실패 없음 (모든 조합 처리). 빈 배열 반환 가능
//   - rationale 은 signal.detail 또는 axisGap.rationale 을 기본 근거로 사용
// ============================================

import type {
  AxisGap,
  BlueprintGap,
} from "../types/blueprint-gap";
import type { StudentState, StudentStateDiff } from "../types/student-state";
import type {
  PerceptionTriggerResult,
  TriggerSignal,
  TriggerSeverity,
} from "./perception-trigger";
import type {
  ExpectedAxisMovement,
  ExpectedImpact,
  ProposalHorizon,
  ProposalItem,
} from "../types/proposal";
import type {
  CompetencyArea,
  CompetencyGrade,
  CompetencyItemCode,
  RoadmapArea,
} from "../types/enums";

// ─── 입력 / 출력 ─────────────────────────────────────────────

export interface RuleProposalInput {
  readonly diff: StudentStateDiff;
  readonly trigger: PerceptionTriggerResult;
  readonly state: StudentState;
  readonly gap: BlueprintGap | null;
  /** asOf 기준 잔여 학기. gap 이 있으면 gap.remainingSemesters 를 우선. */
  readonly remainingSemesters: number;
}

// ─── 내부: axis / area / roadmap 매핑 테이블 ────────────────

const CODE_KO: Record<CompetencyItemCode, string> = {
  academic_achievement: "학업성취도",
  academic_attitude: "학업태도",
  academic_inquiry: "탐구력",
  career_course_effort: "진로교과 이수노력",
  career_course_achievement: "진로교과 성취도",
  career_exploration: "진로탐색",
  community_collaboration: "협업/소통",
  community_caring: "나눔/배려",
  community_integrity: "성실/규칙준수",
  community_leadership: "리더십",
};

const AREA_OF_CODE: Record<CompetencyItemCode, CompetencyArea> = {
  academic_achievement: "academic",
  academic_attitude: "academic",
  academic_inquiry: "academic",
  career_course_effort: "career",
  career_course_achievement: "career",
  career_exploration: "career",
  community_collaboration: "community",
  community_caring: "community",
  community_integrity: "community",
  community_leadership: "community",
};

/** 축 기본 RoadmapArea (rule_v1 템플릿 선택의 기본값). */
const CODE_TO_DEFAULT_ROADMAP: Record<CompetencyItemCode, RoadmapArea> = {
  academic_achievement: "setek",
  academic_attitude: "setek",
  academic_inquiry: "reading",
  career_course_effort: "setek",
  career_course_achievement: "setek",
  career_exploration: "career",
  community_collaboration: "club",
  community_caring: "volunteer",
  community_integrity: "general",
  community_leadership: "autonomy",
};

const GRADE_ORDER: CompetencyGrade[] = ["C", "B-", "B", "B+", "A-", "A+"];

function nextGradeUp(g: CompetencyGrade | null): CompetencyGrade {
  if (g === null) return "B"; // 측정 없음 → 중간 진입점
  const idx = GRADE_ORDER.indexOf(g);
  return idx >= 0 && idx < GRADE_ORDER.length - 1 ? GRADE_ORDER[idx + 1] : g;
}

// ─── 내부: 후보 ProposalItem (rank 부여 전) ─────────────────

interface RuleCandidate {
  readonly name: string;
  readonly summary: string;
  readonly targetArea: CompetencyArea;
  readonly targetAxes: readonly CompetencyItemCode[];
  readonly roadmapArea: RoadmapArea;
  readonly horizon: ProposalHorizon;
  readonly rationale: string;
  readonly expectedImpact: ExpectedImpact;
  readonly prerequisite: readonly string[];
  readonly risks: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly priority: number;
  /** 같은 axis 중복 합치기용 그룹 키 */
  readonly groupKey: string;
}

// ─── 내부: severity / gap priority 숫자 가중치 ────────────────

function severityWeight(s: TriggerSeverity): number {
  return s === "high" ? 3 : s === "medium" ? 2 : s === "low" ? 1 : 0;
}

function gapPriorityWeight(p: "high" | "medium" | "low" | null | undefined): number {
  return p === "high" ? 3 : p === "medium" ? 2 : p === "low" ? 1 : 0;
}

function horizonFromRemaining(remaining: number): ProposalHorizon {
  if (remaining <= 1) return "immediate";
  if (remaining <= 2) return "this_semester";
  if (remaining <= 4) return "next_semester";
  return "long_term";
}

function roadmapAreaForTarget(
  area: CompetencyArea,
  axis?: CompetencyItemCode,
): RoadmapArea {
  if (axis) return CODE_TO_DEFAULT_ROADMAP[axis];
  return area === "academic" ? "setek" : area === "career" ? "career" : "club";
}

function axisMovementFromState(
  state: StudentState,
  code: CompetencyItemCode,
): ExpectedAxisMovement {
  const current =
    state.competencies?.axes.find((a) => a.code === code)?.grade ?? null;
  return { code, fromGrade: current, toGrade: nextGradeUp(current) };
}

// ─── 후보 수집 1: Perception signals ────────────────────────

function candidatesFromSignals(
  signals: readonly TriggerSignal[],
  diff: StudentStateDiff,
  state: StudentState,
  severity: TriggerSeverity,
  remaining: number,
): RuleCandidate[] {
  const base = severityWeight(severity);
  const sevW = (s: TriggerSignal): number =>
    base + (s.weight === "high" ? 3 : s.weight === "medium" ? 2 : 1);
  const horizon = horizonFromRemaining(remaining);
  const out: RuleCandidate[] = [];

  for (const [i, sig] of signals.entries()) {
    const freshness = Math.max(0, signals.length - i) * 0.01; // 미세 정렬용
    switch (sig.kind) {
      case "stale_blueprint":
        out.push({
          name: "청사진 재수립 세션 예약",
          summary:
            "이전 blueprint 이후 학생 상태가 변화했습니다. 목표 재정렬을 위한 재수립이 필요합니다.",
          targetArea: "career",
          targetAxes: ["career_exploration"],
          roadmapArea: "career",
          horizon: "immediate",
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [],
          },
          prerequisite: ["현 blueprint 검토", "컨설턴트/담임 일정 조율"],
          risks: ["기존 tier_plan 과 충돌 — S7 tier_plan_refinement 선행 권장"],
          evidenceRefs: ["signal:stale_blueprint"],
          priority: sevW(sig) + 10 + freshness,
          groupKey: "sig:stale_blueprint",
        });
        break;

      case "hakjong_delta": {
        const down = (diff.hakjongScoreDelta ?? 0) < 0;
        const targetCode: CompetencyItemCode = down
          ? "academic_inquiry"
          : "career_exploration";
        out.push({
          name: down
            ? "Reward 하락 원인 진단 + 약한 영역 보강"
            : "Reward 상승 모멘텀 유지 활동",
          summary: down
            ? "학종 Reward 하락의 주 원인을 찾고 가장 약한 축부터 보강합니다."
            : "Reward 상승 배경이 된 활동 패턴을 연속성 있게 확장합니다.",
          targetArea: down ? "academic" : "career",
          targetAxes: [targetCode],
          roadmapArea: down ? "setek" : "career",
          horizon,
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: down ? null : 1,
            axisMovements: [axisMovementFromState(state, targetCode)],
          },
          prerequisite: down ? ["직전 snapshot 대비 축 단위 비교"] : [],
          risks: down ? [] : ["F16 진로도배 — 동일 과목군 편중 금지"],
          evidenceRefs: ["signal:hakjong_delta"],
          priority: sevW(sig) + 6 + freshness,
          groupKey: "sig:hakjong_delta",
        });
        break;
      }

      case "competency_change": {
        const firstChange = diff.competencyChanges[0];
        const code = firstChange?.code ?? "academic_inquiry";
        const area = AREA_OF_CODE[code];
        out.push({
          name: `${CODE_KO[code]} 루브릭 보강 탐구`,
          summary: `${CODE_KO[code]} 축 변화에 맞춰 루브릭 step 승급 활동을 설계합니다.`,
          targetArea: area,
          targetAxes: [code],
          roadmapArea: CODE_TO_DEFAULT_ROADMAP[code],
          horizon,
          rationale: `역량 변화 — ${sig.detail}`,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [axisMovementFromState(state, code)],
          },
          prerequisite: [`${CODE_KO[code]} 루브릭 4개 질문 재검토`],
          risks: [],
          evidenceRefs: ["signal:competency_change", `axis:${code}`],
          priority: sevW(sig) + 4 + freshness,
          groupKey: `sig:competency:${code}`,
        });
        break;
      }

      case "new_records":
        out.push({
          name: "신규 기록 반영 프로필 카드 업데이트",
          summary: "새로 추가된 기록을 반영해 누적 프로필 카드를 재생성합니다.",
          targetArea: "career",
          targetAxes: ["career_exploration"],
          roadmapArea: "setek",
          horizon: "immediate",
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [],
          },
          prerequisite: ["H2 profile_card 재빌드 또는 파이프라인 재실행"],
          risks: [],
          evidenceRefs: ["signal:new_records"],
          priority: sevW(sig) + 3 + freshness,
          groupKey: "sig:new_records",
        });
        break;

      case "volunteer_hours":
        out.push({
          name: "봉사 연속성 확보 — 월 1회 고정 활동",
          summary:
            "최근 봉사 시간이 누적된 주제를 월 1회 고정 스케줄로 전환해 일관성을 확보합니다.",
          targetArea: "community",
          targetAxes: ["community_caring"],
          roadmapArea: "volunteer",
          horizon,
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [axisMovementFromState(state, "community_caring")],
          },
          prerequisite: ["최근 봉사 주제·기관 정리"],
          risks: [],
          evidenceRefs: ["signal:volunteer_hours"],
          priority: sevW(sig) + 4 + freshness,
          groupKey: "sig:volunteer",
        });
        break;

      case "awards":
        out.push({
          name: "수상 활동 세특 연계 지정",
          summary:
            "수상 활동을 관련 교과 세특의 근거로 연결해 학업·진로·공동체역량 증빙을 강화합니다.",
          targetArea: "community",
          targetAxes: ["community_leadership", "career_exploration"],
          roadmapArea: "competition",
          horizon,
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [
              axisMovementFromState(state, "community_leadership"),
            ],
          },
          prerequisite: ["수상 기록 recordId 확인", "관련 교과 세특 검토"],
          risks: [],
          evidenceRefs: ["signal:awards"],
          priority: sevW(sig) + 4 + freshness,
          groupKey: "sig:awards",
        });
        break;

      case "integrity":
        out.push({
          name: "출결 무결점 회복 플랜",
          summary:
            "출결 변화가 감지되었습니다. 담임 면담 기반 회복 플랜을 즉시 수립합니다.",
          targetArea: "community",
          targetAxes: ["community_integrity"],
          roadmapArea: "general",
          horizon: "immediate",
          rationale: sig.detail,
          expectedImpact: {
            hakjongScoreDelta: null,
            axisMovements: [axisMovementFromState(state, "community_integrity")],
          },
          prerequisite: ["담임 상담 예약"],
          risks: [],
          evidenceRefs: ["signal:integrity"],
          priority: sevW(sig) + 5 + freshness,
          groupKey: "sig:integrity",
        });
        break;
    }
  }

  return out;
}

// ─── 후보 수집 2: BlueprintGap axisGaps ─────────────────────

function candidatesFromGap(
  gap: BlueprintGap,
  state: StudentState,
  remaining: number,
): RuleCandidate[] {
  const gapW = gapPriorityWeight(gap.priority);
  const horizon = horizonFromRemaining(remaining);
  const out: RuleCandidate[] = [];

  // axisGaps 는 이미 gap priority 순서대로 있다고 가정하지 않음 — 절대값 크기 재정렬
  const sorted = [...gap.axisGaps].sort(
    (a, b) => Math.abs(b.gapSize) - Math.abs(a.gapSize),
  );

  for (const [i, ag] of sorted.entries()) {
    const area = ag.area ?? AREA_OF_CODE[ag.code];
    const freshness = (sorted.length - i) * 0.01;

    let name: string;
    let summary: string;
    switch (ag.pattern) {
      case "insufficient":
        name = `${CODE_KO[ag.code]} 루브릭 step 승급 활동`;
        summary = `${CODE_KO[ag.code]} 축 ${ag.currentGrade ?? "—"} → ${ag.targetGrade ?? "—"} 격차를 좁히는 활동을 설계합니다.`;
        break;
      case "latent":
        name = `${CODE_KO[ag.code]} 신규 활성화 — 잔여 학기 활용`;
        summary = `${CODE_KO[ag.code]} 축이 미측정입니다. 잔여 ${gap.remainingSemesters}학기 내 활성화 가능한 진입 활동입니다.`;
        break;
      case "mismatch":
        name = `${CODE_KO[ag.code]} 설계 → 실측 기록 생성`;
        summary = `${CODE_KO[ag.code]} 축이 설계(ai_projected) 만 존재합니다. 실측 기록이 되는 탐구를 1건 생성합니다.`;
        break;
      case "excess":
        name = `${CODE_KO[ag.code]} 과잉 — 에너지 재분배`;
        summary = `${CODE_KO[ag.code]} 축이 목표보다 높습니다. 부족 영역으로 에너지 재분배를 검토합니다.`;
        break;
    }

    const candidate: RuleCandidate = {
      name,
      summary,
      targetArea: area,
      targetAxes: [ag.code],
      roadmapArea: CODE_TO_DEFAULT_ROADMAP[ag.code],
      horizon: ag.pattern === "latent" ? "long_term" : horizon,
      rationale: ag.rationale,
      expectedImpact: {
        hakjongScoreDelta: null,
        axisMovements:
          ag.pattern === "excess"
            ? []
            : [
                {
                  code: ag.code,
                  fromGrade: ag.currentGrade,
                  toGrade: ag.targetGrade ?? nextGradeUp(ag.currentGrade),
                },
              ],
      },
      prerequisite:
        ag.pattern === "latent"
          ? [`${CODE_KO[ag.code]} 진입 활동 브레인스토밍`]
          : [],
      risks:
        area === "career" && ag.pattern === "insufficient"
          ? ["F16 진로도배 방지 — 비진로교과 연결 금지"]
          : [],
      evidenceRefs: [`gap:${ag.code}:${ag.pattern}`],
      priority:
        gapW * 2 + Math.min(3, Math.abs(ag.gapSize)) + freshness,
      groupKey: `gap:${ag.code}`,
    };

    out.push(candidate);
  }

  return out;
}

// ─── 그룹 병합 + 다양성 가드 + rank 부여 ────────────────────

function mergeAndRank(
  candidates: RuleCandidate[],
  maxItems: number,
): ProposalItem[] {
  // 1) groupKey 기준 최고 우선순위만 남기고 병합
  const byGroup = new Map<string, RuleCandidate>();
  for (const c of candidates) {
    const cur = byGroup.get(c.groupKey);
    if (!cur || c.priority > cur.priority) byGroup.set(c.groupKey, c);
  }

  // 2) axis 단위 병합: signal 의 competency_change 와 gap 의 동일 axis 후보는 gap 우선
  //    (gap 이 더 구체적 rationale 을 제공)
  const axisDedup = new Map<string, RuleCandidate>();
  const nonAxis: RuleCandidate[] = [];
  for (const c of byGroup.values()) {
    const singleAxis = c.targetAxes.length === 1 ? c.targetAxes[0] : null;
    if (!singleAxis) {
      nonAxis.push(c);
      continue;
    }
    const key = `axis:${singleAxis}`;
    const cur = axisDedup.get(key);
    if (!cur || c.priority > cur.priority) axisDedup.set(key, c);
  }

  const pool = [...nonAxis, ...axisDedup.values()].sort(
    (a, b) => b.priority - a.priority,
  );

  // 3) 영역 다양성 가드 (F16): 같은 targetArea 4개 이상 금지
  const picked: RuleCandidate[] = [];
  const areaCount: Record<CompetencyArea, number> = {
    academic: 0,
    career: 0,
    community: 0,
  };
  for (const c of pool) {
    if (picked.length >= maxItems) break;
    if (areaCount[c.targetArea] >= 3) continue; // 최대 3개/영역
    picked.push(c);
    areaCount[c.targetArea] += 1;
  }

  // 4) rank 부여 (1~5)
  return picked.map((c, idx) => ({
    rank: (idx + 1) as 1 | 2 | 3 | 4 | 5,
    name: c.name,
    summary: c.summary,
    targetArea: c.targetArea,
    targetAxes: c.targetAxes,
    roadmapArea: c.roadmapArea,
    horizon: c.horizon,
    rationale: c.rationale,
    expectedImpact: c.expectedImpact,
    prerequisite: c.prerequisite,
    risks: c.risks,
    evidenceRefs: c.evidenceRefs,
  }));
}

// ─── 공개 API ─────────────────────────────────────────────

/**
 * Perception + Gap + State → 최대 5개 ProposalItem[] 를 결정적으로 생성.
 *
 * 실패 없음. 후보 0개면 빈 배열 반환 — 호출자는 status='skipped' 로 기록 권장.
 *
 * 영역 다양성 가드: 같은 targetArea 최대 3개 (F16 진로도배 방지).
 */
export function buildRuleProposal(
  input: RuleProposalInput,
  options?: { readonly maxItems?: 3 | 4 | 5 },
): ProposalItem[] {
  const maxItems = options?.maxItems ?? 5;
  const { diff, trigger, state, gap, remainingSemesters: remaining } = input;

  const sig = candidatesFromSignals(
    trigger.signals,
    diff,
    state,
    trigger.severity,
    remaining,
  );
  const gp = gap ? candidatesFromGap(gap, state, remaining) : [];

  const merged = mergeAndRank([...sig, ...gp], maxItems);
  return merged;
}
