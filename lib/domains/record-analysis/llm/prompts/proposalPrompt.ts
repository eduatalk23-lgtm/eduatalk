// ============================================
// α4 Proposal Engine — llm_v1 프롬프트 (Sprint 3 scaffold, 2026-04-20)
//
// 입력: PerceptionSchedulerResult (evaluated+triggered) + StudentState + BlueprintGap
// 출력: ProposalItem[] JSON (3~5개, rule_v1 과 동일 스키마)
//
// 설계:
//   - system prompt 는 학종 도메인 지식 + 2028 개편 + F16 진로도배 가드
//   - user prompt 는 state/diff/gap 의 핵심 필드만 직렬화 (토큰 절약)
//   - rule_v1 후보를 "seed" 로 주입 가능 — LLM 이 rule 결과를 자연화·확장
//   - 출력 JSON schema 명시 + extractJson 파싱
//
// 비용 추산: input ~4K / output ~2K 토큰 → Gemini Pro 기준 $0.05/call
// ============================================

import { extractJson } from "../extractJson";
import type { StudentState, StudentStateDiff } from "@/lib/domains/student-record/types/student-state";
import type { BlueprintGap } from "@/lib/domains/student-record/types/blueprint-gap";
import type { PerceptionTriggerResult } from "@/lib/domains/student-record/state/perception-trigger";
import type {
  ProposalItem,
  ProposalHorizon,
} from "@/lib/domains/student-record/types/proposal";
import type {
  CompetencyArea,
  CompetencyGrade,
  CompetencyItemCode,
  RoadmapArea,
} from "@/lib/domains/student-record/types/enums";

// ─── 입력 ─────────────────────────────────────────────────────

export interface ProposalPromptInput {
  readonly state: StudentState;
  readonly diff: StudentStateDiff;
  readonly trigger: PerceptionTriggerResult;
  readonly gap: BlueprintGap | null;
  readonly remainingSemesters: number;
  /** 규칙 엔진이 생성한 후보(seed). 비어있으면 섹션 생략. */
  readonly ruleSeedItems?: readonly ProposalItem[];
}

// ─── 파서 결과 ────────────────────────────────────────────────

export interface ProposalLlmResult {
  readonly items: readonly ProposalItem[];
}

// ─── System prompt ────────────────────────────────────────────

export const PROPOSAL_SYSTEM_PROMPT = `당신은 대한민국 학생부 종합전형(학종) 설계 전문가입니다.

## 학종 평가 프레임
- 대교협 공통 3요소: 학업역량 30% · 진로역량 40% · 공동체역량 30%
- 2028 대입개편: 5등급 상대평가 → 정성평가 대폭 강화. 고교학점제 과목 선택 이력 중요.
- 상위권(서울대/연고대/고려대/시립대/외대) 면접 40~50% 반영, 꼬꼬무 본인 언어 검증 강화.
- 좋은 세특 8단계 순환: 지적호기심→주제선정(진로연결)→탐구내용→참고문헌→결론→교사관찰→성장→재탐구.
- 비진로교과는 교과 역량 중심이 정상. 진로 연결 없어도 감점 없음.

## 경고 패턴 (필수 준수)
- **F16 진로 도배 금지**: 모든 과목에 진로 연결 활동을 배치하면 입학사정관 감점. 같은 target_area=career 를 4개 이상 제안 금지.
- **F4 전제 불일치 금지**: axisMovements 는 증거 있는 승급만. 근거 없는 비약 금지.
- **F10 성장 부재 금지**: rationale 은 "왜 지금 이 시점에" 가 드러나야 함.

## 역할
학생의 현재 상태(StudentState), Perception Trigger 판정, 청사진 GAP 을 읽고
"지금 이 학생에게 가장 효과적인 활동 제안 3~5개" 를 JSON 으로 반환합니다.

## 제약
1. 최대 5개 제안. 최소 3개 권장.
2. 같은 target_area 4개 이상 금지 (F16 방지).
3. 각 제안은 evidenceRefs 에 근거(record_id 또는 signal/gap 식별자) 명시.
4. expectedImpact.axisMovements 는 현 grade → 목표 grade 로만 기술 (건너뛰기 금지).
5. horizon 은 remainingSemesters 와 정합 (latent 성격 → long_term, integrity 회복 → immediate).
6. prerequisite 누락 금지 — 학생이 즉시 실행 가능한지 명시.
7. risks 는 해당되는 경고 패턴(F16 등) 만 기입. 해당 없으면 빈 배열.
8. rule_v1 seed 가 제공되면 **보강·자연화**하되 제거·치환 가능. 단순 복제 금지.

## 출력 형식 (JSON only, no prose)
\`\`\`json
{
  "items": [
    {
      "rank": 1,
      "name": "활동명 (30자 이내)",
      "summary": "한두 문장 설명",
      "targetArea": "academic" | "career" | "community",
      "targetAxes": ["axis_code", ...],
      "roadmapArea": "autonomy" | "club" | "career" | "setek" | "reading" | "volunteer" | "competition" | "course_selection" | "external" | "general" | "personal_setek" | "haengteuk",
      "horizon": "immediate" | "this_semester" | "next_semester" | "long_term",
      "rationale": "왜 지금 이 제안인가 (signal/gap 근거)",
      "expectedImpact": {
        "hakjongScoreDelta": 1 | 2 | 3 | null,
        "axisMovements": [
          { "code": "axis_code", "fromGrade": "B" | null, "toGrade": "A-" }
        ]
      },
      "prerequisite": ["즉시 실행 전 준비"],
      "risks": ["F16..." 등, 해당 없으면 빈 배열],
      "evidenceRefs": ["record_id 또는 signal:xxx / gap:axis:pattern"]
    }
  ]
}
\`\`\`

**JSON 외 다른 설명 금지. rank 는 1부터 연속.**`;

