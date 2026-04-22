/**
 * Phase E-1 Sprint 1: listStudents tool 공유 정의.
 *
 * admin/consultant/superadmin 이 본인 tenant 의 학생 목록을 자연어로 탐색.
 * 예: "이번 주 면담 2학년 학생 알려줘", "재원 중 1학년 목록", "@김세린 찾기 전에 누구 있는지"
 *
 * 실행 본체는 `searchStudentsAction` (도메인 서버 액션) 래핑. tenant 가드와
 * RPC 호출은 액션 내부에서 수행되며, 본 tool 은 출력 스키마 축약(카드 표시용)만 담당.
 *
 * Chat Shell 과 MCP 서버가 동일 정의를 공유.
 */

import { z } from "zod";
import {
  searchStudentsAction,
  type StudentSearchFilters,
} from "@/lib/domains/student/actions/search";

export type ListStudentsItem = {
  id: string;
  name: string | null;
  grade: number | null;
  className: string | null;
  schoolName: string | null;
  division: string | null;
  status: "enrolled" | "not_enrolled" | null;
};

export type ListStudentsOutput =
  | {
      ok: true;
      students: ListStudentsItem[];
      total: number;
      truncated: boolean;
    }
  | { ok: false; reason: string };

export const listStudentsDescription =
  "본인 tenant 의 학생 목록을 조회합니다. admin/consultant/superadmin 전용. " +
  "사용자가 '@XXX 멘션' 이전에 '어느 학생이 있지', '2학년 누구 있어', '이번 주 면담 예정 학생' 같이 " +
  "**특정 개인이 아닌 복수 학생 후보**를 탐색할 때 호출하세요. " +
  "특정 1명에 대한 상세 조회(성적·생기부)는 getStudentOverview 등 개별 tool 을 사용하세요. " +
  "query 미지정 시 재원 중 전체를 최근순으로 반환합니다. limit 기본 20, 최대 50.";

export const listStudentsInputShape = {
  query: z
    .string()
    .nullable()
    .optional()
    .describe(
      "학생 이름·전화·학교 등 부분 키워드. 생략 시 전체 목록. 빈 문자열도 전체로 간주.",
    ),
  grade: z
    .number()
    .int()
    .min(1)
    .max(3)
    .nullable()
    .optional()
    .describe("학년 필터 (1|2|3). 생략 시 전학년."),
  status: z
    .enum(["enrolled", "not_enrolled"])
    .nullable()
    .optional()
    .describe("재원 상태 필터. 생략 시 전체."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .nullable()
    .optional()
    .describe("반환 개수 상한. 기본 20, 최대 50."),
} as const;

export const listStudentsInputSchema = z.object(listStudentsInputShape);

export type ListStudentsInput = z.infer<typeof listStudentsInputSchema>;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function listStudentsExecute({
  query,
  grade,
  status,
  limit,
}: ListStudentsInput): Promise<ListStudentsOutput> {
  const normalizedQuery = (query ?? "").trim();
  const effectiveLimit = Math.min(
    Math.max(1, limit ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  const filters: StudentSearchFilters = {};
  if (grade) filters.grade = String(grade);
  if (status) filters.status = status;

  const result = await searchStudentsAction(normalizedQuery, filters);
  if (!result.success) {
    return {
      ok: false,
      reason: result.error ?? "학생 목록을 불러오지 못했습니다.",
    };
  }

  const sliced = result.students.slice(0, effectiveLimit);
  const students: ListStudentsItem[] = sliced.map((s) => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    className: s.class,
    schoolName: s.school_name,
    division: s.division,
    status: s.status,
  }));

  return {
    ok: true,
    students,
    total: result.total,
    truncated: result.total > students.length,
  };
}
