// ============================================
// pipeline/slots/shadow-score-runner.ts
//
// Step B (Shadow 측정 모드, 2026-04-29).
//
// applyContinuityRanking 산출 RankedGuide[] 옆에 slot-aware-score 점수를 병행 산출.
// 매칭 로직 변경 없음 — 결과는 ctx.results._slotAwareScores 에만 박제.
//
// 측정 목적:
//   1) 9 승수 ranking Top-N 과 slot-aware Top-N 의 overlap 분포
//   2) 빈 슬롯 별 후보 적합도 (현재 Top-K 가 어느 슬롯도 채우지 못하는 케이스 식별)
//   3) tierFit/subjectFit 보너스의 분포
//
// 한계 (현 단계 수용):
//   - 가이드 키워드/역량/마일스톤은 정규화 테이블 부재 → focusFit/weaknessFix/milestoneFill 항상 0
//   - 후속 단계에서 keyword 추출 + competency 추론 추가 시 본 모듈은 시그니처 변경 없이 보강 가능
// ============================================

import { scoreGuideForSlot, type ScoreableGuide, type ScoreableStudent, type ScoreBreakdown } from "./slot-aware-score";
import type { Slot, SlotDifficulty } from "./types";
import type { RankedGuide } from "@/lib/domains/guide/capability/ranking";
import type { PipelineContext } from "../pipeline-types";

interface ShadowScoreInput {
  ctx: PipelineContext;
  studentId: string;
  tenantId: string;
  ranked: RankedGuide[];
  /** Step A 에서 산출된 학년별 cap. shadow-run 과 동일 산식 결과를 재사용. */
  maxDifficultyByGrade: Record<number, SlotDifficulty>;
  /** 학생의 진로 분야 — careerCompatibility 시드. 없으면 빈 배열. */
  careerCompatibility?: string[];
}

interface SlotAwareShadowResult {
  /** Slot id × Guide id Top-K (slot 별 상위 K건만 박제, 메모리 절약) */
  topKPerSlot: Array<{
    slotId: string;
    grade: number;
    area: string;
    tier: string;
    candidates: Array<{
      guideId: string;
      title: string;
      breakdown: ScoreBreakdown;
    }>;
  }>;
  stats: {
    slotCount: number;
    rankedCount: number;
    pairsScored: number;
    pairsRejected: number;
  };
}

const TOP_K_PER_SLOT = 5;

/**
 * 후보 가이드들의 subject_id + subject_name 을 정규화 테이블에서 batch 회수.
 *
 * G4 fix (2026-04-29): 슬롯의 subareaKey 는 과목명(string)이고 가이드의 subject_id 는 UUID 라
 * 정확 매칭이 0 이었음. subjectName 도 함께 회수해 양방향 비교가 가능하도록 함.
 *
 * 가이드 1건이 여러 subject 에 매핑될 수 있으므로 첫번째만 채택 (subjectFit 은 단일 정합 비교).
 */
async function fetchGuideSubjectMap(
  supabase: PipelineContext["supabase"],
  guideIds: string[],
): Promise<Map<string, { id: string; name: string | null }>> {
  if (guideIds.length === 0) return new Map();
  const { data } = await supabase
    .from("exploration_guide_subject_mappings")
    .select("guide_id, subject_id, subject:subjects(name)")
    .in("guide_id", guideIds);
  const out = new Map<string, { id: string; name: string | null }>();
  for (const row of (data ?? []) as Array<{
    guide_id: string;
    subject_id: string;
    subject: { name: string | null } | null;
  }>) {
    if (!out.has(row.guide_id)) {
      out.set(row.guide_id, { id: row.subject_id, name: row.subject?.name ?? null });
    }
  }
  return out;
}

/**
 * exploration_guides.difficulty_level batch 회수.
 * applyContinuityRanking 의 metadata 도 difficultyByGuide 를 들고 있으나, shadow 모듈에 전달
 * 안 되어 있으므로 가벼운 1 query 로 별도 회수 (재사용은 후속 통합 시).
 */
