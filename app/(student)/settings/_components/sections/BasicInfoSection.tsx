"use client";

import { useController, type Control } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import type { StudentFormData } from "../../types";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";

type BasicInfoSectionProps = {
  control: Control<StudentFormData>;
  schoolType?: "중학교" | "고등학교" | undefined;
  setSchoolType: (type: "중학교" | "고등학교" | undefined) => void;
  disabled?: boolean;
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
}: BasicInfoSectionProps) {
  const nameField = useController({
    name: "name",
    control,
    rules: { required: "이름을 입력해주세요" },
  });

  const genderField = useController({
    name: "gender",
    control,
  });

  const birthDateField = useController({
    name: "birth_date",
    control,
    rules: { required: "생년월일을 입력해주세요" },
  });

  const schoolIdField = useController({
    name: "school_id",
    control,
  });

  const gradeField = useController({
    name: "grade",
    control,
    rules: { required: "학년을 선택해주세요" },
  });

  const classField = useController({
    name: "class",
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
            <FormSelect
              {...genderField.field}
              label="성별"
              disabled={disabled}
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
              {...birthDateField.field}
              label="생년월일"
              type="date"
              required
              disabled={disabled}
              error={birthDateField.fieldState.error?.message}
            />
          </div>

          {/* 학교 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              학교
            </label>
            <SchoolSelect
              value={schoolIdField.field.value}
              onChange={schoolIdField.field.onChange}
              onSchoolSelect={handleSchoolSelect}
              placeholder="학교를 검색하세요"
              disabled={disabled}
            />
          </div>

          {/* 학년 / 반 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormSelect
              {...gradeField.field}
              label="학년"
              required
              disabled={disabled}
              options={[
                { value: "", label: "선택 안 함" },
                ...GRADE_OPTIONS.map((g) => ({
                  value: g.value,
                  label: g.label,
                })),
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

          {/* 연락처 3열 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              {...phoneField.field}
              label="본인 연락처"
              type="tel"
              placeholder="010-0000-0000"
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
        </div>
      </div>
    </div>
  );
}
