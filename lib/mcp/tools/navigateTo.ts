/**
 * Phase F-1a + Phase T v1 #3: navigateTo tool 공유 정의 (role-aware 매핑).
 *
 * Chat Shell(`app/api/chat/route.ts`)과 MCP 서버(`lib/mcp/server.ts`)가
 * 동일 로직을 재사용.
 *
 * **Role-aware 경로 해결**:
 * LLM 은 "의도 수준" 경로(예: `/scores`, `/analysis`)를 호출하고, 서버가 role + studentName
 * 으로 실제 리다이렉트 경로를 결정한다. admin/consultant 가 학생 세부 화면을 찾으면
 * `/admin/students/{id}/...` 로 자동 매핑해 Phase T v0 의 admin 진입 차단 문제를 해소.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";

export const STUDENT_NAV_TARGETS = [
  "/dashboard",
  "/plan",
  "/scores",
  "/analysis",
  "/guides",
  "/settings",
] as const;

export const ADMIN_NAV_TARGETS = [
  "/admin/dashboard",
  "/admin/students",
  "/admin/guides",
  "/admin/settings",
] as const;

export const PARENT_NAV_TARGETS = [
  "/parent/dashboard",
  "/parent/record",
  "/parent/scores",
  "/parent/settings",
] as const;

export const ALL_NAV_TARGETS = [
  ...STUDENT_NAV_TARGETS,
  ...ADMIN_NAV_TARGETS,
  ...PARENT_NAV_TARGETS,
] as const;

type NavRole = "student" | "admin" | "consultant" | "parent" | "superadmin";

/**
 * admin/consultant 가 student 의도 경로를 요청했을 때 매핑할 admin suffix.
 * `""` 는 학생 상세 루트(/admin/students/{id}). `null` 은 "학생 목록으로" 의미.
 */
const STUDENT_VIEW_TO_ADMIN_SUFFIX: Record<
  (typeof STUDENT_NAV_TARGETS)[number],
  { suffix: string; fallback: string }
> = {
  "/dashboard": { suffix: "", fallback: "/admin/dashboard" },
  "/plan": { suffix: "/plans", fallback: "/admin/students" },
  "/scores": { suffix: "", fallback: "/admin/students" },
  "/analysis": { suffix: "/record", fallback: "/admin/students" },
  "/guides": { suffix: "/guides", fallback: "/admin/guides" },
  "/settings": { suffix: "", fallback: "/admin/settings" },
};

/** parent 가 student 의도 경로를 요청했을 때 대응되는 parent 실제 경로. */
const STUDENT_VIEW_TO_PARENT: Partial<
  Record<(typeof STUDENT_NAV_TARGETS)[number], string>
> = {
  "/dashboard": "/parent/dashboard",
  "/scores": "/parent/scores",
  "/analysis": "/parent/record",
  "/settings": "/parent/settings",
};

export function getAllowedNavTargets(role: NavRole | string): readonly string[] {
  switch (role) {
    case "student":
      return STUDENT_NAV_TARGETS;
    case "admin":
    case "consultant":
      return ADMIN_NAV_TARGETS;
    case "parent":
      return PARENT_NAV_TARGETS;
    case "superadmin":
      return [...ADMIN_NAV_TARGETS, ...STUDENT_NAV_TARGETS];
    default:
      return [];
  }
}

export const navigateToDescription =
  "사용자를 에듀엣톡 내부 페이지로 이동시킵니다. 사용자가 특정 화면을 보고 싶어하거나 이동 의사를 표현했을 때만 호출하세요. 단순 질문·설명·잡담에는 호출하지 마세요. " +
  "path 는 **의도 수준 경로**(/dashboard, /scores, /plan, /analysis, /guides, /settings, /admin/..., /parent/...)를 사용하세요. " +
  "관리자/컨설턴트가 특정 학생의 성적·분석·플랜을 보려면 path 를 의도(/scores, /analysis, /plan)로 두고 **studentName 을 함께 전달**하세요 — 서버가 자동으로 /admin/students/{id}/... 로 해결합니다. " +
  "학생 이름 없이 의도 경로만 주면 학생 목록으로 안내됩니다.";

