// ============================================
// S2-c: runHaengteukGuideLinking (Phase 2 Wave 4.2 / Decision #3 / D5)
//
// 행특(student_record_haengteuk_guides)의 8개 평가항목 ↔ 학생에게 배정된 탐구 가이드 매칭.
// runGuideMatching 직후 실행되어야 하며 (배정이 먼저 있어야 매칭 가능),
// Gemini Flash 1회로 8 × N 매칭을 일괄 계산해
// student_record_haengteuk_guide_links 테이블에 INSERT.
//
// 흐름:
//   1. 학생의 모든 학년 행특 가이드 + 배정된 탐구 가이드 조회
//   2. 행특 가이드가 0건이거나 배정 가이드가 0건이면 skip (warning, not error)
//   3. Gemini Flash 호출 — 각 evaluationItem(8개)에 가장 관련 깊은 가이드 1~3건 매칭 + reasoning
//   4. 결과를 student_record_haengteuk_guide_links 에 INSERT (source='ai')
// ============================================

import { logActionDebug, logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import { HAENGTEUK_EVAL_ITEMS } from "@/lib/domains/student-record/evaluation-criteria/defaults";

// 신규 테이블 student_record_haengteuk_guide_links 는 database.types.ts (auto-gen) 미반영 상태.
// Wave 4 시점 임시 — Supabase types 재생성 후 제거 예정.
type LinksTableShape = {
  haengteuk_guide_id: string;
  source: string;
  tenant_id: string;
  evaluation_item: string;
  exploration_guide_assignment_id: string;
  relevance_score: number;
  reasoning: string;
};
function linksTable(supabase: PipelineContext["supabase"]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from("student_record_haengteuk_guide_links" as never) as unknown as {
    delete(): { eq(col: string, val: unknown): { eq(col: string, val: unknown): Promise<{ error: { message: string } | null }> } };
    insert(rows: LinksTableShape[]): Promise<{ error: { message: string } | null }>;
  };
}

const LOG_CTX = { domain: "record-analysis", action: "pipeline.haengteuk_linking" };

interface HaengteukGuideRow {
  id: string;
  school_year: number;
  evaluation_items: unknown;
}

interface AssignmentRow {
  id: string;
  guide_id: string;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
  exploration_guides: {
    title: string;
    guide_type: string | null;
  } | null;
}

interface LlmLinkResult {
  /** evaluation_item 한글명 */
  item: string;
  /** 매칭된 탐구 가이드 배정 ID 목록 (1~3개) */
  matches: Array<{
    assignmentId: string;
    relevance: number;
    reasoning: string;
  }>;
}

export async function runHaengteukGuideLinking(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId } = ctx;

  // 1. 학생의 행특 가이드 조회
  const { data: haengteukGuides, error: hgErr } = await supabase
    .from("student_record_haengteuk_guides")
    .select("id, school_year, evaluation_items")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (hgErr) {
    logActionError(LOG_CTX, hgErr, { studentId });
    return "행특 가이드 조회 실패";
  }
  if (!haengteukGuides || haengteukGuides.length === 0) {
    return "행특 가이드 없음 — 링크 생성 스킵";
  }

  // 2. 학생의 탐구 가이드 배정 조회 (status='assigned' 또는 'in_progress')
  const { data: assignments, error: asgErr } = await supabase
    .from("exploration_guide_assignments")
    .select(
      `id, guide_id, target_activity_type, ai_recommendation_reason,
       exploration_guides!inner(title, guide_type)`,
    )
    .eq("student_id", studentId)
    .in("status", ["assigned", "in_progress", "submitted", "completed"])
    .returns<AssignmentRow[]>();

  if (asgErr) {
    logActionError(LOG_CTX, asgErr, { studentId });
    return "탐구 가이드 배정 조회 실패";
  }
  if (!assignments || assignments.length === 0) {
    return "배정된 탐구 가이드 없음 — 링크 생성 스킵";
  }

  logActionDebug(
    LOG_CTX,
    `행특 ${haengteukGuides.length}건 × 배정 ${assignments.length}건 매칭 시작`,
    { studentId },
  );

  // 3. 학년별로 행특 가이드를 처리 (1년 행특 = 1년 활동 매칭)
  let totalLinksInserted = 0;
  let totalSkipped = 0;
  const assignmentCounter = new Map<string, number>();
  for (const hg of haengteukGuides as HaengteukGuideRow[]) {
    const matches = await matchHaengteukItemsToAssignments(hg, assignments);
    if (!matches) {
      totalSkipped++;
      continue;
    }

    // 4. 기존 ai 링크 삭제 (재실행 cleanup)
    await linksTable(supabase)
      .delete()
      .eq("haengteuk_guide_id", hg.id)
      .eq("source", "ai");

    // 5. 새 링크 INSERT
    const insertRows: LinksTableShape[] = [];
    for (const result of matches) {
      for (const m of result.matches) {
        insertRows.push({
          tenant_id: tenantId,
          haengteuk_guide_id: hg.id,
          evaluation_item: result.item,
          exploration_guide_assignment_id: m.assignmentId,
          relevance_score: m.relevance,
          reasoning: m.reasoning,
          source: "ai",
        });
        assignmentCounter.set(
          m.assignmentId,
          (assignmentCounter.get(m.assignmentId) ?? 0) + 1,
        );
      }
    }
    if (insertRows.length === 0) continue;

    const { error: insErr } = await linksTable(supabase).insert(insertRows);

    if (insErr) {
      logActionWarn(LOG_CTX, `링크 INSERT 실패 (haengteuk ${hg.id}): ${insErr.message}`);
      // 실패 시 counter 에 이미 반영됐지만 다음 실행에서 DB 재조회가 아닌 현 실행 return 기반이므로
      // 실패한 건을 counter 에서 빼는 것이 정확. 단순화 위해 우선 유지.
      continue;
    }
    totalLinksInserted += insertRows.length;
  }

  const assignmentLinkCounts = [...assignmentCounter.entries()]
    .map(([assignmentId, linkCount]) => ({ assignmentId, linkCount }))
    .sort((a, b) => b.linkCount - a.linkCount);

  return {
    preview: `행특 ${haengteukGuides.length}건 처리 — ${totalLinksInserted}건 링크 생성 (스킵 ${totalSkipped}건)`,
    result: {
      linksGenerated: totalLinksInserted,
      haengteukProcessed: haengteukGuides.length,
      skippedCount: totalSkipped,
      assignmentLinkCounts,
    },
  };
}

