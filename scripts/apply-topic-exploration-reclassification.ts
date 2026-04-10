/**
 * topic_exploration 재분류 확정 적용 (Phase 2 Wave 2.2)
 *
 * Phase 1에서 `tentative_guide_type` / `tentative_activity_type` 으로만 마킹된 분류를
 * 실제 `guide_type` 컬럼 값으로 승격시키고, 창체용은 `exploration_guide_activity_mappings`에 INSERT.
 *
 * 실행:
 *   set -a && source .env.local && set +a && npx tsx scripts/apply-topic-exploration-reclassification.ts [--dry-run]
 *
 * 동작:
 *   1. tentative_review_status='confirmed' 인 topic_exploration 가이드 조회
 *   2. tentative_guide_type 이 NOT NULL → exploration_guides.guide_type 변경
 *   3. tentative_activity_type 이 NOT NULL → exploration_guide_activity_mappings INSERT
 *   4. 처리 완료 후 tentative_* 5개 컬럼을 NULL로 클리어 (Wave 2.3 DROP 전에 깨끗한 상태)
 *
 * 예상 결과 (Phase 1 기록 기준):
 *   setek_only         54건 → guide_type 변경 없음 (topic_exploration 유지)
 *   changche_autonomy  55건 → reflection_program + activity_type=autonomy
 *   changche_club      19건 → club_deep_dive + activity_type=club
 *   changche_career    23건 → career_exploration_project + activity_type=career
 *   ─────────────────
 *   총 151건 처리, 97건 guide_type 변경, 97건 activity_mapping INSERT
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

interface GuideRow {
  id: string;
  title: string;
  guide_type: string;
  tentative_guide_type: string | null;
  tentative_activity_type: string | null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 환경변수 누락");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔄 topic_exploration 재분류 확정 적용 시작");
  console.log(`   모드: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  // 1. 대상 가이드 조회
  const { data: guides, error: guideErr } = await supabase
    .from("exploration_guides")
    .select(
      "id, title, guide_type, tentative_guide_type, tentative_activity_type",
    )
    .eq("guide_type", "topic_exploration")
    .eq("status", "approved")
    .eq("is_latest", true)
    .eq("tentative_review_status", "confirmed");

  if (guideErr || !guides) {
    console.error("❌ 가이드 조회 실패:", guideErr?.message);
    process.exit(1);
  }

  console.log(`📋 confirmed 대상: ${guides.length}건`);

  const stats = {
    keptAsTopicExploration: 0,
    changedToReflectionProgram: 0,
    changedToClubDeepDive: 0,
    changedToCareerExploration: 0,
    activityMappingInserted: 0,
    activityMappingSkipped: 0,
    typeUpdateFailed: 0,
    mappingInsertFailed: 0,
  };

  for (const g of guides as GuideRow[]) {
    const newGuideType = g.tentative_guide_type;
    const activityType = g.tentative_activity_type;

    // setek_only (tentative_guide_type=null AND tentative_activity_type=null)
    if (!newGuideType && !activityType) {
      stats.keptAsTopicExploration++;
      continue;
    }

    if (dryRun) {
      if (newGuideType === "reflection_program") stats.changedToReflectionProgram++;
      else if (newGuideType === "club_deep_dive") stats.changedToClubDeepDive++;
      else if (newGuideType === "career_exploration_project") stats.changedToCareerExploration++;
      if (activityType) stats.activityMappingInserted++;
      continue;
    }

    // 2. guide_type 변경
    if (newGuideType) {
      const { error: updErr } = await supabase
        .from("exploration_guides")
        .update({ guide_type: newGuideType })
        .eq("id", g.id);

      if (updErr) {
        console.log(`   ❌ guide_type 변경 실패 (${g.id}): ${updErr.message}`);
        stats.typeUpdateFailed++;
        continue;
      }

      if (newGuideType === "reflection_program") stats.changedToReflectionProgram++;
      else if (newGuideType === "club_deep_dive") stats.changedToClubDeepDive++;
      else if (newGuideType === "career_exploration_project") stats.changedToCareerExploration++;
    }

    // 3. activity_mapping INSERT
    if (activityType) {
      const { error: insErr } = await supabase
        .from("exploration_guide_activity_mappings")
        .insert({
          guide_id: g.id,
          activity_type: activityType,
        });

      if (insErr) {
        if (insErr.code === "23505" || insErr.message.includes("duplicate")) {
          stats.activityMappingSkipped++;
        } else {
          console.log(`   ❌ activity_mapping insert 실패 (${g.id}): ${insErr.message}`);
          stats.mappingInsertFailed++;
        }
      } else {
        stats.activityMappingInserted++;
      }
    }
  }

  console.log("\n📊 처리 결과");
  console.log(`   topic_exploration 유지:       ${stats.keptAsTopicExploration}건`);
  console.log(`   reflection_program 승격:      ${stats.changedToReflectionProgram}건`);
  console.log(`   club_deep_dive 승격:          ${stats.changedToClubDeepDive}건`);
  console.log(`   career_exploration_project:   ${stats.changedToCareerExploration}건`);
  console.log(`   activity_mapping INSERT:      ${stats.activityMappingInserted}건`);
  if (stats.activityMappingSkipped > 0) console.log(`   activity_mapping 중복 스킵:   ${stats.activityMappingSkipped}건`);
  if (stats.typeUpdateFailed > 0) console.log(`   ❌ type 변경 실패:            ${stats.typeUpdateFailed}건`);
  if (stats.mappingInsertFailed > 0) console.log(`   ❌ mapping insert 실패:       ${stats.mappingInsertFailed}건`);

  if (dryRun) {
    console.log("\n🔍 DRY-RUN — 실제 변경 없음. tentative_* 컬럼 클리어 스킵.");
    return;
  }

  // 4. tentative_* 컬럼 클리어 (성공한 가이드만)
  console.log("\n🧹 tentative_* 컬럼 클리어 중...");
  const { error: clearErr, count } = await supabase
    .from("exploration_guides")
    .update({
      tentative_guide_type: null,
      tentative_activity_type: null,
      tentative_confidence: null,
      tentative_review_status: 'pending', // CHECK 제약상 NULL 불가, 기본값으로 복원
      tentative_reasoning: null,
    }, { count: 'exact' })
    .eq("guide_type", "topic_exploration")
    .or("guide_type.eq.reflection_program,guide_type.eq.club_deep_dive,guide_type.eq.career_exploration_project")
    .not("tentative_guide_type", "is", null);

  // 위 .or 는 첫 .eq 를 덮어쓰지 않으므로 명시적 in으로 재시도
  if (clearErr) {
    console.log(`   ⚠️  1차 클리어 실패: ${clearErr.message}, in() 방식으로 재시도`);
  }

  const { error: clearErr2, count: clearedCount } = await supabase
    .from("exploration_guides")
    .update({
      tentative_guide_type: null,
      tentative_activity_type: null,
      tentative_confidence: null,
      tentative_review_status: 'pending',
      tentative_reasoning: null,
    }, { count: 'exact' })
    .in("guide_type", [
      "topic_exploration",
      "reflection_program",
      "club_deep_dive",
      "career_exploration_project",
    ])
    .or("tentative_guide_type.not.is.null,tentative_activity_type.not.is.null,tentative_confidence.not.is.null,tentative_reasoning.not.is.null,tentative_review_status.eq.confirmed");

  if (clearErr2) {
    console.log(`   ❌ 컬럼 클리어 실패: ${clearErr2.message}`);
  } else {
    console.log(`   ✅ ${clearedCount ?? count ?? "?"}건 클리어 완료`);
  }
}

main().catch((err) => {
  console.error("❌ 실행 실패:", err);
  process.exit(1);
});
