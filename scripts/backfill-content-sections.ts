/**
 * content_sections 백필 스크립트
 *
 * content_sections가 빈 배열인 가이드(주로 imported)에 대해
 * legacyToContentSections()로 변환하여 DB에 저장합니다.
 *
 * 사용법:
 *   npx tsx scripts/backfill-content-sections.ts --dry-run   # 드라이런 (DB 미변경)
 *   npx tsx scripts/backfill-content-sections.ts              # 실행
 *   npx tsx scripts/backfill-content-sections.ts --limit=100  # 100건만
 */

import { resolve } from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { legacyToContentSections } from "../lib/domains/guide/section-config";
import type {
  GuideType,
  ExplorationGuideContent,
} from "../lib/domains/guide/types";

// .env.local 파일 로드
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

async function main() {
  console.log(`[backfill-content-sections] 시작 (dry-run: ${dryRun}, limit: ${limit ?? "전체"})`);

  // 1. content_sections가 빈 배열이면서 레거시 데이터가 있는 가이드만 조회
  //    (진짜 빈 콘텐츠는 제외하여 변환 가능한 가이드에 도달)
  let query = supabase
    .from("exploration_guide_content")
    .select("guide_id, motivation, theory_sections, reflection, impression, summary, follow_up, book_description, setek_examples, related_papers, related_books, image_paths, guide_url, raw_source, content_sections, created_at, updated_at")
    .eq("content_sections", "[]")
    .or("motivation.neq.,theory_sections.neq.[]");

  if (limit) {
    query = query.limit(limit);
  }

  const { data: contents, error } = await query;

  if (error) {
    console.error("[backfill] 조회 실패:", error.message);
    process.exit(1);
  }

  if (!contents || contents.length === 0) {
    console.log("[backfill] 백필 대상 없음.");
    return;
  }

  console.log(`[backfill] 대상: ${contents.length}건`);

  // 2. guide_type 조회 (배치 100건씩 — URL 길이 제한 회피)
  const guideIds = contents.map((c) => c.guide_id);
  const guideTypeMap = new Map<string, string>();
  const BATCH = 100;
  for (let i = 0; i < guideIds.length; i += BATCH) {
    const batch = guideIds.slice(i, i + BATCH);
    const { data: guides, error: guideError } = await supabase
      .from("exploration_guides")
      .select("id, guide_type")
      .in("id", batch);

    if (guideError) {
      console.error(`[backfill] guide_type 조회 실패 (batch ${i}):`, guideError.message);
      process.exit(1);
    }
    for (const g of guides ?? []) {
      guideTypeMap.set(g.id, g.guide_type);
    }
  }
  console.log(`[backfill] guide_type 매핑 완료: ${guideTypeMap.size}건`);

  // 3. 변환 및 저장
  let success = 0;
  let failed = 0;

  for (const content of contents) {
    const guideType = guideTypeMap.get(content.guide_id) as GuideType | undefined;
    if (!guideType) {
      console.warn(`[backfill] guide_type 미발견: ${content.guide_id}`);
      failed++;
      continue;
    }

    try {
      const sections = legacyToContentSections(
        guideType,
        content as ExplorationGuideContent,
      );

      if (sections.length === 0) {
        console.warn(`[backfill] 변환 결과 빈 배열: ${content.guide_id}`);
        failed++;
        continue;
      }

      if (dryRun) {
        console.log(
          `[dry-run] ${content.guide_id} (${guideType}): ${sections.length}개 섹션`,
        );
      } else {
        const { error: updateError } = await supabase
          .from("exploration_guide_content")
          .update({ content_sections: sections })
          .eq("guide_id", content.guide_id);

        if (updateError) {
          console.error(
            `[backfill] 업데이트 실패 ${content.guide_id}:`,
            updateError.message,
          );
          failed++;
          continue;
        }
      }

      success++;
    } catch (e) {
      console.error(`[backfill] 변환 실패 ${content.guide_id}:`, e);
      failed++;
    }
  }

  console.log(`[backfill] 완료: 성공 ${success}, 실패 ${failed}, 전체 ${contents.length}`);
}

main().catch(console.error);
