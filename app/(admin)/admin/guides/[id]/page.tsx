import { GuideEditorClient } from "./_components/GuideEditorClient";
import { getAllActiveCurriculumRevisions } from "@/lib/data/subjects";

export const metadata = {
  title: "가이드 편집 | TimeLevelUp",
};

export default async function GuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, curriculumRevisions] = await Promise.all([
    params,
    getAllActiveCurriculumRevisions(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <GuideEditorClient guideId={id} curriculumRevisions={curriculumRevisions} />
    </div>
  );
}
