"use client";

import { useState } from "react";

type AttendanceSettingsTabsProps = {
  locationForm: React.ReactNode;
  smsForm: React.ReactNode;
};

export function AttendanceSettingsTabs({
  locationForm,
  smsForm,
}: AttendanceSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<"location" | "sms">("location");

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("location")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "location"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            위치 설정
          </button>
          <button
            onClick={() => setActiveTab("sms")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === "sms"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            SMS 알림 설정
          </button>
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div>
        {activeTab === "location" && locationForm}
        {activeTab === "sms" && smsForm}
      </div>
    </div>
  );
}

