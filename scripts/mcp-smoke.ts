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
    const expected = ["navigateTo", "getScores", "analyzeRecord"];
    const missing = expected.filter((t) => !toolNames.includes(t));
    if (missing.length > 0) {
      console.error("[mcp-smoke] FAIL: missing tools:", missing);
      process.exit(1);
    }
    console.log("[mcp-smoke] OK — all 3 MCP tools exposed");
  } finally {
    await handle.close();
  }
}

main().catch((e) => {
  console.error("[mcp-smoke] ERROR:", e);
  process.exit(1);
});
