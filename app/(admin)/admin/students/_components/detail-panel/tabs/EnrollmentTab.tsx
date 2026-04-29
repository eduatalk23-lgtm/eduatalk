"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { EnrollmentSectionClient } from "../../../[id]/_components/EnrollmentSectionClient";
import { fetchEnrollmentData } from "@/lib/domains/enrollment/actions/fetchEnrollmentData";
import type { EnrollmentWithProgram } from "@/lib/domains/enrollment/types";
import type { PaymentRecordWithEnrollment } from "@/lib/domains/payment/types";
import type { Program } from "@/lib/domains/crm/types";
import { PanelErrorRetry } from "../../PanelErrorRetry";

type EnrollmentData = {
  enrollments: EnrollmentWithProgram[];
  programs: Program[];
  payments: PaymentRecordWithEnrollment[];
  consultants: { id: string; name: string; role: string }[];
  parentPhone?: string;
};

export function EnrollmentTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<EnrollmentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchEnrollmentData(studentId);
        setData(result);
      } catch (err) {
        console.error("[EnrollmentTab] fetch failed", err);
        setError(err instanceof Error ? err.message : "데이터를 불러올 수 없습니다");
      }
    });
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) return <PanelErrorRetry message={error} onRetry={loadData} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-12 animate-pulse rounded-lg bg-bg-tertiary" />
        <div className="h-64 animate-pulse rounded-lg bg-bg-tertiary" />
      </div>
    );
  }

  return (
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
        onRefresh={loadData}
      />
    </div>
  );
}