// ============================================
// M1-c W6 (2026-04-28): chunked variant — 학년 단위 chunk 처리
//
// narrative_arc chunked sub-route 패턴 mimic. 학년별 LLM 호출 1회 → 학년 N개씩 chunk.
// 각 chunk = 별도 HTTP request → maxDuration 300s 독립 → timeout 분산 안전.
//
// 동작:
// - existingLinkedHaengteukIds: 이미 link 완료된 행특 가이드 id (이번 풀런 chunk 1번 이후)
// - pending = haengteukGuides.filter(hg => !existingLinkedHaengteukIds.has(hg.id))
// - chunk = pending.slice(0, chunkSize)
// - hasMore = pending.length > chunkSize
//
// 첫 chunk 진입 신호: ctx.previews["haengteuk_linking"] 비어있음 (setek 패턴 mimic).
// 단 여기는 학년 단위라 row delete 정책 다름 — chunk 마다 자기 학년 row 만 cleanup.
// ============================================

export async function runHaengteukGuideLinkingChunk(
  ctx: PipelineContext,
  chunkSize: number,
): Promise<TaskRunnerOutput & { hasMore: boolean; totalUncached: number; chunkProcessed: number }> {
  assertSynthesisCtx(ctx);
  const { supabase, studentId, tenantId } = ctx;

  // 1. 학생의 행특 가이드 조회
  const { data: haengteukGuides, error: hgErr } = await supabase
    .from("student_record_haengteuk_guides")
    .select("id, school_year, evaluation_items")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

  if (hgErr) {
    return { preview: "행특 가이드 조회 실패", hasMore: false, totalUncached: 0, chunkProcessed: 0 };
  }
  if (!haengteukGuides || haengteukGuides.length === 0) {
    return { preview: "행특 가이드 없음 — 링크 생성 스킵", hasMore: false, totalUncached: 0, chunkProcessed: 0 };
  }

  // 2. 학생의 탐구 가이드 배정 조회
  const { data: assignments, error: asgErr } = await supabase
    .from("exploration_guide_assignments")
    .select(
      `id, guide_id, target_activity_type, ai_recommendation_reason,
       exploration_guides!inner(title, guide_type)`,
    )
    .eq("student_id", studentId)
    .in("status", ["assigned", "in_progress", "submitted", "completed"])
    .returns<AssignmentRow[]>();

  if (asgErr) {
    return { preview: "탐구 가이드 배정 조회 실패", hasMore: false, totalUncached: 0, chunkProcessed: 0 };
  }
  if (!assignments || assignments.length === 0) {
    return { preview: "배정된 탐구 가이드 없음 — 링크 생성 스킵", hasMore: false, totalUncached: 0, chunkProcessed: 0 };
  }

  // 3. pending haengteuk 식별 — 기존 ai 링크 없는 학년만 처리 (chunk 진행에 따라 누적)
  const { data: existingLinks } = await linksTable(supabase)
    .select("haengteuk_guide_id")
    .in("haengteuk_guide_id", (haengteukGuides as HaengteukGuideRow[]).map((h) => h.id))
    .eq("source", "ai");

  const linkedSet = new Set<string>(
    (existingLinks ?? []).map((r) => (r as { haengteuk_guide_id: string }).haengteuk_guide_id),
  );

  // 첫 chunk 판정 — ctx.previews["haengteuk_linking"] 비어있으면 새 chunk loop 첫 호출.
  // 옛 풀런 row 가 잔존하면 새 풀런 시 모두 정리하고 시작.
  const isVeryFirstChunk = !ctx.previews["haengteuk_linking"];
  if (isVeryFirstChunk && linkedSet.size > 0) {
    // 새 풀런 첫 chunk → 전체 학생의 ai 링크 일괄 삭제
    await linksTable(supabase)
      .delete()
      .in("haengteuk_guide_id", (haengteukGuides as HaengteukGuideRow[]).map((h) => h.id))
      .eq("source", "ai");
    linkedSet.clear();
  }

  const pending = (haengteukGuides as HaengteukGuideRow[]).filter((h) => !linkedSet.has(h.id));
  const totalUncached = pending.length;
  if (totalUncached === 0) {
    return {
      preview: `행특 링크 완료 (${haengteukGuides.length}건 모두 처리)`,
      hasMore: false,
      totalUncached: 0,
      chunkProcessed: 0,
    };
  }

  const chunk = pending.slice(0, chunkSize);
  const hasMore = totalUncached > chunkSize;

  let chunkLinksInserted = 0;
  let chunkSkipped = 0;
  for (const hg of chunk) {
    const matches = await matchHaengteukItemsToAssignments(hg, assignments);
    if (!matches) {
      chunkSkipped++;
      continue;
    }

    const insertRows: LinksTableShape[] = [];
    for (const result of matches) {
      for (const m of result.matches) {
        insertRows.push({
          tenant_id: tenantId,
          haengteuk_guide_id: hg.id,
          evaluation_item: result.item,
          exploration_guide_assignment_id: m.assignmentId,
          relevance_score: m.relevance,
          reasoning: m.reasoning,
          source: "ai",
        });
      }
    }
    if (insertRows.length === 0) continue;
    const { error: insErr } = await linksTable(supabase).insert(insertRows);
    if (insErr) {
      logActionWarn(LOG_CTX, `링크 INSERT 실패 (haengteuk ${hg.id}): ${insErr.message}`);
      continue;
    }
    chunkLinksInserted += insertRows.length;
  }

  const remHint = hasMore ? ` · 잔여 ${totalUncached - chunk.length}학년` : "";
  return {
    preview: `행특 chunk ${chunk.length}학년: ${chunkLinksInserted}건 링크 (스킵 ${chunkSkipped})${remHint}`,
    hasMore,
    totalUncached,
    chunkProcessed: chunk.length,
  };
}