async function fetchGuideDifficultyMap(
  supabase: PipelineContext["supabase"],
  guideIds: string[],
): Promise<Map<string, SlotDifficulty | null>> {
  if (guideIds.length === 0) return new Map();
  const { data } = await supabase
    .from("exploration_guides")
    .select("id, difficulty_level")
    .in("id", guideIds);
  const out = new Map<string, SlotDifficulty | null>();
  const valid = new Set<SlotDifficulty>(["basic", "intermediate", "advanced"]);
  for (const row of (data ?? []) as Array<{ id: string; difficulty_level: string | null }>) {
    const lv = row.difficulty_level;
    out.set(row.id, lv && valid.has(lv as SlotDifficulty) ? (lv as SlotDifficulty) : null);
  }
  return out;
}

/**
 * Shadow 측정 진입점.
 *
 * graceful — 어떤 에러도 매칭을 중단시키지 않음. 박제 실패 시 측정 건너뜀.
 */
export async function runSlotAwareScoreShadow(
  input: ShadowScoreInput,
): Promise<void> {
  try {
    const slots = (input.ctx.results["_slots"] as unknown as Slot[] | undefined) ?? [];
    if (slots.length === 0 || input.ranked.length === 0) return;

    const guideIds = input.ranked.map((r) => r.id);
    const [subjectMap, difficultyMap] = await Promise.all([
      fetchGuideSubjectMap(input.ctx.supabase, guideIds),
      fetchGuideDifficultyMap(input.ctx.supabase, guideIds),
    ]);

    const student: ScoreableStudent = {
      studentId: input.studentId,
      maxDifficultyByGrade: input.maxDifficultyByGrade,
      careerCompatibility: input.careerCompatibility ?? [],
    };

    // 각 ranked guide → ScoreableGuide (per-guide 키워드/역량은 미보유 → 빈 배열).
    const scoreableGuides: ScoreableGuide[] = input.ranked.map((r) => {
      const subj = subjectMap.get(r.id);
      return {
        id: r.id,
        subjectId: subj?.id ?? null,
        subjectName: subj?.name ?? null,
        difficultyLevel: difficultyMap.get(r.id) ?? null,
        keywords: [],
        competencyFocus: [],
        milestoneIds: [],
        careerFields: [],
      };
    });

    let pairsScored = 0;
    let pairsRejected = 0;
    const topKPerSlot: SlotAwareShadowResult["topKPerSlot"] = [];

    for (const slot of slots) {
      const candidates: Array<{ guideId: string; title: string; breakdown: ScoreBreakdown }> = [];
      for (let i = 0; i < scoreableGuides.length; i++) {
        const sg = scoreableGuides[i];
        const breakdown = scoreGuideForSlot(sg, slot, student);
        pairsScored++;
        if (!breakdown.passesConstraints) {
          pairsRejected++;
          continue;
        }
        candidates.push({
          guideId: sg.id,
          title: input.ranked[i].title,
          breakdown,
        });
      }
      candidates.sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);
      topKPerSlot.push({
        slotId: slot.id,
        grade: slot.grade,
        area: slot.area,
        tier: slot.tier,
        candidates: candidates.slice(0, TOP_K_PER_SLOT),
      });
    }

    const result: SlotAwareShadowResult = {
      topKPerSlot,
      stats: {
        slotCount: slots.length,
        rankedCount: input.ranked.length,
        pairsScored,
        pairsRejected,
      },
    };

    input.ctx.results["_slotAwareScores"] = result as unknown as Record<string, unknown>;
    input.ctx.previews["slot_aware_score_shadow"] = JSON.stringify({
      version: "shadow-v1",
      ...result.stats,
      topSlots: topKPerSlot.slice(0, 3).map((s) => ({
        slotId: s.slotId,
        grade: s.grade,
        area: s.area,
        tier: s.tier,
        topCandidates: s.candidates.slice(0, 3).map((c) => ({
          guideId: c.guideId,
          totalScore: c.breakdown.totalScore,
        })),
      })),
    });
  } catch {
    // graceful — 매칭 무영향
  }
}
