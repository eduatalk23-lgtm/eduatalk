"use client";

import { ReactNode } from "react";
import { BreadcrumbProvider } from "@/lib/components/BreadcrumbContext";

type StudentDetailWrapperProps = {
  children: ReactNode;
  studentId: string;
  studentName: string | null;
};

export function StudentDetailWrapper({
  children,
  studentId,
  studentName,
}: StudentDetailWrapperProps) {
  const breadcrumbLabels = {
    [`/admin/students/${studentId}`]: studentName ? `${studentName} 학생` : "학생 상세",
  };

  return (
    <BreadcrumbProvider labels={breadcrumbLabels}>
      {children}
    </BreadcrumbProvider>
  );
}

