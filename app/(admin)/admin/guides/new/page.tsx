import { GuideEditorClient } from "../[id]/_components/GuideEditorClient";
import { getAllActiveCurriculumRevisions } from "@/lib/data/subjects";

export const metadata = {
  title: "새 가이드 | TimeLevelUp",
};

export default async function GuideNewPage() {
  const curriculumRevisions = await getAllActiveCurriculumRevisions();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <GuideEditorClient curriculumRevisions={curriculumRevisions} />
    </div>
  );
}
