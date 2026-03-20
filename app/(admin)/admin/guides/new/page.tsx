import { GuideEditorClient } from "../[id]/_components/GuideEditorClient";

export const metadata = {
  title: "새 가이드 | TimeLevelUp",
};

export default function GuideNewPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <GuideEditorClient />
    </div>
  );
}
