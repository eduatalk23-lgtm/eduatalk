#!/usr/bin/env npx tsx
/**
 * exploration_guides keywords + competency_focus 백필.
 *
 * #3 Scope A (2026-04-29): focusFit/weaknessFix shadow 보너스 활성용 메타 채움.
 *
 * 추출 정책:
 *   keywords         : title + topic_cluster_name + unit_major + unit_minor + subject_select
 *                      → 한국어 명사 토큰 (≥2자, stopword 제외).
 *   competency_focus : 8 표준 역량 코드 — guide_type / source_type / 키워드 휴리스틱.
 *                      LLM 분류 업그레이드는 별도 PR 후보 (정확도 우선이면).
 *
 * 사용법:
 *   npx tsx scripts/backfill-guide-meta.ts            — 빈 row 만 backfill
 *   npx tsx scripts/backfill-guide-meta.ts --force    — 모든 row 재계산
 *   npx tsx scripts/backfill-guide-meta.ts --limit=50 — 상위 N건만 (smoke test)
 *
 * 멱등 (재실행 안전).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const FORCE = process.argv.includes("--force");
const LIMIT_FLAG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_FLAG ? Number(LIMIT_FLAG.split("=")[1]) : null;
const CHUNK_SIZE = 200;

// ── Korean stopwords (조사/접사/일반어) ────────────────────────────────
const STOPWORDS = new Set([
  "그리고","그러나","하지만","그래서","따라서","즉","또는","및","또한","위한","위해",
  "통해","대한","대해","에서","에게","으로","로서","로써","에는","이라","라고","라는",
  "있는","있음","없는","없음","되는","되어","되었","하기","하는","하여","하고","하지",
  "이다","이며","입니다","합니다","됩니다","같은","같이","같다","무엇","어떻게","어떠한",
  "기본","기초","개념","이해","학습","활동","수업","교과","주제","탐구","사례","실험",
  "분석","조사","연구","설계","발표","보고서","제작","활용","비교","적용","응용","고찰",
  "내용","방법","과정","결과","역할","의미","원리","현상","문제","해결","방안","방향",
  "사이","수준","정도","측면","경우","관점","상황","변화","효과","영향","모습","요소",
  "단원","과목","교과목","학년","학기",
]);

function isAsciiOnly(s: string): boolean {
  return /^[\x00-\x7F]+$/.test(s);
}

/** 한국어 텍스트에서 명사 토큰 후보 추출 — 휴리스틱 (형태소 분석기 없이). */
function extractTokens(text: string): string[] {
  if (!text) return [];
  // 한국어 + 영숫자 토큰 분할 (괄호/구두점 제거)
  const cleaned = text.replace(/[()【】「」『』\[\]{}<>'"·…—–\-_,.?!:;/\\|+*=&^%$#@~`]/g, " ");
  const raw = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of raw) {
    const t = tok.trim();
    if (t.length < 2) continue;                   // 1자 토큰 제외
    if (/^\d+$/.test(t)) continue;                // 숫자만 제외
    if (isAsciiOnly(t) && t.length < 3) continue; // 영문 1-2자 제외
    if (STOPWORDS.has(t)) continue;
    // 한국어 조사 끝 정리 (간단 휴리스틱) — 단어 끝의 단일 조사 글자 제거
    let core = t;
    const tail = core.slice(-1);
    if (/[은는이가을를과와도의에로]$/.test(tail) && core.length >= 3) {
      const stripped = core.slice(0, -1);
      if (stripped.length >= 2 && !STOPWORDS.has(stripped)) core = stripped;
    }
    if (STOPWORDS.has(core)) continue;
    out.push(core);
  }
  // dedupe (preserve order)
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const w of out) {
    if (seen.has(w)) continue;
    seen.add(w);
    uniq.push(w);
  }
  return uniq.slice(0, 12); // 최대 12개
}

/** guide row → keywords[] */
function deriveKeywords(row: GuideRow): string[] {
  const sources = [
    row.title,
    row.topic_cluster_name,
    row.unit_major,
    row.unit_minor,
    row.subject_select,
    row.subject_area,
    row.book_title,
  ].filter(Boolean) as string[];
  const all: string[] = [];
  for (const s of sources) {
    for (const t of extractTokens(s)) all.push(t);
  }
  const seen = new Set<string>();
  return all.filter((w) => (seen.has(w) ? false : (seen.add(w), true))).slice(0, 12);
}

/**
 * DB 정렬 10 역량 코드 (student_record_competency_scores.competency_item 제약).
 * weaknessFix 매칭 (slot.weakCompetencies ∩ guide.competencyFocus) 활성용 정렬.
 */
type Competency =
  | "academic_inquiry"
  | "academic_attitude"
  | "academic_achievement"
  | "career_course_effort"
  | "career_course_achievement"
  | "career_exploration"
  | "community_caring"
  | "community_collaboration"
  | "community_integrity"
  | "community_leadership";

/**
 * guide row → competency_focus[] (휴리스틱 — LLM 분류 업그레이드 가능).
 * DB 정렬 10 역량 셋. slot.weakCompetencies (DB 회수) 와 매칭되도록 동일 셋 사용.
 */
