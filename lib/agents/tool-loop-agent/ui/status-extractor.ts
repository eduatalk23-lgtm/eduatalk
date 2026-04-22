/**
 * Phase D-2: Agent Status Bar — 클라이언트 측 진행 단계 추출기.
 *
 * D-1 에서 `runStreamToolLoop` 가 서버 onStepFinish 로 StepTrace 를 수집하지만,
 * 클라이언트에는 AI SDK 의 `UIMessage.parts` 로 tool part 의 `state` 전환이
 * 이미 스트리밍된다. 이 모듈은 서버 변경 없이 messages + useChat status 만으로
 * 현재 "무엇을 하고 있는가" 를 한 줄로 요약한다.
 *
 * 파트 스펙(AI SDK v6):
 *  - `type: "tool-<name>"` — 정적 tool (HITL 포함)
 *  - `type: "dynamic-tool"` — MCP 경유 tool (toolName 속성 있음)
 *  - `state`: "input-streaming" | "input-available" | "output-available" | "output-error"
 *  - `toolCallId`: 고유 id
 *  - `type: "reasoning"` + `state: "streaming" | "done"` — thinking 구간
 *
 * 책임 (순수 함수):
 *  - 입력: messages + useChat status
 *  - 출력: { phase, label?, toolName?, toolCallId?, completedToolCount }
 *  - 시간(elapsed) 계산은 컴포넌트 measure 에 위임 — 순수성 보존
 */

import type { UIMessage } from "ai";

export type StatusPhase = "idle" | "thinking" | "tool" | "generating" | "error";

export type AgentStatus = {
  phase: StatusPhase;
  /** 한국어 한 줄 라벨. idle 은 null */
  label: string | null;
  /** phase='tool' 일 때 원본 tool 이름 (라벨 매핑 전) */
  toolName?: string;
  /** phase='tool' 일 때 고유 id (컴포넌트 key / elapsed 리셋 기준) */
  toolCallId?: string;
  /** 현재 어시스턴트 메시지 기준 완료된 tool 호출 수 */
  completedToolCount: number;
  /** HITL 승인 대기 여부 (tool state='input-available' + execute 없는 HITL tool) */
  awaitingApproval: boolean;
};

/**
 * AI SDK v6 useChat status:
 *  - "submitted": 요청 전송, 첫 청크 대기
 *  - "streaming": 스트림 진행 중
 *  - "ready": idle
 *  - "error": 실패
 */
export type UseChatStatus = "submitted" | "streaming" | "ready" | "error";

/**
 * HITL execute-less tool 목록. state='input-available' 에서 사용자 승인을
 * 받는 경로 — "실행 중" 이 아니라 "승인 대기" 라벨을 써야 오해를 줄임.
 *
 * chat/route.ts 의 `buildArchiveConversationTool`·`buildApplyArtifactEditTool`
 * 과 수동 동기화. 새 HITL tool 추가 시 이 목록에 반영.
 */
const HITL_TOOLS = new Set<string>([
  "archiveConversation",
  "applyArtifactEdit",
]);

/**
 * tool 이름 → 한국어 라벨.
 * 누락된 키는 tool 이름 그대로 노출 (fallback). admin 영역에서만 보이는 tool
 * 이어도 사용자는 admin/consultant 이므로 도메인 용어 노출 OK.
 */
export const TOOL_LABELS: Record<string, string> = {
  // Shell (MCP 경유)
  navigateTo: "화면 이동",
  getScores: "성적 조회",
  analyzeRecord: "생기부 요약",
  analyzeRecordDeep: "생기부 심층 분석",
  designStudentPlan: "수강 계획 설계",
  analyzeAdmission: "입시 배치 분석",
  getPipelineStatus: "파이프라인 상태",
  getStudentRecords: "생기부 기록 열람",
  getStudentDiagnosis: "역량 진단",
  getStudentStorylines: "탐구 스토리라인",
  getStudentOverview: "학생 프로필",
  getUniversityScoreInfo: "대학 정보",
  searchStudents: "학생 검색",
  // HITL
  archiveConversation: "대화 보관",
  applyArtifactEdit: "아티팩트 적용",
  // 내부
  think: "추론",
};

