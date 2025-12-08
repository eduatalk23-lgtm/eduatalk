"use client";

import { createContext, useContext, ReactNode } from "react";

type BreadcrumbLabels = Record<string, string>;

const BreadcrumbContext = createContext<BreadcrumbLabels | null>(null);

export function BreadcrumbProvider({
  labels,
  children,
}: {
  labels: BreadcrumbLabels;
  children: ReactNode;
}) {
  return (
    <BreadcrumbContext.Provider value={labels}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbLabels(): BreadcrumbLabels | null {
  return useContext(BreadcrumbContext);
}

