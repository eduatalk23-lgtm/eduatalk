"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import {
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  bgSurface,
  borderDefault,
  borderInput,
} from "@/lib/utils/darkMode";
import {
  createProgram,
  updateProgram,
  deleteProgram,
} from "@/lib/domains/crm/actions/programs";
import type { Program } from "@/lib/domains/crm/types";
import {
  PRICE_UNIT_OPTIONS,
  BILLING_TYPE_OPTIONS,
  getDefaultBillingType,
  type PriceUnit,
  type BillingType,
} from "./priceUtils";

type FormMode = "register" | "selected";

type ProgramFormPanelProps = {
  selectedProgram: Program | null;
  formMode: FormMode;
  isAdmin: boolean;
  onNewProgram: () => void;
  onSaved: (programId: string) => void;
  onDeleted: () => void;
  onToggled: () => void;
};

type FormState = {
  code: string;
  name: string;
  description: string;
  priceStr: string;
  priceUnit: PriceUnit;
  billingType: BillingType;
  durationMonths: string;
};

function getInitialState(program: Program | null): FormState {
  if (!program) {
    return {
      code: "",
      name: "",
      description: "",
      priceStr: "",
      priceUnit: "monthly",
      billingType: "recurring",
      durationMonths: "",
    };
  }
  const priceUnit = (program.price_unit as PriceUnit) ?? "monthly";
  return {
    code: program.code,
    name: program.name,
    description: program.description ?? "",
    priceStr: program.price ? String(program.price) : "",
    priceUnit,
    billingType:
      (program.billing_type as BillingType) ??
      getDefaultBillingType(priceUnit),
    durationMonths:
      program.duration_months != null ? String(program.duration_months) : "",
  };
}

function hasChanges(state: FormState, program: Program | null): boolean {
  if (!program) {
    // register 모드에서는 dirty 체크 불필요 (상단 저장 버튼 사용)
    return false;
  }
  const initial = getInitialState(program);
  return (
    state.code !== initial.code ||
    state.name !== initial.name ||
    state.description !== initial.description ||
    state.priceStr !== initial.priceStr ||
    state.priceUnit !== initial.priceUnit ||
    state.billingType !== initial.billingType ||
    state.durationMonths !== initial.durationMonths
  );
}

