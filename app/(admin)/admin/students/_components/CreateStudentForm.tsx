"use client";

import { useState } from "react";
import { useController } from "react-hook-form";
import type { FormControl } from "@/lib/types/forms";
import { DialogFooter, ConfirmDialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import BirthDateInput from "@/components/molecules/BirthDateInput";
import CareerInfoSection from "@/components/organisms/CareerInfoSection";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { useCreateStudentForm } from "../_hooks/useCreateStudentForm";
import type { CreateStudentFormSchema } from "@/lib/validation/createStudentFormSchema";
import { toCreateStudentInput } from "@/lib/validation/createStudentFormSchema";
import { createStudent } from "@/lib/domains/student";
import { STUDENT_DIVISIONS } from "@/lib/constants/students";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";

type CreateStudentFormProps = {
  onSuccess: (studentId: string, joinUrl?: string) => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (isSubmitting: boolean) => void;
};

const STATUS_OPTIONS = [
  { value: "enrolled", label: "재원" },
  { value: "not_enrolled", label: "비재원" },
];

export function CreateStudentForm({
  onSuccess,
  onError,
  isSubmitting,
  setIsSubmitting,
}: CreateStudentFormProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "profile" | "career">("basic");
  const { form, control } = useCreateStudentForm();
  const { showError } = useToast();
  const [schoolType, setSchoolType] = useState<"중학교" | "고등학교" | undefined>();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    form.reset();
    setShowResetConfirm(false);
  };

  const onSubmit = async (data: CreateStudentFormSchema): Promise<void> => {
    setIsSubmitting(true);
    try {
      const input = toCreateStudentInput(data);
      const result = await createStudent(input);

      if (result.success && result.studentId) {
        onSuccess(result.studentId, result.joinUrl);
      } else {
        onError(result.error || "학생 등록에 실패했습니다.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "학생 등록 중 오류가 발생했습니다.";
      onError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("basic")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "basic"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          기본 정보
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "profile"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          프로필
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("career")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "career"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          진로 정보
        </button>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto">
        {activeTab === "basic" && (
          <BasicInfoTab control={control as unknown as FormControl<CreateStudentFormSchema>} schoolType={schoolType} setSchoolType={setSchoolType} />
        )}
        {activeTab === "profile" && <ProfileInfoTab control={control as unknown as FormControl<CreateStudentFormSchema>} />}
        {activeTab === "career" && <CareerInfoSection control={control} schoolType={schoolType} />}
      </div>

      {/* 폼 액션 */}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          disabled={isSubmitting}
        >
          초기화
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          등록
        </Button>
      </DialogFooter>

      {/* 초기화 확인 다이얼로그 */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="폼 초기화"
        description="입력한 모든 내용이 삭제됩니다. 초기화하시겠습니까?"
        confirmLabel="초기화"
        cancelLabel="취소"
        onConfirm={handleReset}
        variant="destructive"
      />
    </form>
  );
}

// 기본 정보 탭
function BasicInfoTab({
  control,
  schoolType,
  setSchoolType,
}: {
  control: FormControl<CreateStudentFormSchema>;
  schoolType?: "중학교" | "고등학교" | undefined;
  setSchoolType: (type: "중학교" | "고등학교" | undefined) => void;
}) {
  const nameField = useController({
    name: "name",
    control,
    rules: { required: "이름을 입력해주세요" },
  });

  const gradeField = useController({
    name: "grade",
    control,
  });

  const birthDateField = useController({
    name: "birth_date",
    control,
  });

  const classField = useController({
    name: "class",
    control,
  });

  const divisionField = useController({
    name: "division",
    control,
  });

  const schoolIdField = useController({
    name: "school_id",
    control,
  });

  const statusField = useController({
    name: "status",
    control,
  });

  const memoField = useController({
    name: "memo",
    control,
  });

  const handleSchoolSelect = async (school: {
    id: string;
    name: string;
    type?: "중학교" | "고등학교" | "대학교" | null;
  }) => {
    schoolIdField.field.onChange(school.id || "");
    if (school.type === "중학교" || school.type === "고등학교") {
      setSchoolType(school.type);
    } else {
      setSchoolType(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField
        {...nameField.field}
        label="이름"
        required
        error={nameField.fieldState.error?.message}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          학교
        </label>
        <SchoolSelect
          value={schoolIdField.field.value}
          onChange={schoolIdField.field.onChange}
          onSchoolSelect={handleSchoolSelect}
          placeholder="학교를 검색하세요"
        />
      </div>
      <FormField
        {...gradeField.field}
        label="학년"
        type="text"
        placeholder="예: 1, 2, 3"
        error={gradeField.fieldState.error?.message}
      />
      <BirthDateInput
        {...birthDateField.field}
        label="생년월일"
        error={birthDateField.fieldState.error?.message}
      />
      <FormField
        {...classField.field}
        label="반"
        type="text"
        placeholder="반 번호"
        error={classField.fieldState.error?.message}
      />
      <FormSelect
        {...divisionField.field}
        label="구분"
        options={[
          { value: "", label: "선택 안 함" },
          ...STUDENT_DIVISIONS.map((d) => ({
            value: d.value,
            label: d.label,
          })),
        ]}
        error={divisionField.fieldState.error?.message}
      />
      <FormSelect
        {...statusField.field}
        label="계정 상태"
        options={STATUS_OPTIONS.map((s) => ({
          value: s.value,
          label: s.label,
        }))}
        error={statusField.fieldState.error?.message}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          메모
        </label>
        <textarea
          {...memoField.field}
          placeholder="메모를 입력하세요"
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        {memoField.fieldState.error?.message && (
          <p className="mt-1 text-sm text-red-500">{memoField.fieldState.error.message}</p>
        )}
      </div>
    </div>
  );
}

// 프로필 정보 탭
function ProfileInfoTab({ control }: { control: FormControl<CreateStudentFormSchema> }) {
  const genderField = useController({
    name: "gender",
    control,
  });

  const phoneField = useController({
    name: "phone",
    control,
  });

  const motherPhoneField = useController({
    name: "mother_phone",
    control,
  });

  const fatherPhoneField = useController({
    name: "father_phone",
    control,
  });

  const addressField = useController({
    name: "address",
    control,
  });

  const emergencyContactField = useController({
    name: "emergency_contact",
    control,
  });

  const emergencyContactPhoneField = useController({
    name: "emergency_contact_phone",
    control,
  });

  // 연락처 중 1개 필수 — phone 필드에 refine 에러가 걸림
  const phoneError = phoneField.fieldState.error?.message;
  const hasContactError = phoneError === "연락처(학생, 어머니, 아버지) 중 1개 이상 입력해주세요";

  return (
    <div className="flex flex-col gap-4">
      {hasContactError && (
        <p className="text-sm text-red-500 font-medium">{phoneError}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="block text-sm font-medium text-gray-700">성별</label>
        <div className="flex gap-2">
          {(["남", "여"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => genderField.field.onChange(g)}
              className={cn(
                "rounded-lg border px-5 py-2 text-sm font-semibold transition",
                genderField.field.value === g
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {g}
            </button>
          ))}
        </div>
        {genderField.fieldState.error?.message && (
          <p className="text-xs text-red-500">{genderField.fieldState.error.message}</p>
        )}
      </div>
      <FormField
        {...phoneField.field}
        label="본인 연락처"
        type="tel"
        placeholder="010-0000-0000"
        required
        error={hasContactError ? undefined : phoneField.fieldState.error?.message}
      />
      <FormField
        {...motherPhoneField.field}
        label="어머니 연락처"
        type="tel"
        placeholder="010-0000-0000"
        required
        error={motherPhoneField.fieldState.error?.message}
      />
      <FormField
        {...fatherPhoneField.field}
        label="아버지 연락처"
        type="tel"
        placeholder="010-0000-0000"
        required
        error={fatherPhoneField.fieldState.error?.message}
      />
      <FormField
        {...addressField.field}
        label="주소"
        type="text"
        error={addressField.fieldState.error?.message}
      />
      <FormField
        {...emergencyContactField.field}
        label="비상연락처"
        type="text"
        error={emergencyContactField.fieldState.error?.message}
      />
      <FormField
        {...emergencyContactPhoneField.field}
        label="비상연락처 전화번호"
        type="tel"
        placeholder="010-0000-0000"
        error={emergencyContactPhoneField.fieldState.error?.message}
      />
    </div>
  );
}

