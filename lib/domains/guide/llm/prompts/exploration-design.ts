/**
 * D6(M7) 1단계: 탐구 설계 프롬프트
 *
 * 학생의 스토리라인, 방향 가이드, 수강계획을 분석하여
 * "다음에 어떤 탐구를 해야 스토리라인이 강화되는가"를 설계합니다.
 *
 * 출력: ExplorationDesignOutput (메타 설계도, 가이드 전문 아님)
 */

export interface ExplorationDesignContext {
  /** 희망 전공 */
  targetMajor: string | null;
  /** 희망 계열 */
  desiredCareerField: string | null;
  /** 설계 학년 (2 or 3) */
  designGrade: number;

  /** S1에서 생성된 스토리라인 */
  storylines: {
    title: string;
    keywords: string[];
    narrative: string | null;
    grade1Theme: string | null;
    grade2Theme: string | null;
    grade3Theme: string | null;
    strength: string | null;
  }[];

  /** 방향 가이드 (P4~P6에서 생성) */
  directionGuides: {
    type: "setek" | "changche" | "haengteuk";
    subject?: string;
    activityType?: string;
    direction: string;
    keywords: string[];
    competencyFocus: string[];
  }[];

  /** 수강계획 과목명 목록 */
  plannedSubjects: string[];

  /** 이미 배정된 가이드 (중복 방지) */
  existingGuides: {
    title: string;
    guideType: string;
    difficultyLevel: string | null;
  }[];

  /** 부족 수량 (3 - 현재 매칭 수) */
  neededCount: number;

  /**
   * P2: Layer 2 hyperedge 테마 (최대 5개) — 세특+독서+동아리 등 이미 수렴 중인
   * N-ary 탐구축. 설계는 이 축을 **확장**하거나 **새 축을 추가**하는 방향.
   */
  hyperedgeThemes?: string[];

  /**
   * P2: Layer 3 narrative_arc 단계 분포 (8단계 + 총 N).
   * 약한 단계를 채우는 탐구를 우선 설계하도록 AI에 힌트.
   */
  narrativeStageDistribution?: {
    total: number;
    stages: { stage: string; count: number }[];
  };

  /**
   * P2: Layer 0 profile_card 요약 — 지속 강·약점, 관심사 일관성.
   */
  profileCardSummary?: string;

  /**
   * PR 4 (2026-04-17): Blueprint top-down 설계 청사진.
   * `student_record_hyperedges.edge_context='blueprint'` 의 LLM 원본인 `_blueprintPhase.targetConvergences`
   * 를 그대로 노출. AI 설계는 이 청사진의 **미구현 수렴축**을 우선 메꾸는 방향이어야 한다.
   * 없으면 생략 (1학년 미보유·분석 모드 전용 학생).
   */
  blueprintConvergences?: Array<{
    grade: number;
    themeLabel: string;
    themeKeywords: string[];
    rationale: string;
    tierAlignment: "foundational" | "development" | "advanced";
  }>;
  /** Blueprint 3년 관통 내러티브(있으면 1~2문장). */
  blueprintArc?: string;
  /**
   * M1-d (2026-04-27): blueprintConvergences 의 인덱스 중 "아직 채워지지 않은" 것.
   * 호출자가 computeUnfulfilledConvergences() 로 사전 판정. 비어있으면 표시 안 함.
   */
  unfulfilledConvergenceIndices?: number[];
  /**
   * M1-d (2026-04-27): Blueprint 학년별 마일스톤. 메인테마 cascade 의 학년별
   * keyActivities + competencyFocus + narrativeGoal 을 prompt 에 노출해
   * AI 설계가 학년별 척추와 정합하도록 유도.
   */
  blueprintMilestones?: Array<{
    grade: number;
    keyActivities: string[];
    competencyFocus: string[];
    narrativeGoal: string;
    targetConvergenceCount?: number;
  }>;
}