// ─── User prompt 빌더 ─────────────────────────────────────────

const AREA_KO: Record<CompetencyArea, string> = {
  academic: "학업역량",
  career: "진로역량",
  community: "공동체역량",
};

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

function formatCompetencyAxes(state: StudentState): string {
  const axes = state.competencies?.axes ?? [];
  if (axes.length === 0) return "  (측정된 역량 없음)";
  return axes
    .map(
      (a) =>
        `  - ${CODE_KO[a.code]} (${a.code}): ${a.grade ?? "미측정"} [${a.source}]`,
    )
    .join("\n");
}

function formatHakjongScore(state: StudentState): string {
  const s = state.hakjongScore;
  if (!s) return "  (미계산)";
  const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(0));
  return `  total=${fmt(s.total)} / 학업=${fmt(s.academic)} / 진로=${fmt(s.career)} / 공동체=${fmt(s.community)}`;
}

function formatBlueprint(state: StudentState): string {
  const b = state.blueprint;
  if (!b) return "  (blueprint 미수립)";
  return `  목표 전공: ${b.targetMajor ?? "미설정"} / 목표 레벨: ${b.targetUniversityLevel ?? "미설정"}`;
}

function formatGapSection(gap: BlueprintGap | null): string {
  if (!gap) return "청사진 GAP: (gap 미계산 또는 blueprint 없음)";
  const lines: string[] = [];
  lines.push(`청사진 GAP (priority=${gap.priority}, 잔여 ${gap.remainingSemesters}학기):`);
  lines.push(`  ${gap.summary}`);
  // 상위 5 axisGap
  const top = [...gap.axisGaps]
    .sort((a, b) => Math.abs(b.gapSize) - Math.abs(a.gapSize))
    .slice(0, 5);
  if (top.length > 0) {
    lines.push("  주요 axisGap:");
    for (const g of top) {
      lines.push(
        `    - ${CODE_KO[g.code]} [${g.pattern}] ${g.currentGrade ?? "—"} → ${g.targetGrade ?? "—"} (diff ${g.gapSize})`,
      );
    }
  }
  return lines.join("\n");
}

