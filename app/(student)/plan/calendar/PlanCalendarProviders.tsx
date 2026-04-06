"use client";

import { PlanToastProvider } from "@/app/(admin)/admin/students/[id]/plans/_components/PlanToast";
import { UndoProvider } from "@/app/(admin)/admin/students/[id]/plans/_components/UndoSnackbar";

export function PlanCalendarProviders({ children }: { children: React.ReactNode }) {
  return (
    <PlanToastProvider>
      <UndoProvider>{children}</UndoProvider>
    </PlanToastProvider>
  );
}
