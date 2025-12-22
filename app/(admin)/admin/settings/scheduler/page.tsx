
import { Metadata } from "next";
import { SchedulerSettingsForm } from "./_components/SchedulerSettingsForm";

export const metadata: Metadata = {
  title: "스케줄러 설정 - TimeLevelUp",
  description: "기관 전체의 기본 스케줄러 설정을 관리합니다.",
};

export default function SchedulerSettingsPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-gray-900 dark:text-gray-100">스케줄러 설정</h1>
          <p className="text-body-2 text-gray-600 dark:text-gray-400">
            기관 전체의 기본 스케줄러 설정을 관리합니다. 이 설정은 모든 플랜
            그룹에 기본값으로 적용됩니다.
          </p>
        </div>

        <SchedulerSettingsForm />
      </div>
    </div>
  );
}