export function ProgramFormPanel({
  selectedProgram,
  formMode,
  isAdmin,
  onNewProgram,
  onSaved,
  onDeleted,
  onToggled,
}: ProgramFormPanelProps) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    getInitialState(selectedProgram)
  );

  // 선택 프로그램 변경 시 폼 리셋
  useEffect(() => {
    setForm(getInitialState(selectedProgram));
  }, [selectedProgram]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm(getInitialState(selectedProgram));
  }, [selectedProgram]);

  const isDirty = hasChanges(form, selectedProgram);

  // 저장 (생성 or 수정)
  const handleSave = useCallback(() => {
    if (!form.code.trim()) {
      toast.showError("프로그램 코드를 입력해주세요.");
      return;
    }
    if (!form.name.trim()) {
      toast.showError("프로그램 이름을 입력해주세요.");
      return;
    }

    const parsedPrice = form.priceStr.trim()
      ? parseInt(form.priceStr, 10) || 0
      : 0;
    const parsedDuration = form.durationMonths.trim()
      ? parseInt(form.durationMonths, 10)
      : null;

    startTransition(async () => {
      try {
        if (formMode === "selected" && selectedProgram) {
          const result = await updateProgram(selectedProgram.id, {
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: parsedPrice,
            price_unit: form.priceUnit,
            billing_type: form.billingType,
            duration_months: parsedDuration,
          });
          if (result.success) {
            toast.showSuccess("프로그램이 수정되었습니다.");
            onSaved(selectedProgram.id);
          } else {
            toast.showError(result.error ?? "수정에 실패했습니다.");
          }
        } else {
          const result = await createProgram({
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            price: parsedPrice,
            price_unit: form.priceUnit,
            billing_type: form.billingType,
            duration_months: parsedDuration,
          });
          if (result.success && result.data) {
            toast.showSuccess("프로그램이 생성되었습니다.");
            onSaved(result.data.programId);
          } else {
            toast.showError(result.error ?? "생성에 실패했습니다.");
          }
        }
      } catch (error) {
        toast.showError(
          error instanceof Error ? error.message : "처리에 실패했습니다."
        );
      }
    });
  }, [form, formMode, selectedProgram, toast, onSaved]);

  // 삭제
  const handleDeleteConfirm = useCallback(() => {
    if (!selectedProgram) return;
    startTransition(async () => {
      const result = await deleteProgram(selectedProgram.id);
      if (result.success) {
        toast.showSuccess("프로그램이 삭제되었습니다.");
        onDeleted();
      } else {
        toast.showError(result.error ?? "삭제에 실패했습니다.");
      }
      setShowDeleteConfirm(false);
    });
  }, [selectedProgram, toast, onDeleted]);

  // 활성/비활성 토글
  const handleToggleActive = useCallback(() => {
    if (!selectedProgram) return;
    startTransition(async () => {
      const result = await updateProgram(selectedProgram.id, {
        is_active: !selectedProgram.is_active,
      });
      if (result.success) {
        toast.showSuccess(
          selectedProgram.is_active
            ? "프로그램이 비활성화되었습니다."
            : "프로그램이 활성화되었습니다."
        );
        onToggled();
      } else {
        toast.showError(result.error ?? "상태 변경에 실패했습니다.");
      }
    });
  }, [selectedProgram, toast, onToggled]);

  const inputClass = cn(
    "w-full rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-primary-500 focus:ring-primary-200 dark:focus:ring-primary-800"
  );

  return (
    <div className={cn("flex flex-col gap-4 rounded-lg border p-4 shadow-sm sm:p-6", borderDefault, bgSurface)}>
      {/* 액션 바 */}
      <div className={cn("flex flex-wrap items-center gap-2 border-b pb-4", "border-secondary-100 dark:border-secondary-700")}>
        {formMode === "selected" && selectedProgram && (
          <>
            <button
              type="button"
              onClick={onNewProgram}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              신규등록
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                selectedProgram.is_active
                  ? "border-warning-200 text-warning-600 hover:bg-warning-50"
                  : "border-success-200 text-success-600 hover:bg-success-50"
              )}
            >
              {selectedProgram.is_active ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {selectedProgram.is_active ? "비활성화" : "활성화"}
            </button>
            {isAdmin && !selectedProgram.is_active && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-error-200 px-3 py-2 text-sm font-medium text-error-600 transition hover:bg-error-50"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            )}
          </>
        )}
        {formMode === "register" && (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !form.code.trim() || !form.name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              저장
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition", "border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-700")}
            >
              <RotateCcw className="h-4 w-4" />
              초기화
            </button>
          </>
        )}
      </div>

      {/* 폼 섹션 */}
      <div className="flex flex-col gap-6">
        {/* 기본 정보 */}
        <div className={cn("rounded-lg border p-4", "border-secondary-100 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-800/50")}>
          <h3 className={cn("pb-4 text-sm font-semibold", textPrimary)}>
            기본 정보
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  코드 <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    updateField("code", e.target.value.toUpperCase())
                  }
                  disabled={isPending}
                  placeholder="예: PRO"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  프로그램명 <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  disabled={isPending}
                  placeholder="예: 생기부레벨업 프로"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={cn("text-xs font-medium", textSecondary)}>
                설명 (선택)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                disabled={isPending}
                rows={2}
                placeholder="프로그램에 대한 간단한 설명"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* 수강료 설정 */}
        <div className={cn("rounded-lg border p-4", "border-secondary-100 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-800/50")}>
          <h3 className={cn("pb-4 text-sm font-semibold", textPrimary)}>
            수강료 설정
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  수강료 (원)
                </label>
                <input
                  type="number"
                  value={form.priceStr}
                  onChange={(e) => updateField("priceStr", e.target.value)}
                  disabled={isPending}
                  min={0}
                  step={10000}
                  placeholder="0 (무료)"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  단위
                </label>
                <select
                  value={form.priceUnit}
                  onChange={(e) => {
                    const newUnit = e.target.value as PriceUnit;
                    setForm((prev) => ({
                      ...prev,
                      priceUnit: newUnit,
                      billingType: getDefaultBillingType(newUnit),
                    }));
                  }}
                  disabled={isPending}
                  className={inputClass}
                >
                  {PRICE_UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  수강 기간 (개월, 선택)
                </label>
                <input
                  type="number"
                  value={form.durationMonths}
                  onChange={(e) => updateField("durationMonths", e.target.value)}
                  disabled={isPending}
                  min={0}
                  placeholder="미입력 시 무제한"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={cn("text-xs font-medium", textSecondary)}>
                  청구 방식
                </label>
                <select
                  value={form.billingType}
                  onChange={(e) =>
                    updateField("billingType", e.target.value as BillingType)
                  }
                  disabled={isPending}
                  className={inputClass}
                >
                  {BILLING_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className={cn("text-xs", textSecondary)}>
                  {BILLING_TYPE_OPTIONS.find((o) => o.value === form.billingType)?.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky 저장 버튼 (수정 모드에서 변경사항 감지 시) */}
      {formMode === "selected" && (
        <StickySaveButton
          hasChanges={isDirty}
          isSaving={isPending}
          onSubmit={handleSave}
          onCancel={resetForm}
          submitLabel="저장하기"
          cancelLabel="취소"
        />
      )}

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="프로그램 삭제"
        description={`정말 "${selectedProgram?.name ?? "이 프로그램"}"을(를) 삭제하시겠습니까?\n수강 이력이 있는 프로그램은 삭제할 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={isPending}
      />
    </div>
  );
}
