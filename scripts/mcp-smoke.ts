/**
 * F-2 smoke test: createChatMcpHandle() 로 InMemoryTransport 경로가 살아있는지 확인.
 * tool 목록만 조회, 실제 execute 는 auth 필요라 skip.
 *
 * 사용: `npx tsx scripts/mcp-smoke.ts`
 */

import { createChatMcpHandle } from "@/lib/mcp/client";

async function main() {
  const handle = await createChatMcpHandle();
  try {
    const toolNames = Object.keys(handle.tools);
    console.log("[mcp-smoke] tools:", toolNames);
    if (toolNames.length === 0) {
      console.error("[mcp-smoke] FAIL: no tools returned");
      process.exit(1);
    }
    const expected = [
      "navigateTo",
      "getScores",
      "analyzeRecord",
      "getPipelineStatus",
      "getStudentRecords",
      "getStudentDiagnosis",
      "getStudentStorylines",
      "getStudentOverview",
    ];
    const missing = expected.filter((t) => !toolNames.includes(t));
    if (missing.length > 0) {
      console.error("[mcp-smoke] FAIL: missing tools:", missing);
      process.exit(1);
    }
    console.log(
      `[mcp-smoke] OK — all ${expected.length} MCP tools exposed\n`,
    );

    // F-2 회귀 진단: 각 tool 의 description + inputSchema 를 덤프.
    for (const name of toolNames) {
      const t = (handle.tools as Record<string, unknown>)[name] as {
        description?: string;
        inputSchema?: unknown;
      };
      console.log(`--- ${name} ---`);
      console.log("description:", t.description);
      console.log("inputSchema:", JSON.stringify(t.inputSchema, null, 2));
      console.log("");
    }
  } finally {
    await handle.close();
  }
}

main().catch((e) => {
  console.error("[mcp-smoke] ERROR:", e);
  process.exit(1);
});
