"use client";

/**
 * StudentDetailPanel — 학생 상세 정보 통합 슬라이드 패널
 *
 * 수강·수납 / 가족 / 상담 / 성적 / 시간관리 / SMS 6개 탭을 단일
 * SlideOverPanel 안에서 전환. 각 Tab 은 mount 시 자체 fetch.
 *
 * 기존 6개 *SlidePanel.tsx 를 대체. StudentManageClient 는 단일
 * activeTab 으로 패널 제어.
 */

import { useId } from "react";
import { cn } from "@/lib/cn";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import {
  Receipt,
  Users,
  MessageSquare,
  BarChart3,
  Clock,
  Send,
} from "lucide-react";
import { EnrollmentTab } from "./tabs/EnrollmentTab";
import { FamilyTab } from "./tabs/FamilyTab";
import { ConsultationTab } from "./tabs/ConsultationTab";
import { ScoreTab } from "./tabs/ScoreTab";
import { TimeManagementTab } from "./tabs/TimeManagementTab";
import { SMSTab } from "./tabs/SMSTab";

export type StudentDetailTabKey =
  | "enrollment"
  | "family"
  | "consultation"
  | "score"
  | "time"
  | "sms";

const TABS: {
  key: StudentDetailTabKey;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}[] = [
  { key: "enrollment", label: "수강·수납", icon: Receipt },
  { key: "family", label: "가족", icon: Users },
  { key: "consultation", label: "상담", icon: MessageSquare },
  { key: "score", label: "성적", icon: BarChart3 },
  { key: "time", label: "시간관리", icon: Clock },
  { key: "sms", label: "SMS", icon: Send },
];

interface StudentDetailPanelProps {
  studentId: string;
  studentName: string;
  studentLabel?: string;
  activeTab: StudentDetailTabKey | null;
  onClose: () => void;
  onTabChange: (tab: StudentDetailTabKey) => void;
}

export function StudentDetailPanel({
  studentId,
  studentName,
  studentLabel,
  activeTab,
  onClose,
  onTabChange,
}: StudentDetailPanelProps) {
  const tabsId = useId();
  const isOpen = activeTab !== null;

  return (
    <SlideOverPanel
      id="student-detail-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`학생 상세${studentLabel ? ` — ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      <div className="flex flex-col gap-4">
        {/* 탭 바 */}
        <div
          role="tablist"
          aria-label="학생 정보 탭"
          className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                role="tab"
                id={`${tabsId}-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`${tabsId}-panel-${tab.key}`}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  isActive
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 ring-1 ring-primary-200 dark:ring-primary-800"
                    : "text-text-tertiary hover:bg-bg-secondary hover:text-text-primary",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden={true} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 탭 콘텐츠 — 활성 탭만 mount (전환 시 자동 unmount + re-fetch) */}
        <div
          role="tabpanel"
          id={activeTab ? `${tabsId}-panel-${activeTab}` : undefined}
          aria-labelledby={activeTab ? `${tabsId}-tab-${activeTab}` : undefined}
          className="min-h-[300px]"
        >
          {activeTab === "enrollment" && <EnrollmentTab studentId={studentId} />}
          {activeTab === "family" && <FamilyTab studentId={studentId} />}
          {activeTab === "consultation" && <ConsultationTab studentId={studentId} />}
          {activeTab === "score" && <ScoreTab studentId={studentId} />}
          {activeTab === "time" && <TimeManagementTab studentId={studentId} />}
          {activeTab === "sms" && (
            <SMSTab studentId={studentId} studentName={studentName} />
          )}
        </div>
      </div>
    </SlideOverPanel>
  );
}
