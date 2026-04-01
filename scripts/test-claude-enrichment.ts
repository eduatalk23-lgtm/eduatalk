/**
 * Claude Web Search 출처 수집 테스트 스크립트
 *
 * 실행: npx tsx scripts/test-claude-enrichment.ts
 *
 * 테스트 내용:
 * 1. 가상 가이드 데이터로 enrichGuideResources() 실행
 * 2. URL 유효성 확인
 * 3. 결과 출력
 */

import "dotenv/config";

// Dynamic import로 서버 전용 모듈 우회
async function main() {
  console.log("=== Claude Web Search 출처 수집 테스트 ===\n");

  // API 키 확인
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY가 설정되지 않았습니다.");
    console.error("   .env.local 파일을 확인하세요.");
    process.exit(1);
  }
  console.log("✅ ANTHROPIC_API_KEY 확인됨\n");

  // enrichGuideResources를 직접 구현 (서버 액션 import 우회)
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // 테스트 데이터: 실제 가이드에서 나올 법한 resources
  const testResources = [
    {
      description: "니켈 촉매의 활성 온도는 300-400°C 범위로 보고됨(김○○, 2022)",
      consultantHint: "RISS: 니켈 촉매 메탄화 활성 온도",
    },
    {
      description: "난민협약 제33조의 강제송환금지원칙은 국제관습법으로 인정됨",
      consultantHint: "KCI: 난민법 강제송환금지원칙",
    },
    {
      description: "열역학 제2법칙에 따르면 고립계의 엔트로피는 항상 증가하거나 일정하다",
      consultantHint: "DBpia: 엔트로피 열역학 교육",
    },
  ];

  const testPapers = [
    { title: "이산화탄소 메탄화를 위한 니켈 촉매 기술 동향", summary: "Ni 기반 촉매의 CO2 메탄화 반응 특성 분석" },
    { title: "한국 난민정책의 현황과 과제", summary: "난민법 제정 이후 난민 인정 절차의 문제점 분석" },
  ];

  const DOMAINS = [
    "riss.kr", "kci.go.kr", "dbpia.co.kr", "scholar.google.com",
    "kiss.kstudy.com", "scienceall.com", "koreascience.kr",
  ];

  // 테스트 1: 개별 리소스 검색
  console.log("─".repeat(60));
  console.log("📚 테스트 1: 개별 리소스 출처 검색");
  console.log("─".repeat(60));

  for (const resource of testResources) {
    console.log(`\n🔍 검색: "${resource.description.slice(0, 50)}..."`);
    console.log(`   힌트: ${resource.consultantHint}`);

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 2,
            allowed_domains: DOMAINS,
            user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `다음 참고 자료에 해당하는 실제 학술 논문 또는 자료의 웹 페이지를 찾아주세요.

참고 자료 설명: ${resource.description}
검색 힌트: ${resource.consultantHint}

찾은 URL과 해당 페이지에서 관련 내용 1~2문장을 인용해주세요.
찾지 못하면 "URL_NOT_FOUND"라고만 답하세요.`,
          },
        ],
      });

      // 결과 파싱
      let foundUrl: string | null = null;
      let citedText: string | null = null;

      for (const block of response.content) {
        if (block.type === "text") {
          if (block.text.includes("URL_NOT_FOUND")) {
            console.log("   ⚠️ URL을 찾지 못함");
            break;
          }

          // citations에서 URL 추출
          if ("citations" in block && Array.isArray((block as Record<string, unknown>).citations)) {
            for (const c of (block as Record<string, unknown>).citations as Array<Record<string, unknown>>) {
              if (c.type === "web_search_result_location" && typeof c.url === "string") {
                if (!foundUrl) foundUrl = c.url;
                if (typeof c.cited_text === "string" && !citedText) citedText = c.cited_text;
              }
            }
          }

          // text에서 URL fallback
          if (!foundUrl) {
            const match = block.text.match(/https?:\/\/[^\s)>\]"']+/);
            if (match) foundUrl = match[0];
          }

          if (!citedText && block.text.length > 20) {
            citedText = block.text.slice(0, 150);
          }
        }

        // web_search_tool_result에서도 URL 추출
        if (block.type === "web_search_tool_result" && "content" in block) {
          const content = (block as Record<string, unknown>).content;
          if (Array.isArray(content)) {
            for (const r of content) {
              if (typeof r === "object" && r !== null && "url" in r && typeof (r as Record<string, unknown>).url === "string") {
                if (!foundUrl) foundUrl = (r as Record<string, unknown>).url as string;
              }
            }
          }
        }
      }

      if (foundUrl) {
        // URL 유효성 검증
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          let res = await fetch(foundUrl, { method: "HEAD", signal: controller.signal, redirect: "follow" });
          clearTimeout(timeout);

          if (res.status === 405) {
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), 5000);
            res = await fetch(foundUrl, { method: "GET", signal: ctrl2.signal, redirect: "follow" });
            clearTimeout(t2);
          }

          const valid = res.ok;
          console.log(`   ${valid ? "✅" : "❌"} URL: ${foundUrl}`);
          console.log(`   📝 인용: ${citedText?.slice(0, 100) ?? "(없음)"}...`);
        } catch {
          console.log(`   ❌ URL 접속 실패: ${foundUrl}`);
        }
      } else {
        console.log("   ⚠️ URL 미발견");
      }

      // 토큰 사용량
      console.log(`   💰 토큰: in=${response.usage.input_tokens}, out=${response.usage.output_tokens}`);

    } catch (err) {
      console.log(`   ❌ API 에러: ${err instanceof Error ? err.message : String(err)}`);
    }

    // rate limit 대기
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 테스트 2: 논문 검색
  console.log(`\n${"─".repeat(60)}`);
  console.log("📄 테스트 2: 관련 논문 검색");
  console.log("─".repeat(60));

  for (const paper of testPapers) {
    console.log(`\n🔍 논문: "${paper.title}"`);

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 2,
            allowed_domains: DOMAINS,
            user_location: { type: "approximate", country: "KR", timezone: "Asia/Seoul" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `다음 논문의 실제 URL을 한국 학술 데이터베이스(RISS, KCI, DBpia)에서 찾아주세요.

논문 제목: ${paper.title}
요약: ${paper.summary}

찾은 URL과 논문 초록에서 1~2문장을 인용해주세요.
찾지 못하면 "URL_NOT_FOUND"라고만 답하세요.`,
          },
        ],
      });

      // 간단 파싱
      let foundUrl: string | null = null;
      let citedText: string | null = null;

      for (const block of response.content) {
        if (block.type === "text") {
          if (block.text.includes("URL_NOT_FOUND")) break;
          if ("citations" in block && Array.isArray((block as Record<string, unknown>).citations)) {
            for (const c of (block as Record<string, unknown>).citations as Array<Record<string, unknown>>) {
              if (c.type === "web_search_result_location" && typeof c.url === "string") {
                if (!foundUrl) foundUrl = c.url;
                if (typeof c.cited_text === "string" && !citedText) citedText = c.cited_text;
              }
            }
          }
          if (!foundUrl) {
            const match = block.text.match(/https?:\/\/[^\s)>\]"']+/);
            if (match) foundUrl = match[0];
          }
          if (!citedText && block.text.length > 20) citedText = block.text.slice(0, 150);
        }
        if (block.type === "web_search_tool_result" && "content" in block) {
          const content = (block as Record<string, unknown>).content;
          if (Array.isArray(content)) {
            for (const r of content) {
              if (typeof r === "object" && r !== null && "url" in r) {
                if (!foundUrl) foundUrl = (r as Record<string, unknown>).url as string;
              }
            }
          }
        }
      }

      if (foundUrl) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          let res = await fetch(foundUrl, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
          clearTimeout(t);
          if (res.status === 405) {
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), 5000);
            res = await fetch(foundUrl, { method: "GET", signal: ctrl2.signal, redirect: "follow" });
            clearTimeout(t2);
          }
          console.log(`   ${res.ok ? "✅" : "❌"} URL: ${foundUrl}`);
          console.log(`   📝 인용: ${citedText?.slice(0, 100) ?? "(없음)"}...`);
        } catch {
          console.log(`   ❌ URL 접속 실패: ${foundUrl}`);
        }
      } else {
        console.log("   ⚠️ URL 미발견");
      }

      console.log(`   💰 토큰: in=${response.usage.input_tokens}, out=${response.usage.output_tokens}`);

    } catch (err) {
      console.log(`   ❌ API 에러: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ 테스트 완료");
  console.log("=".repeat(60));
}

main().catch(console.error);
