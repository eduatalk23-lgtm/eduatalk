"use client";

import { QueryProvider } from "@/lib/providers/QueryProvider";
import { ThemeProvider } from "@/lib/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { SubjectHierarchyProvider } from "@/lib/contexts/SubjectHierarchyContext";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { GlobalRefetchIndicator } from "@/components/ui/GlobalRefetchIndicator";
import type { DehydratedState } from "@tanstack/react-query";
import { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
  dehydratedState?: DehydratedState;
}

export function Providers({ children, dehydratedState }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider dehydratedState={dehydratedState}>
        <GlobalRefetchIndicator />
        <AuthProvider>
          <ToastProvider>
            <SidebarProvider>
              <SubjectHierarchyProvider>
                {children}
              </SubjectHierarchyProvider>
            </SidebarProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

