"use client";

// ============================================
// 생기부 사이드 패널 컨테이너
// 캘린더 SidePanelContainer와 동일 구조, AdminPlanContext 의존 제거
// ============================================

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";
import { useSidePanel, SidePanelContent, SidePanelIconRail, RailButton } from "@/components/side-panel";
import { RECORD_SIDE_PANEL_APPS } from "@/components/side-panel/types";
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

const PipelinePanelApp = dynamic(
  () => import("./PipelinePanelApp").then((m) => ({ default: m.PipelinePanelApp })),
  { ssr: false },
);

export function RecordSidePanelContainer() {
  const { activeApp } = useSidePanel();
  const { studentId, tenantId, studentName, activeSubjectId, scrollToSection, hasTargetMajor } = useStudentRecordContext();

  const openAgentPopout = useCallback(() => {
    const params = new URLSearchParams();
    params.set("studentId", studentId);
    if (studentName) params.set("studentName", studentName);
    window.open(`/agent-popout?${params.toString()}`, "agent-popout", "width=480,height=700");
  }, [studentId, studentName]);

  return (
    <>
      <SidePanelContent>
        {activeApp === "memo" && <RecordMemoPanelApp studentId={studentId} />}
        {activeApp === "chat" && <ChatPanelApp recordTopic={activeSubjectId} />}
        {activeApp === "connections" && (
          <ConnectionsPanelApp studentId={studentId} tenantId={tenantId} />
        )}
        {activeApp === "pipeline" && (
          <PipelinePanelApp
            studentId={studentId}
            tenantId={tenantId}
            hasTargetMajor={hasTargetMajor ?? false}
            onReview={scrollToSection ? () => scrollToSection("sec-pipeline-results") : undefined}
          />
        )}
      </SidePanelContent>
      <SidePanelIconRail
        apps={RECORD_SIDE_PANEL_APPS}
        extraButtons={
          <RailButton
            icon={Bot}
            label="AI 어시스턴트"
            isActive={false}
            onClick={openAgentPopout}
          />
        }
      />
    </>
  );
}
