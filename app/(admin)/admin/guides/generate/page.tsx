import type { Metadata } from "next";
import { GuideGeneratorClient } from "./_components/GuideGeneratorClient";

export const metadata: Metadata = {
  title: "AI 가이드 생성 | TimeLevelUp",
};

export default function GuideGeneratePage() {
  return <GuideGeneratorClient />;
}