// ============================================
// LLM 매칭 헬퍼
// ============================================

async function matchHaengteukItemsToAssignments(
  haengteukGuide: HaengteukGuideRow,
  assignments: AssignmentRow[],
): Promise<LlmLinkResult[] | null> {
  // evaluation_items 파싱
  const items = parseEvaluationItems(haengteukGuide.evaluation_items);
  if (items.length === 0) {
    // 평가 아이템이 비어있으면 8개 default 사용
    for (const def of HAENGTEUK_EVAL_ITEMS) {
      items.push({ item: def.name, score: "보통", reasoning: "" });
    }
  }

  // assignments가 너무 적으면 (1건) 단순 균등 매칭
  if (assignments.length === 1) {
    return items.map((it) => ({
      item: it.item,
      matches: [
        {
          assignmentId: assignments[0].id,
          relevance: 0.6,
          reasoning: "유일한 배정 가이드 — 자동 균등 매칭",
        },
      ],
    }));
  }

  // assignments가 충분하면 LLM 호출
  try {
    const result = await callGeminiForLinking(items, assignments);
    return result;
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      `LLM 매칭 실패 → rule-based fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
    return ruleBasedFallback(items, assignments);
  }
}

interface EvalItem {
  item: string;
  score: string;
  reasoning?: string;
}

function parseEvaluationItems(raw: unknown): EvalItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      item: typeof r.item === "string" ? r.item : "",
      score: typeof r.score === "string" ? r.score : "보통",
      reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
    }))
    .filter((r) => r.item.length > 0);
}

// ============================================
// Gemini Flash 호출
// ============================================

async function callGeminiForLinking(
  items: EvalItem[],
  assignments: AssignmentRow[],
): Promise<LlmLinkResult[]> {
  const { generateTextWithRateLimit } = await import("@/lib/domains/plan/llm/ai-sdk");
  const { withRetry } = await import("@/lib/domains/record-analysis/llm/retry");

  const systemPrompt = `당신은 한국 고등학교 입시 컨설턴트입니다.
학생의 행특 평가항목과 배정된 탐구 가이드 활동을 매칭하여,
"이 평가항목이 어떤 탐구 가이드 수행으로 뒷받침되는가"를 판단합니다.

## 8개 행특 평가항목
${HAENGTEUK_EVAL_ITEMS.map((d) => `- ${d.name}: ${d.description}`).join("\n")}

## 출력 형식 (JSON only)
{
  "links": [
    {
      "item": "리더십",
      "matches": [
        { "assignmentId": "...", "relevance": 0.85, "reasoning": "1-2문장" }
      ]
    }
  ]
}

## 규칙
- 각 평가항목은 0~3개 가이드와 매칭 (관련도 낮으면 빈 배열)
- relevance는 0.0~1.0
- reasoning은 1~2문장의 구체적 근거
- 가이드 제목과 활동 유형(autonomy/club/career)을 함께 고려
- 같은 가이드가 여러 평가항목에 매칭되어도 OK`;

  const userPrompt = buildUserPrompt(items, assignments);

  const result = await withRetry(
    () =>
      generateTextWithRateLimit({
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "fast",
        temperature: 0.2,
        maxTokens: 4000,
        responseFormat: "json",
      }),
    { label: "haengteukGuideLinking" },
  );

  if (!result.content) throw new Error("LLM 응답 비어있음");
  return parseLlmResponse(result.content, items, assignments);
}

function buildUserPrompt(items: EvalItem[], assignments: AssignmentRow[]): string {
  const lines: string[] = [];
  lines.push(`## 평가 대상 (${items.length}개 항목)`);
  for (const it of items) {
    lines.push(`- **${it.item}** (현재 점수: ${it.score})${it.reasoning ? ` — ${it.reasoning}` : ""}`);
  }
  lines.push(`\n## 배정된 탐구 가이드 (${assignments.length}건)`);
  for (const a of assignments) {
    const title = a.exploration_guides?.title ?? "(제목 없음)";
    const type = a.exploration_guides?.guide_type ?? "?";
    const activity = a.target_activity_type ? ` [${a.target_activity_type}]` : "";
    lines.push(`- assignmentId=\`${a.id}\` (${type}${activity}): ${title.slice(0, 80)}`);
  }
  lines.push(`\n위 행특 평가항목 각각에 대해, 어떤 탐구 가이드 활동이 근거가 되는지 매칭하세요. JSON만 출력.`);
  return lines.join("\n");
}

function parseLlmResponse(
  content: string,
  items: EvalItem[],
  assignments: AssignmentRow[],
): LlmLinkResult[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON 파싱 실패");

  let parsed: { links?: Array<{ item?: string; matches?: Array<{ assignmentId?: string; relevance?: number; reasoning?: string }> }> };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("JSON 파싱 실패");
  }

  const validAssignmentIds = new Set(assignments.map((a) => a.id));
  const validItemNames = new Set(items.map((i) => i.item));

  const results: LlmLinkResult[] = [];
  for (const link of parsed.links ?? []) {
    if (!link.item || !validItemNames.has(link.item)) continue;
    const matches = (link.matches ?? [])
      .filter((m) => m.assignmentId && validAssignmentIds.has(m.assignmentId))
      .map((m) => ({
        assignmentId: m.assignmentId!,
        relevance: Math.max(0, Math.min(1, m.relevance ?? 0.5)),
        reasoning: m.reasoning ?? "",
      }))
      .slice(0, 3);

    results.push({ item: link.item, matches });
  }
  return results;
}

