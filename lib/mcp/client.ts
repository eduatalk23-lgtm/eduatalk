/**
 * Phase F-2: 동일 프로세스 MCP 클라이언트.
 *
 * Chat Shell(`app/api/chat/route.ts`)이 자체 MCP 서버(`lib/mcp/server.ts`)를
 * **InMemoryTransport** 로 호출해 tool 정의를 수령. Vercel 서버-서버 HTTP
 * 체이닝을 피하기 위해 `fetch('/api/mcp')` 대신 동일 Node 프로세스 내부에서
 * client↔server 를 직결한다.
 *
 * MCP SDK 의 `InMemoryTransport.createLinkedPair()` 가 반환하는 Transport 쌍은
 * AI SDK 의 `MCPTransport` 인터페이스와 동일 shape 라 그대로 사용 가능.
 *
 * 수명: 요청당 1회 생성 → streamText 완료 후 close. v0 stateless 서버 정책과
 * 일치.
 */

import type { MCPTransport } from "@ai-sdk/mcp";
import { createMCPClient } from "@ai-sdk/mcp";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/lib/mcp/server";

export type ChatMcpHandle = {
  /** streamText 의 tools 에 merge 해 전달 */
  tools: Awaited<ReturnType<Awaited<ReturnType<typeof createMCPClient>>["tools"]>>;
  /** 스트림 완료 후 반드시 호출 (transport · server 해제) */
  close: () => Promise<void>;
};

/**
 * 요청별 MCP 서버↔클라이언트 쌍 생성.
 * Chat route 에서 `const h = await createChatMcpHandle()` → streamText tools 에 h.tools
 * 전개 → onFinish 에서 `await h.close()`.
 */
export async function createChatMcpHandle(): Promise<ChatMcpHandle> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const server = createMcpServer();
  await server.connect(serverTransport);

  const client = await createMCPClient({
    transport: clientTransport as unknown as MCPTransport,
    name: "eduatalk-shell",
    version: "0.1.0",
  });

  const tools = await client.tools();

  return {
    tools,
    close: async () => {
      try {
        await client.close();
      } catch {
        // ignore
      }
      try {
        await server.close();
      } catch {
        // ignore
      }
    },
  };
}
