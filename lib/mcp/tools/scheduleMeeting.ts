/**
 * Phase E-1 Sprint 2.2: scheduleMeeting tool 공유 정의.
 *
 * admin/consultant/superadmin 이 **calendar_events** 에 신규 이벤트(면담·상담·행사)
 * 를 INSERT 하는 HITL write tool. 학생과의 1:1 면담이면 학생 Primary Calendar,
 * studentId 가 없으면 관리자 Primary Calendar(개인 일정·학원 행사) 에 생성.
 *
 * createPlan HITL 패턴을 복제 — execute 없는 tool 이라 state='input-available'
 * 에서 Chat Shell 이 InlineConfirm 을 렌더하고 사용자가 승인하면 서버 액션
 * `applyScheduleMeeting` 을 호출 → `addToolResult` 로 LLM resume.
 *
 * Google Calendar 동기화는 studentId 가 있을 때만 enqueue → 컨설턴트가 Google 을
 * 연동해 두지 않았다면 즉시 동기화 실패 후 큐 drop(graceful no-op).
 */

import { z } from "zod";

const ISO_DATETIME_HINT =
  "ISO 8601 타임스탬프. 예: '2026-05-12T15:30:00+09:00'. 타임존은 항상 Asia/Seoul.";

export const scheduleMeetingInputShape = {
  studentId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe(
      "대상 학생 id (UUID). 학생과의 1:1 면담이면 필수. 컨설턴트 개인 일정·학원 행사면 생략(null/undefined).",
    ),
  studentName: z
    .string()
    .min(1)
    .max(40)
    .nullable()
    .optional()
    .describe("학생 이름 (UI 확인용). studentId 지정 시 함께 전달 권장."),
  title: z
    .string()
    .min(1)
    .max(80)
    .describe("이벤트 제목. 예: '김세린 수시 방향 면담', '주간 학원 회의'"),
  startAt: z.string().min(1).describe(`시작 시각. ${ISO_DATETIME_HINT}`),
  endAt: z.string().min(1).describe(`종료 시각 (> startAt). ${ISO_DATETIME_HINT}`),
  location: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .describe("오프라인 장소 (선택). 최대 200자."),
  description: z
    .string()
    .max(400)
    .nullable()
    .optional()
    .describe("메모·어젠다 (선택). 최대 400자."),
  syncGoogle: z
    .boolean()
    .optional()
    .describe(
      "Google Calendar 동기화 여부. 기본 true. studentId 가 없거나 컨설턴트가 Google 연동이 안 돼 있으면 graceful skip.",
    ),
} as const;

export const scheduleMeetingInputSchema = z
  .object(scheduleMeetingInputShape)
  .refine(
    (v) => {
      const start = Date.parse(v.startAt);
      const end = Date.parse(v.endAt);
      return Number.isFinite(start) && Number.isFinite(end) && start < end;
    },
    { message: "startAt 은 유효해야 하며 endAt 보다 이전이어야 합니다.", path: ["endAt"] },
  );

export type ScheduleMeetingInput = z.infer<typeof scheduleMeetingInputSchema>;

export const scheduleMeetingDescription =
  "calendar_events 에 **새 일정(면담·상담·행사)** 을 등록합니다. " +
  "admin/consultant/superadmin 전용. HITL 승인 후 서버가 실제 INSERT. " +
  "studentId 를 지정하면 학생 Primary Calendar 에, 생략하면 관리자 Primary Calendar 에 생성합니다. " +
  "label 은 '면담' 고정, source 는 'ai-chat-hitl'. " +
  "syncGoogle=true(기본) + studentId 지정 시 Google Calendar 동기화 시도 — 미연동 시 graceful skip. " +
  "비가역 작업(취소 시 별도 삭제 경로 필요) → 사용자 승인 필요. " +
  "사용 예: '내일 오후 3시 @김세린 수시 면담 1시간 잡아줘', '다음 주 월 10시 학원 전체 회의 30분'.";

export type ApplyScheduleMeetingOutput =
  | {
      ok: true;
      eventId: string;
      calendarScope: "student" | "admin";
      syncedToGoogle: boolean;
      studentId: string | null;
    }
  | { ok: false; reason: string };
