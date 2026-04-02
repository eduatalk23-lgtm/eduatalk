/**
 * academic_sources 매칭 테스트
 * - 다양한 주제로 벡터 검색하여 매칭률 확인
 * - Gemini 임베딩 + Supabase RPC
 *
 * 실행: set -a && source .env.local && set +a && npx tsx scripts/test-academic-matching.ts
 */

import "dotenv/config";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = "gemini-embedding-2-preview";
const EMBEDDING_DIMENSIONS = 768;

// 실제 가이드에서 나올 법한 리소스 설명 (다양한 과목)
const TEST_QUERIES = [
  // 과학
  { query: "DNA 이중나선 구조와 복제 메커니즘에 관한 분자생물학 연구", subject: "생물학" },
  { query: "뉴턴 역학에서 라그랑주 역학으로의 전환과 일반화 좌표", subject: "물리학" },
  { query: "산화-환원 반응에서 전자 이동과 전기화학 전지의 원리", subject: "화학" },
  { query: "판 구조론과 한반도 지진 발생 메커니즘", subject: "지구과학" },
  // 수학
  { query: "미분방정식을 활용한 감염병 확산 모델링 SIR 모형", subject: "수학" },
  { query: "지니계수의 수학적 원리와 소득 불평등 측정", subject: "수학" },
  // 국어/사회
  { query: "현대 소설에서의 서사 구조와 인물 형상화 기법 분석", subject: "국어" },
  { query: "한국 청소년의 정치 참여와 민주주의 의식 변화", subject: "사회학" },
  // 윤리
  { query: "인공지능의 도덕적 행위자 가능성과 책임 귀속 문제", subject: "윤리학" },
  { query: "유전자 편집 기술 CRISPR의 생명윤리적 쟁점", subject: "윤리학" },
  // 기타
  { query: "음악 치료가 청소년 정서 조절에 미치는 효과", subject: "음악" },
  { query: "Nrf2 signaling pathway and oxidative stress in neurodegeneration", subject: "생물학" },
  // 융합 주제
  { query: "빅데이터 분석을 활용한 도시 열섬 효과 연구", subject: "환경과학" },
  { query: "한국 전통 발효식품의 프로바이오틱스 기능성 분석", subject: "식품과학" },
  { query: "청소년 SNS 사용과 사회비교 심리가 자존감에 미치는 영향", subject: "심리학" },
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || !process.env.GOOGLE_API_KEY) {
    console.error("❌ 환경변수 누락");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("\n🔬 Academic Sources 매칭 테스트\n");
  console.log("=".repeat(100));

  const thresholds = [0.78, 0.72, 0.65];
  const results: { query: string; subject: string; matches: Record<number, number>; bestTitle: string; bestScore: number }[] = [];

  for (const test of TEST_QUERIES) {
    // 임베딩 생성
    const { embedding } = await embed({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      value: test.query,
      providerOptions: { google: { outputDimensionality: EMBEDDING_DIMENSIONS } },
    });

    const matchCounts: Record<number, number> = {};
    let bestTitle = "";
    let bestScore = 0;

    for (const threshold of thresholds) {
      const { data, error } = await supabase.rpc("search_academic_sources", {
        query_embedding: JSON.stringify(embedding),
        subject_filter: null, // 순수 벡터 검색
        match_count: 5,
        similarity_threshold: threshold,
      });

      if (error) {
        console.error(`  ❌ 검색 실패: ${error.message}`);
        matchCounts[threshold] = -1;
        continue;
      }

      matchCounts[threshold] = data?.length ?? 0;

      if (threshold === thresholds[0] && data && data.length > 0) {
        bestTitle = (data[0] as { title: string }).title;
        bestScore = (data[0] as { score: number }).score;
      }
      // 0.78에서 못 찾았으면 0.72 결과 사용
      if (threshold === thresholds[1] && !bestTitle && data && data.length > 0) {
        bestTitle = (data[0] as { title: string }).title;
        bestScore = (data[0] as { score: number }).score;
      }
    }

    results.push({ query: test.query, subject: test.subject, matches: matchCounts, bestTitle, bestScore });

    const status78 = matchCounts[0.78] > 0 ? "✅" : matchCounts[0.72] > 0 ? "🟡" : "❌";
    console.log(`\n${status78} [${test.subject}] ${test.query.slice(0, 55)}`);
    console.log(`   임계값별: 0.78→${matchCounts[0.78]}건  0.72→${matchCounts[0.72]}건  0.65→${matchCounts[0.65]}건`);
    if (bestTitle) {
      console.log(`   최고매칭: "${bestTitle.slice(0, 60)}" (${bestScore.toFixed(3)})`);
    }

    // rate limit
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 요약
  console.log("\n" + "=".repeat(100));
  console.log("\n📊 매칭 요약\n");

  for (const t of thresholds) {
    const matched = results.filter((r) => r.matches[t] > 0).length;
    console.log(`  임계값 ${t}: ${matched}/${results.length} 매칭 (${Math.round((100 * matched) / results.length)}%)`);
  }

  const avgBestScore = results.filter((r) => r.bestScore > 0).reduce((sum, r) => sum + r.bestScore, 0) /
    Math.max(1, results.filter((r) => r.bestScore > 0).length);
  console.log(`  평균 최고 유사도: ${avgBestScore.toFixed(3)}`);
  console.log(`\n  ✅ = 0.78 이상 매칭, 🟡 = 0.72~0.78 매칭, ❌ = 매칭 없음\n`);
}

main().catch(console.error);