export function labelForTool(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

type ToolLikePart = {
  type: string;
  state?: string;
  toolName?: string;
  toolCallId?: string;
};

type ReasoningLikePart = {
  type: "reasoning";
  state?: "streaming" | "done";
};

type TextLikePart = {
  type: "text";
  text?: string;
};

function isToolPart(p: unknown): p is ToolLikePart {
  if (!p || typeof p !== "object") return false;
  const t = (p as { type?: unknown }).type;
  if (typeof t !== "string") return false;
  return t.startsWith("tool-") || t === "dynamic-tool";
}

function extractToolName(p: ToolLikePart): string {
  if (p.type === "dynamic-tool" && typeof p.toolName === "string") {
    return p.toolName;
  }
  return p.type.replace(/^tool-/, "");
}

function isReasoning(p: unknown): p is ReasoningLikePart {
  return !!p && typeof p === "object" &&
    (p as { type?: unknown }).type === "reasoning";
}

function isText(p: unknown): p is TextLikePart {
  return !!p && typeof p === "object" &&
    (p as { type?: unknown }).type === "text";
}

const IDLE: AgentStatus = {
  phase: "idle",
  label: null,
  completedToolCount: 0,
  awaitingApproval: false,
};

/**
 * messages + useChat status → 단일 AgentStatus.
 *
 * 판정 우선순위(마지막 assistant 메시지의 parts 를 역순으로 스캔):
 *  1. status='error' → phase='error'
 *  2. status='submitted' 또는 마지막 assistant 메시지 없음 → phase='thinking' ("생각 중")
 *  3. 진행 중 tool part (state != 'output-*') 존재 → phase='tool'
 *     3a. HITL tool + state='input-available' → awaitingApproval=true, 라벨='... 승인 대기'
 *  4. 활성 reasoning part → phase='thinking' ("추론 중")
 *  5. 스트리밍 중이지만 텍스트만 → phase='generating' ("응답 생성 중")
 *  6. 그 외 → phase='idle'
 *
 * 완료된 tool 호출 수(completedToolCount) 는 같은 assistant 메시지 내
 * state='output-available' + state='output-error' 를 합산.
 */
export function extractAgentStatus(
  messages: readonly UIMessage[],
  status: UseChatStatus,
): AgentStatus {
  if (status === "error") {
    return {
      phase: "error",
      label: "오류가 발생했습니다",
      completedToolCount: 0,
      awaitingApproval: false,
    };
  }

  const lastAssistant = findLastAssistant(messages);

  if (status === "submitted" && !lastAssistant) {
    return {
      phase: "thinking",
      label: "생각 중",
      completedToolCount: 0,
      awaitingApproval: false,
    };
  }

  if (!lastAssistant) {
    return status === "streaming"
      ? {
          phase: "thinking",
          label: "생각 중",
          completedToolCount: 0,
          awaitingApproval: false,
        }
      : IDLE;
  }

  const parts = lastAssistant.parts ?? [];
  let completedToolCount = 0;

  // 역순 스캔: 가장 최근 활성 파트 탐색
  let activeTool: {
    name: string;
    toolCallId?: string;
    state: string;
  } | null = null;
  let hasActiveReasoning = false;
  let hasAnyText = false;

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (isToolPart(p)) {
      const state = p.state ?? "input-streaming";
      if (state === "output-available" || state === "output-error") {
        completedToolCount++;
        continue;
      }
      if (!activeTool) {
        activeTool = {
          name: extractToolName(p),
          toolCallId: p.toolCallId,
          state,
        };
      }
      continue;
    }
    if (isReasoning(p)) {
      if (p.state === "streaming") hasActiveReasoning = true;
      continue;
    }
    if (isText(p) && typeof p.text === "string" && p.text.length > 0) {
      hasAnyText = true;
    }
  }

  if (activeTool) {
    const isHitl = HITL_TOOLS.has(activeTool.name);
    const awaiting =
      isHitl && activeTool.state === "input-available";
    const base = labelForTool(activeTool.name);
    return {
      phase: "tool",
      label: awaiting ? `${base} · 승인 대기` : `${base} 실행 중`,
      toolName: activeTool.name,
      toolCallId: activeTool.toolCallId,
      completedToolCount,
      awaitingApproval: awaiting,
    };
  }

  if (status === "streaming") {
    if (hasActiveReasoning) {
      return {
        phase: "thinking",
        label: "추론 중",
        completedToolCount,
        awaitingApproval: false,
      };
    }
    return {
      phase: "generating",
      label: hasAnyText ? "응답 생성 중" : "생각 중",
      completedToolCount,
      awaitingApproval: false,
    };
  }

  if (status === "submitted") {
    return {
      phase: "thinking",
      label: "생각 중",
      completedToolCount,
      awaitingApproval: false,
    };
  }

  return { ...IDLE, completedToolCount };
}

function findLastAssistant(
  messages: readonly UIMessage[],
): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") return m;
  }
  return null;
}
