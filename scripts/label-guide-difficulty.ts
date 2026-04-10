#!/usr/bin/env npx tsx
/**
 * Phase A Step 5a: 클러스터 단위 난이도 배치 라벨링
 *
 * 각 cluster 내 가이드 제목을 배치로 LLM에 보내
 * basic / intermediate / advanced 3단계 난이도를 배정.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/label-guide-difficulty.ts [--dry-run] [--limit=N] [--verify-only]
 */

import "dotenv/config";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

// ---------- CLI args ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const VERIFY_ONLY = args.includes("--verify-only");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

const USE_FLASH_FIRST = args.includes("--flash-first");
const MODEL_CHAIN = USE_FLASH_FIRST
  ? (["gemini-2.5-flash", "gemini-2.5-pro"] as const)
  : (["gemini-2.5-pro"] as const);
const DELAY_MS = 1200;
const MAX_RETRIES_PER_MODEL = 2;
const BACKOFF_MS = [5000, 15000];
const BATCH_SIZE = 40; // 한 LLM 호출당 가이드 수

const VALID_LEVELS = ["basic", "intermediate", "advanced"] as const;
type DifficultyLevel = (typeof VALID_LEVELS)[number];

// ---------- Prompt ----------
const SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드의 난이도를 판정하는 전문가입니다.

## 난이도 기준

### basic (기초)
- 교과서 수준의 개념 확인, 조사·정리·발표 활동
- "~을 조사해 보자", "~을 설명해 보자" 같은 단순 과제
- 1학년 또는 교과 입문 수준

### intermediate (발전)
- 개념 간 연결, 비교·분석, 토론, 실험 설계
- "~의 원인과 영향을 분석", "~에 대해 토론", 둘 이상 관점 비교
- 2학년 수준 또는 교과 심화

### advanced (심화)
- 학제간 융합, 독자적 연구 설계, 논문/보고서 작성, 창의적 산출물
- "~모델을 제안", "~시스템을 설계", "연구계획서 작성"
- 3학년 또는 대학 연계 수준

## 출력 규칙
- 각 가이드 번호에 대해 난이도를 배정
- JSON 배열로 출력: [{"idx": 1, "level": "basic"}, ...]
- 마크다운 코드블록 금지, JSON만 출력
- 판단이 애매하면 낮은 쪽으로 배정 (보수적)`;

interface GuideRow {
  id: string;
  title: string;
}

interface DifficultyResult {
  idx: number;
  level: DifficultyLevel;
}

function buildUserPrompt(
  clusterName: string,
  guides: { idx: number; title: string }[],
): string {
  const list = guides.map((g) => `${g.idx}. ${g.title}`).join("\n");
  return `## 클러스터: ${clusterName}

아래 ${guides.length}건의 탐구 가이드 난이도를 판정하세요.

${list}

JSON 배열로 출력. 예: [{"idx": 1, "level": "basic"}, {"idx": 2, "level": "intermediate"}]`;
}

function parseResults(text: string, expectedCount: number): DifficultyResult[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]) as Array<Record<string, unknown>>;
    const results: DifficultyResult[] = [];
    for (const item of arr) {
      const idx = typeof item.idx === "number" ? item.idx : parseInt(String(item.idx), 10);
      const level = String(item.level);
      if (isNaN(idx) || !(VALID_LEVELS as readonly string[]).includes(level)) continue;
      results.push({ idx, level: level as DifficultyLevel });
    }
    // 80% 이상 파싱되면 성공으로 취급
    if (results.length < expectedCount * 0.8) return null;
    return results;
  } catch {
    return null;
  }
}

async function callLLM(
  clusterName: string,
  guides: { idx: number; title: string }[],
): Promise<DifficultyResult[] | null> {
  const userPrompt = buildUserPrompt(clusterName, guides);

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const { text } = await generateText({
          model: google(model),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          temperature: 0.2,
          maxTokens: 4000,
        });
        const results = parseResults(text, guides.length);
        if (results) return results;
        console.warn(`   ⚠️ parse 실패 (${model} attempt ${attempt + 1}), got ${text.slice(0, 100)}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.includes("overloaded") || msg.includes("high demand")) {
          console.warn(`   ⚠️ ${model} rate-limited, ${BACKOFF_MS[attempt]}ms 대기...`);
          await sleep(BACKOFF_MS[attempt] ?? 15000);
          continue;
        }
        console.warn(`   ⚠️ ${model} 에러: ${msg.slice(0, 120)}`);
        break;
      }
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runLabeling() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

  // 클러스터 로드
  const { data: clusters, error: cErr } = await supabase
    .from("exploration_guide_topic_clusters")
    .select("id, name, guide_type, guide_count")
    .order("guide_count", { ascending: false });

  if (cErr || !clusters) {
    console.error("❌ cluster 조회 실패:", cErr?.message);
    process.exit(1);
  }

  const target = clusters.slice(0, LIMIT);
  console.log(`📊 ${target.length}개 클러스터 처리 예정`);
  if (DRY_RUN) console.log("🏷️  DRY RUN — DB 업데이트 안 함");

  let totalLabeled = 0;
  let totalFailed = 0;
  let llmCalls = 0;

  for (let ci = 0; ci < target.length; ci++) {
    const cluster = target[ci];
    process.stdout.write(`[${ci + 1}/${target.length}] ${cluster.name} (${cluster.guide_count}건)...`);

    // 이 클러스터의 가이드 중 difficulty_level이 null인 것만
    const allGuides: GuideRow[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("exploration_guides")
        .select("id, title")
        .eq("topic_cluster_id", cluster.id)
        .eq("status", "approved")
        .eq("is_latest", true)
        .is("difficulty_level", null)
        .order("title")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allGuides.push(...data);
      offset += data.length;
      if (data.length < 1000) break;
    }

    if (allGuides.length === 0) {
      console.log(" 스킵 (이미 완료)");
      continue;
    }

    // 배치 분할
    let clusterLabeled = 0;
    for (let bi = 0; bi < allGuides.length; bi += BATCH_SIZE) {
      const batch = allGuides.slice(bi, bi + BATCH_SIZE);
      const indexed = batch.map((g, i) => ({ idx: bi + i + 1, title: g.title }));

      const results = await callLLM(cluster.name, indexed);
      llmCalls++;

      if (!results) {
        console.warn(`\n   ❌ batch ${bi / BATCH_SIZE + 1} LLM 실패`);
        totalFailed += batch.length;
        continue;
      }

      // idx → guide id 매핑해서 UPDATE
      const idxToGuide = new Map(batch.map((g, i) => [bi + i + 1, g]));

      if (!DRY_RUN) {
        for (const r of results) {
          const guide = idxToGuide.get(r.idx);
          if (!guide) continue;
          const { error } = await supabase
            .from("exploration_guides")
            .update({ difficulty_level: r.level })
            .eq("id", guide.id);
          if (!error) clusterLabeled++;
          else totalFailed++;
        }
      } else {
        clusterLabeled += results.length;
      }

      await sleep(DELAY_MS);
    }

    totalLabeled += clusterLabeled;
    console.log(` ✅ ${clusterLabeled}건 라벨`);
  }

  console.log(`\n🏁 라벨링 완료: ${totalLabeled}건 성공, ${totalFailed}건 실패 (LLM 호출 ${llmCalls}회)`);

  // cluster stats 갱신 (difficulty_distribution)
  if (!DRY_RUN) {
    console.log("🔄 cluster difficulty_distribution 갱신...");
    for (const c of target) {
      await supabase.rpc("refresh_topic_cluster_stats", { p_cluster_id: c.id }).catch(() => {});
    }
    console.log("✅ 갱신 완료");
  }
}

