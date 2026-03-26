// ============================================
// Phase C-2: 커리큘럼 확충 오케스트레이터
// Tier 1(기존) → 2(공공API) → 3(웹검색) → 4(LLM추론)
// 모든 Tier 결과 DB 저장 + staleness 점검
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import type { EnrichmentResult, EnrichmentOptions, CurriculumSource, ParsedCourse } from "./types";

const LOG_CTX = { domain: "bypass-major", action: "enrichment" };
const DEFAULT_STALENESS_DAYS = 180; // 6개월

/**
 * 학과의 커리큘럼 데이터를 확충.
 * Tier 1(기존)이 있고 fresh이면 스킵. 없거나 stale이면 Tier 2→3→4 순차 시도.
 */
export async function enrichDepartmentCurriculum(
  departmentId: string,
  options?: EnrichmentOptions,
): Promise<EnrichmentResult | null> {
  const maxTier = options?.maxTier ?? 4;
  const forceRefresh = options?.forceRefresh ?? false;
  const stalenessDays = options?.stalenessThresholdDays ?? DEFAULT_STALENESS_DAYS;

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Admin client 초기화 실패 — SUPABASE_SERVICE_ROLE_KEY 확인 필요");

  // 1. 기존 커리큘럼 상태 확인
  const { data: existing } = await supabase
    .from("department_curriculum")
    .select("id, source, confidence, collected_at, stale_at")
    .eq("department_id", departmentId)
    .limit(1);

  const hasExisting = existing && existing.length > 0;
  const bestSource = hasExisting ? (existing[0].source as CurriculumSource) : null;

  if (hasExisting && !forceRefresh) {
    // fresh이면 스킵
    const staleAt = existing[0].stale_at ? new Date(existing[0].stale_at) : null;
    if (!staleAt || staleAt > new Date()) {
      return {
        departmentId,
        tier: bestSource!,
        coursesAdded: 0,
        confidence: existing[0].confidence as number,
        cached: true,
      };
    }
  }

  // 2. 학과 정보 조회
  const { data: dept } = await supabase
    .from("university_departments")
    .select("university_name, department_name, mid_classification")
    .eq("id", departmentId)
    .single();

  if (!dept) return null;

  const universityName = dept.university_name as string;
  const departmentName = dept.department_name as string;
  const classification = dept.mid_classification as string | null;

  // 3. Tier 순차 시도
  let result: { courses: ParsedCourse[]; confidence: number; tier: CurriculumSource } | null = null;

  // Tier 2: 공공 API (주요교과목명) — TODO: data.go.kr API 연동 시 구현
  // 현재는 스킵하고 Tier 3로 진행
  if (maxTier >= 2 && !result) {
    // 공공 API 연동은 별도 배치 스크립트로 구현 예정
    await logCollection(supabase, departmentId, "public_api", "skipped", 0, null, "API 연동 미구현");
  }

  // Tier 3: 웹 검색 + LLM 파싱
  if (maxTier >= 3 && !result) {
    try {
      const { buildSearchQuery, parseWebSearchResults } = await import("./tier3-web-search");
      const searchQuery = buildSearchQuery(universityName, departmentName);

      // MCP tavily_search 사용 시도
      let searchText = "";
      try {
        // 프로젝트의 웹 검색 서비스 활용 (Gemini Grounding)
        const { generateTextWithRateLimit } = await import("@/lib/domains/plan/llm/ai-sdk");
        const searchResult = await generateTextWithRateLimit({
          system: "웹에서 대학 학과 교육과정 정보를 검색하여 과목 목록을 정리해주세요.",
          messages: [{ role: "user", content: `${searchQuery}\n\n위 검색어로 찾은 교육과정에서 전공필수, 전공선택, 전공기초 과목 목록을 나열해주세요. 과목 유형도 함께 표기하세요.` }],
          modelTier: "fast",
          temperature: 0.1,
          maxTokens: 4000,
          grounding: { enabled: true },
        });
        searchText = searchResult.content ?? "";
      } catch (searchErr) {
        logActionDebug(LOG_CTX, `Tier 3 검색 실패 (${universityName} ${departmentName}): ${searchErr}`);
      }

      if (searchText.length > 50) {
        const parsed = await parseWebSearchResults(universityName, departmentName, searchText);
        if (parsed.courses.length > 0) {
          result = { courses: parsed.courses, confidence: parsed.confidence, tier: "web_search" };
        }
      }

      await logCollection(
        supabase, departmentId, "web_search",
        result ? "success" : "failed",
        result?.courses.length ?? 0,
        searchQuery,
        result ? null : "과목 추출 실패",
      );
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "enrichment.tier3" }, err, { departmentId });
      await logCollection(supabase, departmentId, "web_search", "failed", 0, null, String(err));
    }
  }

  // Tier 4: LLM 추론
  if (maxTier >= 4 && !result) {
    try {
      const { inferCurriculum } = await import("./tier4-ai-inference");
      const inferred = await inferCurriculum(universityName, departmentName, classification);

      if (inferred.courses.length > 0) {
        result = { courses: inferred.courses, confidence: inferred.confidence, tier: "ai_inferred" };
      }

      await logCollection(
        supabase, departmentId, "ai_inferred",
        result ? "success" : "failed",
        result?.courses.length ?? 0,
        null,
        result ? inferred.reasoning : "추론 실패",
      );
    } catch (err) {
      logActionError({ ...LOG_CTX, action: "enrichment.tier4" }, err, { departmentId });
      await logCollection(supabase, departmentId, "ai_inferred", "failed", 0, null, String(err));
    }
  }

  if (!result || result.courses.length === 0) return null;

  // 4. DB 저장 — 기존 같은 source 데이터 교체
  try {
    // forceRefresh 또는 같은/하위 source인 기존 행 삭제
    if (forceRefresh || shouldReplace(bestSource, result.tier)) {
      await supabase
        .from("department_curriculum")
        .delete()
        .eq("department_id", departmentId)
        .in("source", getReplaceSources(result.tier));
    }

    const staleAt = new Date();
    staleAt.setDate(staleAt.getDate() + stalenessDays);

    const insertRows = result.courses.map((c) => ({
      department_id: departmentId,
      course_name: c.courseName,
      course_type: c.courseType,
      semester: c.semester,
      source: result!.tier,
      confidence: result!.confidence,
      collected_at: new Date().toISOString(),
      stale_at: staleAt.toISOString(),
    }));

    const { error: insertErr } = await supabase
      .from("department_curriculum")
      .insert(insertRows);

    if (insertErr) throw insertErr;

    logActionDebug(LOG_CTX, `Enriched ${universityName} ${departmentName}: ${result.courses.length}건 (${result.tier}, confidence=${result.confidence})`);

    return {
      departmentId,
      tier: result.tier,
      coursesAdded: result.courses.length,
      confidence: result.confidence,
      cached: false,
    };
  } catch (err) {
    logActionError({ ...LOG_CTX, action: "enrichment.save" }, err, { departmentId });
    return null;
  }
}

