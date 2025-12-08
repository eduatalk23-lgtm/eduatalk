"use client";

import { ReactNode } from "react";

type TabKey =
  | "basic"
  | "plan"
  | "content"
  | "score"
  | "session"
  | "analysis"
  | "consulting"
  | "attendance";

export function TabContent({
  tab,
  children,
}: {
  tab: TabKey;
  children: ReactNode;
}) {
  return <div>{children}</div>;
}
