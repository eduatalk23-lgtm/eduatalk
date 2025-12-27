"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useController } from "react-hook-form";
import type { FormControl } from "@/lib/types/forms";
import { DialogFooter, ConfirmDialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { useCreateStudentForm } from "../_hooks/useCreateStudentForm";
import type { CreateStudentFormData } from "../_types/createStudentTypes";
import { createStudent } from "@/lib/domains/student";
import { STUDENT_DIVISIONS } from "@/lib/constants/students";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";
import { useToast } from "@/components/ui/ToastProvider";

type CreateStudentFormProps = {
  onSuccess: (studentId: string, connectionCode: string) => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (isSubmitting: boolean) => void;
};

const STATUS_OPTIONS = [
  { value: "enrolled", label: "재학" },
  { value: "on_leave", label: "휴학" },
  { value: "graduated", label: "졸업" },
  { value: "transferred", label: "전학" },
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

  const onSubmit = async (data: CreateStudentFormData): Promise<void> => {
    setIsSubmitting(true);
    try {
      // FormData로 변환
      const formData = new FormData();
      
      // 기본 정보
      formData.append("name", data.name);
      formData.append("grade", data.grade);
      formData.append("class", data.class || "");
      formData.append("birth_date", data.birth_date);
      formData.append("school_id", data.school_id || "");
      if (data.school_type) {
        formData.append("school_type", data.school_type);
      }
      if (data.division) {
        formData.append("division", data.division);
      }
      formData.append("student_number", data.student_number || "");
      formData.append("enrolled_at", data.enrolled_at || "");
      formData.append("status", data.status);

      // 프로필 정보
      if (data.gender) {
        formData.append("gender", data.gender);
      }
      formData.append("phone", data.phone || "");
      formData.append("mother_phone", data.mother_phone || "");
      formData.append("father_phone", data.father_phone || "");
      formData.append("address", data.address || "");
      formData.append("address_detail", data.address_detail || "");
      formData.append("postal_code", data.postal_code || "");
      formData.append("emergency_contact", data.emergency_contact || "");
      formData.append("emergency_contact_phone", data.emergency_contact_phone || "");
      formData.append("medical_info", data.medical_info || "");
      formData.append("bio", data.bio || "");
      if (data.interests && data.interests.length > 0) {
        data.interests.forEach((interest) => {
          formData.append("interests", interest);
        });
      }

      // 진로 정보
      if (data.exam_year) {
        formData.append("exam_year", String(data.exam_year));
      }
      if (data.curriculum_revision) {
        formData.append("curriculum_revision", data.curriculum_revision);
      }
      if (data.desired_university_ids && data.desired_university_ids.length > 0) {
        data.desired_university_ids.forEach((id) => {
          formData.append("desired_university_ids", id);
        });
      }
      formData.append("desired_career_field", data.desired_career_field || "");
      formData.append("target_major", data.target_major || "");
      formData.append("target_major_2", data.target_major_2 || "");
      formData.append("target_university_type", data.target_university_type || "");
      formData.append("notes", data.notes || "");

      const result = await createStudent(formData);

      if (result.success && result.studentId && result.connectionCode) {
        onSuccess(result.studentId, result.connectionCode);
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
    <form onSubmit={form.handleSubmit(onSubmit as unknown as Parameters<typeof form.handleSubmit>[0])} className="flex flex-col gap-6">
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
          <BasicInfoTab control={control as unknown as FormControl<CreateStudentFormData>} schoolType={schoolType} setSchoolType={setSchoolType} />
        )}
        {activeTab === "profile" && <ProfileInfoTab control={control as unknown as FormControl<CreateStudentFormData>} />}
        {activeTab === "career" && <CareerInfoTab control={control as unknown as FormControl<CreateStudentFormData>} />}
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
  control: FormControl<CreateStudentFormData>;
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
    rules: { required: "학년을 선택해주세요" },
  });

  const birthDateField = useController({
    name: "birth_date",
    control,
    rules: { required: "생년월일을 입력해주세요" },
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
        required
        error={gradeField.fieldState.error?.message}
      />
      <FormField
        {...birthDateField.field}
        label="생년월일"
        type="date"
        required
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
    </div>
  );
}

// 프로필 정보 탭
function ProfileInfoTab({ control }: { control: FormControl<CreateStudentFormData> }) {
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

  return (
    <div className="flex flex-col gap-4">
      <FormSelect
        {...genderField.field}
        label="성별"
        options={[
          { value: "", label: "선택 안 함" },
          ...GENDER_OPTIONS.map((g) => ({
            value: g.value,
            label: g.label,
          })),
        ]}
        error={genderField.fieldState.error?.message}
      />
      <FormField
        {...phoneField.field}
        label="본인 연락처"
        type="tel"
        placeholder="010-1234-5678"
        error={phoneField.fieldState.error?.message}
      />
      <FormField
        {...motherPhoneField.field}
        label="어머니 연락처"
        type="tel"
        placeholder="010-1234-5678"
        error={motherPhoneField.fieldState.error?.message}
      />
      <FormField
        {...fatherPhoneField.field}
        label="아버지 연락처"
        type="tel"
        placeholder="010-1234-5678"
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
        placeholder="010-1234-5678"
        error={emergencyContactPhoneField.fieldState.error?.message}
      />
    </div>
  );
}

// 진로 정보 탭
function CareerInfoTab({ control }: { control: FormControl<CreateStudentFormData> }) {
  const examYearField = useController({
    name: "exam_year",
    control,
  });

  const curriculumRevisionField = useController({
    name: "curriculum_revision",
    control,
  });

  const desiredCareerFieldField = useController({
    name: "desired_career_field",
    control,
  });

  return (
    <div className="flex flex-col gap-4">
      <FormField
        {...examYearField.field}
        label="수능연도"
        type="number"
        placeholder="예: 2025"
        error={examYearField.fieldState.error?.message}
      />
      <FormSelect
        {...curriculumRevisionField.field}
        label="교육과정"
        options={[
          { value: "", label: "선택 안 함" },
          { value: "2009 개정", label: "2009 개정" },
          { value: "2015 개정", label: "2015 개정" },
          { value: "2022 개정", label: "2022 개정" },
        ]}
        error={curriculumRevisionField.fieldState.error?.message}
      />
      <FormField
        {...desiredCareerFieldField.field}
        label="희망 진로 계열"
        type="text"
        error={desiredCareerFieldField.fieldState.error?.message}
      />
    </div>
  );
}

