import { Metadata } from "next";
import { TemplateManagerPageClient } from "./_components/TemplateManagerPageClient";

export const metadata: Metadata = {
  title: "SMS 템플릿 관리",
};

export default function SMSTemplatesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">SMS 템플릿 관리</h1>
      <TemplateManagerPageClient />
    </div>
  );
}
