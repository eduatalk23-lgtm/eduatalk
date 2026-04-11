import type { Metadata } from "next";
import { GuideGeneratorClient } from "./_components/GuideGeneratorClient";
import { getAllActiveCurriculumRevisions } from "@/lib/data/subjects";

export const metadata: Metadata = {
  title: "AI 가이드 생성 | TimeLevelUp",
};

export default async function GuideGeneratePage() {
  const curriculumRevisions = await getAllActiveCurriculumRevisions();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <GuideGeneratorClient curriculumRevisions={curriculumRevisions} />
    </div>
  );
}
