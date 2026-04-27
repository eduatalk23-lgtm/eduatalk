// ============================================
// S2: runGuideMatching 본체 + 관련 helpers
//
// Phase 2 Wave 4 (D1+D2+D3+D4+D7) — runGuideMatching 대수술:
//   D2: course plan refresh 선호출 (Phase 순서 버그 fix)
//   D1: 3단계 폭포수 (풀 매칭 → 활성 풀 보강 → 조건부 AI 생성)
//   D3: 창체 slot auto-link 분기 (setek + changche)
//   D4: 12계열 연속성 점수 weighted ranking
//   D7: 0건 결과 시 explicit 메시지 (idempotency 재고)
// ============================================

import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import {
  type RankedGuide,
  MAX_GUIDES_PER_SLOT,
  fetchClubHistory,
  applyContinuityRanking,
  insertAssignments,
} from "./phase-s2-guide-ranking";
import type { ExplorationDesignItem } from "@/lib/domains/guide/llm/types";

const LOG_CTX = { domain: "record-analysis", action: "pipeline" };

const MIN_GUIDES_FOR_AI_TRIGGER = 3; // Decision #2 Q2-1: 매칭이 3건 미만일 때만 AI 생성
// P2: 기본 ON. 명시적 "0"일 때만 OFF. Gemini 할당량 초과 시 runExplorationDesign
//     내부에서 자동 스킵하므로 안전. D6 feature flag.
const ENABLE_AI_GENERATION = process.env.PHASE2_AI_GUIDE_GENERATION !== "0";

// ============================================
// 배정 상한 (과다 할당 방지)
//
// Phase A(AI 설계) + Phase B(풀 보충) 합집합 후 finalScore 기준으로
// 상위 N건만 배정. 한 세특 과목/창체 영역에는 최대 M건까지만 link.
// 이전: 합집합 후 상한 없음 → 최대 65건+ 후보가 그대로 insert 되어
//       한 과목에 10건+ 가이드가 달리는 문제 (사용자 피드백 2026-04-17).
// ============================================
const MAX_TOTAL_ASSIGNMENTS = 24;

// ============================================
// Sub-task 4 (2026-04-26): GuideMatchingState 타입
//
// `ctx.previews` JSON 박제 패턴을 타입 안전 state 객체로 격상.
// 단계별(diagnosis/phaseA/phaseB/merged/assignment) 상태를 명시적으로 보유 →
// Phase A 실패 시 `phaseA.error` 보존하고 Phase B 계속 (현 동작 유지) +
// 향후 단계별 재시도 진입 발판 확보.
// 기존 ctx.previews 키 호환성 유지: 동일 시점·동일 키로 직렬화.
// ============================================
interface DesignOutcome {
  title: string;
  poolMatch: boolean;
  poolMatchTitle?: string;
  shellCreated?: boolean;
  shellError?: string;
}

interface GuideMatchingState {
  diagnosis: {
    enableAiGeneration: boolean;
    canDesign: boolean;
    consultingGrades: number[] | null;
    hasAnyDesign: boolean | null;
    hasUnifiedInput: boolean;
    storylineCount: number | null;
  };
  phaseA: {
    attempted: boolean;
    designs: ExplorationDesignItem[];
    overallStrategy: string | null;
    designOutcomes: DesignOutcome[];
    error?: string;
  };
  phaseB: {
    ranked: RankedGuide[];
  };
  merged: {
    candidateCount: number;
    capped: RankedGuide[];
    overflowCount: number;
  };
  assignment: {
    inserted: number;
    skippedOrphan: number;
    skippedOrphanGuides: Array<{ id: string; title: string }>;
    skippedSlotOverflow: number;
  };
}

function createInitialState(): GuideMatchingState {
  return {
    diagnosis: {
      enableAiGeneration: ENABLE_AI_GENERATION,
      canDesign: false,
      consultingGrades: null,
      hasAnyDesign: null,
      hasUnifiedInput: false,
      storylineCount: null,
    },
    phaseA: { attempted: false, designs: [], overallStrategy: null, designOutcomes: [] },
    phaseB: { ranked: [] },
    merged: { candidateCount: 0, capped: [], overflowCount: 0 },
    assignment: { inserted: 0, skippedOrphan: 0, skippedOrphanGuides: [], skippedSlotOverflow: 0 },
  };
}

