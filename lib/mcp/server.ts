/**
 * Phase F-1a/F-1b: 에듀엣톡 MCP 서버 팩토리.
 *
 * 요청마다 새 McpServer 인스턴스를 생성하는 **stateless** 전략(F-1a v0).
 * 향후 세션 유지·알림 스트리밍이 필요하면 session id 기반 캐시로 승격 가능.
 *
 * Tool 범위(v0): Chat Shell 의 read/navigate 도구.
 *   - navigateTo (F-1a)
 *   - getScores·analyzeRecord (F-1b)
 *   - archiveConversation 은 HITL elicitation 이 stateful session + MCP
 *     클라이언트 지원을 전제로 해 v0 범위에서 제외. Chat Shell 전용으로 유지.
 *
 * Agent read tool(findDiagnosis 등)은 F-3 에서 추가.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  navigateToDescription,
  navigateToExecute,
  navigateToInputShape,
} from "@/lib/mcp/tools/navigateTo";
import {
  getScoresDescription,
  getScoresExecute,
  getScoresInputShape,
} from "@/lib/mcp/tools/getScores";
import {
  analyzeRecordDescription,
  analyzeRecordExecute,
  analyzeRecordInputShape,
} from "@/lib/mcp/tools/analyzeRecord";
import {
  getPipelineStatusDescription,
  getPipelineStatusExecute,
  getPipelineStatusInputShape,
} from "@/lib/mcp/tools/getPipelineStatus";
import {
  getStudentRecordsDescription,
  getStudentRecordsExecute,
  getStudentRecordsInputShape,
} from "@/lib/mcp/tools/getStudentRecords";
import {
  getStudentDiagnosisDescription,
  getStudentDiagnosisExecute,
  getStudentDiagnosisInputShape,
} from "@/lib/mcp/tools/getStudentDiagnosis";
import {
  getStudentStorylinesDescription,
  getStudentStorylinesExecute,
  getStudentStorylinesInputShape,
} from "@/lib/mcp/tools/getStudentStorylines";
import {
  getStudentOverviewDescription,
  getStudentOverviewExecute,
  getStudentOverviewInputShape,
} from "@/lib/mcp/tools/getStudentOverview";
import {
  analyzeRecordDeepDescription,
  analyzeRecordDeepExecute,
  analyzeRecordDeepInputShape,
} from "@/lib/mcp/tools/analyzeRecordDeep";

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

  server.registerTool(
    "getScores",
    {
      description: getScoresDescription,
      inputSchema: getScoresInputShape,
    },
    async (args) => {
      const result = await getScoresExecute(args);
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

  server.registerTool(
    "analyzeRecord",
    {
      description: analyzeRecordDescription,
      inputSchema: analyzeRecordInputShape,
    },
    async (args) => {
      const result = await analyzeRecordExecute(args);
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

  server.registerTool(
    "getPipelineStatus",
    {
      description: getPipelineStatusDescription,
      inputSchema: getPipelineStatusInputShape,
    },
    async (args) => {
      const result = await getPipelineStatusExecute(args);
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

  server.registerTool(
    "getStudentRecords",
    {
      description: getStudentRecordsDescription,
      inputSchema: getStudentRecordsInputShape,
    },
    async (args) => {
      const result = await getStudentRecordsExecute(args);
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

  server.registerTool(
    "getStudentDiagnosis",
    {
      description: getStudentDiagnosisDescription,
      inputSchema: getStudentDiagnosisInputShape,
    },
    async (args) => {
      const result = await getStudentDiagnosisExecute(args);
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

  server.registerTool(
    "getStudentStorylines",
    {
      description: getStudentStorylinesDescription,
      inputSchema: getStudentStorylinesInputShape,
    },
    async (args) => {
      const result = await getStudentStorylinesExecute(args);
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

  server.registerTool(
    "getStudentOverview",
    {
      description: getStudentOverviewDescription,
      inputSchema: getStudentOverviewInputShape,
    },
    async (args) => {
      const result = await getStudentOverviewExecute(args);
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

  server.registerTool(
    "analyzeRecordDeep",
    {
      description: analyzeRecordDeepDescription,
      inputSchema: analyzeRecordDeepInputShape,
    },
    async (args) => {
      const result = await analyzeRecordDeepExecute(args);
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
