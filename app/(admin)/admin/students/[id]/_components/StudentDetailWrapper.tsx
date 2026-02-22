"use client";

import { ReactNode } from "react";

type StudentDetailWrapperProps = {
  children: ReactNode;
  studentId: string;
  studentName: string | null;
};

export function StudentDetailWrapper({
  children,
}: StudentDetailWrapperProps) {
  return <>{children}</>;
}
