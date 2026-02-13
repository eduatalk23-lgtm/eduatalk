"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary } from "@/lib/utils/darkMode";
import { ConsultationScheduleForm } from "../[id]/_components/ConsultationScheduleForm";
import { ScheduleTableTab } from "./consultation-tabs/ScheduleTableTab";
import { NotesTab } from "./consultation-tabs/NotesTab";
import { NotificationLogTab } from "./consultation-tabs/NotificationLogTab";
import type { ConsultationPanelData } from "@/lib/domains/consulting/actions/fetchConsultationData";

type Tab = "schedules" | "notes" | "logs";

type ConsultationPanelContentProps = {
  studentId: string;
  data: ConsultationPanelData;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function ConsultationPanelContent({
  studentId,
  data,
  onRefresh,
  isRefreshing,
}: ConsultationPanelContentProps) {
  const [activeTab, setActiveTab] = useState<Tab>("schedules");
  const [defaultScheduleId, setDefaultScheduleId] = useState<string | null>(null);

  // 상담 완료 → 노트 탭 전환 + 해당 일정 자동 연결
  const handleCompleteWithNote = useCallback((scheduleId: string) => {
    setDefaultScheduleId(scheduleId);
    setActiveTab("notes");
  }, []);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "schedules", label: "상담 내역", count: data.schedules.length },
    { key: "notes", label: "상담 노트", count: data.consultingNotes.length },
    {
      key: "logs",
      label: "알림 이력",
      count: Object.values(data.notificationLogs).reduce((sum, arr) => sum + arr.length, 0),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 일정 등록 폼 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className={cn("mb-3 text-sm font-semibold", textPrimary)}>일정 등록</h3>
        <ConsultationScheduleForm
          studentId={studentId}
          consultants={data.consultants}
          enrollments={data.enrollments}
          defaultConsultantId={data.currentUserId ?? undefined}
          phoneAvailability={data.phoneAvailability}
          onSuccess={onRefresh}
        />
      </div>

      {/* 탭 헤더 */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {isRefreshing && (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
        )}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              // 탭 전환 시 defaultScheduleId 초기화 (수동 전환)
              if (tab.key !== "notes") setDefaultScheduleId(null);
            }}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition",
              activeTab === tab.key
                ? "text-indigo-600 dark:text-indigo-400"
                : cn("hover:text-gray-700 dark:hover:text-gray-300", textSecondary)
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  activeTab === tab.key
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "schedules" && (
        <ScheduleTableTab
          schedules={data.schedules}
          studentId={studentId}
          consultants={data.consultants}
          enrollments={data.enrollments}
          phoneAvailability={data.phoneAvailability}
          notificationLogs={data.notificationLogs}
          consultingNotes={data.consultingNotes}
          currentUserId={data.currentUserId}
          studentPhones={data.studentPhones}
          onRefresh={onRefresh}
          onCompleteWithNote={handleCompleteWithNote}
        />
      )}
      {activeTab === "notes" && (
        <NotesTab
          notes={data.consultingNotes}
          schedules={data.schedules}
          enrollments={data.enrollments}
          studentId={studentId}
          currentUserId={data.currentUserId}
          defaultScheduleId={defaultScheduleId}
          onRefresh={onRefresh}
        />
      )}
      {activeTab === "logs" && (
        <NotificationLogTab
          notificationLogs={data.notificationLogs}
          schedules={data.schedules}
          studentPhones={data.studentPhones}
        />
      )}
    </div>
  );
}