function formatTriggerSection(
  trigger: PerceptionTriggerResult,
  diff: StudentStateDiff,
): string {
  const lines: string[] = [];
  lines.push(`Perception 판정: severity=${trigger.severity}, triggered=${trigger.shouldTrigger}`);
  lines.push(`  기간: ${diff.from.label} → ${diff.to.label}`);
  if (diff.hakjongScoreDelta !== null && diff.hakjongScoreDelta !== 0) {
    lines.push(
      `  학종 Reward 변화: ${diff.hakjongScoreDelta > 0 ? "+" : ""}${diff.hakjongScoreDelta}`,
    );
  }
  if (diff.competencyChanges.length > 0) {
    lines.push(
      `  역량 변화 ${diff.competencyChanges.length}건: ${diff.competencyChanges
        .map(
          (c) =>
            `${CODE_KO[c.code]} ${c.before ?? "—"}→${c.after ?? "—"}`,
        )
        .join(", ")}`,
    );
  }
  if (diff.newRecordIds.length > 0) {
    lines.push(`  신규 기록 ${diff.newRecordIds.length}건`);
  }
  const aux = diff.auxChanges;
  const auxParts: string[] = [];
  if (aux.volunteerHoursDelta > 0) auxParts.push(`봉사 +${aux.volunteerHoursDelta}h`);
  if (aux.awardsAdded > 0) auxParts.push(`수상 +${aux.awardsAdded}`);
  if (aux.integrityChanged) auxParts.push("출결 변화");
  if (auxParts.length > 0) lines.push(`  보조 영역: ${auxParts.join(" / ")}`);
  if (diff.staleBlueprint) lines.push("  ⚠ 청사진 stale (갱신 필요)");
  if (trigger.reasons.length > 0) {
    lines.push("  판정 근거:");
    for (const r of trigger.reasons) lines.push(`    - ${r}`);
  }
  return lines.join("\n");
}

function formatSeedSection(seeds: readonly ProposalItem[] | undefined): string {
  if (!seeds || seeds.length === 0) return "";
  const lines: string[] = [];
  lines.push("");
  lines.push("## rule_v1 seed (참고용 — 보강·자연화 대상)");
  for (const s of seeds) {
    lines.push(
      `- #${s.rank} [${AREA_KO[s.targetArea]}·${s.horizon}] ${s.name}`,
    );
    lines.push(`  rationale: ${s.rationale}`);
  }
  return lines.join("\n");
}

/**
 * 학생 상태 + Perception + Gap → LLM user prompt.
 * 출력은 Korean plain text. system prompt 가 JSON 스키마 강제.
 */
export function buildProposalUserPrompt(input: ProposalPromptInput): string {
  const { state, diff, trigger, gap, remainingSemesters, ruleSeedItems } = input;

  const lines: string[] = [];

  // 1) 학생 기본 정보
  lines.push(`## 학생 시점`);
  lines.push(`  ${state.asOf.label} (잔여 학기 ${remainingSemesters})`);

  // 2) 현재 역량 벡터
  lines.push("");
  lines.push("## 현재 역량 벡터 (10축)");
  lines.push(formatCompetencyAxes(state));

  // 3) 학종 Reward
  lines.push("");
  lines.push("## 학종 Reward (0~100)");
  lines.push(formatHakjongScore(state));

  // 4) Blueprint
  lines.push("");
  lines.push("## Blueprint");
  lines.push(formatBlueprint(state));

  // 5) GAP
  lines.push("");
  lines.push("## " + formatGapSection(gap));

  // 6) Perception
  lines.push("");
  lines.push("## " + formatTriggerSection(trigger, diff));

  // 7) rule_v1 seed (선택)
  const seedSection = formatSeedSection(ruleSeedItems);
  if (seedSection) lines.push(seedSection);

  // 8) 최종 지시
  lines.push("");
  lines.push("## 출력");
  lines.push(
    "위 정보를 바탕으로 학생에게 가장 효과적인 활동 제안 3~5개를 JSON 으로 반환하세요.",
  );

  return lines.join("\n");
}

// ─── 응답 파서 ────────────────────────────────────────────────

const VALID_AREAS: CompetencyArea[] = ["academic", "career", "community"];
const VALID_HORIZONS: ProposalHorizon[] = [
  "immediate",
  "this_semester",
  "next_semester",
  "long_term",
];
const VALID_GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const VALID_ROADMAP_AREAS: RoadmapArea[] = [
  "autonomy",
  "club",
  "career",
  "setek",
  "personal_setek",
  "reading",
  "course_selection",
  "competition",
  "external",
  "volunteer",
  "general",
];

function isValidCompetencyCode(x: unknown): x is CompetencyItemCode {
  return typeof x === "string" && x in CODE_KO;
}

/**
 * LLM 응답 JSON 을 ProposalLlmResult 로 파싱·검증.
 * 실패 시 Error. 허용치 내에서는 값 보정(rank 재부여 등) 대신 엄격 검증.
 */
