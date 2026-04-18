/**
 * Phase F-1a: MCP Streamable HTTP 엔드포인트.
 *
 * Anthropic `@modelcontextprotocol/sdk` v1.29 의 WebStandardStreamableHTTPServerTransport
 * 를 사용해 Next.js App Router 의 Web Request/Response 를 그대로 처리.
 *
 * v0 정책:
 * - Stateless: 요청마다 새 서버/트랜스포트 생성 (세션 없음)
 * - JSON 응답 모드: SSE 스트리밍 대신 단일 JSON 반환 (단순 조회 용도 충분)
 * - 인증: Next.js 세션 쿠키 의존 (별도 API 키 미도입). 외부 에이전트(Claude Desktop)
 *   연동은 F-6 에서 OAuth/토큰 도입 후 확장.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function handleRequest(req: Request): Promise<Response> {
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
  return handleRequest(req);
}

export async function DELETE(req: Request) {
  return handleRequest(req);
}
