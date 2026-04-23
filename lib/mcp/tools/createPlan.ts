/**
 * Phase E-1 Sprint 2.1: createPlan tool 공유 정의.
 *
 * admin/consultant/superadmin 이 **신규 수강 계획 row** 를 student_course_plans
 * 에 INSERT. 기존 `applyArtifactEdit` type=plan 은 **기존 row 편집**(Sprint P2) 이고,
 * 이 tool 은 **신규 생성** 경로.
 *
 * HITL execute-less 패턴:
 *  Chat Shell 의 LLM → tool call → state='input-available' → InlineConfirm
 *  → 사용자 승인 → 서버 액션 `applyCreatePlan` → addToolResult 로 resume.
 *
 * `archiveConversation` / `applyArtifactEdit` 와 동일 패턴 — MCP 서버에는
 * 등록하지 않고 route.ts 에서 HITL inline 으로 구성. HITL elicitation 은
 * MCP stateful session 필요해 v0 에선 Chat Shell 전용.
 */

import { z } from "zod";

export const createPlanCourseInputShape = {
  subjectId: z
    .string()
    .uuid()
    .describe("과목 id (UUID). subjects.id 참조."),
  subjectName: z
    .string()
    .min(1)
    .max(80)
    .describe("과목 이름 (UI 확인용). 예: '경제수학'"),
  grade: z
    .number()
    .int()
    .min(1)
    .max(3)
    .describe("학년 1~3"),
  semester: z
    .number()
    .int()
    .min(1)
    .max(2)
    .describe("학기 1 또는 2"),
  priority: z
    .number()
    .int()
    .min(0)
    .max(99)
    .nullable()
    .optional()
    .describe("우선순위 (0~99). 기본 0."),
  notes: z
    .string()
    .max(400)
    .nullable()
    .optional()
    .describe("메모 (선택). 최대 400자."),
} as const;

export const createPlanCourseSchema = z.object(createPlanCourseInputShape);
export type CreatePlanCourse = z.infer<typeof createPlanCourseSchema>;

export const createPlanInputShape = {
  studentId: z
    .string()
    .uuid()
    .describe("대상 학생의 id (UUID). students.id."),
  studentName: z
    .string()
    .min(1)
    .max(40)
    .describe("학생 이름 (UI 확인용)."),
  courses: z
    .array(createPlanCourseSchema)
    .min(1)
    .max(20)
    .describe(
      "신규 생성할 수강 계획 row 목록. 1~20건. 같은 (학년·학기·과목) 에 이미 계획이 있으면 skip.",
    ),
} as const;

export const createPlanInputSchema = z.object(createPlanInputShape);
export type CreatePlanInput = z.infer<typeof createPlanInputSchema>;

export const createPlanDescription =
  "학생의 student_course_plans 에 **신규 수강 계획 row 를 일괄 생성**합니다. " +
  "admin/consultant/superadmin 전용. HITL 승인 후 서버가 실제 DB 에 INSERT. " +
  "기존 row 편집은 applyArtifactEdit(type=plan) 으로 하세요 — 이 도구는 신규 생성 전용. " +
  "사용 예: 'designStudentPlan/recommendCourses 결과를 그대로 DB 에 등록해줘', " +
  "'2학년 2학기 경제수학·물리학 계획 새로 만들어줘'. " +
  "source 는 'consultant', plan_status 는 'recommended' 로 고정 INSERT. " +
  "같은 (학년·학기·과목) 중복 시 skip(UNIQUE 위반 방지). 비가역 작업 → 사용자 승인 필요.";

export type ApplyCreatePlanOutput =
  | {
      ok: true;
      createdCount: number;
      skippedCount: number;
      studentId: string;
    }
  | { ok: false; reason: string };