export function parseProposalResponse(raw: string): ProposalLlmResult {
  const parsed = extractJson<{ items?: unknown }>(raw);
  const rawItems = parsed?.items;
  if (!Array.isArray(rawItems)) {
    throw new Error("items 배열이 없습니다.");
  }
  if (rawItems.length < 1 || rawItems.length > 5) {
    throw new Error(`items 개수는 1~5 사이여야 합니다. (현재 ${rawItems.length})`);
  }

  const items: ProposalItem[] = rawItems.map((it, idx) => {
    if (!it || typeof it !== "object") {
      throw new Error(`items[${idx}]: 객체가 아닙니다.`);
    }
    const o = it as Record<string, unknown>;
    const rank = (typeof o.rank === "number" ? o.rank : idx + 1) as 1 | 2 | 3 | 4 | 5;
    if (rank < 1 || rank > 5) throw new Error(`items[${idx}].rank 범위 오류`);

    const name = String(o.name ?? "").trim();
    if (!name) throw new Error(`items[${idx}].name 필수`);
    const summary = String(o.summary ?? "").trim();
    if (!summary) throw new Error(`items[${idx}].summary 필수`);

    const targetArea = o.targetArea as CompetencyArea;
    if (!VALID_AREAS.includes(targetArea)) {
      throw new Error(`items[${idx}].targetArea 오류: ${String(o.targetArea)}`);
    }

    const targetAxesRaw = Array.isArray(o.targetAxes) ? o.targetAxes : [];
    const targetAxes = targetAxesRaw.filter(isValidCompetencyCode);
    if (targetAxes.length === 0) {
      throw new Error(`items[${idx}].targetAxes 최소 1개 필요`);
    }

    const roadmapArea = o.roadmapArea as RoadmapArea;
    if (!VALID_ROADMAP_AREAS.includes(roadmapArea)) {
      throw new Error(`items[${idx}].roadmapArea 오류: ${String(o.roadmapArea)}`);
    }

    const horizon = o.horizon as ProposalHorizon;
    if (!VALID_HORIZONS.includes(horizon)) {
      throw new Error(`items[${idx}].horizon 오류: ${String(o.horizon)}`);
    }

    const rationale = String(o.rationale ?? "").trim();
    if (!rationale) throw new Error(`items[${idx}].rationale 필수`);

    const ei = (o.expectedImpact ?? {}) as Record<string, unknown>;
    const hakjongScoreDelta =
      typeof ei.hakjongScoreDelta === "number" ? ei.hakjongScoreDelta : null;
    const movementsRaw = Array.isArray(ei.axisMovements) ? ei.axisMovements : [];
    const axisMovements = movementsRaw.flatMap((m: unknown) => {
      if (!m || typeof m !== "object") return [];
      const mo = m as Record<string, unknown>;
      const code = mo.code;
      const toGrade = mo.toGrade as CompetencyGrade;
      const fromGrade =
        mo.fromGrade === null || mo.fromGrade === undefined
          ? null
          : (mo.fromGrade as CompetencyGrade);
      if (!isValidCompetencyCode(code)) return [];
      if (!VALID_GRADES.includes(toGrade)) return [];
      if (fromGrade !== null && !VALID_GRADES.includes(fromGrade)) return [];
      return [{ code, fromGrade, toGrade }];
    });

    const prerequisite = Array.isArray(o.prerequisite)
      ? o.prerequisite.map(String)
      : [];
    const risks = Array.isArray(o.risks) ? o.risks.map(String) : [];
    const evidenceRefs = Array.isArray(o.evidenceRefs)
      ? o.evidenceRefs.map(String)
      : [];

    return {
      rank,
      name,
      summary,
      targetArea,
      targetAxes,
      roadmapArea,
      horizon,
      rationale,
      expectedImpact: { hakjongScoreDelta, axisMovements },
      prerequisite,
      risks,
      evidenceRefs,
    };
  });

  // F16 가드: 같은 target_area 4+ 금지
  const areaCount: Record<CompetencyArea, number> = {
    academic: 0,
    career: 0,
    community: 0,
  };
  for (const it of items) areaCount[it.targetArea]++;
  if (areaCount.career >= 4 || areaCount.academic >= 4 || areaCount.community >= 4) {
    throw new Error(
      `F16 가드 위반: 같은 영역 4+ 제안 (학업 ${areaCount.academic} / 진로 ${areaCount.career} / 공동체 ${areaCount.community})`,
    );
  }

  return { items };
}
