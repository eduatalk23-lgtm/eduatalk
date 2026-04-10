/**
 * topic_exploration 재분류 결과 CSV 내보내기 (Phase 1 / Decision #1 Step 4)
 *
 * 실행:
 *   set -a && source .env.local && set +a && npx tsx scripts/export-topic-exploration-review.ts [--only-review]
 *
 * 출력:
 *   tmp/topic-exploration-review.csv
 *
 * 컬럼:
 *   id, title, career_fields, current_type, tentative_primary, tentative_activity_type,
 *   tentative_confidence, tentative_review_status, tentative_reasoning,
 *   content_preview, consultant_decision, consultant_notes
 *
 * --only-review 옵션 시 needs_review 상태만 내보냄 (컨설턴트 리뷰용 짧은 목록)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const OUT_PATH = "tmp/topic-exploration-review.csv";

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function primaryFromColumns(
  tentative_guide_type: string | null,
  tentative_activity_type: string | null,
): string {
  if (tentative_activity_type === "autonomy") return "changche_autonomy";
  if (tentative_activity_type === "club") return "changche_club";
  if (tentative_activity_type === "career") return "changche_career";
  if (tentative_guide_type === null && tentative_activity_type === null) return "setek_only";
  return "unknown";
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 환경변수 누락");
    process.exit(1);
  }

  const onlyReview = process.argv.includes("--only-review");

  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from("exploration_guides")
    .select(
      "id, title, guide_type, tentative_guide_type, tentative_activity_type, tentative_confidence, tentative_review_status, tentative_reasoning",
    )
    .eq("guide_type", "topic_exploration")
    .eq("status", "approved")
    .eq("is_latest", true)
    .order("tentative_confidence", { ascending: true, nullsFirst: true })
    .order("title");

  if (onlyReview) {
    query = query.eq("tentative_review_status", "needs_review");
  }

  const { data: guides, error: guideErr } = await query;
  if (guideErr || !guides) {
    console.error("❌ 가이드 조회 실패:", guideErr?.message);
    process.exit(1);
  }
  console.log(`📋 가이드: ${guides.length}건${onlyReview ? " (needs_review만)" : ""}`);

  const guideIds = guides.map((g) => g.id);

  // content_preview
  const contentMap = new Map<string, string>();
  const PAGE = 100;
  for (let i = 0; i < guideIds.length; i += PAGE) {
    const slice = guideIds.slice(i, i + PAGE);
    const { data: rows } = await supabase
      .from("exploration_guide_content")
      .select("guide_id, content_sections")
      .in("guide_id", slice);
    for (const r of rows ?? []) {
      const row = r as { guide_id: string; content_sections: unknown };
      if (Array.isArray(row.content_sections)) {
        const text = row.content_sections
          .map((s: { content?: string }) => stripHtml(s.content ?? ""))
          .filter((t) => t.length > 0)
          .join(" ");
        contentMap.set(row.guide_id, text.slice(0, 200));
      }
    }
  }

  // career_fields
  const careerMap = new Map<string, string[]>();
  for (let i = 0; i < guideIds.length; i += PAGE) {
    const slice = guideIds.slice(i, i + PAGE);
    const { data: rows } = await supabase
      .from("exploration_guide_career_mappings")
      .select("guide_id, exploration_guide_career_fields!inner(name_kor)")
      .in("guide_id", slice);
    for (const r of rows ?? []) {
      const row = r as {
        guide_id: string;
        exploration_guide_career_fields: { name_kor: string } | { name_kor: string }[];
      };
      const cfs = Array.isArray(row.exploration_guide_career_fields)
        ? row.exploration_guide_career_fields
        : [row.exploration_guide_career_fields];
      const names = cfs.map((cf) => cf.name_kor);
      const existing = careerMap.get(row.guide_id) ?? [];
      careerMap.set(row.guide_id, [...new Set([...existing, ...names])]);
    }
  }

  // CSV 작성
  const headers = [
    "id",
    "title",
    "career_fields",
    "current_type",
    "tentative_primary",
    "tentative_activity_type",
    "tentative_confidence",
    "tentative_review_status",
    "tentative_reasoning",
    "content_preview",
    "consultant_decision",
    "consultant_notes",
  ];

  const lines = [headers.join(",")];
  for (const g of guides) {
    const row = g as {
      id: string;
      title: string;
      guide_type: string;
      tentative_guide_type: string | null;
      tentative_activity_type: string | null;
      tentative_confidence: number | null;
      tentative_review_status: string | null;
      tentative_reasoning: string | null;
    };
    const primary = primaryFromColumns(row.tentative_guide_type, row.tentative_activity_type);
    const careerFields = careerMap.get(row.id)?.join("|") ?? "";
    const preview = contentMap.get(row.id) ?? "";

    lines.push(
      [
        csvEscape(row.id),
        csvEscape(row.title),
        csvEscape(careerFields),
        csvEscape(row.guide_type),
        csvEscape(primary),
        csvEscape(row.tentative_activity_type ?? ""),
        csvEscape(row.tentative_confidence ?? ""),
        csvEscape(row.tentative_review_status ?? ""),
        csvEscape(row.tentative_reasoning ?? ""),
        csvEscape(preview),
        "", // consultant_decision (컨설턴트 채움)
        "", // consultant_notes (컨설턴트 채움)
      ].join(","),
    );
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, "\uFEFF" + lines.join("\n"), "utf-8"); // BOM for Excel 한글
  console.log(`✅ 저장: ${OUT_PATH} (${guides.length}건)`);
  console.log(`   Excel/Google Sheets 에서 바로 열기 가능 (BOM 포함)`);

  // 요약 통계
  const counts: Record<string, number> = {};
  for (const g of guides) {
    const row = g as { tentative_review_status: string | null };
    const k = row.tentative_review_status ?? "null";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  console.log("\n📊 상태 분포");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`   ${k}: ${v}건`);
  }
}

main().catch((err) => {
  console.error("❌ 실행 실패:", err);
  process.exit(1);
});
