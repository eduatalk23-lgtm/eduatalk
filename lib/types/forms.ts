/**
 * React Hook Form 타입 정의
 * 
 * 폼 컨트롤 및 필드 타입을 정의하여 타입 안정성을 향상시킵니다.
 */

import type { Control, FieldValues, FieldPath, UseFormReturn } from "react-hook-form";

/**
 * 폼 컨트롤 타입 (제네릭)
 * 
 * @template TFieldValues - 폼 데이터 타입
 */
export type FormControl<TFieldValues extends FieldValues = FieldValues> = Control<TFieldValues>;

/**
 * 폼 필드 경로 타입
 * 
 * @template TFieldValues - 폼 데이터 타입
 */
export type FormFieldPath<TFieldValues extends FieldValues = FieldValues> = FieldPath<TFieldValues>;

/**
 * 폼 반환 타입 (제네릭)
 * 
 * @template TFieldValues - 폼 데이터 타입
 */
export type FormReturn<TFieldValues extends FieldValues = FieldValues> = UseFormReturn<TFieldValues>;

/**
 * 폼 섹션 Props 타입
 * 
 * @template TFieldValues - 폼 데이터 타입
 */
export type FormSectionProps<TFieldValues extends FieldValues = FieldValues> = {
  control: FormControl<TFieldValues>;
};

