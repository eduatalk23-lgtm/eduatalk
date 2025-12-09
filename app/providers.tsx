"use client";

import { QueryProvider } from "@/lib/providers/QueryProvider";
import { ThemeProvider } from "@/lib/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ToastProvider>
          <SidebarProvider>
            {children}
          </SidebarProvider>
        </ToastProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

