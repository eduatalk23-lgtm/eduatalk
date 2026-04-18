/**
 * Phase F-1a: navigateTo tool 공유 정의.
 *
 * Chat Shell(`app/api/chat/route.ts`)과 MCP 서버(`app/api/mcp/route.ts`)가
 * 동일 로직을 재사용. 향후 F-2 에서 Chat Shell 의 tools 객체를 MCP 클라이언트
 * 연결로 대체할 때 구현이 한곳에 있어 마이그레이션이 안전.
 */

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

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
  "사용자를 에듀엣톡 내부 페이지로 이동시킵니다. 사용자가 특정 화면을 보고 싶어하거나 이동 의사를 표현했을 때만 호출하세요. 단순 질문·설명·잡담에는 호출하지 마세요. **반드시 현재 사용자 role 에 허용된 경로만 호출하세요**.";

export const navigateToInputShape = {
  path: z
    .enum(ALL_NAV_TARGETS)
    .describe(
      "이동할 페이지 경로. role 별 허용 경로는 시스템 프롬프트 참조. student=/dashboard·/plan·/scores·/analysis·/guides·/settings, admin/consultant=/admin/*, parent=/parent/*.",
    ),
  reason: z.string().describe("사용자에게 보여줄 짧은 이동 안내 문구"),
} as const;

export const navigateToInputSchema = z.object(navigateToInputShape);

export type NavigateToInput = z.infer<typeof navigateToInputSchema>;

export type NavigateToOutput =
  | { ok: true; path: string; reason: string }
  | { ok: false; path: string; reason: string };

export async function navigateToExecute({
  path,
  reason,
}: NavigateToInput): Promise<NavigateToOutput> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      path,
      reason: "로그인 세션이 만료되었습니다.",
    };
  }
  const allowed = getAllowedNavTargets(user.role);
  if (!allowed.includes(path)) {
    return {
      ok: false,
      path,
      reason: `${user.role} 역할은 ${path} 로 이동할 수 없어요. 현재 역할에 맞는 화면을 안내드릴게요.`,
    };
  }
  return { ok: true, path, reason };
}