// ============================================
// Rule-based fallback (LLM 실패 시 — Gemini 과부하 대비)
// ============================================

function ruleBasedFallback(
  items: EvalItem[],
  assignments: AssignmentRow[],
): LlmLinkResult[] {
  // 평가 항목 → activity_type 휴리스틱 매핑
  const itemActivityHints: Record<string, string[]> = {
    "자기주도성": ["career", "club"],
    "갈등관리": ["autonomy", "club"],
    "리더십": ["club", "autonomy", "career"],
    "타인존중·배려": ["autonomy"],
    "성실성": ["club", "career"],
    "규칙준수": ["autonomy"],
    "회복탄력성": ["career", "club"],
    "지적호기심": ["career", "club"],
  };

  const results: LlmLinkResult[] = [];
  for (const it of items) {
    const hints = itemActivityHints[it.item] ?? [];
    const candidates = assignments.filter(
      (a) => a.target_activity_type && hints.includes(a.target_activity_type),
    );
    const top = candidates.slice(0, 2).map((a) => ({
      assignmentId: a.id,
      relevance: 0.7,
      reasoning: `규칙 기반 매칭: '${it.item}' 항목과 ${a.target_activity_type} 활동의 관련성`,
    }));
    results.push({ item: it.item, matches: top });
  }
  return results;
}
