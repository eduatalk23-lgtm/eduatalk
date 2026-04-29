/**
 * topic_exploration 151건 재분류 (Phase 1 / Decision #1)
 *
 * 실행:
 *   set -a && source .env.local && set +a && npx tsx scripts/reclassify-topic-exploration.ts [--dry-run] [--limit=N]
 *
 * 동작:
 *   1. approved + is_latest = true + guide_type = 'topic_exploration' 가이드 전체 조회
 *   2. 각 가이드를 Gemini Flash로 4분류:
 *        setek_only            — 교과 개념 심화형, 세특 전용
 *        changche_autonomy     — 시사·사회 이슈, 인문학적 성찰형 (창체 자율)
 *        changche_club         — 지속 탐구, 전공 심화형 (창체 동아리)
 *        changche_career       — 진로 탐색, 자기주도 조사형 (창체 진로)
 *   3. 신뢰도 ≥ 0.9 → tentative_review_status = 'auto_approved'
 *      그 외 → 'needs_review'
 *   4. exploration_guides에 tentative_* 컬럼 업데이트
 *
 * 결과는 Step 4 CSV 내보내기 스크립트가 컨설턴트 리뷰용으로 읽음.
 */

import "dotenv/config";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

// 모델 fallback chain — flash overloaded 시 pro로 자동 전환
const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-2.5-pro"] as const;
const DELAY_MS = 1200; // 분당 50건 수준
const MAX_RETRIES_PER_MODEL = 2;
const BACKOFF_MS = [5000, 15000];

interface GuideRow {
  id: string;
  title: string;
  content_preview: string;
  career_fields: string[];
}

interface ClassificationResult {
  primary: "setek_only" | "changche_autonomy" | "changche_club" | "changche_career";
  confidence: number;
  alternatives: string[];
  reasoning: string;
}

const SYSTEM_PROMPT = `당신은 한국 고등학교 생활기록부(생기부) 전문 컨설턴트입니다.
주어진 탐구 주제가 세특/창체 중 어느 영역에 가장 적합한지 4분류합니다.

## 분류 기준

### 1. setek_only (교과 세특 전용)
- 교과 개념·이론·공식에서 출발하는 탐구
- 특정 과목의 성취기준과 직접 연결됨
- 예: "베르누이 정리 탐구", "미분이 실생활에 활용되는 사례", "헤스의 법칙 반응열", "자연언어처리 방법의 이해"

### 2. changche_autonomy (창체 자율·자치)
- 학교 공통 교육프로그램(민주시민·인권·환경·생명존중 등) + 교과 이론 대입 + 인문학적/사회적 성찰
- 사회 이슈·시사 + 다학문적 관점
- 예: "ESG 경영과 공리주의", "22대 총선 여론조사 통계적 오류", "국제관계가 경제에 미친 영향", "국제연구보고서 민주화→독재화", "땡윤뉴스와 K-콘텐츠"

### 3. changche_club (창체 동아리)
- 2년 이상 지속 가능한 전공 심화 탐구
- 동아리 단위 협업·프로젝트·산출물 가능
- 기존 탐구를 이어서 확장할 수 있는 주제
- 예: "자연언어처리 동아리 프로젝트", "미래식량 대체 식품 탐구", "수학 모델링 동아리 연구"

### 4. changche_career (창체 진로)
- 자기주도 진로 조사·탐색 중심
- 학과·직업 연계가 명확하고 진로 계획을 구체화
- 박람회/학과탐방에서 출발해 심화 탐구로 이어지는 주제
- 예: "개와 고양이 자가면역질환 탐구(수의학 지망)", "특정 직업군 인터뷰 프로젝트"

## 분류 규칙

- 둘 이상의 카테고리에 애매하게 걸치면 primary에 가장 가능성 높은 것, alternatives에 2순위
- confidence는 0.00~1.00 사이 숫자로, 0.9 이상은 "매우 확실"일 때만
- reasoning은 1-2문장으로 간결하게 판단 근거를 쓸 것
- JSON만 출력

## 출력 형식

{
  "primary": "setek_only",
  "confidence": 0.92,
  "alternatives": [],
  "reasoning": "교과 개념(미분)에서 출발하고 수학 성취기준에 직접 대응됨"
}`;

