/**
 * 시간 관리(Time Management) 관련 Zod 스키마
 */

import { z } from "zod";
import type { DayOfWeek, TimeString } from "@/lib/types/time-management";

/**
 * 시간 형식 검증 (HH:MM)
 */
const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "시간은 HH:MM 형식이어야 합니다.")
  .refine(
    (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
    },
    {
      message: "시간은 00:00 ~ 23:59 범위여야 합니다.",
    }
  );

/**
 * 요일 검증 (0: 일요일 ~ 6: 토요일)
 */
const dayOfWeekSchema = z
  .number()
  .int("요일은 정수여야 합니다.")
  .min(0, "요일은 0(일요일) 이상이어야 합니다.")
  .max(6, "요일은 6(토요일) 이하여야 합니다.");

/**
 * 시간 블록 스키마
 * 
 * 시작 시간이 종료 시간보다 이전이어야 합니다.
 */
export const blockSchema = z
  .object({
    day: dayOfWeekSchema,
    start_time: timeStringSchema,
    end_time: timeStringSchema,
  })
  .refine(
    (data) => {
      const [startH, startM] = data.start_time.split(":").map(Number);
      const [endH, endM] = data.end_time.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return startMinutes < endMinutes;
    },
    {
      message: "시작 시간은 종료 시간보다 이전이어야 합니다.",
      path: ["start_time"], // 에러를 start_time 필드에 연결
    }
  );

/**
 * 블록 세트 스키마
 */
export const blockSetSchema = z.object({
  name: z
    .string()
    .min(1, "세트 이름을 입력해주세요.")
    .max(100, "세트 이름은 100자 이하여야 합니다."),
  description: z
    .string()
    .max(500, "설명은 500자 이하여야 합니다.")
    .optional()
    .nullable(),
});

/**
 * 블록 추가 폼 스키마
 * 
 * 최소 1개 이상의 요일이 선택되어야 합니다.
 */
export const blockFormSchema = z
  .object({
    selectedWeekdays: z
      .array(dayOfWeekSchema)
      .min(1, "최소 1개 이상의 요일을 선택해주세요."),
    start_time: timeStringSchema,
    end_time: timeStringSchema,
    block_set_id: z.string().min(1, "블록 세트 ID가 필요합니다."),
  })
  .refine(
    (data) => {
      const [startH, startM] = data.start_time.split(":").map(Number);
      const [endH, endM] = data.end_time.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return startMinutes < endMinutes;
    },
    {
      message: "시작 시간은 종료 시간보다 이전이어야 합니다.",
      path: ["start_time"],
    }
  );

/**
 * 블록 배열 스키마
 */
export const blocksArraySchema = z.array(blockSchema);

/**
 * 블록 세트 생성 폼 스키마 (FormData용)
 */
export const blockSetFormSchema = z.object({
  name: z
    .string()
    .min(1, "세트 이름을 입력해주세요.")
    .max(100, "세트 이름은 100자 이하여야 합니다."),
  description: z
    .string()
    .max(500, "설명은 500자 이하여야 합니다.")
    .optional()
    .nullable(),
});

/**
 * 블록 추가 폼 스키마 (FormData용)
 */
export const blockAddFormSchema = z.object({
  day: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(dayOfWeekSchema),
  start_time: timeStringSchema,
  end_time: timeStringSchema,
  block_set_id: z.string().min(1, "블록 세트 ID가 필요합니다."),
});

/**
 * 타입 추론 헬퍼
 */
export type BlockInput = z.infer<typeof blockSchema>;
export type BlockSetInput = z.infer<typeof blockSetSchema>;
export type BlockFormInput = z.infer<typeof blockFormSchema>;
export type BlockAddFormInput = z.infer<typeof blockAddFormSchema>;

/**
 * 시간 문자열 검증 헬퍼
 * 
 * @param time 검증할 시간 문자열 (HH:MM 형식)
 * @returns 유효한 시간 형식이면 true, 그렇지 않으면 false
 * 
 * @example
 * ```typescript
 * validateTimeString("09:30"); // true
 * validateTimeString("25:00"); // false (시간 범위 초과)
 * validateTimeString("9:30");  // false (형식 불일치)
 * ```
 */
export function validateTimeString(time: string): boolean {
  return timeStringSchema.safeParse(time).success;
}

/**
 * 요일 검증 헬퍼
 * 
 * @param day 검증할 요일 값
 * @returns 유효한 요일(0-6)이면 true, 그렇지 않으면 false
 * 
 * @example
 * ```typescript
 * validateDayOfWeek(0); // true (일요일)
 * validateDayOfWeek(6); // true (토요일)
 * validateDayOfWeek(7); // false (범위 초과)
 * ```
 */
export function validateDayOfWeek(day: number): day is DayOfWeek {
  return dayOfWeekSchema.safeParse(day).success;
}

/**
 * 시간 비교 헬퍼
 * 
 * @param startTime 시작 시간 (HH:MM)
 * @param endTime 종료 시간 (HH:MM)
 * @returns 시작 시간이 종료 시간보다 이전이면 true
 */
export function isStartTimeBeforeEndTime(
  startTime: TimeString,
  endTime: TimeString
): boolean {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return startMinutes < endMinutes;
}

