"use client";

// ============================================
// 생기부 사이드 패널 컨테이너
// 캘린더 SidePanelContainer와 동일 구조, AdminPlanContext 의존 제거
// ============================================

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import { useSidePanel, SidePanelContent, SidePanelIconRail } from "@/components/side-panel";
import { useStudentRecordContext } from "../StudentRecordContext";

const RecordMemoPanelApp = dynamic(
  () => import("./RecordMemoPanelApp").then((m) => ({ default: m.RecordMemoPanelApp })),
  { ssr: false },
);

const ChatPanelApp = dynamic(
  () =>
    import("@/app/(admin)/admin/students/[id]/plans/_components/side-panel/apps/chat/ChatPanelApp").then(
      (m) => ({ default: m.ChatPanelApp }),
    ),
  { ssr: false },
);

const ConnectionsPanelApp = dynamic(
  () => import("./ConnectionsPanelApp").then((m) => ({ default: m.ConnectionsPanelApp })),
  { ssr: false },
);

export function RecordSidePanelContainer() {
  const { activeApp } = useSidePanel();
  const { studentId, tenantId, studentName, activeSubjectId } = useStudentRecordContext();

  const openAgentPopout = useCallback(() => {
    const params = new URLSearchParams();
    params.set("studentId", studentId);
    if (studentName) params.set("studentName", studentName);
    window.open(`/admin/agent-popout?${params.toString()}`, "agent-popout", "width=480,height=700");
  }, [studentId, studentName]);

  return (
    <>
      <SidePanelContent>
        {activeApp === "memo" && <RecordMemoPanelApp studentId={studentId} />}
        {activeApp === "chat" && <ChatPanelApp recordTopic={activeSubjectId} />}
        {activeApp === "connections" && (
          <ConnectionsPanelApp studentId={studentId} tenantId={tenantId} />
        )}
        {activeApp === "agent" && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center dark:bg-indigo-900/30">
              <Bot className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                AI 어시스턴트
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                별도 창에서 AI 어시스턴트를 사용합니다.
                <br />
                바텀시트와 동시에 사용할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={openAgentPopout}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium transition-colors hover:bg-indigo-700"
            >
              AI 어시스턴트 열기
            </button>
          </div>
        )}
      </SidePanelContent>
      <SidePanelIconRail />
    </>
  );
}
