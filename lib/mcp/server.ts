/**
 * Phase F-1a: 에듀엣톡 MCP 서버 팩토리.
 *
 * 요청마다 새 McpServer 인스턴스를 생성하는 **stateless** 전략(F-1a v0).
 * 향후 세션 유지·알림 스트리밍이 필요하면 session id 기반 캐시로 승격 가능.
 *
 * Tool 범위(v0): Chat Shell 의 read/navigate 도구.
 *   - navigateTo (F-1a)
 *   - getScores·analyzeRecord·archiveConversation (F-1b 예정)
 *
 * Agent read tool(findDiagnosis 등)은 F-3 에서 추가.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  navigateToDescription,
  navigateToExecute,
  navigateToInputShape,
} from "@/lib/mcp/tools/navigateTo";

export const MCP_SERVER_INFO = {
  name: "eduatalk-mcp",
  version: "0.1.0",
} as const;

export function createMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO);

  server.registerTool(
    "navigateTo",
    {
      description: navigateToDescription,
      inputSchema: navigateToInputShape,
    },
    async (args) => {
      const result = await navigateToExecute(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        structuredContent: result,
        isError: !result.ok,
      };
    },
  );

  return server;
}
