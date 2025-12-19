"use client";

import { QueryProvider } from "@/lib/providers/QueryProvider";
import { ThemeProvider } from "@/lib/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { SubjectHierarchyProvider } from "@/lib/contexts/SubjectHierarchyContext";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
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

