// ============================================
// pipeline-task-runners-main-theme.ts
//
// P3.6 (M1-c W1+W2, 2026-04-27): derive_main_theme 태스크 runner.
//
// 역할:
//   1. 학생 입력(전공/계열/수강계획/NEIS 발췌) 수집
//   2. structural_hash 기반 staleness 판정 — 변경 없으면 LLM 호출 0회로 cache hit
//   3. deriveMainTheme + buildCascadePlan capability 순차 호출
//   4. ctx.results["_mainTheme"] / ["_cascadePlan"] 영속화 (Synthesis D4 시딩 회수)
//   5. ctx.belief.mainTheme / cascadePlan 즉시 업데이트 (현 세션 downstream 소비 가능)
//
// graceful — 실패해도 가이드 진입에 영향 없음. 단, ctx 결과는 themeOk=false 로 기록.
// ============================================

import type { PipelineContext } from "./pipeline-types";
import { logActionWarn, logActionDebug } from "@/lib/logging/actionLogger";
import { deriveMainTheme, type MainTheme } from "../capability/main-theme";
import { buildCascadePlan, type CascadePlan } from "../capability/cascade-plan";
import { reconcileCascadeEvidence } from "../capability/cascade-evidence";

const LOG_CTX = { domain: "record-analysis", action: "pipeline-runner-main-theme" };

/** djb2 hash — profileCard / pipeline-task-runners-shared 와 동일 패턴. */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * 학생 입력으로부터 structural_hash 계산.
 * 변경 감지 단위 = 전공 + 계열 + KEDI 분류 + NEIS 활동 텍스트 길이 합 + 수강계획 학년/과목 라벨.
 * 활동 텍스트 자체는 길어 hash 입력에 부적합 → 길이 + 학년만 사용.
 */
function computeStructuralHash(payload: {
  targetMajor: string | null;
  careerFieldHint: string | null;
  classificationLabel: string | null;
  neisLengths: Array<{ grade: number; len: number }>;
  coursePlan: Array<{ grade: number; subjects: string[] }>;
}): string {
  const parts: string[] = [
    `m:${payload.targetMajor ?? ""}`,
    `c:${payload.careerFieldHint ?? ""}`,
    `k:${payload.classificationLabel ?? ""}`,
    "n:" +
      payload.neisLengths
        .sort((a, b) => a.grade - b.grade)
        .map((n) => `${n.grade}=${n.len}`)
        .join(","),
    "p:" +
      payload.coursePlan
        .sort((a, b) => a.grade - b.grade)
        .map((p) => `${p.grade}=${p.subjects.slice().sort().join("|")}`)
        .join(","),
  ];
  return djb2Hash(parts.join("\n"));
}

interface PreviousMainThemePersistence {
  mainTheme?: MainTheme;
  cascadePlan?: CascadePlan;
  structuralHash?: string;
}