export async function runGuideMatching(ctx: PipelineContext): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId, studentGrade, snapshot } = ctx;

  // ── D2: course plan 보장 (Phase 순서 버그 fix) ──
  // synthesis pipeline은 phase별 별도 HTTP 요청이라, 이 task가 호출될 때 ctx.coursePlanData가
  // 없거나 stale일 수 있음. course_recommendation이 아직 안 돈 fresh 학생이면 빈 배열.
  // → 명시적으로 DB에서 다시 읽어 항상 최신 상태 보장.
  await refreshCoursePlanData(ctx);

  // ── Step 2.1 (2026-04-27): Slot Generator Shadow run ──
  // 매칭 로직 변경 없음. 슬롯 도출 결과는 ctx.results._slots + ctx.previews에 박제.
  // Step 2.2부터 score(guide, slot) 시그니처에서 소비.
  // 어떤 에러도 매칭을 중단시키지 않음 (graceful).
  {
    const { runSlotGeneratorShadow } = await import("../slots/shadow-run");
    await runSlotGeneratorShadow({
      studentId,
      tenantId,
      studentGrade,
      belief: ctx.belief,
      coursePlanData: ctx.coursePlanData ?? null,
      results: ctx.results,
      previews: ctx.previews,
    });
  }

  const classificationId = (snapshot?.target_sub_classification_id as number | null) ?? null;
  // desired_career_field는 이제 H3 careerFieldHint로 대체됨
  void (snapshot?.desired_career_field);

  const { autoRecommendGuidesAction } = await import("@/lib/domains/guide/actions/auto-recommend");
  // H3: 전공 기반 career field 힌트 (가이드 추천 풀에 전공 계열 가이드 포함)
  let careerFieldHint: string | null = null;
  const targetMajorForCareer = (snapshot?.target_major as string) ?? null;
  if (targetMajorForCareer) {
    const { inferCareerFieldFromMajor } = await import("@/lib/domains/student-record/constants");
    careerFieldHint = inferCareerFieldFromMajor(targetMajorForCareer);
  }

  // ── D6 v2: AI 설계 선행 → 풀 매칭 → 없으면 셸 생성 ──
  // 학생 맥락(스토리라인 + 방향가이드 + 수강계획)을 AI가 먼저 분석하여
  // "이 학생에게 필요한 탐구"를 설계한 뒤, 설계 결과에 맞는 풀 가이드를 매칭.
  // 풀에 없는 것만 셸(queued_generation)로 생성.

  const clubHistory = await fetchClubHistory(supabase, studentId, tenantId);
  const plannedNames = collectPlannedSubjectNames(ctx);

  // 전공 권장 과목 subject_id 세트 (ranking용)
  let majorRecommendedSubjectIds: Set<string> | undefined;
  const targetMajor = (snapshot?.target_major as string) ?? null;
  if (targetMajor) {
    const { getMajorRecommendedCourses } = await import(
      "@/lib/domains/student-record/constants"
    );
    const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
    const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
    const curriculumYear = getCurriculumYear(enrollmentYear);
    const recommended = getMajorRecommendedCourses(targetMajor, curriculumYear);
    if (recommended) {
      const allNames = [
        ...recommended.general,
        ...recommended.career,
        ...("fusion" in recommended && recommended.fusion ? recommended.fusion as string[] : []),
      ];
      if (allNames.length > 0) {
        const { normalizeSubjectName } = await import("@/lib/domains/subject/normalize");
        const normalizedNames = allNames.map(normalizeSubjectName);
        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("id, name");
        majorRecommendedSubjectIds = new Set<string>();
        for (const s of subjectRows ?? []) {
          if (normalizedNames.includes(normalizeSubjectName(s.name))) {
            majorRecommendedSubjectIds.add(s.id);
          }
        }
      }
    }
  }

  const state = createInitialState();

  // ── Phase A: AI 탐구 설계 (설계 학년 + 스토리라인 존재 시) ──
  const canDesign = ENABLE_AI_GENERATION && shouldTriggerAiGeneration(ctx, 0);

  // P2 진단(2026-04-14): Phase A가 왜 안/도는지 task_previews 에 박제.
  state.diagnosis.canDesign = canDesign;
  state.diagnosis.consultingGrades = ctx.consultingGrades ?? null;
  state.diagnosis.hasAnyDesign = ctx.unifiedInput?.hasAnyDesign ?? null;
  state.diagnosis.hasUnifiedInput = !!ctx.unifiedInput;
  state.diagnosis.storylineCount =
    (ctx.results?.storyline_generation as { storylineCount?: number } | undefined)?.storylineCount ?? null;
  ctx.previews["d6_diagnosis"] = JSON.stringify(state.diagnosis);

  if (canDesign) {
    state.phaseA.attempted = true;
    try {
      // AI가 학생 맥락을 분석하여 필요한 탐구 N건을 설계
      const { designs, overallStrategy } = await runExplorationDesign(ctx);
      state.phaseA.designs = designs;
      state.phaseA.overallStrategy = overallStrategy ?? null;

      // P2 진단: Phase A 결과 박제
      ctx.previews["d6_phase_a_result"] = JSON.stringify({
        attempted: true,
        designsCount: designs.length,
        overallStrategy: overallStrategy?.slice(0, 200) ?? null,
        designs: designs.map((d) => ({
          title: d.title?.slice(0, 60) ?? null,
          guideType: d.guideType,
          difficulty: d.difficultyLevel,
          subjectConnect: d.subjectConnect?.slice(0, 60) ?? null,
        })),
      });

      // P2 진단: 각 design의 풀 매칭 / 셸 생성 결과 박제 (state.phaseA.designOutcomes 로 누적)
      for (const design of designs) {
        // 설계 결과의 키워드/제목으로 풀 매칭 시도
        const poolMatch = await matchDesignToPool(
          design,
          { studentId, classificationId, autoRecommendGuidesAction },
        );

        if (poolMatch) {
          // 풀에 맞는 가이드 있음 → 기존 가이드 사용
          state.phaseB.ranked.push({
            ...poolMatch,
            match_reason: "ai_design_pool_match",
            baseScore: 3, // AI 설계 + 풀 매칭 = 최고 적합도
          });
          state.phaseA.designOutcomes.push({
            title: design.title?.slice(0, 60) ?? "",
            poolMatch: true,
            poolMatchTitle: poolMatch.title?.slice(0, 60),
          });
          logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 풀 매칭 "${poolMatch.title}"`, { studentId });
        } else {
          // 풀에 없음 → 셸 생성 (2단계에서 전문 생성)
          let shellCreated = false;
          let shellError: string | undefined;
          try {
            const shell = await createDesignShell(design, ctx);
            if (shell) {
              state.phaseB.ranked.push(shell);
              shellCreated = true;
              logActionDebug(LOG_CTX, `D6: 설계 "${design.title}" → 셸 생성`, { studentId });
            } else {
              shellError = "createDesignShell returned null";
            }
          } catch (shellErr) {
            // Supabase error 객체는 instanceof Error=false 이고 String()이 [object Object]가 되므로
            // JSON.stringify 로 message/code/details/hint 모두 추출.
            if (shellErr instanceof Error) {
              shellError = shellErr.message;
            } else if (shellErr && typeof shellErr === "object") {
              try {
                shellError = JSON.stringify(shellErr);
              } catch {
                shellError = "(unstringifiable shell error)";
              }
            } else {
              shellError = String(shellErr);
            }
          }
          state.phaseA.designOutcomes.push({
            title: design.title?.slice(0, 60) ?? "",
            poolMatch: false,
            shellCreated,
            ...(shellError ? { shellError: shellError.slice(0, 300) } : {}),
          });
        }
      }
      ctx.previews["d6_design_outcomes"] = JSON.stringify(state.phaseA.designOutcomes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.phaseA.error = msg.slice(0, 500);
      // P2 진단: AI 설계 실패 박제 (Phase B 는 계속 진행 → 단계별 격리)
      ctx.previews["d6_phase_a_result"] = JSON.stringify({
        attempted: true,
        error: state.phaseA.error,
      });
      logActionWarn(
        LOG_CTX,
        `D6: AI 탐구 설계 실패 — 기존 풀 매칭으로 fallback: ${msg}`,
        { studentId },
      );
    }
  }

  // ── Phase B: 기존 풀 보충 매칭 (AI 설계 불가 or fallback) ──
  //
  // P3 라스트마일(2026-04-14): 임계 3 → 항상 합집합으로 변경.
  //   이전 가드(`< 3`)는 Phase A가 4건 처리(풀 매칭 1 + 셸 3)되면 임계 통과 못해
  //   Phase B 풀 보충이 0건 → 학생 전체 배정이 1건으로 격감하는 문제 유발.
  //   상용 MVP 기준선은 "AI 맞춤 설계 + 풀 보충 모두 제공"이 합리적이라
  //   Phase A 결과와 Phase B 보충을 항상 합집합으로 합산.
  //   (성능: Phase B는 DB만 사용, LLM 호출 없음 → 안전)
  {
    type RecommendedGuide = { id: string; title: string; guide_type: string | null; match_reason: string };
    const guideMap = new Map<string, RecommendedGuide>();
    // 이미 Phase A 결과 (state.phaseB.ranked) 에 있는 가이드 제외
    const rankedIds = new Set(state.phaseB.ranked.map((r) => r.id));

    // (1) classification 매칭
    const classResult = await autoRecommendGuidesAction({ studentId, classificationId, careerFieldHint, limit: 10 });
    if (classResult.success && Array.isArray(classResult.data)) {
      for (const g of classResult.data) {
        if (!rankedIds.has(g.id)) guideMap.set(g.id, g);
      }
    }

    // (2) 수강계획 과목 매칭
    for (const subjectName of plannedNames.slice(0, 8)) {
      const subjectResult = await autoRecommendGuidesAction({
        studentId,
        classificationId,
        subjectName,
        careerFieldHint,
        limit: 5,
      });
      if (subjectResult.success && Array.isArray(subjectResult.data)) {
        for (const g of subjectResult.data) {
          if (!rankedIds.has(g.id)) {
            const existing = guideMap.get(g.id);
            if (!existing || g.match_reason === "both" || g.match_reason === "all") {
              guideMap.set(g.id, g);
            }
          }
        }
      }
    }

    // (3) activity_type 매칭 (창체용)
    for (const activityType of ["autonomy", "club", "career"] as const) {
      const activityResult = await autoRecommendGuidesAction({
        studentId,
        classificationId,
        activityType,
        careerFieldHint,
        limit: 5,
      });
      if (activityResult.success && Array.isArray(activityResult.data)) {
        for (const g of activityResult.data) {
          if (!rankedIds.has(g.id) && !guideMap.has(g.id)) guideMap.set(g.id, g);
        }
      }
    }

    // 격차 3: MidPlan focusHypothesis 키워드 추출 — ctx.midPlan(최신 학년) + ctx.belief.midPlanByGrade(다학년) 합집합.
    //
    // v1(폐기): 단순 단일 토큰 매칭 → 6차 풀런에서 50건 중 31건(62%) 매칭, 균일 1.10× 적용으로 변별력 0.
    // v2(폐기): bigram + 의미 단어만 → 50건 중 0~1건 매칭, 너무 좁음.
    // v3(현재): 보수적 stopword + 매칭 개수 비례 보너스 (1개=1.05×, 2개=1.10×, 3+=1.15×).
    //   사전 시뮬레이션: 50건 → 0매칭 25건(50%) / 1매칭 21건(42%) / 2매칭 4건(8%) — 변별력 회복.
    //   매칭 개수 비례 보너스는 applyContinuityRanking 측에서 keyword.size 보고 dynamic 계산.
    const midPlanFocusKeywords = new Set<string>();
    const KO_SUFFIX_STOP = /(은|는|이|가|을|를|에|와|과|의|로|도|만|에서|부터|까지|에게|이다|있다|되다|되|할|것|면|며|므로|이며|있으며|있는|있을|관련된|이지만|할까|일까)$/;
    const KO_GENERIC_STOP = new Set([
      "있다", "있으며", "있는", "있을", "이", "그", "저",
      "대한", "위한", "위해", "대해", "통해", "통한", "관련", "관련된",
      "학생", "학생은", "역량이", "역량을", "이슈가", "테마", "테마에",
      "이해가", "이해", "필요할", "필요", "부족할", "부족", "가능성", "가능성이",
      "것으로", "추정된다", "추정", "발생할", "발생",
    ]);
    const collectFocusKeywords = (focusHypothesis: string | undefined) => {
      if (!focusHypothesis) return;
      // (1) 영문 kebab-case 추출 (예: critical-thinking, social-issues)
      const kebabMatches = focusHypothesis.toLowerCase().match(/[a-z]+(?:-[a-z]+)+/g) ?? [];
      for (const m of kebabMatches) midPlanFocusKeywords.add(m);
      // (2) 괄호 안 영문 라벨 제거 후 의미 한국어 어절 + 인접 bigram
      const cleaned = focusHypothesis.replace(/\([^)]*\)/g, " ");
      const allWords = cleaned
        .split(/[\s·,/[\]{}"'`~!@#$%^&*+=|<>?:;.0-9]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && /^[가-힣]+$/.test(w));
      const semantic = allWords.filter((w) => !KO_SUFFIX_STOP.test(w) && !KO_GENERIC_STOP.has(w));
      for (const w of semantic) midPlanFocusKeywords.add(w);
      for (let i = 0; i < semantic.length - 1; i++) {
        midPlanFocusKeywords.add(`${semantic[i]} ${semantic[i + 1]}`);
      }
    };
    if (ctx.midPlan?.focusHypothesis) collectFocusKeywords(ctx.midPlan.focusHypothesis);
    if (ctx.belief.midPlanByGrade) {
      for (const mp of Object.values(ctx.belief.midPlanByGrade)) {
        collectFocusKeywords(mp?.focusHypothesis);
      }
    }
    // v4 (2026-04-27): gradeThemes 도 토큰 source 에 추가 — focusHypothesis 가 결함 위주로 나올 때
    //   테마 콘텐츠가 빠지는 LLM 비결정성 보강. P3.5 가 매번 안정적으로 채우는 dominant theme 라벨/키워드.
    //   themes[].id (kebab-case 영문) + label (한국어 phrase) + keywords[] 모두 추가.
    if (ctx.belief.gradeThemesByGrade) {
      for (const byGrade of Object.values(ctx.belief.gradeThemesByGrade)) {
        if (!byGrade?.themes) continue;
        const dominantSet = new Set(byGrade.dominantThemeIds ?? []);
        for (const theme of byGrade.themes) {
          if (!dominantSet.has(theme.id)) continue; // dominant 만 채택 (전체 테마는 noise)
          // (1) 영문 kebab-case id
          if (/^[a-z]+(?:-[a-z]+)+$/.test(theme.id)) midPlanFocusKeywords.add(theme.id.toLowerCase());
          // (2) 한국어 label (예: "우주 탐구")
          if (theme.label) {
            midPlanFocusKeywords.add(theme.label.toLowerCase());
            // label 이 다어절이면 단어 분리해서도 추가
            const labelWords = theme.label.split(/[\s·]+/).map((w) => w.trim()).filter(
              (w) => w.length >= 2 && /^[가-힣]+$/.test(w) && !KO_GENERIC_STOP.has(w),
            );
            for (const w of labelWords) midPlanFocusKeywords.add(w);
          }
          // (3) keywords 배열 (이미 한국어 키워드)
          for (const kw of theme.keywords ?? []) {
            const k = kw.trim().toLowerCase();
            if (k.length >= 2 && !KO_GENERIC_STOP.has(k)) midPlanFocusKeywords.add(k);
          }
        }
      }
    }

    // ranking 적용 후 기존 ranked에 추가
    const poolRanked = await applyContinuityRanking(
      [...guideMap.values()],
      clubHistory,
      studentGrade,
      supabase,
      studentId,
      tenantId,
      majorRecommendedSubjectIds,
      midPlanFocusKeywords.size > 0 ? midPlanFocusKeywords : undefined,
    );
    state.phaseB.ranked.push(...poolRanked);
  }

  // ── Phase A + Phase B 합집합 정렬 + 전체 상한 ──
  //
  // Phase A (AI 설계)와 Phase B (풀 보충)가 합집합으로 쌓여 있으므로
  // finalScore 기준 글로벌 정렬 후 상위 MAX_TOTAL_ASSIGNMENTS 건만 insert.
  // 이전: 정렬·상한 없이 전부 insertAssignments 로 전달.
  state.merged.candidateCount = state.phaseB.ranked.length;
  state.phaseB.ranked.sort((a, b) => b.finalScore - a.finalScore);
  state.merged.capped = state.phaseB.ranked.slice(0, MAX_TOTAL_ASSIGNMENTS);
  state.merged.overflowCount = Math.max(0, state.merged.candidateCount - state.merged.capped.length);

  if (state.merged.overflowCount > 0) {
    ctx.previews["guide_matching_cap"] = JSON.stringify({
      candidateCount: state.merged.candidateCount,
      cappedCount: state.merged.capped.length,
      overflowCount: state.merged.overflowCount,
      maxTotal: MAX_TOTAL_ASSIGNMENTS,
      maxPerSlot: MAX_GUIDES_PER_SLOT,
    });
  }

  // ── 배정 INSERT ──
  if (state.merged.capped.length > 0) {
    const r = await insertAssignments(ctx, state.merged.capped);
    state.assignment.inserted = r.count;
    state.assignment.skippedOrphan = r.skippedOrphan;
    state.assignment.skippedOrphanGuides = r.skippedOrphanGuides;
    state.assignment.skippedSlotOverflow = r.skippedSlotOverflow;
  }

  // ── D7: 결과 메시지 ──
  const aiHint = ENABLE_AI_GENERATION ? "" : "";
  const continuityHint = clubHistory.length > 0
    ? ` / ${clubHistory.length}건 동아리 이력 반영`
    : "";

  const orphanHint = state.assignment.skippedOrphan > 0
    ? ` / ${state.assignment.skippedOrphan}건 미배정(과목 풀 불일치: ${state.assignment.skippedOrphanGuides.map((g) => g.title).slice(0, 3).join(", ")}${state.assignment.skippedOrphan > 3 ? " 외" : ""})`
    : "";
  const slotCapHint = state.assignment.skippedSlotOverflow > 0
    ? ` / ${state.assignment.skippedSlotOverflow}건 슬롯 상한(${MAX_GUIDES_PER_SLOT}개) 제외`
    : "";
  const totalCapHint = state.merged.overflowCount > 0
    ? ` / ${state.merged.overflowCount}건 전체 상한(${MAX_TOTAL_ASSIGNMENTS}개) 제외`
    : "";

  // H4: 고아 가이드 세부 정보를 previews에 저장 (UI 표시용)
  if (state.assignment.skippedOrphanGuides.length > 0) {
    ctx.previews["guide_matching_orphans"] = JSON.stringify({
      count: state.assignment.skippedOrphan,
      guides: state.assignment.skippedOrphanGuides.slice(0, 10).map((g) => ({ id: g.id, title: g.title })),
    });
  }

  // Cross-run 관찰치: 직전 실행 haengteuk_linking.assignmentLinkCounts 중 linkCount >= 2 인 ID 수집.
  // 현 슬라이스에서는 ranking 반영 없음(guide 도메인 수술 회피) — 읽기 + task_result 노출만.
  // 후속 슬라이스에서 autoRecommendGuidesAction 에 boost/demote 신호로 연결할 수 있도록 보존.
  let priorHighLinkAssignmentIds: string[] | undefined;
  const prevRun = ctx.belief.previousRunOutputs;
  if (prevRun?.runId) {
    const { getPreviousRunResult } = await import("../pipeline-previous-run");
    const prevLinking = getPreviousRunResult<{
      linksGenerated: number;
      assignmentLinkCounts: Array<{ assignmentId: string; linkCount: number }>;
    }>(prevRun, "haengteuk_linking");
    const hits = (prevLinking?.assignmentLinkCounts ?? []).filter((c) => c.linkCount >= 2);
    if (hits.length > 0) {
      priorHighLinkAssignmentIds = hits.map((c) => c.assignmentId);
      logActionDebug(
        LOG_CTX,
        `runGuideMatching cross-run signal: ${hits.length}건 assignment 직전 실행에서 행특 링크 ≥2`,
        { studentId, sampleIds: priorHighLinkAssignmentIds.slice(0, 3) },
      );
    }
  }

  return {
    preview: `${state.assignment.inserted}건 가이드 배정 (${state.merged.candidateCount}건 후보${continuityHint}${orphanHint}${slotCapHint}${totalCapHint})${aiHint}`,
    result: {
      assignedCount: state.assignment.inserted,
      candidateCount: state.merged.candidateCount,
      ...(priorHighLinkAssignmentIds ? { priorHighLinkAssignmentIds } : {}),
    },
  };
}

// ============================================
// D2 helper: course plan refresh
// ============================================

async function refreshCoursePlanData(ctx: PipelineContext): Promise<void> {
  const { data: refreshedPlans, error } = await ctx.supabase
    .from("student_course_plans")
    .select(
      `*, subject:subject_id ( id, name, subject_type:subject_type_id ( name ), subject_group:subject_group_id ( name ) )`,
    )
    .eq("student_id", ctx.studentId)
    .order("grade")
    .order("semester")
    .order("priority", { ascending: false })
    .returns<import("@/lib/domains/student-record/course-plan/types").CoursePlanWithSubject[]>();

  if (error) {
    logActionWarn(LOG_CTX, `refreshCoursePlanData 실패 (계속 진행): ${error.message}`, { studentId: ctx.studentId });
    return;
  }

  if (refreshedPlans) {
    ctx.coursePlanData = { plans: refreshedPlans };
  }
}

function collectPlannedSubjectNames(ctx: PipelineContext): string[] {
  if (!ctx.coursePlanData?.plans) return [];
  // Wave 5.1f: **설계 학년(consultingGrades) 의 plans 만** 사용.
  //   탐구 가이드는 본질상 NEIS 가 아직 기록되지 않은 설계 학년 대상.
  //   분석 학년(NEIS 확정) 의 plans 를 포함하면 이미 끝난 활동에 가이드가
  //   link 되는 무의미한 상황 발생.
  // Wave 5.1d: grade 역순(높은 학년 우선)으로 정렬해 상위 slice 가 현재 학년을
  //   먼저 뽑도록. 설계 학년만 있는 지금도 여전히 grade 내림차순 정렬 유지.
  const consultingGradesSet = new Set(ctx.consultingGrades ?? []);
  if (consultingGradesSet.size === 0) return [];

  const byGrade = new Map<number, Set<string>>();
  for (const p of ctx.coursePlanData.plans) {
    if (p.plan_status !== "confirmed" && p.plan_status !== "recommended") continue;
    if (!consultingGradesSet.has(p.grade)) continue; // 설계 학년만
    const name = (p.subject as { name?: string } | null)?.name;
    if (!name) continue;
    const set = byGrade.get(p.grade) ?? new Set<string>();
    set.add(name);
    byGrade.set(p.grade, set);
  }
  const sortedGrades = [...byGrade.keys()].sort((a, b) => b - a); // 3 → 2 → 1
  const result: string[] = [];
  for (const grade of sortedGrades) {
    for (const name of byGrade.get(grade) ?? []) {
      if (!result.includes(name)) result.push(name);
    }
  }
  return result;
}

// ============================================
// D6 helpers: AI 생성 트리거 + 호출 (feature-flag)
// ============================================

function shouldTriggerAiGeneration(ctx: PipelineContext, currentMatchCount: number): boolean {
  // Decision #2 Q2-1: 설계 학년 + storyline 존재 + 매칭 < 3건
  if (currentMatchCount >= MIN_GUIDES_FOR_AI_TRIGGER) return false;

  // P2 (2026-04-14): mode=analysis 학생도 consultingGrades에 설계 학년이 잡혀 있으면
  //   AI 설계 trigger. 이전엔 `unifiedInput.hasAnyDesign === true`만 봤는데
  //   김세린(mode=analysis, 3학년만 설계) 같은 케이스에서 hasAnyDesign이 null로 잡혀
  //   AI 설계가 한 번도 안 도는 문제가 있었다. consultingGrades가 더 정확한 신호.
  const hasDesignGrade =
    ctx.unifiedInput?.hasAnyDesign === true ||
    (ctx.consultingGrades?.length ?? 0) > 0;
  if (!hasDesignGrade) return false;

  // storyline 존재 여부는 task_results에서 확인
  const storylineResult = ctx.results?.storyline_generation as { storylineCount?: number } | undefined;
  if (!storylineResult || (storylineResult.storylineCount ?? 0) === 0) return false;
  return true;
}

// ============================================
// D6 v2: AI 설계 선행 → 풀 매칭 → 셸 생성
// ============================================

/** AI 탐구 설계 수행 — 학생 맥락에서 필요한 탐구 N건을 설계 */
async function runExplorationDesign(
  ctx: PipelineContext,
): Promise<{ designs: ExplorationDesignItem[]; overallStrategy: string }> {
  const { supabase, studentId, tenantId, snapshot, consultingGrades } = ctx;

  // 1. 스토리라인 (DB 조회)
  const { data: storylineRows } = await supabase
    .from("student_record_storylines")
    .select("title, keywords, narrative, grade_1_theme, grade_2_theme, grade_3_theme, strength")
    .eq("student_id", studentId)
    .order("sort_order", { ascending: true })
    .limit(5);

  const storylines = (storylineRows ?? []).map((s) => ({
    title: s.title ?? "",
    keywords: (s.keywords as string[]) ?? [],
    narrative: s.narrative as string | null,
    grade1Theme: s.grade_1_theme as string | null,
    grade2Theme: s.grade_2_theme as string | null,
    grade3Theme: s.grade_3_theme as string | null,
    strength: s.strength as string | null,
  }));

  if (storylines.length === 0) return { designs: [], overallStrategy: "" };

  // 2. 방향 가이드
  const directionGuides: {
    type: "setek" | "changche" | "haengteuk";
    subject?: string;
    activityType?: string;
    direction: string;
    keywords: string[];
    competencyFocus: string[];
  }[] = [];

  if (ctx.unifiedInput) {
    for (const grade of consultingGrades ?? []) {
      const gradeData = ctx.unifiedInput.grades[grade];
      if (!gradeData) continue;
      for (const dg of gradeData.directionGuides) {
        directionGuides.push({
          type: dg.type,
          subject: dg.subjectName,
          activityType: dg.activityType,
          direction: dg.direction,
          keywords: dg.keywords,
          competencyFocus: dg.competencyFocus,
        });
      }
    }
  }

  // 3. 수강계획 과목명 + 설계 학년
  const plannedSubjects = collectPlannedSubjectNames(ctx);
  const designGrade = (consultingGrades ?? []).length > 0
    ? Math.max(...(consultingGrades ?? []))
    : ctx.studentGrade;

  // P2: Layer 0/2/3 — 이 시점에 hyperedge_computation/narrative_arc_extraction이
  //     이미 선행 실행되어 DB에 있다(synthesis phase 2 순서상).
  //     이 데이터를 설계 프롬프트에 주입해 "약한 서사 단계 보강 / 수렴축 확장" 방향의 설계 유도.
  const [hyperedgeRows, narrativeRows, profileCardRow] = await Promise.all([
    supabase
      .from("student_record_hyperedges")
      .select("theme_label, member_count")
      .eq("student_id", studentId)
      .eq("edge_context", "analysis")
      .order("member_count", { ascending: false })
      .limit(5)
      .then((r) => r.data),
    supabase
      .from("student_record_narrative_arc")
      .select(
        "curiosity_present, topic_selection_present, inquiry_content_present, references_present, conclusion_present, teacher_observation_present, growth_narrative_present, reinquiry_present",
      )
      .eq("student_id", studentId)
      .then((r) => r.data),
    supabase
      .from("student_record_profile_cards")
      .select("persistent_strengths, persistent_weaknesses, recurring_quality_issues, cross_grade_themes, interest_consistency")
      .eq("student_id", studentId)
      .order("target_grade", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const hyperedgeThemes = (hyperedgeRows ?? [])
    .map((h) => (h.theme_label as string | null) ?? null)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  let narrativeStageDistribution:
    | { total: number; stages: { stage: string; count: number }[] }
    | undefined;
  if (narrativeRows && narrativeRows.length > 0) {
    const total = narrativeRows.length;
    const cnt = (key: keyof typeof narrativeRows[number]) =>
      narrativeRows.filter((r) => r[key] === true).length;
    narrativeStageDistribution = {
      total,
      stages: [
        { stage: "지적호기심", count: cnt("curiosity_present") },
        { stage: "주제선정", count: cnt("topic_selection_present") },
        { stage: "탐구내용/이론", count: cnt("inquiry_content_present") },
        { stage: "참고문헌", count: cnt("references_present") },
        { stage: "결론/제언", count: cnt("conclusion_present") },
        { stage: "교사관찰", count: cnt("teacher_observation_present") },
        { stage: "성장서사", count: cnt("growth_narrative_present") },
        { stage: "오류분석→재탐구", count: cnt("reinquiry_present") },
      ],
    };
  }

  let profileCardSummary: string | undefined;
  if (profileCardRow) {
    const parts: string[] = [];
    const s = profileCardRow.persistent_strengths as string[] | null;
    const w = profileCardRow.persistent_weaknesses as string[] | null;
    const iss = profileCardRow.recurring_quality_issues as string[] | null;
    const th = profileCardRow.cross_grade_themes as string[] | null;
    const ic = profileCardRow.interest_consistency as string | null;
    if (s?.length) parts.push(`지속 강점: ${s.slice(0, 4).join(", ")}`);
    if (w?.length) parts.push(`지속 약점: ${w.slice(0, 3).join(", ")}`);
    if (iss?.length) parts.push(`반복 품질 이슈: ${iss.slice(0, 3).join(", ")}`);
    if (th?.length) parts.push(`학년 관통 테마: ${th.slice(0, 4).join(", ")}`);
    if (ic) parts.push(`관심사 일관성: ${ic}`);
    if (parts.length > 0) profileCardSummary = parts.join(" | ");
  }

  // PR 4 (2026-04-17) + M1-d (2026-04-27): Blueprint 설계 청사진 로드
  // top-down 목표 (targetConvergences) + 학년별 마일스톤 + 미충족 수렴축 판정
  let blueprintConvergences:
    | Array<{
        grade: number;
        themeLabel: string;
        themeKeywords: string[];
        rationale: string;
        tierAlignment: "foundational" | "development" | "advanced";
      }>
    | undefined;
  let blueprintArc: string | undefined;
  let blueprintMilestones:
    | Array<{
        grade: number;
        keyActivities: string[];
        competencyFocus: string[];
        narrativeGoal: string;
        targetConvergenceCount?: number;
      }>
    | undefined;
  let unfulfilledConvergenceIndices: number[] | undefined;
  try {
    const { loadBlueprintForStudent } = await import(
      "@/lib/domains/record-analysis/blueprint/loader"
    );
    const bp = await loadBlueprintForStudent(studentId, tenantId);
    if (bp && Array.isArray(bp.targetConvergences) && bp.targetConvergences.length > 0) {
      blueprintConvergences = bp.targetConvergences.slice(0, 6).map((c) => ({
        grade: c.grade,
        themeLabel: c.themeLabel,
        themeKeywords: c.themeKeywords ?? [],
        rationale: c.rationale,
        tierAlignment: c.tierAlignment,
      }));

      // M1-d: 미충족 수렴축 판정 — 이미 배정된 가이드 + NEIS 활동 텍스트 풀에서 매칭
      try {
        const { computeUnfulfilledConvergences } = await import(
          "@/lib/domains/record-analysis/blueprint/coverage"
        );
        const [{ data: assignmentRows }, { data: setekRows }, { data: changcheRows }] =
          await Promise.all([
            supabase
              .from("exploration_guide_assignments")
              .select("guide_id, exploration_guides!inner(title)")
              .eq("student_id", studentId)
              .eq("tenant_id", tenantId),
            supabase
              .from("student_record_seteks")
              .select("imported_content, confirmed_content, content")
              .eq("student_id", studentId)
              .eq("tenant_id", tenantId)
              .is("deleted_at", null),
            supabase
              .from("student_record_changche")
              .select("imported_content, confirmed_content, content")
              .eq("student_id", studentId)
              .eq("tenant_id", tenantId),
          ]);

        const assignedTitles: string[] = [];
        for (const row of (assignmentRows ?? []) as Array<{
          exploration_guides: { title: string } | { title: string }[] | null;
        }>) {
          const g = Array.isArray(row.exploration_guides)
            ? row.exploration_guides[0]
            : row.exploration_guides;
          if (g?.title) assignedTitles.push(g.title);
        }

        const neisTexts: string[] = [];
        for (const r of [...(setekRows ?? []), ...(changcheRows ?? [])] as Array<{
          imported_content?: string | null;
          confirmed_content?: string | null;
          content?: string | null;
        }>) {
          const text =
            r.imported_content?.trim() ||
            r.confirmed_content?.trim() ||
            r.content?.trim() ||
            "";
          if (text) neisTexts.push(text.slice(0, 400)); // 400자 캡으로 메모리 보호
        }

        const verdict = computeUnfulfilledConvergences({
          convergences: bp.targetConvergences.slice(0, 6),
          assignedGuideTitles: assignedTitles,
          neisActivityTexts: neisTexts,
        });
        unfulfilledConvergenceIndices = verdict.unfulfilledIndices;
        logActionDebug(
          LOG_CTX,
          `M1-d coverage: ${verdict.unfulfilledIndices.length}/${blueprintConvergences.length} 미충족`,
          { studentId },
        );
      } catch {
        // best-effort — coverage 판정 실패 시 미표시 (기존 동작 유지)
      }
    }
    if (bp?.storylineSkeleton?.narrativeArc) {
      blueprintArc = bp.storylineSkeleton.narrativeArc;
    }

    // M1-d: 학년별 마일스톤 추출
    if (bp?.milestones && typeof bp.milestones === "object") {
      const ms: typeof blueprintMilestones = [];
      for (const [gradeStr, m] of Object.entries(bp.milestones)) {
        const grade = Number(gradeStr);
        if (!Number.isFinite(grade) || !m) continue;
        ms.push({
          grade,
          keyActivities: Array.isArray(m.keyActivities) ? m.keyActivities : [],
          competencyFocus: Array.isArray(m.competencyFocus) ? m.competencyFocus : [],
          narrativeGoal: m.narrativeGoal ?? "",
          targetConvergenceCount: m.targetConvergenceCount,
        });
      }
      ms.sort((a, b) => a.grade - b.grade);
      if (ms.length > 0) blueprintMilestones = ms;
    }
  } catch {
    // best-effort — blueprint 없이 진행
  }

  // 4. AI 호출
  const { generateObjectWithRateLimit } = await import("@/lib/domains/plan/llm/ai-sdk");
  const { geminiQuotaTracker } = await import("@/lib/domains/plan/llm/providers/gemini");
  const { zodSchema } = await import("ai");
  const { explorationDesignSchema } = await import("@/lib/domains/guide/llm/types");
  const {
    buildExplorationDesignSystemPrompt,
    buildExplorationDesignUserPrompt,
  } = await import("@/lib/domains/guide/llm/prompts/exploration-design");

  const quota = geminiQuotaTracker.getQuotaStatus();
  if (quota.isExceeded) {
    logActionWarn(LOG_CTX, "D6: Gemini 할당량 초과 — AI 탐구 설계 스킵", { studentId });
    return { designs: [], overallStrategy: "" };
  }

  const result = await generateObjectWithRateLimit({
    system: buildExplorationDesignSystemPrompt(),
    messages: [{
      role: "user",
      content: buildExplorationDesignUserPrompt({
        targetMajor: (snapshot?.target_major as string) ?? null,
        desiredCareerField: (snapshot?.desired_career_field as string) ?? null,
        designGrade,
        storylines,
        directionGuides,
        plannedSubjects,
        existingGuides: [], // 아직 매칭 전이므로 빈 배열
        neededCount: MIN_GUIDES_FOR_AI_TRIGGER + 1, // 여유 있게 설계 요청
        ...(hyperedgeThemes.length > 0 ? { hyperedgeThemes } : {}),
        ...(narrativeStageDistribution ? { narrativeStageDistribution } : {}),
        ...(profileCardSummary ? { profileCardSummary } : {}),
        ...(blueprintConvergences && blueprintConvergences.length > 0
          ? { blueprintConvergences }
          : {}),
        ...(blueprintArc ? { blueprintArc } : {}),
        ...(blueprintMilestones && blueprintMilestones.length > 0
          ? { blueprintMilestones }
          : {}),
        ...(unfulfilledConvergenceIndices && unfulfilledConvergenceIndices.length > 0
          ? { unfulfilledConvergenceIndices }
          : {}),
      }),
    }],
    schema: zodSchema(explorationDesignSchema),
    modelTier: "fast" as const,
    temperature: 0.4,
    maxTokens: 4096,
  });

  logActionDebug(LOG_CTX, `D6: ${result.object.designs.length}건 탐구 설계 완료`, {
    studentId,
    strategy: result.object.overallStrategy,
  });

  return { designs: result.object.designs, overallStrategy: result.object.overallStrategy };
}

/** 설계 결과를 키워드로 풀에서 매칭 시도 */
async function matchDesignToPool(
  design: ExplorationDesignItem,
  opts: {
    studentId: string;
    classificationId: number | null;
    autoRecommendGuidesAction: (input: { studentId: string; classificationId: number | null; subjectName?: string; limit?: number }) => Promise<{ success: boolean; data?: { id: string; title: string; guide_type: string | null; match_reason: string }[] }>;
  },
): Promise<RankedGuide | null> {
  // 설계의 교과 연계에서 과목명 추출 (예: "생명과학II > 세포와 물질대사" → "생명과학II")
  const subjectName = design.subjectConnect?.split(" > ")[0]?.trim();
  if (!subjectName) return null;

  const result = await opts.autoRecommendGuidesAction({
    studentId: opts.studentId,
    classificationId: opts.classificationId,
    subjectName,
    limit: 5,
  });

  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) return null;

  // 설계 키워드와 제목이 겹치는 가이드를 우선 선택
  const designKeywords = new Set(design.keyTopics.map((k) => k.toLowerCase()));
  let bestMatch = result.data[0];
  let bestOverlap = 0;

  for (const candidate of result.data) {
    const titleLower = candidate.title.toLowerCase();
    let overlap = 0;
    for (const kw of designKeywords) {
      if (titleLower.includes(kw)) overlap++;
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = candidate;
    }
  }

  // 키워드 겹침이 없으면 풀 매칭 실패 — 맥락 불일치
  if (bestOverlap === 0) return null;

  return {
    id: bestMatch.id,
    title: bestMatch.title,
    guide_type: bestMatch.guide_type,
    match_reason: "ai_design_pool_match",
    baseScore: 3,
    continuityScore: 1.0,
    difficultyScore: 1.0,
    sequelBonus: 1.0,
    majorBonus: 1.0,
    storylineBonus: 1.0,
    finalScore: 3.0,
  };
}

/** 풀에 없는 설계 → 셸(queued_generation) 생성. P2: 실패 시 throw하여 호출자가 사유 박제 */
async function createDesignShell(
  design: ExplorationDesignItem,
  ctx: PipelineContext,
): Promise<RankedGuide | null> {
  const { tenantId, studentId, consultingGrades } = ctx;
  const designGrade = (consultingGrades ?? []).length > 0
    ? Math.max(...(consultingGrades ?? []))
    : ctx.studentGrade;

  // title 방어 — zod 스키마는 required지만, AI가 공백/짧은 값을 보낼 수 있어
  // 키토픽/교과연계 기반 fallback 조립. UI의 "(제목 없음)" 폴백 노출을 막기 위함.
  const trimmedTitle = design.title?.trim() ?? "";
  const safeTitle = trimmedTitle.length >= 5
    ? trimmedTitle
    : (design.keyTopics?.[0] ?? design.subjectConnect ?? "탐구 설계")
        + " 탐구";

  // P2 (2026-04-14): synthesis pipeline은 server-autonomous라 RLS 우회용 admin client 필요.
  //   기본 server client는 사용자 권한 → exploration_guides INSERT 시 RLS 정책 차단(42501).
  const { createGuideShell } = await import("@/lib/domains/guide/repository");
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정: synthesis pipeline 진행 불가");
  }
  const guideId = await createGuideShell(
    {
      tenantId,
      title: safeTitle,
      guideType: design.guideType,
      difficultyLevel: design.difficultyLevel,
      sourceType: "ai_pipeline_design",
      aiGenerationMeta: {
        ...design,
        studentId,
        designGrade,
        designedAt: new Date().toISOString(),
      },
    },
    adminClient,
  );

  // P3 라스트마일(2026-04-14): 셸 가이드는 subject_mapping이 비어있어 area-resolver가
  //   학생 과목 슬롯에 link 못함 → 무조건 orphan 처리됐던 문제. design.subjectConnect
  //   ("교과명 > 단원명") 에서 교과명을 normalize 매칭해 subject_mappings 자동 INSERT.
  const subjectName = design.subjectConnect?.split(" > ")[0]?.trim();
  if (subjectName) {
    try {
      const { normalizeSubjectName } = await import("@/lib/domains/subject/normalize");
      const normalized = normalizeSubjectName(subjectName);
      const { data: allSubjects } = await adminClient
        .from("subjects")
        .select("id, name");
      const matchedIds = (allSubjects ?? [])
        .filter((s) => normalizeSubjectName(s.name) === normalized)
        .map((s) => s.id as string);
      if (matchedIds.length > 0) {
        await adminClient
          .from("exploration_guide_subject_mappings")
          .insert(matchedIds.map((sid) => ({ guide_id: guideId, subject_id: sid })));
      }
    } catch {
      // mapping 실패는 셸 생성을 막지 않음 (best-effort). area-resolver에서 orphan 처리됨.
    }
  }

  void logActionError;

  return {
    id: guideId,
    title: safeTitle,
    guide_type: design.guideType,
    match_reason: "ai_designed",
    baseScore: 2,
    continuityScore: 1.0,
    difficultyScore: 1.0,
    sequelBonus: 1.0,
    majorBonus: 1.0,
    storylineBonus: 1.0,
    finalScore: 2.0,
  };
}
