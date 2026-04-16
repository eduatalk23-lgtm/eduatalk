// ============================================
// Blueprint Phase — 진로→3년 수렴 설계 프롬프트
//
// top-down 방향: WHO(진로 정체성) + SEED(메인 탐구 tier_plan)
//   → 학년별 타겟 수렴(blueprint 하이퍼엣지) + 서사 골격 + 역량 타겟
//
// 소비자: llm/actions/generateBlueprint.ts
// 참조: blueprint/types.ts
// ============================================

import { extractJson } from "../extractJson";
import type {
  BlueprintPhaseInput,
  BlueprintPhaseOutput,
  BlueprintConvergence,
  BlueprintMilestone,
  CompetencyGrowthTarget,
  BlueprintStorylineSkeleton,
} from "../../blueprint/types";

// ============================================
// SYSTEM PROMPT
// ============================================

export const BLUEPRINT_SYSTEM_PROMPT = `당신은 대학입시 컨설턴트의 내부 분석 도우미입니다.

## 문서 성격

이 문서는 "3년 수렴 설계 청사진(Blueprint)"입니다.
- 한국 고등학교(3년제) 학생의 진로 정체성으로부터 역산하여
  3년간 어떤 교과 활동이 어떤 탐구 주제로 수렴해야 하는지를 설계합니다.
- top-down 방향: 목표 → 3년 서사 골격 → 학년별 수렴 → 과목별 활동.
- 컨설턴트 내부 문서이므로 전문 용어를 자유롭게 사용합니다.

## 핵심 개념: "수렴(Convergence)"

수렴이란 여러 활동(세특, 창체, 독서 등)이 하나의 탐구 주제로 모이는 것입니다.
입학사정관은 "흩어진 활동이 하나의 정체성으로 수렴하는 서사"를 높이 평가합니다.

좋은 수렴의 조건:
- 3개 이상의 활동이 참여 (세특 + 독서 + 동아리 등 다양한 유형)
- 공통 역량을 강화 (예: 탐구설계, 진로역량, 학업수행능력)
- 학년 간 심화·발전 (나선형: 기초→심화→통합)
- anchor(핵심 진로교과 세특) + support(보조 활동) + evidence(근거 자료) 역할 분담

## 규칙

1. 학생의 현재 학년부터 3학년까지의 수렴을 설계합니다. 지난 학년은 제외합니다.
2. 설계 대상 학년(remainingGrades) 모두에 최소 2개 이상의 수렴을 설계합니다. 0개 학년은 불허하며, 특정 학년만 채우고 다른 학년을 비우는 편향을 금지합니다. 권장 분포: 학년당 2-4개.
3. 각 수렴에는 3-5개 멤버(활동)를 배치합니다.
4. anchor 멤버는 반드시 진로 교과 세특이어야 합니다.
5. 메인 탐구의 tier_plan이 주어지면 이를 존중합니다:
   - foundational → 1학년 수렴에 매핑
   - development → 2학년 수렴에 매핑
   - advanced → 3학년 수렴에 매핑
6. exemplar 패턴이 주어지면 few-shot 참고로 활용하되, 학생 고유의 설계를 생성합니다.
7. 기존 분석 데이터(analysis)가 있으면 이미 형성된 수렴을 존중하고,
   남은 학년의 수렴만 새로 설계합니다.
8. 역량 성장 타겟은 현실적으로 설정합니다 (한 학년에 2등급 이상 점프 금지).
9. 스토리라인 골격의 overarchingTheme은 3년 전체를 관통하는 하나의 문장입니다.
10. 모든 수렴의 rationale은 "왜 이 수렴이 이 학년에 필요한가"를 설명합니다.
13. remainingGrades의 각 학년마다 최소 1개 수렴을 배치합니다. tierAlignment은 규칙 5의 매핑(1→foundational, 2→development, 3→advanced)을 따르며, currentGrade=1학년이면 "지금 당장 시작할 기초 탐구(foundational)"를 반드시 포함합니다.
11. sharedCompetencies는 한국 고등학교 생기부 역량 코드를 사용합니다:
    academic_inquiry, academic_achievement, creative_problem_solving,
    collaborative_communication, career_passion, career_course_achievement,
    self_directed_learning, community_contribution
14. competencyGrowthTargets 배열에 각 수렴의 sharedCompetencies에 등장하는 모든 역량에 대해 성장 타겟을 포함하세요. 타겟이 없으면 Bridge 역량 갭 분석이 불가합니다.
15. milestones는 remainingGrades의 모든 학년에 대해 각 객체를 생성합니다. 특정 학년에 targetConvergences가 있으면 동일 학년의 milestones 객체도 반드시 작성하세요. 누락 시 Bridge 로드맵 Phase가 실패합니다.
16. JSON으로만 응답합니다.

## JSON 출력 형식

\`\`\`json
{
  "targetConvergences": [
    {
      "grade": 1,
      "semester": 1,
      "themeLabel": "세포·화학 기초 수렴",
      "themeKeywords": ["세포 호흡", "산화환원", "물질대사"],
      "targetMembers": [
        {
          "recordType": "setek",
          "subjectOrActivity": "생명과학Ⅰ",
          "role": "anchor",
          "description": "세포 호흡과 물질대사 기초 탐구"
        },
        {
          "recordType": "setek",
          "subjectOrActivity": "화학Ⅰ",
          "role": "support",
          "description": "산화환원 반응 원리와 생체 적용"
        },
        {
          "recordType": "reading",
          "subjectOrActivity": "의학 윤리 독서",
          "role": "evidence",
          "description": "의학 윤리 관점에서 생명과학 탐구 동기 근거"
        }
      ],
      "sharedCompetencies": ["academic_inquiry", "career_passion"],
      "confidence": 0.85,
      "rationale": "의학 진로에서 세포생물학은 기초 필수. 1학년 1학기에 화학과 연결하여 기초 수렴 형성",
      "tierAlignment": "foundational"
    }
  ],
  "storylineSkeleton": {
    "overarchingTheme": "의학 탐구를 통한 생명윤리 의식 성장",
    "yearThemes": {
      "1": "기초 과학 탐구와 의학 관심 확인",
      "2": "심화 실험과 의학 윤리 연구",
      "3": "통합 응용과 진로 구체화"
    },
    "narrativeArc": "1학년 기초과학 탐구로 의학에 대한 관심을 구체화하고, 2학년에서 유전학·약물 기전 심화 연구를 수행하며, 3학년에서 임상 응용과 연구 윤리를 통합하는 3년 성장 서사."
  },
  "competencyGrowthTargets": [
    {
      "competencyItem": "academic_inquiry",
      "currentGrade": "B+",
      "targetGrade": "A-",
      "yearTarget": 2,
      "pathway": "생명과학 세특에서 실험설계 역량 강화"
    }
  ],
  "milestones": {
    "1": {
      "grade": 1,
      "targetConvergenceCount": 3,
      "keyActivities": ["생명과학 세포 탐구", "화학 산화환원 연결", "의학 윤리 독서"],
      "competencyFocus": ["academic_inquiry", "career_passion"],
      "narrativeGoal": "기초 탐구 역량 확보 + 진로 방향 구체화"
    }
  }
}
\`\`\``;