export function buildExplorationDesignSystemPrompt(): string {
  return `당신은 학생부종합전형(학종) 입시 전문 컨설턴트입니다.
학생의 탐구 스토리라인을 분석하고, 다음 학기에 수행할 탐구 가이드의 **메타 설계도**를 생성합니다.

## 설계 원칙

1. **시계열 연계**: 이전 학년의 탐구 위에 자연스럽게 쌓이는 구조. 고1=관심·발견 → 고2=심화·확장 → 고3=통합·학술적 깊이
2. **난이도 심화**: 학년과 내신에 맞는 기초→발전→심화 단계. 같은 난이도 반복 회피
3. **교과 연계**: 수강계획 과목의 **구체적 단원**과 탐구가 자연스럽게 연결
4. **진로 정합**: 탐구 주제가 희망 전공/계열과의 연결을 자연스럽게 보여줌
5. **8단계 흐름 잠재력**: 호기심→주제→탐구→참고문헌→결론→교사관찰→성장→오류재탐구 의 흐름이 가능한 주제
6. **중복 회피**: 이미 배정된 가이드와 주제·관점이 겹치지 않도록 차별화
7. **역량 보완**: 방향 가이드에서 지적된 보완 필요 역량을 강화하는 방향

## 가이드 유형 선택 기준

- topic_exploration: 교과 연계 주제 탐구 (가장 범용, 세특용)
- experiment: 실험 설계 + 결과 분석 (과학 교과, 탐구력 강화)
- reading: 독서 기반 심화 탐구 (인문/사회, 학술적 깊이)
- club_deep_dive: 동아리 심화 탐구 (계열 연속성)
- career_exploration_project: 진로 탐색 프로젝트 (진로 활동용)

## 출력 규칙

- title: 구체적이고 학술적 (40~80자). "~에 대한 탐구" 같은 일반적 표현 금지
- subjectConnect: 반드시 "교과명 > 단원명" 형식
- storylineConnect: 이전 탐구와의 구체적 연결고리
- keyTopics: 실제 탐구에서 다룰 핵심 개념/실험/이론
- rationale: 왜 이 탐구가 이 학생에게 필요한지 (스토리라인 강화 관점)`;
}

