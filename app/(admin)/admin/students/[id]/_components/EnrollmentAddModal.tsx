"use client";

import { useState, useTransition } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { createEnrollmentAction } from "@/lib/domains/enrollment/actions";
import type { Program } from "@/lib/domains/crm/types";
import {
  formatPrice,
  PRICE_UNIT_LABELS,
} from "@/app/(admin)/admin/programs/_components/priceUtils";

type ConsultantOption = { id: string; name: string; role: string };

type EnrollmentAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  programs: Program[];
  consultants?: ConsultantOption[];
  onSuccess?: () => void;
};

export function EnrollmentAddModal({
  open,
  onOpenChange,
  studentId,
  programs,
  consultants = [],
  onSuccess,
}: EnrollmentAddModalProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [consultantId, setConsultantId] = useState("");

  const resetForm = () => {
    setProgramId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setPriceStr("");
    setPriceNote("");
    setConsultantId("");
  };

  const handleProgramChange = (id: string) => {
    setProgramId(id);
    const selected = programs.find((p) => p.id === id);
    if (selected && selected.price > 0) {
      setPriceStr(String(selected.price));
    } else {
      setPriceStr("");
    }
    setPriceNote("");
  };

  const handleSubmit = () => {
    if (!programId) {
      toast.showError("프로그램을 선택해주세요.");
      return;
    }

    const parsedPrice = priceStr.trim() ? parseInt(priceStr, 10) : null;

    startTransition(async () => {
      try {
        const result = await createEnrollmentAction({
          student_id: studentId,
          program_id: programId,
          start_date: startDate,
          notes: notes || undefined,
          price: parsedPrice,
          price_note: priceNote || undefined,
          consultant_id: consultantId || undefined,
        });

        if (result.success) {
          toast.showSuccess("수강이 등록되었습니다.");
          onSuccess?.();
          onOpenChange(false);
          resetForm();
        } else {
          toast.showError(result.error ?? "수강 등록에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "수강 등록에 실패했습니다."
        );
      }
    });
  };

  const inputClass = cn(
    "w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
    isPending && "opacity-50 cursor-not-allowed"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth="md">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            수강 등록
          </h2>
          <p className={cn("text-body-2", textSecondary)}>
            학생에게 프로그램을 수강 등록합니다.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* 프로그램 선택 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              프로그램 <span className="text-red-500">*</span>
            </label>
            <select
              value={programId}
              onChange={(e) => handleProgramChange(e.target.value)}
              disabled={isPending}
              className={inputClass}
            >
              <option value="">프로그램을 선택하세요</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {programId && (() => {
              const selected = programs.find((p) => p.id === programId);
              if (!selected) return null;
              const stdPriceLabel =
                selected.price > 0
                  ? `${formatPrice(selected.price)}/${PRICE_UNIT_LABELS[selected.price_unit] ?? selected.price_unit}`
                  : "무료";
              return (
                <p className={cn("text-xs", textSecondary)}>
                  기본 수강료: {stdPriceLabel}
                  {selected.duration_months
                    ? ` · 기간: ${selected.duration_months}개월`
                    : ""}
                </p>
              );
            })()}
          </div>

          {/* 수강료 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              수강료 (원)
            </label>
            <input
              type="number"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              disabled={isPending}
              min={0}
              step={10000}
              placeholder="프로그램 기본 수강료와 동일하면 비워두세요"
              className={inputClass}
            />
            <p className={cn("text-xs", textSecondary)}>
              중도 합류 등으로 기본 수강료와 다를 경우 입력하세요.
            </p>
          </div>

          {/* 수강료 메모 */}
          {priceStr && (() => {
            const selected = programs.find((p) => p.id === programId);
            const stdPrice = selected?.price ?? 0;
            const inputPrice = parseInt(priceStr, 10) || 0;
            if (inputPrice !== stdPrice) {
              return (
                <div className="flex flex-col gap-2">
                  <label className={cn("text-body-2 font-semibold", textPrimary)}>
                    수강료 메모
                  </label>
                  <input
                    type="text"
                    value={priceNote}
                    onChange={(e) => setPriceNote(e.target.value)}
                    disabled={isPending}
                    placeholder="예: 2학기 중도합류 (3개월분)"
                    className={inputClass}
                  />
                </div>
              );
            }
            return null;
          })()}

          {/* 담당 컨설턴트 */}
          {consultants.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className={cn("text-body-2 font-semibold", textPrimary)}>
                담당 컨설턴트
              </label>
              <select
                value={consultantId}
                onChange={(e) => setConsultantId(e.target.value)}
                disabled={isPending}
                className={inputClass}
              >
                <option value="">선택 안 함</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role === "admin" ? "관리자" : "컨설턴트"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 시작일 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
          </div>

          {/* 메모 */}
          <div className="flex flex-col gap-2">
            <label className={cn("text-body-2 font-semibold", textPrimary)}>
              메모 (선택)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              rows={2}
              placeholder="수강 관련 메모를 입력하세요"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isPending || !programId}
            isLoading={isPending}
          >
            {isPending ? "등록 중..." : "등록"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
