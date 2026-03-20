import { GuideEditorClient } from "./_components/GuideEditorClient";

export const metadata = {
  title: "가이드 편집 | TimeLevelUp",
};

export default async function GuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <GuideEditorClient guideId={id} />
    </div>
  );
}
