// ============================================
// Phase D-2 — status-extractor 단위 테스트.
// UIMessage parts + useChat status → AgentStatus 매핑.
// ============================================

import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import {
  extractAgentStatus,
  labelForTool,
  TOOL_LABELS,
  type UseChatStatus,
} from "../ui/status-extractor";

// UIMessage parts 의 내부 구조는 TS 에서 union-generic 이라 테스트에서 직접
// 만들기 번거롭다. 이 파일은 구조만 검사하므로 any-cast 가 아닌 "as unknown as"
// 경로로 최소 속성만 넣어 주입한다.
function msg(
  role: "user" | "assistant",
  parts: unknown[],
  id: string = Math.random().toString(36).slice(2),
): UIMessage {
  return {
    id,
    role,
    parts: parts as never,
  } as unknown as UIMessage;
}

function textPart(text: string) {
  return { type: "text", text };
}

function reasoningPart(state: "streaming" | "done", text = "") {
  return { type: "reasoning", state, text };
}

function toolPart(
  toolName: string,
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error",
  opts: { toolCallId?: string; dynamic?: boolean } = {},
) {
  if (opts.dynamic) {
    return {
      type: "dynamic-tool",
      toolName,
      state,
      toolCallId: opts.toolCallId ?? `tc-${toolName}`,
    };
  }
  return {
    type: `tool-${toolName}`,
    state,
    toolCallId: opts.toolCallId ?? `tc-${toolName}`,
  };
}

describe("labelForTool", () => {
  it("맵핑된 tool 은 한국어 라벨", () => {
    expect(labelForTool("getScores")).toBe("성적 조회");
    expect(labelForTool("navigateTo")).toBe("화면 이동");
    expect(labelForTool("analyzeRecordDeep")).toBe("생기부 심층 분석");
  });

  it("맵핑 누락 시 원본 반환", () => {
    expect(labelForTool("futureUnknownTool")).toBe("futureUnknownTool");
  });

  it("모든 주요 Shell tool 라벨 존재", () => {
    for (const name of [
      "navigateTo",
      "getScores",
      "analyzeRecord",
      "getStudentRecords",
      "archiveConversation",
      "applyArtifactEdit",
    ]) {
      expect(TOOL_LABELS[name]).toBeDefined();
    }
  });
});

describe("extractAgentStatus — status 별 기본 분기", () => {
  const S: UseChatStatus[] = ["submitted", "streaming", "ready", "error"];

  it("error 는 항상 phase=error", () => {
    const s = extractAgentStatus([], "error");
    expect(s.phase).toBe("error");
    expect(s.label).toBe("오류가 발생했습니다");
  });

  it("ready + 메시지 없음 → idle", () => {
    const s = extractAgentStatus([], "ready");
    expect(s.phase).toBe("idle");
    expect(s.label).toBeNull();
  });

  it("submitted + 메시지 없음 → thinking 생각 중", () => {
    const s = extractAgentStatus([], "submitted");
    expect(s.phase).toBe("thinking");
    expect(s.label).toBe("생각 중");
  });

  it("streaming + 어시스턴트 메시지 없음 → thinking", () => {
    const s = extractAgentStatus([msg("user", [textPart("안녕")])], "streaming");
    expect(s.phase).toBe("thinking");
    expect(s.label).toBe("생각 중");
  });

  it("모든 status 타입이 valid 반환", () => {
    for (const st of S) {
      const s = extractAgentStatus([], st);
      expect(["idle", "thinking", "tool", "generating", "error"]).toContain(
        s.phase,
      );
    }
  });
});

