/**
 * setek_only로 분류된 topic_exploration 가이드에 subject_mapping 보강 (Phase 1 / Decision #1 Step 3)
 *
 * 실행:
 *   set -a && source .env.local && set +a && npx tsx scripts/augment-topic-exploration-subject-mappings.ts [--dry-run]
 *
 * 동작 (transitive similarity):
 *   1. setek_only로 분류된 topic_exploration 가이드 (54건) 조회
 *   2. 승인된 reading 가이드 전체 (~4432건)의 embedding + subject_mapping 조회
 *      — reading 가이드는 Access DB에서 임포트된 수작업 매핑을 가지므로 품질 보장
 *   3. 각 topic 가이드 embedding과 모든 reading 가이드 embedding의 cosine similarity 계산
 *   4. 유사도 ≥ SIMILARITY_THRESHOLD인 top-K reading 가이드의 subject_id를 수집
 *   5. subject_id별 등장 빈도 + 평균 유사도 가중치로 top-3 과목 선정
 *   6. exploration_guide_subject_mappings에 INSERT (중복 스킵)
 *
 * 왜 transitive? subjects 테이블 직접 임베딩은 텍스트가 짧아 discriminative power가 낮음.
 * reading 가이드의 풍부한 content는 subjects를 잘 대표하는 "semantic anchor" 역할.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSIONS = 768;
// 환경변수로 2-pass 실행 지원 (기본: 엄격 / LOOSE=1: 느슨)
const LOOSE = process.env.LOOSE === "1";
const SIMILARITY_THRESHOLD = LOOSE ? 0.68 : 0.72;
const TOP_K_READING = LOOSE ? 20 : 10;
const TOP_N_SUBJECTS = 3;
const MIN_SUBJECT_VOTES = LOOSE ? 1 : 2;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? (arr as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 환경변수 누락");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔄 subject_mapping 보강 시작 (transitive similarity)");
  console.log(`   모드: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`   SIMILARITY_THRESHOLD: ${SIMILARITY_THRESHOLD}`);
  console.log(`   TOP_K_READING: ${TOP_K_READING}`);
  console.log(`   MIN_SUBJECT_VOTES: ${MIN_SUBJECT_VOTES}`);

  // ── 1. 대상 topic 가이드 조회 ──
  const { data: targetGuides, error: guideErr } = await supabase
    .from("exploration_guides")
    .select("id, title")
    .eq("guide_type", "topic_exploration")
    .eq("status", "approved")
    .eq("is_latest", true)
    .is("tentative_activity_type", null)
    .in("tentative_review_status", ["auto_approved", "needs_review"])
    .order("title");

  if (guideErr || !targetGuides) {
    console.error("❌ 가이드 조회 실패:", guideErr?.message);
    process.exit(1);
  }
  console.log(`\n📋 대상 topic_exploration setek_only 가이드: ${targetGuides.length}건`);

  // ── 2. 대상 가이드 embedding 조회 ──
  const targetIds = targetGuides.map((g) => g.id);
  const targetEmbeddingMap = new Map<string, number[]>();
  for (let i = 0; i < targetIds.length; i += 100) {
    const slice = targetIds.slice(i, i + 100);
    const { data: rows } = await supabase
      .from("exploration_guide_content")
      .select("guide_id, embedding")
      .in("guide_id", slice);
    for (const r of rows ?? []) {
      const emb = parseEmbedding((r as { embedding: unknown }).embedding);
      if (emb && emb.length === EMBEDDING_DIMENSIONS) {
        targetEmbeddingMap.set((r as { guide_id: string }).guide_id, emb);
      }
    }
  }
  console.log(`   target embedding 확보: ${targetEmbeddingMap.size}/${targetIds.length}건`);

  // ── 3. reading 가이드 전체 + subject_mapping 조회 (semantic anchor) ──
  console.log(`\n📖 reading 가이드 (semantic anchor) 로딩 중...`);
  const anchorGuides: Array<{ id: string; title: string; embedding: number[]; subjectIds: string[] }> = [];

  // 3-a. reading approved 가이드 id 전체
  const allReadingIds: string[] = [];
  let fetchPage = 0;
  const FETCH_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from("exploration_guides")
      .select("id, title")
      .eq("guide_type", "reading")
      .eq("status", "approved")
      .eq("is_latest", true)
      .range(fetchPage * FETCH_SIZE, (fetchPage + 1) * FETCH_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) allReadingIds.push(r.id);
    if (data.length < FETCH_SIZE) break;
    fetchPage++;
  }
  console.log(`   reading 가이드 id: ${allReadingIds.length}건`);

  // 3-b. reading embedding 일괄 조회 (배치 100 — 큰 페이로드 방지)
  const readingEmbMap = new Map<string, number[]>();
  const readingTitleMap = new Map<string, string>();
  const EMB_BATCH = 100;
  for (let i = 0; i < allReadingIds.length; i += EMB_BATCH) {
    const slice = allReadingIds.slice(i, i + EMB_BATCH);
    const { data: rows, error: embErr } = await supabase
      .from("exploration_guide_content")
      .select("guide_id, embedding")
      .in("guide_id", slice);
    if (embErr) {
      console.error(`   ❌ embedding 조회 실패 (batch ${i}): ${embErr.message}`);
      continue;
    }
    for (const r of rows ?? []) {
      const emb = parseEmbedding((r as { embedding: unknown }).embedding);
      if (emb && emb.length === EMBEDDING_DIMENSIONS) {
        readingEmbMap.set((r as { guide_id: string }).guide_id, emb);
      }
    }
    if ((i / EMB_BATCH) % 10 === 0) {
      process.stdout.write(`   reading embedding: ${readingEmbMap.size}/${allReadingIds.length}\r`);
    }
  }
  console.log(`\n   reading embedding 확보: ${readingEmbMap.size}건`);

  // title 별도 조회
  for (let i = 0; i < allReadingIds.length; i += 500) {
    const slice = allReadingIds.slice(i, i + 500);
    const { data: rows } = await supabase
      .from("exploration_guides")
      .select("id, title")
      .in("id", slice);
    for (const r of rows ?? []) {
      readingTitleMap.set((r as { id: string }).id, (r as { title: string }).title);
    }
  }

  // 3-c. reading 가이드별 subject_mappings 조회 (Supabase 기본 1000건 제한 → 배치 200 + 내부 페이지네이션)
  const readingSubjectMap = new Map<string, string[]>();
  const MAPPING_BATCH = 200;
  for (let i = 0; i < allReadingIds.length; i += MAPPING_BATCH) {
    const slice = allReadingIds.slice(i, i + MAPPING_BATCH);
    // 내부 페이지네이션 (1000건 초과 대비)
    let offset = 0;
    const INNER = 1000;
    while (true) {
      const { data: rows, error: mapErr } = await supabase
        .from("exploration_guide_subject_mappings")
        .select("guide_id, subject_id")
        .in("guide_id", slice)
        .range(offset, offset + INNER - 1);
      if (mapErr) {
        console.error(`   ❌ mapping 조회 실패: ${mapErr.message}`);
        break;
      }
      if (!rows || rows.length === 0) break;
      for (const r of rows) {
        const row = r as { guide_id: string; subject_id: string };
        const arr = readingSubjectMap.get(row.guide_id) ?? [];
        arr.push(row.subject_id);
        readingSubjectMap.set(row.guide_id, arr);
      }
      if (rows.length < INNER) break;
      offset += INNER;
    }
  }
  const totalMappings = [...readingSubjectMap.values()].reduce((a, b) => a + b.length, 0);
  console.log(`   reading subject_mappings: ${readingSubjectMap.size} guides, ${totalMappings} mappings`);

  // 3-d. anchor 구성 (embedding + subject 모두 있는 것만)
  for (const id of allReadingIds) {
    const embedding = readingEmbMap.get(id);
    const subjectIds = readingSubjectMap.get(id);
    if (embedding && subjectIds && subjectIds.length > 0) {
      anchorGuides.push({
        id,
        title: readingTitleMap.get(id) ?? "",
        embedding,
        subjectIds,
      });
    }
  }
  console.log(`   유효 anchor: ${anchorGuides.length}건 (embedding + subject_mapping 모두 있음)`);

  // subjects 테이블: id → name 조회 (리포트용)
  const { data: subjectNameRows } = await supabase.from("subjects").select("id, name");
  const subjectNameMap = new Map<string, string>();
  for (const r of subjectNameRows ?? []) {
    subjectNameMap.set((r as { id: string }).id, (r as { name: string }).name);
  }

  if (dryRun) {
    console.log("\n🔍 DRY-RUN — 실제 INSERT 없음");
    console.log(`   매칭 대상: ${targetEmbeddingMap.size}건 → anchor: ${anchorGuides.length}건`);
    return;
  }

  // ── 4. 각 target 가이드 매칭 ──
  let insertedMappings = 0;
  let skippedAlreadyExists = 0;
  let skippedNoMatch = 0;
  const stats: Array<{
    title: string;
    topReadings: Array<{ title: string; sim: number }>;
    subjects: Array<{ name: string; votes: number; avgSim: number }>;
  }> = [];

  for (const g of targetGuides) {
    const guideEmb = targetEmbeddingMap.get(g.id);
    if (!guideEmb) continue;

    // 4-a. 모든 anchor와 유사도 계산 → threshold 이상 top-K
    const scored = anchorGuides
      .map((a) => ({
        anchor: a,
        similarity: cosineSimilarity(guideEmb, a.embedding),
      }))
      .filter((s) => s.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_K_READING);

    if (scored.length === 0) {
      skippedNoMatch++;
      continue;
    }

    // 4-b. subject_id별 득표 수 + 평균 유사도 집계
    const subjectVotes = new Map<string, { votes: number; sumSim: number }>();
    for (const { anchor, similarity } of scored) {
      for (const sid of anchor.subjectIds) {
        const current = subjectVotes.get(sid) ?? { votes: 0, sumSim: 0 };
        current.votes++;
        current.sumSim += similarity;
        subjectVotes.set(sid, current);
      }
    }

    // 4-c. votes >= MIN_SUBJECT_VOTES인 것만 + votes desc, avgSim desc 정렬 → top-N
    const ranked = [...subjectVotes.entries()]
      .filter(([, v]) => v.votes >= MIN_SUBJECT_VOTES)
      .map(([subjectId, v]) => ({
        subjectId,
        votes: v.votes,
        avgSim: v.sumSim / v.votes,
      }))
      .sort((a, b) => b.votes - a.votes || b.avgSim - a.avgSim)
      .slice(0, TOP_N_SUBJECTS);

    if (ranked.length === 0) {
      skippedNoMatch++;
      continue;
    }

    stats.push({
      title: g.title,
      topReadings: scored.slice(0, 3).map((s) => ({
        title: s.anchor.title.slice(0, 35),
        sim: +s.similarity.toFixed(3),
      })),
      subjects: ranked.map((r) => ({
        name: subjectNameMap.get(r.subjectId) ?? r.subjectId,
        votes: r.votes,
        avgSim: +r.avgSim.toFixed(3),
      })),
    });

    // 4-d. INSERT
    for (const r of ranked) {
      const { error: insErr } = await supabase
        .from("exploration_guide_subject_mappings")
        .insert({
          guide_id: g.id,
          subject_id: r.subjectId,
          curriculum_revision_id: null,
        });
      if (insErr) {
        if (insErr.code === "23505" || insErr.message.includes("duplicate")) {
          skippedAlreadyExists++;
        } else {
          console.log(`   ❌ insert 실패: ${insErr.message}`);
        }
      } else {
        insertedMappings++;
      }
    }
  }

  console.log("\n📊 매칭 결과");
  console.log(`   매칭된 가이드:      ${stats.length}/${targetGuides.length}건`);
  console.log(`   INSERT된 mapping:   ${insertedMappings}건`);
  console.log(`   중복 스킵:          ${skippedAlreadyExists}건`);
  console.log(`   매칭 실패 스킵:     ${skippedNoMatch}건`);

  console.log("\n📝 샘플 매칭 (상위 15건)");
  for (const s of stats.slice(0, 15)) {
    const title = s.title.length > 45 ? s.title.slice(0, 45) + "…" : s.title;
    const subjects = s.subjects
      .map((sub) => `${sub.name}(vote=${sub.votes},sim=${sub.avgSim})`)
      .join(", ");
    console.log(`   ${title}\n     subjects → ${subjects}`);
  }
}

main().catch((err) => {
  console.error("❌ 실행 실패:", err);
  process.exit(1);
});
