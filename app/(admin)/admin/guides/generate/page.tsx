import type { Metadata } from "next";
import { GuideGeneratorClient } from "./_components/GuideGeneratorClient";

export const metadata: Metadata = {
  title: "AI 가이드 생성 | TimeLevelUp",
};

export default function GuideGeneratePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <GuideGeneratorClient />
    </div>
  );
}
