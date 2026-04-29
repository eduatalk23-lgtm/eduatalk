"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { SlideOverPanel } from "@/components/layouts/SlideOver";
import { EnrollmentSectionClient } from "../[id]/_components/EnrollmentSectionClient";
import { fetchEnrollmentData } from "@/lib/domains/enrollment/actions/fetchEnrollmentData";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";
import { PanelErrorRetry } from "./PanelErrorRetry";

type EnrollmentData = {
  enrollments: EnrollmentWithProgram[];
  programs: Program[];
  payments: PaymentRecordWithEnrollment[];
  consultants: { id: string; name: string; role: string }[];
  parentPhone?: string;
};

type EnrollmentSlidePanelProps = {
  studentId: string;
  studentLabel?: string;
  isOpen: boolean;
  onClose: () => void;
};

export function EnrollmentSlidePanel({
  studentId,
  studentLabel,
  isOpen,
  onClose,
}: EnrollmentSlidePanelProps) {
  const [data, setData] = useState<EnrollmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const prevKeyRef = useRef("");

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchEnrollmentData(studentId);
        setData(result);
      } catch (err) {
        console.error("[EnrollmentSlidePanel] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    const key = isOpen ? studentId : "";

    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    if (!key) {
      const id = requestAnimationFrame(() => {
        setData(null);
        setError(null);
      });
      return () => cancelAnimationFrame(id);
    }

    loadData();
  }, [isOpen, studentId, loadData]);

  const handleRefresh = loadData;

  return (
    <SlideOverPanel
      id="enrollment-panel"
      isOpen={isOpen}
      onClose={onClose}
      title={`수강 / 수납 관리${studentLabel ? ` - ${studentLabel}` : ""}`}
      size="full"
      className="max-w-[66vw]"
    >
      {error ? (
        <PanelErrorRetry message={error} onRetry={loadData} />
      ) : !data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
          <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
        </div>
      ) : (
        <div
          className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}
          aria-busy={isPending}
        >
          <EnrollmentSectionClient
            studentId={studentId}
            enrollments={data.enrollments}
            programs={data.programs}
            payments={data.payments}
            consultants={data.consultants}
            parentPhone={data.parentPhone}
            onRefresh={handleRefresh}
          />
        </div>
      )}
    </SlideOverPanel>
  );
}
