"use client";

import type { InheritedTemplateSettings } from "@/lib/types/plan";
import { ContentAddWizard } from "./ContentAddWizard";

interface ContentAddWizardWrapperProps {
  templateId: string;
  templateSettings: InheritedTemplateSettings;
  remainingSlots: number;
}

export function ContentAddWizardWrapper({
  templateId,
  templateSettings,
  remainingSlots,
}: ContentAddWizardWrapperProps) {
  return (
    <ContentAddWizard
      templateId={templateId}
      templateSettings={templateSettings}
      remainingSlots={remainingSlots}
    />
  );
}
