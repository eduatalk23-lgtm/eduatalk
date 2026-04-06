'use client';

import { PlanToastProvider } from './_components/PlanToast';
import { UndoProvider } from './_components/UndoSnackbar';

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanToastProvider>
      <UndoProvider>{children}</UndoProvider>
    </PlanToastProvider>
  );
}