async function loadPreviousPersistence(
  ctx: PipelineContext,
): Promise<PreviousMainThemePersistence> {
  // 동일 학생의 직전 completed pipeline (어느 type 든) task_results 에서 회수.
  const { data: rows } = await ctx.supabase
    .from("student_record_analysis_pipelines")
    .select("task_results, completed_at, pipeline_type")
    .eq("student_id", ctx.studentId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(8);
  const out: PreviousMainThemePersistence = {};
  for (const row of (rows ?? []) as Array<{ task_results: unknown }>) {
    const tr = row.task_results as Record<string, unknown> | null;
    if (!tr) continue;
    if (!out.mainTheme && tr._mainTheme) out.mainTheme = tr._mainTheme as MainTheme;
    if (!out.cascadePlan && tr._cascadePlan) out.cascadePlan = tr._cascadePlan as CascadePlan;
    const meta = tr._mainThemeMeta as { structuralHash?: string } | undefined;
    if (!out.structuralHash && meta?.structuralHash) out.structuralHash = meta.structuralHash;
    if (out.mainTheme && out.cascadePlan && out.structuralHash) break;
  }
  return out;
}

/**
 * derive_main_theme 태스크 runner.
 * 결과 형식은 PipelineTaskResultMap.derive_main_theme 와 일치.
 */
export async function runDeriveMainThemeForGrade(
  ctx: PipelineContext,
): Promise<{
  themeOk: boolean;
  cascadeOk: boolean;
  fromCache: boolean;
  structuralHash?: string;
  skipped?: boolean;
  skipReason?: string;
}> {
  const startedAt = Date.now();

  // 1. 학생 스냅샷에서 진로 정보 수집
  const snapshot = ctx.snapshot ?? {};
  const targetMajor = (snapshot.target_major as string | null) ?? null;
  const careerFieldHint = (snapshot.desired_career_field as string | null) ?? null;
  const classificationId = (snapshot.classification_id as number | null) ?? null;

  // 진로 정보 전무 → graceful skip (LLM 호출 자체가 의미 없음)
  if (!targetMajor && !careerFieldHint && classificationId == null) {
    logActionDebug(LOG_CTX, "진로 정보 전무 → skip", { studentId: ctx.studentId });
    return {
      themeOk: false,
      cascadeOk: false,
      fromCache: false,
      skipped: true,
      skipReason: "no_career_info",
    };
  }

  // 2. KEDI 분류 라벨 조회 (있으면)
  let classificationLabel: string | null = null;
  if (classificationId != null) {
    try {
      const { data: classRow } = await ctx.supabase
        .from("kedi_classifications")
        .select("name")
        .eq("id", classificationId)
        .maybeSingle();
      classificationLabel = (classRow?.name as string | null) ?? null;
    } catch {
      // best-effort
    }
  }

  // 3. NEIS 발췌 — analysisContext + raw 4-layer 콘텐츠 합쳐 학년별 요약
  const neisExtractsByGrade: Record<number, Array<{ category: string; summary: string }>> = {};
  const neisLengths: Array<{ grade: number; len: number }> = [];
  const resolved = ctx.belief.resolvedRecords ?? {};
  for (const [gradeStr, perGrade] of Object.entries(resolved)) {
    const grade = Number(gradeStr);
    if (!Number.isFinite(grade) || !perGrade) continue;
    const list: Array<{ category: string; summary: string }> = [];
    let totalLen = 0;
    // M1-c W3 hotfix (2026-04-27): resolvedRecords 의 seteks/changche/haengteuk 는
    // 일부 학년/모드에서 Array 가 아닌 값(undefined, object)일 수 있어 Array.isArray 가드 필수.
    // 미가드 시 .slice is not a function 런타임 에러 → derive_main_theme 실패 → cascade skip.
    const seteksRaw = (perGrade as { seteks?: unknown }).seteks;
    const seteks = Array.isArray(seteksRaw) ? (seteksRaw as Array<{ effectiveContent?: string }>) : [];
    for (const s of seteks.slice(0, 6)) {
      const text = (s.effectiveContent ?? "").slice(0, 200);
      if (text) {
        list.push({ category: "setek", summary: text });
        totalLen += text.length;
      }
    }
    const changcheRaw = (perGrade as { changche?: unknown }).changche;
    const changche = Array.isArray(changcheRaw) ? (changcheRaw as Array<{ effectiveContent?: string }>) : [];
    for (const c of changche.slice(0, 4)) {
      const text = (c.effectiveContent ?? "").slice(0, 200);
      if (text) {
        list.push({ category: "changche", summary: text });
        totalLen += text.length;
      }
    }
    // haengteuk 는 ResolvedRecord | null (학년당 단일 객체) — Array 가 아님 (pipeline-types.ts:393).
    // 이전 버전은 Array 로 가정하고 .slice(0,2) 호출 → 런타임 에러로 derive_main_theme 실패.
    const haengteukRaw = (perGrade as { haengteuk?: { effectiveContent?: string } | null }).haengteuk;
    if (haengteukRaw && typeof haengteukRaw === "object") {
      const text = (haengteukRaw.effectiveContent ?? "").slice(0, 200);
      if (text) {
        list.push({ category: "haengteuk", summary: text });
        totalLen += text.length;
      }
    }
    if (list.length > 0) neisExtractsByGrade[grade] = list;
    neisLengths.push({ grade, len: totalLen });
  }

  // 4. 수강계획 — coursePlanData.plans 에서 학년별 과목명
  const coursePlan: Array<{ grade: number; subjects: string[] }> = [];
  const coursePlanByGrade: Record<number, string[]> = {};
  const plans = (ctx.coursePlanData?.plans ?? []) as Array<{
    grade?: number;
    subject_name?: string | null;
  }>;
  for (const p of plans) {
    if (p.grade == null || !p.subject_name) continue;
    if (!coursePlanByGrade[p.grade]) coursePlanByGrade[p.grade] = [];
    coursePlanByGrade[p.grade].push(p.subject_name);
  }
  for (const [g, subjects] of Object.entries(coursePlanByGrade)) {
    coursePlan.push({ grade: Number(g), subjects });
  }

  // 5. structural hash + cache hit 판정
  const structuralHash = computeStructuralHash({
    targetMajor,
    careerFieldHint,
    classificationLabel,
    neisLengths,
    coursePlan,
  });
  const previous = await loadPreviousPersistence(ctx);
  if (
    previous.mainTheme &&
    previous.cascadePlan &&
    previous.structuralHash === structuralHash
  ) {
    // cache hit — LLM 호출 스킵, 이전 결과 재시딩
    ctx.results["_mainTheme"] = previous.mainTheme as unknown as Record<string, unknown>;
    ctx.results["_cascadePlan"] = previous.cascadePlan as unknown as Record<string, unknown>;
    ctx.results["_mainThemeMeta"] = { structuralHash } as unknown as Record<string, unknown>;
    ctx.belief.mainTheme = previous.mainTheme;
    ctx.belief.cascadePlan = previous.cascadePlan;
    logActionDebug(LOG_CTX, "cache hit (structuralHash 일치) — LLM 호출 스킵", {
      studentId: ctx.studentId,
      hash: structuralHash,
    });
    return {
      themeOk: true,
      cascadeOk: true,
      fromCache: true,
      structuralHash,
    };
  }

  // 6. deriveMainTheme 호출
  const neisExtracts: Array<{ grade: number; category: string; summary: string }> = [];
  for (const [gradeStr, list] of Object.entries(neisExtractsByGrade)) {
    const grade = Number(gradeStr);
    for (const ex of list) neisExtracts.push({ grade, ...ex });
  }
  const themeRes = await deriveMainTheme({
    studentProfile: { targetMajor, careerFieldHint, classificationLabel },
    neisExtracts: neisExtracts.length > 0 ? neisExtracts : undefined,
    coursePlan: coursePlan.length > 0 ? coursePlan : undefined,
    previousTheme: previous.mainTheme ?? null,
  });

  if (!themeRes.ok) {
    logActionWarn(LOG_CTX, `deriveMainTheme 실패: ${themeRes.reason}`, {
      studentId: ctx.studentId,
    });
    return {
      themeOk: false,
      cascadeOk: false,
      fromCache: false,
      structuralHash,
    };
  }

  ctx.results["_mainTheme"] = themeRes.theme as unknown as Record<string, unknown>;
  ctx.belief.mainTheme = themeRes.theme;

  // 7. buildCascadePlan 호출
  const targetGrades = computeTargetGrades(ctx);
  const cascadeRes = await buildCascadePlan({
    mainTheme: themeRes.theme,
    targetGrades,
    currentGrade: ctx.studentGrade,
    neisExtractsByGrade:
      Object.keys(neisExtractsByGrade).length > 0 ? neisExtractsByGrade : undefined,
    coursePlanByGrade:
      Object.keys(coursePlanByGrade).length > 0 ? coursePlanByGrade : undefined,
    blueprintConvergences:
      ctx.belief.blueprint?.targetConvergences?.slice(0, 6) ?? undefined,
  });

  if (cascadeRes.ok) {
    // 옵션 A-2 (W3): cascade evidence 코드 후처리 — LLM 가짜 evidence 차단 + 코드 매칭 폴백.
    const reconciled = reconcileCascadeEvidence({
      plan: cascadeRes.plan,
      neisExtractsByGrade:
        Object.keys(neisExtractsByGrade).length > 0 ? neisExtractsByGrade : undefined,
      mainTheme: themeRes.theme,
    });
    const removedCount = reconciled.changes.filter((c) => c.action === "cleared" || c.action === "filtered").length;
    const addedCount = reconciled.changes.filter((c) => c.action === "auto-filled").length;
    if (removedCount > 0 || addedCount > 0) {
      logActionDebug(
        LOG_CTX,
        `evidence 후처리: ${removedCount}개 제거 / ${addedCount}개 자동 채움`,
        { studentId: ctx.studentId },
      );
    }
    ctx.results["_cascadePlan"] = reconciled.plan as unknown as Record<string, unknown>;
    ctx.belief.cascadePlan = reconciled.plan;
  } else {
    logActionWarn(LOG_CTX, `buildCascadePlan 실패: ${cascadeRes.reason}`, {
      studentId: ctx.studentId,
    });
  }

  // M1-c W6 hotfix (2026-04-28): cascadePlan fail reason 영속 (silent fail 진단 강화).
  // 사용자 dev terminal 로그 외에 task_results 에서도 zod 실패 사유 직접 확인 가능.
  ctx.results["_mainThemeMeta"] = {
    structuralHash,
    cascadeOk: cascadeRes.ok,
    ...(cascadeRes.ok ? {} : { cascadeFailReason: cascadeRes.reason }),
  } as unknown as Record<string, unknown>;

  logActionDebug(
    LOG_CTX,
    `derive_main_theme 완료 — themeOk=true cascadeOk=${cascadeRes.ok} elapsed=${Date.now() - startedAt}ms`,
    { studentId: ctx.studentId, hash: structuralHash },
  );

  return {
    themeOk: true,
    cascadeOk: cascadeRes.ok,
    fromCache: false,
    structuralHash,
  };
}

/** target grades 결정 — 분석/설계 학년 합집합. 빈 경우 [1,2,3] 폴백. */
function computeTargetGrades(ctx: PipelineContext): number[] {
  const all = new Set<number>();
  for (const g of ctx.neisGrades ?? []) all.add(g);
  for (const g of ctx.consultingGrades ?? []) all.add(g);
  if (all.size === 0) return [1, 2, 3];
  return Array.from(all).sort((a, b) => a - b);
}