describe("extractAgentStatus — tool 활성", () => {
  it("정적 tool(getScores) + input-streaming → phase=tool", () => {
    const m = msg("assistant", [
      toolPart("getScores", "input-streaming", { toolCallId: "t1" }),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("tool");
    expect(s.toolName).toBe("getScores");
    expect(s.toolCallId).toBe("t1");
    expect(s.label).toBe("성적 조회 실행 중");
    expect(s.awaitingApproval).toBe(false);
  });

  it("dynamic-tool(MCP) 도 toolName 추출", () => {
    const m = msg("assistant", [
      toolPart("navigateTo", "input-available", {
        toolCallId: "t2",
        dynamic: true,
      }),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("tool");
    expect(s.toolName).toBe("navigateTo");
    expect(s.label).toBe("화면 이동 실행 중");
  });

  it("HITL tool(archiveConversation) + input-available → 승인 대기", () => {
    const m = msg("assistant", [
      toolPart("archiveConversation", "input-available", { toolCallId: "t3" }),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("tool");
    expect(s.awaitingApproval).toBe(true);
    expect(s.label).toBe("대화 보관 · 승인 대기");
  });

  it("HITL tool 의 input-streaming 은 아직 승인 대기 아님", () => {
    const m = msg("assistant", [
      toolPart("applyArtifactEdit", "input-streaming"),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.awaitingApproval).toBe(false);
    expect(s.label).toBe("아티팩트 적용 실행 중");
  });

  it("output-available 파트는 activeTool 이 아님 → 다음 후보 탐색", () => {
    const m = msg("assistant", [
      toolPart("getScores", "output-available", { toolCallId: "t1" }),
      toolPart("analyzeRecord", "input-streaming", { toolCallId: "t2" }),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("tool");
    expect(s.toolName).toBe("analyzeRecord");
    expect(s.completedToolCount).toBe(1);
  });

  it("output-error 도 완료 카운트에 포함", () => {
    const m = msg("assistant", [
      toolPart("getScores", "output-available"),
      toolPart("navigateTo", "output-error"),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.completedToolCount).toBe(2);
    expect(s.phase).toBe("generating"); // 모든 tool 이 완료됨 → 텍스트 생성 중
  });

  it("여러 activeTool 중 가장 최근(역순) 것 선택", () => {
    const m = msg("assistant", [
      toolPart("getScores", "input-streaming", { toolCallId: "t-old" }),
      toolPart("analyzeRecord", "input-streaming", { toolCallId: "t-new" }),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.toolCallId).toBe("t-new");
  });
});

describe("extractAgentStatus — reasoning / generating", () => {
  it("reasoning state=streaming + tool 없음 → thinking 추론 중", () => {
    const m = msg("assistant", [reasoningPart("streaming", "분석 중...")]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("thinking");
    expect(s.label).toBe("추론 중");
  });

  it("text 만 있고 streaming → generating 응답 생성 중", () => {
    const m = msg("assistant", [textPart("안녕하세요")]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("generating");
    expect(s.label).toBe("응답 생성 중");
  });

  it("streaming + 빈 assistant → generating '생각 중' (텍스트 없음)", () => {
    const m = msg("assistant", []);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("generating");
    expect(s.label).toBe("생각 중");
  });

  it("reasoning done 상태는 thinking 아님 (이미 끝났음)", () => {
    const m = msg("assistant", [
      reasoningPart("done"),
      textPart("결과입니다"),
    ]);
    const s = extractAgentStatus([m], "streaming");
    expect(s.phase).toBe("generating");
  });
});

describe("extractAgentStatus — ready 상태", () => {
  it("ready + 완료된 assistant 메시지 → idle + completedCount 유지", () => {
    const m = msg("assistant", [
      toolPart("getScores", "output-available"),
      textPart("총 5과목이에요"),
    ]);
    const s = extractAgentStatus([m], "ready");
    expect(s.phase).toBe("idle");
    expect(s.label).toBeNull();
    expect(s.completedToolCount).toBe(1);
  });
});

describe("extractAgentStatus — 여러 메시지", () => {
  it("가장 마지막 assistant 만 참조", () => {
    const m1 = msg("assistant", [toolPart("getScores", "output-available")]);
    const m2 = msg("user", [textPart("다시")]);
    const m3 = msg("assistant", [
      toolPart("analyzeRecord", "input-streaming", { toolCallId: "new" }),
    ]);
    const s = extractAgentStatus([m1, m2, m3], "streaming");
    expect(s.toolCallId).toBe("new");
    expect(s.completedToolCount).toBe(0); // m3 의 완료만 카운트
  });
});
