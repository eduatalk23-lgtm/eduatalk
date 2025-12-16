"use client";

import { FormSelect } from "@/components/molecules/FormField";
import { useDifficultyOptions } from "@/lib/hooks/useDifficultyOptions";

type DifficultySelectFieldProps = {
  contentType: "book" | "lecture" | "custom";
  defaultValue?: string; // difficulty_level_id
  name?: string;
  label?: string;
  required?: boolean;
  error?: string;
};

/**
 * 난이도 선택 필드 컴포넌트
 * 콘텐츠 타입에 따라 적절한 난이도 옵션을 동적으로 로드
 */
export function DifficultySelectField({
  contentType,
  defaultValue,
  name = "difficulty_level_id",
  label = "난이도",
  required = false,
  error,
}: DifficultySelectFieldProps) {
  const { options, loading } = useDifficultyOptions({ contentType });

  // 옵션 배열 생성
  const selectOptions = [
    { value: "", label: "선택하세요", disabled: true },
    ...options.map((option) => ({
      value: option.id,
      label: option.name,
    })),
  ];

  return (
    <FormSelect
      label={label}
      name={name}
      defaultValue={defaultValue || ""}
      options={selectOptions}
      required={required}
      disabled={loading}
      error={error}
      hint={loading ? "난이도 목록을 불러오는 중..." : undefined}
    />
  );
}