export const navigateToInputShape = {
  path: z
    .enum(ALL_NAV_TARGETS)
    .describe(
      "이동할 의도 경로. 공통(의도): /dashboard, /plan, /scores, /analysis, /guides, /settings. admin 전용: /admin/dashboard, /admin/students, /admin/guides, /admin/settings. parent 전용: /parent/*.",
    ),
  reason: z.string().describe("사용자에게 보여줄 짧은 이동 안내 문구"),
  studentName: z
    .string()
    .optional()
    .describe(
      "대상 학생 이름. admin/consultant 가 '김세린 성적 페이지', '@김세린 생기부' 같은 특정 학생 화면을 요청할 때 제공. 서버가 /admin/students/{id} 로 매핑.",
    ),
} as const;

export const navigateToInputSchema = z.object(navigateToInputShape);

export type NavigateToInput = z.infer<typeof navigateToInputSchema>;

export type NavigateToOutput =
  | {
      ok: true;
      /** 실제 리다이렉트 경로 (role-aware 매핑 후). */
      path: string;
      reason: string;
      /** LLM 이 호출한 원래 의도 경로. 디버깅·UX 용. */
      requestedPath?: string;
    }
  | { ok: false; path: string; reason: string; requestedPath?: string };

type ResolveStudentResult =
  | { ok: true; studentId: string; resolvedName: string | null }
  | { ok: false; reason: string };

async function resolveStudentByName(
  name: string | undefined,
): Promise<ResolveStudentResult | null> {
  if (!name || name.trim().length === 0) return null;
  const result = await searchStudentsAction(name.trim());
  if (!result.success) {
    return { ok: false, reason: result.error ?? "학생 검색에 실패했습니다." };
  }
  if (result.students.length === 0) {
    return { ok: false, reason: `'${name}'과 일치하는 학생을 찾지 못했습니다.` };
  }
  if (result.students.length > 1) {
    return {
      ok: false,
      reason: `'${name}'과 일치하는 학생이 ${result.students.length}명입니다. 학년·학교로 좁혀 다시 말해주세요.`,
    };
  }
  const picked = result.students[0];
  return { ok: true, studentId: picked.id, resolvedName: picked.name ?? null };
}

type ResolvedPath =
  | { ok: true; path: string }
  | { ok: false; reason: string };

async function resolveNavigationPath(args: {
  role: string;
  requestedPath: (typeof ALL_NAV_TARGETS)[number];
  studentName?: string;
}): Promise<ResolvedPath> {
  const { role, requestedPath, studentName } = args;
  const allowed = getAllowedNavTargets(role);

  // 1) 이미 allowed 목록에 포함 → 그대로 통과 (기존 동작).
  if (allowed.includes(requestedPath)) {
    return { ok: true, path: requestedPath };
  }

  // 2) admin/consultant 가 student 의도 경로 요청 → /admin/students/{id}/... 로 매핑.
  const isStudentView = (STUDENT_NAV_TARGETS as readonly string[]).includes(
    requestedPath,
  );
  if ((role === "admin" || role === "consultant") && isStudentView) {
    const mapping =
      STUDENT_VIEW_TO_ADMIN_SUFFIX[
        requestedPath as (typeof STUDENT_NAV_TARGETS)[number]
      ];
    const resolved = await resolveStudentByName(studentName);
    if (resolved?.ok) {
      return {
        ok: true,
        path: `/admin/students/${resolved.studentId}${mapping.suffix}`,
      };
    }
    if (resolved && !resolved.ok) {
      return { ok: false, reason: resolved.reason };
    }
    // studentName 미지정 → fallback 경로로 안내.
    return { ok: true, path: mapping.fallback };
  }

  // 3) parent 가 student 의도 경로 요청 → parent 대응 경로.
  if (role === "parent" && isStudentView) {
    const mapped =
      STUDENT_VIEW_TO_PARENT[
        requestedPath as (typeof STUDENT_NAV_TARGETS)[number]
      ];
    if (mapped) return { ok: true, path: mapped };
  }

  // 4) 그 외 — 역할이 해당 경로를 지원하지 않음.
  return {
    ok: false,
    reason: `${role} 역할은 ${requestedPath} 로 이동할 수 없어요. 현재 역할에 맞는 화면을 안내드릴게요.`,
  };
}

export async function navigateToExecute({
  path,
  reason,
  studentName,
}: NavigateToInput): Promise<NavigateToOutput> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      path,
      reason: "로그인 세션이 만료되었습니다.",
      requestedPath: path,
    };
  }

  const resolved = await resolveNavigationPath({
    role: user.role,
    requestedPath: path,
    studentName,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      path,
      reason: resolved.reason,
      requestedPath: path,
    };
  }

  return {
    ok: true,
    path: resolved.path,
    reason,
    requestedPath: path,
  };
}