function deriveCompetencyFocus(row: GuideRow): Competency[] {
  const out = new Set<Competency>();
  // 모든 탐구 가이드 = academic_inquiry baseline
  out.add("academic_inquiry");

  const titleLower = (row.title ?? "").toLowerCase();
  const topic = (row.topic_cluster_name ?? "").toLowerCase();
  const all = `${row.title ?? ""} ${row.topic_cluster_name ?? ""} ${row.unit_major ?? ""} ${row.unit_minor ?? ""}`;

  // 진로 탐색 — 직업/진로 키워드
  if (/진로|직업|의사|약사|간호|교사|연구원|엔지니어|디자이너|변호사|기자/.test(all)) {
    out.add("career_exploration");
  }
  // 진로 교과 노력 — guide_type=reading 또는 자율 학습 키워드
  if (row.guide_type === "reading" || /자기 주도|자기주도|독립|스스로|자율|자기 학습|자기학습/.test(all)) {
    out.add("career_course_effort");
  }
  // 진로 교과 성취 — 심화/연구/실험 키워드
  if (/실험|설계|제작|발명|창의|개선|혁신|시뮬레이션|프로젝트/.test(all)) {
    out.add("career_course_achievement");
  }
  // 공동체 협력 — 협력/토론/팀 키워드
  if (/협력|협동|토론|발표|소통|팀|조별|공동/.test(all)) {
    out.add("community_collaboration");
  }
  // 공동체 배려 — 봉사/기부/약자 키워드
  if (/봉사|기부|배려|공헌|복지|약자|취약|돕기|돕는/.test(all)) {
    out.add("community_caring");
  }
  // 공동체 리더십 — 주도/리더 키워드
  if (/주도|리더|이끌|회장|대표|관리/.test(all)) {
    out.add("community_leadership");
  }
  // 학업 성취 — 심화/고급/학술
  if (/심화|고급|advanced|연구|논문|학술/.test(titleLower + " " + topic)) {
    out.add("academic_achievement");
  }
  // 학업 태도 — 꾸준/관심/탐구 키워드 (default 가까운 baseline 보완)
  if (/꾸준|지속|관심|호기심|탐구|관찰/.test(all)) {
    out.add("academic_attitude");
  }

  return Array.from(out);
}

interface GuideRow {
  id: string;
  guide_type: string | null;
  title: string | null;
  subject_area: string | null;
  subject_select: string | null;
  unit_major: string | null;
  unit_minor: string | null;
  topic_cluster_name: string | null;
  book_title: string | null;
  keywords: string[] | null;
  competency_focus: string[] | null;
}

async function main() {
  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error("admin client unavailable");

  console.log(
    `▶ guide meta backfill — force=${FORCE} limit=${LIMIT ?? "all"} chunkSize=${CHUNK_SIZE}\n`,
  );

  // topic_cluster_name 은 별도 테이블 JOIN — 여기선 미사용 (가이드 테이블에 redundant 컬럼 있으면 사용).
  // 현 schema 에서 ExplorationGuide.topic_cluster_name 은 findGuides 조인 결과 가상 컬럼이므로
  // 백필 단순화를 위해 topic_cluster_id → topic_clusters JOIN 으로 별도 회수.
  // PostgREST 는 server-side row cap (보통 1000) 적용 — paged 회수.
  const PAGE_SIZE = 1000;
  const rows: Array<Record<string, unknown>> = [];
  for (let page = 0; ; page++) {
    let q = sb
      .from("exploration_guides")
      .select(
        "id, guide_type, title, subject_area, subject_select, unit_major, unit_minor, book_title, keywords, competency_focus, topic_cluster_id",
      );
    if (!FORCE) q = q.eq("keywords", "{}").eq("competency_focus", "{}");
    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data: pageRows, error } = await q;
    if (error) throw error;
    if (!pageRows || pageRows.length === 0) break;
    rows.push(...pageRows);
    if (LIMIT != null && rows.length >= LIMIT) {
      rows.splice(LIMIT);
      break;
    }
    if (pageRows.length < PAGE_SIZE) break;
  }
  console.log(`대상 row: ${rows?.length ?? 0}건`);
  if (!rows || rows.length === 0) {
    console.log("✅ 백필 대상 없음.");
    return;
  }

  // topic_cluster_name 회수
  const clusterIds = Array.from(
    new Set(
      rows
        .map((r) => (r as { topic_cluster_id: string | null }).topic_cluster_id)
        .filter(Boolean) as string[],
    ),
  );
  const clusterNameMap = new Map<string, string>();
  if (clusterIds.length > 0) {
    const { data: cdata } = await sb
      .from("topic_clusters")
      .select("id, name")
      .in("id", clusterIds);
    for (const c of (cdata ?? []) as Array<{ id: string; name: string | null }>) {
      if (c.name) clusterNameMap.set(c.id, c.name);
    }
  }

  let processed = 0;
  let kwTotal = 0;
  let cfTotal = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const updates = chunk.map((raw) => {
      const r = raw as GuideRow & { topic_cluster_id: string | null };
      const enriched: GuideRow = {
        ...r,
        topic_cluster_name: r.topic_cluster_id ? clusterNameMap.get(r.topic_cluster_id) ?? null : null,
      };
      const keywords = deriveKeywords(enriched);
      const competency_focus = deriveCompetencyFocus(enriched);
      kwTotal += keywords.length;
      cfTotal += competency_focus.length;
      return { id: r.id, keywords, competency_focus };
    });

    // 개별 update — chunk 내 병렬
    await Promise.all(
      updates.map((u) =>
        sb
          .from("exploration_guides")
          .update({ keywords: u.keywords, competency_focus: u.competency_focus })
          .eq("id", u.id),
      ),
    );
    processed += chunk.length;
    if (processed % (CHUNK_SIZE * 5) === 0 || processed === rows.length) {
      console.log(`  ✓ ${processed}/${rows.length}`);
    }
  }

  console.log(
    `\n✅ 완료 — ${processed}건. avg keywords=${(kwTotal / processed).toFixed(1)}, avg competencies=${(cfTotal / processed).toFixed(1)}`,
  );
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.stack : e);
  process.exitCode = 1;
});
