"use client";

import { useController } from "react-hook-form";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { GENDER_OPTIONS } from "@/lib/utils/studentProfile";

type ProfileInfoSectionProps = {
  control: any; // React Hook Form의 Control 타입
  studentEmail: string | null;
};

export default function ProfileInfoSection({
  control,
  studentEmail,
}: ProfileInfoSectionProps) {
  const genderField = useController({
    name: "gender",
    control,
  });

  const phoneField = useController({
    name: "phone",
    control,
    rules: { required: "본인 연락처를 입력해주세요" },
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

  const medicalInfoField = useController({
    name: "medical_info",
    control,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">프로필 정보</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              계정 (이메일)
            </label>
            <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {studentEmail ?? "-"}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              이메일은 수정할 수 없습니다.
            </p>
          </div>

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
            required
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
            placeholder="주소를 입력하세요"
            error={addressField.fieldState.error?.message}
          />

          <FormField
            {...emergencyContactField.field}
            label="비상연락처"
            type="text"
            placeholder="비상연락처 이름"
            error={emergencyContactField.fieldState.error?.message}
          />

          <FormField
            {...emergencyContactPhoneField.field}
            label="비상연락처 전화번호"
            type="tel"
            placeholder="010-1234-5678"
            error={emergencyContactPhoneField.fieldState.error?.message}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              의료정보
            </label>
            <textarea
              {...medicalInfoField.field}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="의료정보를 입력하세요"
            />
            {medicalInfoField.fieldState.error && (
              <p className="text-body-2 text-error-600 dark:text-error-400 mt-1">
                {medicalInfoField.fieldState.error.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

