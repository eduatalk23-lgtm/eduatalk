"use client";

import { useController } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import SchoolSelect from "@/components/ui/SchoolSelect";
import type { AdminStudentFormData } from "../../_types/studentFormTypes";
import { STUDENT_DIVISIONS } from "@/lib/constants/students";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";

type BasicInfoSectionProps = {
  control: any; // React Hook Form의 Control 타입
  schoolType?: "중학교" | "고등학교" | undefined;
  setSchoolType: (type: "중학교" | "고등학교" | undefined) => void;
};

const STATUS_OPTIONS = [
  { value: "enrolled", label: "재학" },
  { value: "on_leave", label: "휴학" },
  { value: "graduated", label: "졸업" },
  { value: "transferred", label: "전학" },
];

export default function BasicInfoSection({
  control,
  schoolType,
  setSchoolType,
}: BasicInfoSectionProps) {
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

  const memoField = useController({
    name: "memo",
    control,
  });

  const statusField = useController({
    name: "status",
    control,
  });

  const isActiveField = useController({
    name: "is_active",
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
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h3>
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

          <FormField
            {...birthDateField.field}
            label="생년월일"
            type="date"
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

          <FormField
            {...memoField.field}
            label="메모"
            type="text"
            placeholder="메모를 입력하세요"
            error={memoField.fieldState.error?.message}
          />

          <FormSelect
            {...statusField.field}
            label="계정 상태"
            options={[
              { value: "", label: "선택 안 함" },
              ...STATUS_OPTIONS.map((s) => ({
                value: s.value,
                label: s.label,
              })),
            ]}
            error={statusField.fieldState.error?.message}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActiveField.field.value ?? true}
              onChange={(e) => isActiveField.field.onChange(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              활성 계정
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

