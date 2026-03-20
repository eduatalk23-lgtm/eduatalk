import { GuideListClient } from "./_components/GuideListClient";

export const metadata = {
  title: "탐구 가이드 관리 | TimeLevelUp",
};

export default function GuidesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-3 font-bold text-[var(--text-heading)]">
            탐구 가이드 관리
          </h1>
          <p className="text-body-2 text-[var(--text-secondary)] mt-1">
            가이드를 검색, 편집, 생성할 수 있습니다.
          </p>
        </div>
      </div>
      <GuideListClient />
    </div>
  );
}
