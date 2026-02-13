"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { EnrollmentSectionClient } from "../[id]/_components/EnrollmentSectionClient";
import { fetchEnrollmentData } from "@/lib/domains/enrollment/actions/fetchEnrollmentData";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";

type EnrollmentData = {
  enrollments: EnrollmentWithProgram[];
  programs: Program[];
  payments: PaymentRecordWithEnrollment[];
  consultants: { id: string; name: string; role: string }[];
};

type EnrollmentSlidePanelProps = {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
};

export function EnrollmentSlidePanel({
  studentId,
  isOpen,
  onClose,
}: EnrollmentSlidePanelProps) {
  const [data, setData] = useState<EnrollmentData | null>(null);
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  useEffect(() => {
    const key = isOpen ? studentId : "";

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (!key) {
      // 패널이 닫혔을 때 — 다음 렌더 사이클에서 초기화
      const id = requestAnimationFrame(() => setData(null));
      return () => cancelAnimationFrame(id);
    }

    startTransition(async () => {
      const result = await fetchEnrollmentData(studentId);
      setData(result);
    });
  }, [isOpen, studentId]);

  return (
    <SlideOverPanel
      id="enrollment-panel"
      isOpen={isOpen}
      onClose={onClose}
      title="수강 / 수납 관리"
      size="full"
      className="max-w-[66vw]"
    >
      {isPending || !data ? (
        <div className="flex flex-col gap-4">
          <div className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : (
        <EnrollmentSectionClient
          studentId={studentId}
          enrollments={data.enrollments}
          programs={data.programs}
          payments={data.payments}
          consultants={data.consultants}
        />
      )}
    </SlideOverPanel>
  );
}