export function buildExplorationDesignUserPrompt(
  ctx: ExplorationDesignContext,
): string {
  const lines: string[] = [];

  // 학생 프로필
  lines.push("## 학생 프로필");
  if (ctx.targetMajor) lines.push(`- 희망 전공: ${ctx.targetMajor}`);
  if (ctx.desiredCareerField) lines.push(`- 희망 계열: ${ctx.desiredCareerField}`);
  lines.push(`- 설계 학년: 고${ctx.designGrade}`);
  if (ctx.plannedSubjects.length > 0) {
    lines.push(`- 수강계획 과목: ${ctx.plannedSubjects.join(", ")}`);
  }

  // 스토리라인
  if (ctx.storylines.length > 0) {
    lines.push("");
    lines.push("## 스토리라인");
    for (const sl of ctx.storylines) {
      lines.push(`### ${sl.title} (강도: ${sl.strength ?? "불명"})`);
      if (sl.keywords.length > 0) lines.push(`- 키워드: ${sl.keywords.join(", ")}`);
      if (sl.narrative) lines.push(`- 서사: ${sl.narrative}`);
      const themes: string[] = [];
      if (sl.grade1Theme) themes.push(`1학년="${sl.grade1Theme}"`);
      if (sl.grade2Theme) themes.push(`2학년="${sl.grade2Theme}"`);
      if (sl.grade3Theme) themes.push(`3학년="${sl.grade3Theme}"`);
      if (themes.length > 0) lines.push(`- 학년별 테마: ${themes.join(" → ")}`);
    }
  }

  // 방향 가이드
  if (ctx.directionGuides.length > 0) {
    lines.push("");
    lines.push("## 방향 가이드 (이전 Phase에서 AI가 제시한 탐구 방향)");
    for (const dg of ctx.directionGuides) {
      const label =
        dg.type === "setek"
          ? `세특 ${dg.subject ?? ""}`
          : dg.type === "changche"
            ? `창체 ${dg.activityType ?? ""}`
            : "행특";
      lines.push(`- [${label}] ${dg.direction}`);
      if (dg.keywords.length > 0) lines.push(`  키워드: ${dg.keywords.join(", ")}`);
      if (dg.competencyFocus.length > 0) lines.push(`  역량 초점: ${dg.competencyFocus.join(", ")}`);
    }
  }

  // PR 4 (2026-04-17) + M1-d (2026-04-27): Blueprint 청사진 — top-down 목표 + milestones + 미충족 highlight
  if (
    (ctx.blueprintConvergences?.length ?? 0) > 0 ||
    ctx.blueprintArc ||
    (ctx.blueprintMilestones?.length ?? 0) > 0
  ) {
    lines.push("");
    lines.push("## 설계 청사진 (Blueprint — top-down 목표)");
    if (ctx.blueprintArc) lines.push(`- 3년 관통 내러티브: ${ctx.blueprintArc}`);

    if (ctx.blueprintConvergences?.length) {
      const unfulfilled = new Set(ctx.unfulfilledConvergenceIndices ?? []);
      const hasUnfulfilledHints = unfulfilled.size > 0;
      lines.push(
        hasUnfulfilledHints
          ? "- 목표 수렴축 (★=아직 채워지지 않음, 우선 채울 것):"
          : "- 목표 수렴축:",
      );
      for (let i = 0; i < Math.min(ctx.blueprintConvergences.length, 6); i++) {
        const bc = ctx.blueprintConvergences[i];
        const kw = bc.themeKeywords.slice(0, 4).join(", ");
        const marker = unfulfilled.has(i) ? "★ " : "  ";
        lines.push(
          `  ${marker}· 고${bc.grade} [${bc.tierAlignment}] "${bc.themeLabel}"` +
            (kw ? ` (${kw})` : "") +
            ` — ${bc.rationale}`,
        );
      }
      lines.push(
        hasUnfulfilledHints
          ? "- ★ 표시된 수렴축을 **우선 완성**시키는 방향으로 설계하세요. (이미 충족된 수렴축은 회피)"
          : "- 설계는 위 수렴축 중 **아직 채워지지 않은 것**을 우선 완성시키는 방향이어야 합니다.",
      );
    }

    // M1-d: 학년별 마일스톤 — 메인테마 cascade 의 학년별 척추 노출
    if (ctx.blueprintMilestones && ctx.blueprintMilestones.length > 0) {
      lines.push("- 학년별 마일스톤:");
      for (const m of ctx.blueprintMilestones) {
        const acts = m.keyActivities.slice(0, 4).join(", ");
        const comps = m.competencyFocus.slice(0, 4).join(", ");
        lines.push(
          `  · 고${m.grade}: ${m.narrativeGoal}` +
            (acts ? ` | 핵심 활동: ${acts}` : "") +
            (comps ? ` | 역량 초점: ${comps}` : ""),
        );
      }
      lines.push(
        `- 설계는 고${ctx.designGrade} 마일스톤의 핵심 활동/역량 초점과 정합해야 합니다.`,
      );
    }
  }

  // P2: 학생 서사 맥락 (Layer 0/2/3)
  const hasNarrativeContext =
    !!ctx.profileCardSummary ||
    (ctx.hyperedgeThemes?.length ?? 0) > 0 ||
    !!ctx.narrativeStageDistribution;

  if (hasNarrativeContext) {
    lines.push("");
    lines.push("## 학생 서사 맥락");

    if (ctx.profileCardSummary) {
      lines.push(`### 누적 프로필 (Layer 0)`);
      lines.push(`- ${ctx.profileCardSummary}`);
    }

    if (ctx.hyperedgeThemes?.length) {
      lines.push(`### 수렴 탐구축 (Layer 2)`);
      lines.push(
        `- ${ctx.hyperedgeThemes.slice(0, 5).map((t) => `"${t}"`).join(", ")}`,
      );
      lines.push(
        `- 설계는 이 축을 **심화 확장**하거나 **명시적으로 새 축을 추가**하는 방향이어야 합니다`,
      );
    }

    if (ctx.narrativeStageDistribution && ctx.narrativeStageDistribution.total > 0) {
      const { total, stages } = ctx.narrativeStageDistribution;
      const threshold = Math.max(1, Math.round(total * 0.5));
      const weak = stages.filter((s) => s.count < threshold).map((s) => s.stage);
      const strong = stages
        .filter((s) => s.count >= Math.round(total * 0.8))
        .map((s) => s.stage);
      lines.push(`### 서사 8단계 진단 (Layer 3, N=${total})`);
      if (strong.length > 0) lines.push(`- 자주 나타난 단계: ${strong.join(", ")}`);
      if (weak.length > 0) {
        lines.push(
          `- **약한 단계 (설계가 반드시 보강해야)**: ${weak.join(", ")}`,
        );
      }
    }
  }

  // 이미 배정된 가이드
  if (ctx.existingGuides.length > 0) {
    lines.push("");
    lines.push("## 이미 배정된 가이드 (중복 회피)");
    for (const eg of ctx.existingGuides) {
      lines.push(`- [${eg.difficultyLevel ?? "불명"}] ${eg.title} (${eg.guideType})`);
    }
  }

  // 요청
  lines.push("");
  lines.push(`## 요청`);
  lines.push(`부족한 **${ctx.neededCount}건**의 탐구 가이드 메타를 설계하세요.`);
  lines.push(`각 가이드는 기존 배정 가이드 및 다른 설계 가이드와 난이도/관점이 차별화되어야 합니다.`);

  return lines.join("\n");
}
