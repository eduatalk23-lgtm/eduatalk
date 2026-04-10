#!/usr/bin/env npx tsx
/**
 * Phase A Step 4: 100개 topic cluster LLM 라벨링
 *
 * 각 cluster 의 대표 가이드 제목을 샘플링하여 Gemini Flash 로
 * name / description / career_field_codes / subject_hints 를 생성,
 * exploration_guide_topic_clusters 에 UPDATE.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/label-guide-clusters.ts [--dry-run] [--limit=N]
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

// flash 과부하 시 pro 직접 사용 (--flash-first 로 flash 우선 복원 가능)
const USE_FLASH_FIRST = args.includes("--flash-first");
const MODEL_CHAIN = USE_FLASH_FIRST
  ? (["gemini-2.5-flash", "gemini-2.5-pro"] as const)
  : (["gemini-2.5-pro"] as const);
const DELAY_MS = 1200;
const MAX_RETRIES_PER_MODEL = 2;
const BACKOFF_MS = [5000, 15000];
const SAMPLE_SIZE = 15; // 클러스터당 샘플 가이드 수

const VALID_CAREER_CODES = [
  "HUM", "SOC", "NAT", "ENG", "MED", "EDU", "ART", "all_fields",
] as const;
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ---------- Prompt ----------
const SYSTEM_PROMPT = `당신은 한국 고등학교 탐구 가이드 DB의 주제 분류 전문가입니다.
주어진 가이드 제목 목록을 보고 이 클러스터의 주제를 요약합니다.

## 출력 규칙
1. name: 클러스터를 대표하는 한국어 주제명 (10~20자). 예: "생물 다양성과 진화", "인권과 사회정의", "확률과 통계 심화"
2. description: 이 클러스터에 속한 가이드들의 공통 주제를 설명 (80~150자)
3. career_field_codes: 가장 관련 높은 계열 코드 배열 (1~3개). 선택지: ${VALID_CAREER_CODES.join(", ")}
4. subject_hints: 연관 고교 과목명 배열 (1~4개). 예: ["생명과학I", "생명과학II", "생태와 환경"]

## 주의
- name 에 "클러스터", "그룹", "모음" 같은 메타 단어 사용 금지
- 가이드 제목이 너무 다양하면 가장 큰 주제 흐름 기준으로 요약
- all_fields 는 정말 범계열적일 때만 사용
- JSON만 출력. 마크다운 코드블록 금지.

## 출력 형식
{
  "name": "...",
  "description": "...",
  "career_field_codes": ["HUM", "SOC"],
  "subject_hints": ["사회·문화", "생활과 윤리"]
}`;

interface ClusterRow {
  id: string;
  name: string;
  guide_type: string;
  guide_count: number;
}

interface LabelResult {
  name: string;
  description: string;
  career_field_codes: string[];
  subject_hints: string[];
}

function buildUserPrompt(
  cluster: ClusterRow,
  titles: string[],
): string {
  return `## 클러스터 정보
- 유형: ${cluster.guide_type}
- 가이드 수: ${cluster.guide_count}건
- 현재 임시 이름: ${cluster.name}

## 대표 가이드 제목 (${titles.length}건 샘플)
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

이 클러스터의 주제를 요약하세요. JSON만 출력.`;
}

function parseJson(text: string): LabelResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.description !== "string") return null;
    const codes = Array.isArray(obj.career_field_codes)
      ? (obj.career_field_codes as string[]).filter((c) =>
          (VALID_CAREER_CODES as readonly string[]).includes(c),
        )
      : [];
    const hints = Array.isArray(obj.subject_hints)
      ? (obj.subject_hints as string[]).filter((h) => typeof h === "string")
      : [];
    return {
      name: obj.name.slice(0, 50),
      description: obj.description.slice(0, 300),
      career_field_codes: codes.length > 0 ? codes : ["all_fields"],
      subject_hints: hints.slice(0, 6),
    };
  } catch {
    return null;
  }
}

async function callLLM(
  cluster: ClusterRow,
  titles: string[],
): Promise<LabelResult | null> {
  const userPrompt = buildUserPrompt(cluster, titles);

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const { text } = await generateText({
          model: google(model),
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          temperature: 0.3,
          maxTokens: 500,
        });
        const result = parseJson(text);
        if (result) return result;
        console.warn(`   ⚠️ parse 실패 (${model} attempt ${attempt + 1})`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.includes("overloaded")) {
          console.warn(`   ⚠️ ${model} rate-limited, ${BACKOFF_MS[attempt]}ms 대기...`);
          await sleep(BACKOFF_MS[attempt] ?? 15000);
          continue;
        }
        console.warn(`   ⚠️ ${model} 에러: ${msg.slice(0, 100)}`);
        break; // 다음 모델로
      }
    }
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

  // (1) 전체 cluster 로드
  const { data: clusters, error: cErr } = await supabase
    .from("exploration_guide_topic_clusters")
    .select("id, name, guide_type, guide_count")
    .order("guide_type")
    .order("guide_count", { ascending: false });

  if (cErr || !clusters) {
    console.error("❌ cluster 조회 실패:", cErr?.message);
    process.exit(1);
  }

  // 이미 라벨된 것 스킵 (임시 이름 패턴 "xxx cluster yyy")
  const unlabeled = clusters.filter((c) => /cluster \d+|cluster all/.test(c.name));
  const target = unlabeled.slice(0, LIMIT);

  console.log(`📊 전체 ${clusters.length}개 중 미라벨 ${unlabeled.length}개, 처리 대상 ${target.length}개`);
  if (DRY_RUN) console.log("🏷️  DRY RUN — DB 업데이트 안 함");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < target.length; i++) {
    const cluster = target[i];
    process.stdout.write(`\r[${i + 1}/${target.length}] ${cluster.name} (${cluster.guide_count}건)...`);

    // (2) 대표 가이드 제목 샘플링
    const { data: guides } = await supabase
      .from("exploration_guides")
      .select("title")
      .eq("topic_cluster_id", cluster.id)
      .eq("status", "approved")
      .eq("is_latest", true)
      .limit(SAMPLE_SIZE);

    const titles = (guides ?? []).map((g) => g.title).filter(Boolean);
    if (titles.length === 0) {
      console.warn(`\n   ⚠️ ${cluster.name}: 가이드 0건, 스킵`);
      failed++;
      continue;
    }

    // (3) LLM 호출
    const label = await callLLM(cluster, titles);
    if (!label) {
      console.warn(`\n   ❌ ${cluster.name}: LLM 라벨 생성 실패`);
      failed++;
      continue;
    }

    console.log(`\n   ✅ "${label.name}" — ${label.career_field_codes.join(",")} — ${label.subject_hints.join(", ")}`);

    // (4) DB UPDATE
    if (!DRY_RUN) {
      const { error: uErr } = await supabase
        .from("exploration_guide_topic_clusters")
        .update({
          name: label.name,
          description: label.description,
          career_field_codes: label.career_field_codes,
          subject_hints: label.subject_hints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cluster.id);

      if (uErr) {
        console.error(`   ❌ UPDATE 실패: ${uErr.message}`);
        failed++;
        continue;
      }
    }

    success++;
    await sleep(DELAY_MS);
  }

  console.log(`\n\n🏁 완료: ${success} 성공, ${failed} 실패 (총 ${target.length})`);

  // (5) 소형 클러스터 병합 후보 리포트 (subject_performance 2~5건)
  const smallClusters = target.filter(
    (c) => c.guide_type === "subject_performance" && c.guide_count <= 5,
  );
  if (smallClusters.length > 0) {
    console.log(`\n📋 소형 subject_performance 클러스터 (≤5건) — 병합 검토 대상:`);
    for (const sc of smallClusters) {
      const { data: scGuides } = await supabase
        .from("exploration_guides")
        .select("title")
        .eq("topic_cluster_id", sc.id)
        .eq("status", "approved")
        .eq("is_latest", true)
        .limit(5);
      const scTitles = (scGuides ?? []).map((g) => g.title).join(" / ");
      console.log(`   - ${sc.name} (${sc.guide_count}건): ${scTitles.slice(0, 120)}`);
    }
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
