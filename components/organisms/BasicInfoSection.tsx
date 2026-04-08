"use client";

import { useController, type Control, type FieldValues } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import BirthDateInput from "@/components/molecules/BirthDateInput";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { STUDENT_DIVISIONS } from "@/lib/constants/students";
import { cn } from "@/lib/cn";

type BasicInfoSectionProps = {
  control: Control<FieldValues>;
  schoolType?: "중학교" | "고등학교" | undefined;
  setSchoolType: (type: "중학교" | "고등학교" | undefined) => void;
  disabled?: boolean;
  /** "admin": 전화 필수 + 메모 표시, "student": 생년월일/학년 필수 */
  role?: "admin" | "student";
  config?: {
    showMemo?: boolean;
  };
};

const GRADE_OPTIONS = [
  { value: "1", label: "1학년" },
  { value: "2", label: "2학년" },
  { value: "3", label: "3학년" },
];

export default function BasicInfoSection({
  control,
  schoolType,
  setSchoolType,
  disabled,
  role = "admin",
  config,
}: BasicInfoSectionProps) {
  const isAdmin = role === "admin";
  const showMemo = config?.showMemo ?? isAdmin;

  const nameField = useController({
    name: "name",
    control,
    rules: { required: "이름을 입력해주세요" },
  });
  const genderField = useController({ name: "gender", control });
  const birthDateField = useController({
    name: "birth_date",
    control,
    rules: !isAdmin ? { required: "생년월일을 입력해주세요" } : undefined,
  });
  const schoolIdField = useController({ name: "school_id", control });
  const gradeField = useController({
    name: "grade",
    control,
    rules: !isAdmin ? { required: "학년을 선택해주세요" } : undefined,
  });
  const classField = useController({ name: "class", control });
  const divisionField = useController({ name: "division", control });
  const phoneField = useController({
    name: "phone",
    control,
    rules: isAdmin ? { required: "학생 연락처를 입력해주세요" } : undefined,
  });
  const motherPhoneField = useController({ name: "mother_phone", control });
  const fatherPhoneField = useController({ name: "father_phone", control });
  const addressField = useController({ name: "address", control });
  const memoField = useController({ name: "memo", control });

  const handleSchoolSelect = (school: {
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
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
        <div className="flex flex-col gap-4">
          {/* 이름 / 성별 / 생년월일 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              {...nameField.field}
              label="이름"
              required
              disabled={disabled}
              error={nameField.fieldState.error?.message}
            />
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-gray-700">성별</label>
              <div className="flex gap-2">
                {(["남", "여"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={disabled}
                    onClick={() => genderField.field.onChange(g)}
                    className={cn(
                      "rounded-lg border px-5 py-2 text-sm font-semibold transition",
                      genderField.field.value === g
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50",
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
            <BirthDateInput
              {...birthDateField.field}
              label="생년월일"
              required={!isAdmin}
              disabled={disabled}
              error={birthDateField.fieldState.error?.message}
            />
          </div>

          {/* 학교 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">학교</label>
            <SchoolSelect
              value={schoolIdField.field.value}
              onChange={schoolIdField.field.onChange}
              onSchoolSelect={handleSchoolSelect}
              placeholder="학교를 검색하세요"
              disabled={disabled}
            />
          </div>

          {/* 학부 / 학년 / 반 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormSelect
              {...divisionField.field}
              label="학부"
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...STUDENT_DIVISIONS.map((d) => ({ value: d.value, label: d.label })),
              ]}
              error={divisionField.fieldState.error?.message}
            />
            <FormSelect
              {...gradeField.field}
              label="학년"
              required={!isAdmin}
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...GRADE_OPTIONS.map((g) => ({ value: g.value, label: g.label })),
              ]}
              error={gradeField.fieldState.error?.message}
            />
            <FormField
              {...classField.field}
              label="반"
              type="text"
              placeholder="반 번호"
              disabled={disabled}
              error={classField.fieldState.error?.message}
            />
          </div>

          {/* 연락처 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              {...phoneField.field}
              label={isAdmin ? "학생 연락처" : "본인 연락처"}
              type="tel"
              placeholder="010-0000-0000"
              required={isAdmin}
              disabled={disabled}
              error={phoneField.fieldState.error?.message}
            />
            <FormField
              {...motherPhoneField.field}
              label="모 연락처"
              type="tel"
              placeholder="010-0000-0000"
              disabled={disabled}
              error={motherPhoneField.fieldState.error?.message}
            />
            <FormField
              {...fatherPhoneField.field}
              label="부 연락처"
              type="tel"
              placeholder="010-0000-0000"
              disabled={disabled}
              error={fatherPhoneField.fieldState.error?.message}
            />
          </div>

          {/* 주소 */}
          <FormField
            {...addressField.field}
            label="주소"
            type="text"
            placeholder="주소를 입력하세요"
            disabled={disabled}
            error={addressField.fieldState.error?.message}
          />

          {/* 메모 (어드민만) */}
          {showMemo && (
            <FormField
              {...memoField.field}
              label="메모"
              type="text"
              placeholder="메모를 입력하세요"
              disabled={disabled}
              error={memoField.fieldState.error?.message}
            />
          )}
        </div>
      </div>
    </div>
  );
}
