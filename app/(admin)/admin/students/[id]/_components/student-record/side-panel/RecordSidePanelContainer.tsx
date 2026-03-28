"use client";

// ============================================
// 생기부 사이드 패널 컨테이너
// 캘린더 SidePanelContainer와 동일 구조, AdminPlanContext 의존 제거
// ============================================

import dynamic from "next/dynamic";
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

const AgentChat = dynamic(
  () => import("@/components/agent/AgentChat").then((m) => ({ default: m.AgentChat })),
  { ssr: false },
);

const ConnectionsPanelApp = dynamic(
  () => import("./ConnectionsPanelApp").then((m) => ({ default: m.ConnectionsPanelApp })),
  { ssr: false },
);

const ContextGridPanelApp = dynamic(
  () => import("./ContextGridPanelApp").then((m) => ({ default: m.ContextGridPanelApp })),
  { ssr: false },
);

export function RecordSidePanelContainer() {
  const { activeApp } = useSidePanel();
  const { studentId, tenantId, studentName, activeSubjectId, activeSchoolYear, activeSubjectName } = useStudentRecordContext();

  return (
    <>
      <SidePanelContent>
        {activeApp === "memo" && <RecordMemoPanelApp studentId={studentId} />}
        {activeApp === "chat" && <ChatPanelApp recordTopic={activeSubjectId} />}
        {activeApp === "connections" && (
          <ConnectionsPanelApp studentId={studentId} tenantId={tenantId} />
        )}
        {activeApp === "context-grid" && (
          <ContextGridPanelApp
            studentId={studentId}
            tenantId={tenantId}
            activeSubjectId={activeSubjectId}
            activeSchoolYear={activeSchoolYear}
            activeSubjectName={activeSubjectName}
          />
        )}
        {activeApp === "agent" && (
          <AgentChat
            studentId={studentId}
            studentName={studentName ?? "학생"}
          />
        )}
      </SidePanelContent>
      <SidePanelIconRail />
    </>
  );
}