function buildUserPrompt(guide: GuideRow): string {
  const parts: string[] = [];
  parts.push(`## 분류 대상 가이드\n`);
  parts.push(`제목: ${guide.title}`);
  if (guide.career_fields.length > 0) {
    parts.push(`연결된 계열: ${guide.career_fields.join(", ")}`);
  }
  if (guide.content_preview) {
    parts.push(`본문 요약: ${guide.content_preview.slice(0, 400)}`);
  }
  parts.push(`\n이 가이드를 분류하세요. JSON만 출력.`);
  return parts.join("\n");
}

function parseJson(text: string): ClassificationResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    const primary = obj.primary;
    const confidence = obj.confidence;
    if (typeof primary !== "string" || typeof confidence !== "number") return null;
    if (
      primary !== "setek_only" &&
      primary !== "changche_autonomy" &&
      primary !== "changche_club" &&
      primary !== "changche_career"
    )
      return null;
    return {
      primary,
      confidence: Math.max(0, Math.min(1, confidence)),
      alternatives: Array.isArray(obj.alternatives) ? (obj.alternatives as string[]) : [],
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
    };
  } catch {
    return null;
  }
}

function primaryToColumns(primary: ClassificationResult["primary"]): {
  tentative_guide_type: string | null;
  tentative_activity_type: string | null;
} {
  switch (primary) {
    case "setek_only":
      return { tentative_guide_type: null, tentative_activity_type: null };
    case "changche_autonomy":
      return { tentative_guide_type: "reflection_program", tentative_activity_type: "autonomy" };
    case "changche_club":
      return { tentative_guide_type: "club_deep_dive", tentative_activity_type: "club" };
    case "changche_career":
      return { tentative_guide_type: "career_exploration_project", tentative_activity_type: "career" };
  }
}

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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase 환경변수 누락");
    process.exit(1);
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY 누락");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔄 topic_exploration 재분류 시작");
  console.log(`   모드: ${dryRun ? "DRY-RUN" : "LIVE"}`);
  if (limit) console.log(`   제한: ${limit}건`);

  // 대상 가이드 조회
  const { data: guides, error: guideErr } = await supabase
    .from("exploration_guides")
    .select("id, title")
    .eq("guide_type", "topic_exploration")
    .eq("status", "approved")
    .eq("is_latest", true)
    .order("created_at");

  if (guideErr || !guides) {
    console.error("❌ 가이드 조회 실패:", guideErr?.message);
    process.exit(1);
  }

  const targets = limit ? guides.slice(0, limit) : guides;
  console.log(`📋 대상: ${targets.length}건\n`);

  // 콘텐츠 일괄 조회
  const guideIds = targets.map((g) => g.id);
  const { data: contents } = await supabase
    .from("exploration_guide_content")
    .select("guide_id, content_sections")
    .in("guide_id", guideIds);

  const contentMap = new Map<string, string>();
  for (const c of contents ?? []) {
    const sections = (c as { guide_id: string; content_sections: unknown }).content_sections;
    if (!Array.isArray(sections)) continue;
    const text = sections
      .map((s: { content?: string }) => stripHtml(s.content ?? ""))
      .filter((t) => t.length > 0)
      .join(" ");
    contentMap.set((c as { guide_id: string }).guide_id, text);
  }

  // 계열 매핑 일괄 조회
  const { data: careerRows } = await supabase
    .from("exploration_guide_career_mappings")
    .select("guide_id, career_field_id, exploration_guide_career_fields!inner(name_kor)")
    .in("guide_id", guideIds);

  const careerMap = new Map<string, string[]>();
  for (const row of careerRows ?? []) {
    const r = row as {
      guide_id: string;
      exploration_guide_career_fields: { name_kor: string } | { name_kor: string }[];
    };
    const cfs = Array.isArray(r.exploration_guide_career_fields)
      ? r.exploration_guide_career_fields
      : [r.exploration_guide_career_fields];
    const names = cfs.map((cf) => cf.name_kor);
    const existing = careerMap.get(r.guide_id) ?? [];
    careerMap.set(r.guide_id, [...new Set([...existing, ...names])]);
  }

  const stats = {
    setek_only: 0,
    changche_autonomy: 0,
    changche_club: 0,
    changche_career: 0,
    auto_approved: 0,
    needs_review: 0,
    failed: 0,
  };

  for (let i = 0; i < targets.length; i++) {
    const g = targets[i];
    const guide: GuideRow = {
      id: g.id,
      title: g.title,
      content_preview: contentMap.get(g.id) ?? "",
      career_fields: careerMap.get(g.id) ?? [],
    };

    const progress = `[${i + 1}/${targets.length}]`;
    const shortTitle = guide.title.length > 40 ? guide.title.slice(0, 40) + "…" : guide.title;

    if (dryRun) {
      console.log(`${progress} DRY-RUN: ${shortTitle}`);
      continue;
    }

    let text: string | null = null;
    let lastError: Error | null = null;
    modelLoop: for (const modelId of MODEL_CHAIN) {
      for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const resp = await generateText({
            model: google(modelId),
            system: SYSTEM_PROMPT,
            prompt: buildUserPrompt(guide),
            temperature: 0.1,
          });
          text = resp.text;
          break modelLoop;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const isOverloaded =
            lastError.message.includes("high demand") ||
            lastError.message.includes("overload") ||
            lastError.message.includes("503");
          if (!isOverloaded) break;
          const wait = BACKOFF_MS[attempt] ?? 15000;
          console.log(`${progress} ⏳ ${modelId} 과부하, ${wait / 1000}s 대기 후 재시도`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }

    if (!text) {
      console.log(
        `${progress} ❌ 전체 모델 실패: ${lastError?.message ?? "unknown"}: ${shortTitle}`,
      );
      stats.failed++;
      await new Promise((r) => setTimeout(r, DELAY_MS));
      continue;
    }

    try {
      const result = parseJson(text);
      if (!result) {
        console.log(`${progress} ⚠️  파싱 실패: ${shortTitle}`);
        stats.failed++;
        await new Promise((r) => setTimeout(r, DELAY_MS));
        continue;
      }

      const cols = primaryToColumns(result.primary);
      // 신뢰도 0.92 이상이면 자동 승인 (alternatives는 LLM이 모델링용 힌트로 남기는 경우가 많아 약한 제약)
      const reviewStatus =
        result.confidence >= 0.92 ? "auto_approved" : "needs_review";

      stats[result.primary]++;
      stats[reviewStatus as "auto_approved" | "needs_review"]++;

      const { error: updErr } = await supabase
        .from("exploration_guides")
        .update({
          tentative_guide_type: cols.tentative_guide_type,
          tentative_activity_type: cols.tentative_activity_type,
          tentative_confidence: result.confidence,
          tentative_review_status: reviewStatus,
          tentative_reasoning: result.reasoning,
        })
        .eq("id", guide.id);

      if (updErr) {
        console.log(`${progress} ❌ DB 업데이트 실패: ${updErr.message}`);
        stats.failed++;
      } else {
        const marker = reviewStatus === "auto_approved" ? "✅" : "🔍";
        console.log(
          `${progress} ${marker} ${result.primary} (${result.confidence.toFixed(2)}) ${shortTitle}`,
        );
      }
    } catch (err) {
      console.log(
        `${progress} ❌ ${err instanceof Error ? err.message : String(err)}: ${shortTitle}`,
      );
      stats.failed++;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log("\n📊 분류 결과");
  console.log(`   setek_only:        ${stats.setek_only}건`);
  console.log(`   changche_autonomy: ${stats.changche_autonomy}건`);
  console.log(`   changche_club:     ${stats.changche_club}건`);
  console.log(`   changche_career:   ${stats.changche_career}건`);
  console.log(`   auto_approved:     ${stats.auto_approved}건 (신뢰도 ≥ 0.9)`);
  console.log(`   needs_review:      ${stats.needs_review}건`);
  if (stats.failed > 0) console.log(`   ❌ failed:         ${stats.failed}건`);
}

main().catch((err) => {
  console.error("❌ 실행 실패:", err);
  process.exit(1);
});
