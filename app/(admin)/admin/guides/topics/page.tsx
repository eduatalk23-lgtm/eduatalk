import { TopicListClient } from "./_components/TopicListClient";
import { getAllActiveCurriculumRevisions } from "@/lib/data/subjects";

export const metadata = {
  title: "AI 추천 주제 관리 | TimeLevelUp",
};

export default async function TopicsPage() {
  const curriculumRevisions = await getAllActiveCurriculumRevisions();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-3 font-bold text-[var(--text-heading)]">
            AI 추천 주제 관리
          </h1>
          <p className="text-body-2 text-[var(--text-secondary)] mt-1">
            AI가 생성한 탐구 주제를 검색, 필터링, 관리할 수 있습니다.
          </p>
        </div>
      </div>
      <TopicListClient curriculumRevisions={curriculumRevisions} />
    </div>
  );
}
