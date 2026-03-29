"use client";

// ============================================
// 에이전트 팝아웃 클라이언트
// URL 파라미터로 초기 학생 지정
// BroadcastChannel로 메인 윈도우 UI 상태 수신
// 에이전트 액션은 메인 윈도우로 역전달
// ============================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Bot } from "lucide-react";
import { AgentChat } from "@/components/agent/AgentChat";
import type { UIStateSnapshot } from "@/lib/agents/ui-state";
import type { AgentAction } from "@/lib/agents/agent-actions";

interface StudentOption {
  id: string;
  name: string;
}

interface AgentPopoutClientProps {
  students: StudentOption[];
}

const CHANNEL_UI_STATE = "agent-ui-state";
const CHANNEL_UI_ACTION = "agent-ui-action";

export function AgentPopoutClient({ students }: AgentPopoutClientProps) {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId");
  const initialStudentName = searchParams.get("studentName");

  // 학생 선택
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(() => {
    if (initialStudentId) {
      const found = students.find((s) => s.id === initialStudentId);
      if (found) return found;
      if (initialStudentName) return { id: initialStudentId, name: decodeURIComponent(initialStudentName) };
    }
    return null;
  });

  // BroadcastChannel — 메인 윈도우에서 UI 상태 수신
  const [uiState, setUIState] = useState<UIStateSnapshot | null>(null);
  const uiStateRef = useRef<UIStateSnapshot | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_UI_STATE);
    channel.onmessage = (e: MessageEvent<UIStateSnapshot>) => {
      setUIState(e.data);
      uiStateRef.current = e.data;
    };
    return () => channel.close();
  }, []);

  // 동기화된 UI 상태에서 학생/과목 변경 감지
  useEffect(() => {
    if (!uiState?.focusedSubject) return;
    // 메인 윈도우에서 다른 학생의 과목을 포커스했을 때는 무시
    // (같은 학생만 동기화)
  }, [uiState]);

  const getUIState = useCallback((): UIStateSnapshot => {
    return uiStateRef.current ?? {
      activeLayerTab: "neis",
      viewMode: "all",
      activeSection: "",
      activeStage: "record",
      focusedSubject: null,
      sidePanelApp: null,
      bottomSheetOpen: false,
      topSheetOpen: false,
    };
  }, []);

  // 에이전트 액션 → 메인 윈도우로 전달
  const onAgentAction = useCallback((action: AgentAction) => {
    const channel = new BroadcastChannel(CHANNEL_UI_ACTION);
    channel.postMessage(action);
    channel.close();
  }, []);

  // 연결 상태 표시
  const isConnected = uiState !== null;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 학생 선택 + 연결 상태 */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgb(var(--color-secondary-200))] bg-[var(--background)]">
        <label
          htmlFor="popout-student-select"
          className="text-sm font-medium text-[var(--color-text-secondary)] whitespace-nowrap"
        >
          학생
        </label>
        <select
          id="popout-student-select"
          value={selectedStudent?.id ?? ""}
          onChange={(e) => {
            const student = students.find((s) => s.id === e.target.value);
            setSelectedStudent(student ?? null);
          }}
          className="flex-1 max-w-xs rounded-lg border border-[rgb(var(--color-secondary-300))] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary-500))]"
        >
          <option value="">학생을 선택하세요</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* 연결 상태 */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-gray-300"}`}
          />
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {isConnected ? "연동됨" : "대기 중"}
          </span>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-hidden">
        {selectedStudent ? (
          <AgentChat
            studentId={selectedStudent.id}
            studentName={selectedStudent.name}
            className="h-full"
            getUIState={getUIState}
            onAgentAction={onAgentAction}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[rgb(var(--color-secondary-100))] flex items-center justify-center">
              <Bot className="w-8 h-8 text-[var(--color-text-tertiary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                학생을 선택하세요
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                학생을 선택하면 AI 어시스턴트와 대화할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