// ============================================
// USER PROMPT BUILDER
// ============================================

export function buildUserPrompt(input: BlueprintPhaseInput): string {
  const lines: string[] = [];

  // ── WHO: 학생 정체성 ──────────────────────────
  lines.push("## 학생 정체성 (WHO)");
  lines.push("");
  lines.push(`- 진로 분야: ${input.identity.careerField}`);
  if (input.identity.targetMajor) {
    lines.push(`- 목표 학과: ${input.identity.targetMajor}`);
  }
  lines.push(`- 학교 권역: ${input.identity.schoolTier}`);
  if (input.identity.identityKeywords.length > 0) {
    lines.push(`- 정체성 키워드: ${input.identity.identityKeywords.join(", ")}`);
  }
  lines.push("");

  // ── SEED: 메인 탐구 ──────────────────────────
  lines.push("## 메인 탐구 (SEED)");
  lines.push("");
  lines.push(`- 테마: ${input.mainExploration.themeLabel}`);
  if (input.mainExploration.themeKeywords.length > 0) {
    lines.push(`- 키워드: ${input.mainExploration.themeKeywords.join(", ")}`);
  }
  if (input.mainExploration.careerField) {
    lines.push(`- 진로: ${input.mainExploration.careerField}`);
  }

  // tier_plan 상세
  const tp = input.mainExploration.tierPlan;
  if (tp) {
    for (const tier of ["foundational", "development", "advanced"] as const) {
      const entry = tp[tier];
      if (!entry) continue;
      const tierLabel = tier === "foundational" ? "기초" : tier === "development" ? "발전" : "심화";
      lines.push(`\n### tier_plan — ${tierLabel}`);
      if (entry.theme) lines.push(`  - 주제: ${entry.theme}`);
      if (entry.key_questions?.length) {
        for (const q of entry.key_questions) lines.push(`  - 질문: ${q}`);
      }
      if (entry.suggested_activities?.length) {
        for (const a of entry.suggested_activities) lines.push(`  - 활동: ${a}`);
      }
    }
  }
  lines.push("");

  // ── CURRICULUM: 교육과정 ─────────────────────
  lines.push("## 교육과정 맥락 (CURRICULUM)");
  lines.push("");
  lines.push(`- 교육과정: ${input.curriculum.revisionYear} 개정`);
  lines.push(`- 현재 학년: ${input.curriculum.currentGrade}학년`);
  lines.push(`- 설계 대상 학년: ${input.curriculum.remainingGrades.join(", ")}학년`);

  if (input.curriculum.offeredSubjects && input.curriculum.offeredSubjects.length > 0) {
    lines.push(`\n### 학교 개설 과목`);
    lines.push(input.curriculum.offeredSubjects.join(", "));
  }

  if (input.curriculum.coursePlans && input.curriculum.coursePlans.length > 0) {
    lines.push(`\n### 수강 계획`);
    const grouped = new Map<string, typeof input.curriculum.coursePlans>();
    for (const cp of input.curriculum.coursePlans) {
      const key = `${cp.grade}-${cp.semester}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(cp);
    }
    for (const [key, plans] of [...grouped.entries()].sort()) {
      const [g, s] = key.split("-");
      lines.push(`\n${g}학년 ${s}학기:`);
      for (const cp of plans) {
        const typeLabel = cp.subjectType ? ` (${cp.subjectType})` : "";
        lines.push(`- ${cp.subjectName}${typeLabel}`);
      }
    }
  }
  lines.push("");

  // ── EXEMPLAR: few-shot ────────────────────────
  if (input.exemplarPatterns && input.exemplarPatterns.length > 0) {
    lines.push("## 참고 사례 (EXEMPLAR)");
    lines.push("");
    lines.push("아래는 유사 진로의 우수 사례입니다. 학생 고유 설계의 참고로만 활용하세요.");
    lines.push("");

    for (let i = 0; i < input.exemplarPatterns.length; i++) {
      const ex = input.exemplarPatterns[i];
      lines.push(`### 사례 ${i + 1}: ${ex.themeLabel}`);
      if (ex.careerField) lines.push(`- 진로: ${ex.careerField}`);
      if (ex.tierPlan) {
        for (const tier of ["foundational", "development", "advanced"] as const) {
          const entry = ex.tierPlan[tier];
          if (entry?.theme) {
            const label = tier === "foundational" ? "기초" : tier === "development" ? "발전" : "심화";
            lines.push(`- ${label}: ${entry.theme}`);
          }
        }
      }
      if (ex.convergences && ex.convergences.length > 0) {
        lines.push("- 수렴 패턴:");
        for (const conv of ex.convergences) {
          lines.push(`  · ${conv.grade}학년 "${conv.themeLabel}": ${conv.memberLabels.join(", ")}`);
        }
      }
      lines.push("");
    }
  }

  // ── ANALYSIS: 기존 분석 데이터 ────────────────
  if (input.existingAnalysis) {
    lines.push("## 기존 분석 데이터 (ANALYSIS)");
    lines.push("");
    lines.push("⚠ 아래는 이미 형성된 수렴입니다. 이를 존중하고 남은 학년만 설계하세요.");
    lines.push("");

    if (input.existingAnalysis.analysisHyperedges.length > 0) {
      lines.push("### 형성된 수렴");
      for (const he of input.existingAnalysis.analysisHyperedges) {
        const gradeLabel = he.grade ? `${he.grade}학년` : "";
        lines.push(`- ${gradeLabel} "${he.themeLabel}": ${he.memberLabels.join(", ")}`);
        if (he.sharedCompetencies.length > 0) {
          lines.push(`  역량: ${he.sharedCompetencies.join(", ")}`);
        }
      }
      lines.push("");
    }

    if (input.existingAnalysis.competencyScores && input.existingAnalysis.competencyScores.length > 0) {
      lines.push("### 현재 역량 등급");
      for (const cs of input.existingAnalysis.competencyScores) {
        lines.push(`- ${cs.item}: ${cs.grade}`);
      }
      lines.push("");
    }

    if (input.existingAnalysis.storylines && input.existingAnalysis.storylines.length > 0) {
      lines.push("### 기존 스토리라인");
      for (const sl of input.existingAnalysis.storylines) {
        lines.push(`- "${sl.title}": ${sl.keywords.join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ============================================
// RESPONSE PARSER
// ============================================

const VALID_RECORD_TYPES = new Set(["setek", "changche", "haengteuk", "reading"]);
const VALID_ROLES = new Set(["anchor", "support", "evidence"]);
const VALID_TIERS = new Set(["foundational", "development", "advanced"]);
const VALID_COMPETENCIES = new Set([
  "academic_inquiry", "academic_achievement", "creative_problem_solving",
  "collaborative_communication", "career_passion", "career_course_achievement",
  "self_directed_learning", "community_contribution",
]);

export function parseResponse(content: string): BlueprintPhaseOutput {
  const raw = extractJson<Record<string, unknown>>(content);

  // targetConvergences
  const rawConvergences = Array.isArray(raw.targetConvergences) ? raw.targetConvergences : [];
  const targetConvergences: BlueprintConvergence[] = rawConvergences
    .filter((c: Record<string, unknown>) => c && typeof c === "object" && c.grade && c.themeLabel)
    .map((c: Record<string, unknown>) => ({
      grade: Number(c.grade),
      semester: c.semester != null ? Number(c.semester) : undefined,
      themeLabel: String(c.themeLabel ?? ""),
      themeKeywords: Array.isArray(c.themeKeywords)
        ? (c.themeKeywords as unknown[]).map(String)
        : [],
      targetMembers: Array.isArray(c.targetMembers)
        ? (c.targetMembers as Array<Record<string, unknown>>)
          .filter((m) => m && typeof m === "object")
          .map((m) => ({
            recordType: VALID_RECORD_TYPES.has(String(m.recordType))
              ? String(m.recordType) as "setek" | "changche" | "haengteuk" | "reading"
              : "setek",
            subjectOrActivity: String(m.subjectOrActivity ?? ""),
            role: VALID_ROLES.has(String(m.role))
              ? String(m.role) as "anchor" | "support" | "evidence"
              : "support",
            description: String(m.description ?? ""),
          }))
        : [],
      sharedCompetencies: Array.isArray(c.sharedCompetencies)
        ? (c.sharedCompetencies as unknown[]).map(String).filter((s) => VALID_COMPETENCIES.has(s))
        : [],
      confidence: Math.min(1, Math.max(0, Number(c.confidence ?? 0.7))),
      rationale: String(c.rationale ?? ""),
      tierAlignment: VALID_TIERS.has(String(c.tierAlignment))
        ? String(c.tierAlignment) as "foundational" | "development" | "advanced"
        : "foundational",
    }));

  // storylineSkeleton
  const rawStoryline = (raw.storylineSkeleton ?? {}) as Record<string, unknown>;
  const rawYearThemes = (rawStoryline.yearThemes ?? {}) as Record<string, unknown>;
  const yearThemes: Record<number, string> = {};
  for (const [k, v] of Object.entries(rawYearThemes)) {
    const num = Number(k);
    if (num >= 1 && num <= 3) yearThemes[num] = String(v);
  }
  const storylineSkeleton: BlueprintStorylineSkeleton = {
    overarchingTheme: String(rawStoryline.overarchingTheme ?? ""),
    yearThemes,
    narrativeArc: String(rawStoryline.narrativeArc ?? ""),
  };

  // competencyGrowthTargets
  const rawTargets = Array.isArray(raw.competencyGrowthTargets)
    ? raw.competencyGrowthTargets
    : [];
  const competencyGrowthTargets: CompetencyGrowthTarget[] = rawTargets
    .filter((t: Record<string, unknown>) => t && typeof t === "object" && t.competencyItem)
    .map((t: Record<string, unknown>) => ({
      competencyItem: String(t.competencyItem),
      ...(t.currentGrade != null ? { currentGrade: String(t.currentGrade) } : {}),
      targetGrade: String(t.targetGrade ?? "B+"),
      yearTarget: Number(t.yearTarget ?? 3),
      pathway: String(t.pathway ?? ""),
    }));

  // milestones
  const rawMilestones = (raw.milestones ?? {}) as Record<string, Record<string, unknown>>;
  const milestones: Record<number, BlueprintMilestone> = {};
  for (const [k, v] of Object.entries(rawMilestones)) {
    const grade = Number(k);
    if (grade < 1 || grade > 3 || !v) continue;
    milestones[grade] = {
      grade,
      targetConvergenceCount: Number(v.targetConvergenceCount ?? 0),
      keyActivities: Array.isArray(v.keyActivities)
        ? (v.keyActivities as unknown[]).map(String)
        : [],
      competencyFocus: Array.isArray(v.competencyFocus)
        ? (v.competencyFocus as unknown[]).map(String)
        : [],
      narrativeGoal: String(v.narrativeGoal ?? ""),
    };
  }

  return {
    targetConvergences,
    storylineSkeleton,
    competencyGrowthTargets,
    milestones,
  };
}