/**
 * 복수 학과에 대해 커리큘럼 확충 실행 (병렬, 동시성 제한)
 */
export async function enrichDepartmentsBatch(
  departmentIds: string[],
  options?: EnrichmentOptions,
  concurrency = 2,
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];
  const queue = [...departmentIds]; // 작업 큐 (shift로 소비 — 레이스 안전)

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const deptId = queue.shift();
      if (!deptId) break;
      const result = await enrichDepartmentCurriculum(deptId, options);
      if (result) results.push(result);
    }
  });

  await Promise.allSettled(workers);
  return results;
}

// ─── 헬퍼 ──────────────────────────────────

/** 상위 Tier가 하위 Tier를 교체할 수 있는지 판단 */
function shouldReplace(existingSource: CurriculumSource | null, newSource: CurriculumSource): boolean {
  if (!existingSource) return true;
  const priority: Record<CurriculumSource, number> = {
    import: 4,
    web_search: 3,
    public_api: 2,
    ai_inferred: 1,
  };
  return priority[newSource] >= priority[existingSource];
}

/** 교체 대상 source 목록 (자신 이하) */
function getReplaceSources(tier: CurriculumSource): CurriculumSource[] {
  switch (tier) {
    case "import": return ["import", "public_api", "web_search", "ai_inferred"];
    case "web_search": return ["web_search", "ai_inferred"];
    case "public_api": return ["public_api", "ai_inferred"];
    case "ai_inferred": return ["ai_inferred"];
  }
}

/** curriculum_collection_log에 수집 이력 기록 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logCollection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  departmentId: string,
  tier: string,
  status: string,
  coursesFound: number,
  searchQuery: string | null,
  errorMessage: string | null,
) {
  await supabase.from("curriculum_collection_log").insert({
    department_id: departmentId,
    tier,
    status,
    courses_found: coursesFound,
    search_query: searchQuery,
    error_message: errorMessage,
    completed_at: status !== "pending" ? new Date().toISOString() : null,
  }).then(() => {}).catch((err: unknown) => {
    logActionDebug(LOG_CTX, `curriculum_collection_log 저장 실패: ${err}`);
  });
}