async function runVerification() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

  console.log("\n📋 Step 5b: 난이도 검증 (100건 무작위 샘플)");

  // 100건 무작위 샘플 (difficulty_level이 있는 것만)
  const { data: samples, error } = await supabase
    .rpc("get_random_guides_with_difficulty", { sample_size: 100 });

  // RPC가 없으면 직접 쿼리
  let sampleGuides: Array<{ id: string; title: string; difficulty_level: string; cluster_name: string }>;

  if (error || !samples) {
    // fallback: 직접 쿼리 (TABLESAMPLE 불가하므로 order random limit)
    const { data, error: qErr } = await supabase
      .from("exploration_guides")
      .select("id, title, difficulty_level, topic_cluster_id")
      .eq("status", "approved")
      .eq("is_latest", true)
      .not("difficulty_level", "is", null)
      .limit(100);

    if (qErr || !data || data.length === 0) {
      console.error("❌ 샘플 조회 실패:", qErr?.message);
      return;
    }

    // cluster name 조인
    const clusterIds = [...new Set(data.map((d) => d.topic_cluster_id).filter(Boolean))];
    const { data: clusterData } = await supabase
      .from("exploration_guide_topic_clusters")
      .select("id, name")
      .in("id", clusterIds);
    const clusterMap = new Map((clusterData ?? []).map((c) => [c.id, c.name]));

    sampleGuides = data.map((d) => ({
      id: d.id,
      title: d.title,
      difficulty_level: d.difficulty_level,
      cluster_name: clusterMap.get(d.topic_cluster_id) ?? "unknown",
    }));
  } else {
    sampleGuides = samples;
  }

  console.log(`   ${sampleGuides.length}건 샘플 추출`);

  // LLM에게 재판정 요청 (배치)
  let agree = 0;
  let disagree = 0;
  const disagreements: Array<{ title: string; original: string; llm: string }> = [];

  for (let i = 0; i < sampleGuides.length; i += BATCH_SIZE) {
    const batch = sampleGuides.slice(i, i + BATCH_SIZE);
    const indexed = batch.map((g, idx) => ({ idx: i + idx + 1, title: g.title }));

    const results = await callLLM("검증 배치", indexed);
    if (!results) {
      console.warn(`   ⚠️ 검증 batch ${i / BATCH_SIZE + 1} 실패`);
      continue;
    }

    const idxToGuide = new Map(batch.map((g, idx) => [i + idx + 1, g]));
    for (const r of results) {
      const guide = idxToGuide.get(r.idx);
      if (!guide) continue;
      if (guide.difficulty_level === r.level) {
        agree++;
      } else {
        disagree++;
        disagreements.push({
          title: guide.title.slice(0, 60),
          original: guide.difficulty_level,
          llm: r.level,
        });
      }
    }

    await sleep(DELAY_MS);
  }

  const total = agree + disagree;
  const errorRate = total > 0 ? (disagree / total * 100).toFixed(1) : "N/A";

  console.log(`\n📊 검증 결과: ${agree}/${total} 일치 (오차율 ${errorRate}%)`);

  if (disagree > 0) {
    console.log(`\n불일치 ${disagree}건:`);
    for (const d of disagreements.slice(0, 20)) {
      console.log(`   ${d.original} → ${d.llm}: ${d.title}`);
    }
  }

  if (parseFloat(String(errorRate)) > 20) {
    console.log("\n⚠️ 오차율 > 20% — 전체 재라벨링 권장");
  } else {
    console.log("\n✅ 오차율 허용 범위 내 — 라벨링 품질 양호");
  }
}

async function main() {
  if (!VERIFY_ONLY) {
    await runLabeling();
  }
  await runVerification();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
