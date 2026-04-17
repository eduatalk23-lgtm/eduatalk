import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { ollama } from "ai-sdk-ollama";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getStudentById } from "@/lib/data/students";
import { getInternalScoresByTerm } from "@/lib/data/scoreDetails";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getConversationOrigin,
  saveChatTurn,
} from "@/lib/domains/ai-chat/persistence";
import type { AIConversationPersona } from "@/lib/domains/ai-chat/types";
import { getHandoffSource } from "@/lib/domains/ai-chat/handoff/sources";
import { validateAndResolveHandoff } from "@/lib/domains/ai-chat/handoff/validator";
import { buildHandoffPromptSection } from "@/lib/domains/ai-chat/handoff/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Phase T 서버 최적화 (2026-04 Vercel/Ollama 모범사례)
 *
 * 1. Prompt 재배치 — 정적 prefix 앞, 동적 suffix 뒤.
 *    매 요청마다 동일한 규칙이 앞에 오도록 해 Ollama KV cache 재사용 극대화.
 *    AI SDK v6 공식 권고: static instructions 앞, variable data 뒤.
 *
 * 2. providerOptions.options — num_ctx/num_predict/num_keep 튜닝
 *    - num_ctx 8192: 기본 128K → 8K (KV cache 메모리 축소)
 *    - num_predict 500: 응답 토큰 상한 (장문 낭비 방지)
 *    - num_keep 256: 시스템 prefix KV cache 영구 고정
 *
 * 3. stepCountIs(2) — tool 호출 + 응답 1루프로 제한 (3 → 2)
 *
 * 4. 응답 간결 지침 (프롬프트 내부)
 */
const STATIC_SYSTEM_PREFIX = `당신은 에듀엣톡 AI 컨설턴트입니다. 한국어로 친근하고 간결하게 답변합니다. 답변 원칙은 2~3문장, 불필요한 수식어 배제.

[도구 선택 규칙]
- 화면 이동 요청 → navigateTo
- 데이터 조회(성적·점수·내신 등) → getScores
- 단순 질문·상담 → 도구 없이 텍스트

[navigateTo 규칙]
- 반드시 현재 사용자 role 에 맞는 경로만 호출. role 은 [현재 사용자] 참조.
  · student: /dashboard, /plan, /scores, /analysis, /guides, /settings
  · admin/consultant: /admin/dashboard, /admin/students, /admin/guides, /admin/settings
  · parent: /parent/dashboard, /parent/record, /parent/scores, /parent/settings
  · superadmin: admin + student 경로
- 호출 후 한 문장으로 이동 안내.

[getScores 규칙]
- admin/consultant는 반드시 studentName. 없으면 도구 호출 대신 "어느 학생?" 먼저 질문.
- 학년·학기 언급 시 grade/semester 필터 전달.
- 결과 0건이면 입력 안내 + /scores 이동 제안.
- 긴 숫자 나열 금지. 1~2문장 해석(평균·눈에 띄는 과목·변화)만.

[대화 규칙]
- student: 이름 부르며 친근하게.
- admin/consultant: 전문가 톤으로 간결.`;

// Phase T 빈틈 #3: navigateTo role-aware 경로 매핑
// proxy.ts (ROLE_ALLOWED_PATHS)와 일관성 유지 — 각 role이 실제 접근 가능한 경로만 노출
const STUDENT_NAV_TARGETS = [
  "/dashboard",
  "/plan",
  "/scores",
  "/analysis",
  "/guides",
  "/settings",
] as const;

const ADMIN_NAV_TARGETS = [
  "/admin/dashboard",
  "/admin/students",
  "/admin/guides",
  "/admin/settings",
] as const;

const PARENT_NAV_TARGETS = [
  "/parent/dashboard",
  "/parent/record",
  "/parent/scores",
  "/parent/settings",
] as const;

// tool inputSchema enum — 모든 role 경로의 합집합. 실행 시 role 별 허용 검증.
const ALL_NAV_TARGETS = [
  ...STUDENT_NAV_TARGETS,
  ...ADMIN_NAV_TARGETS,
  ...PARENT_NAV_TARGETS,
] as const;

type NavRole = "student" | "admin" | "consultant" | "parent" | "superadmin";

function getAllowedNavTargets(role: NavRole | string): readonly string[] {
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

export type ScoreRow = {
  subjectGroup: string;
  subject: string;
  grade: number;
  semester: number;
  rawScore: number | null;
  rankGrade: number | null;
  creditHours: number;
};

export type StudentCandidate = {
  id: string;
  name: string | null;
  grade: number | null;
  schoolName: string | null;
};

export type GetScoresOutput =
  | {
      ok: true;
      studentName?: string | null;
      filter: { grade?: number; semester?: number };
      count: number;
      rows: ScoreRow[];
    }
  | { ok: false; reason: string; candidates?: StudentCandidate[] };

type ResolvedTarget =
  | { ok: true; studentId: string; tenantId: string; studentName: string | null }
  | { ok: false; reason: string; candidates?: StudentCandidate[] };

/**
 * 역할별로 성적 조회 대상 학생을 해결.
 * - student: 항상 self
 * - admin/consultant: studentName으로 본 테넌트 학생 검색. 정확히 1명이면 선택, 0명/다수면 에러+후보 반환.
 * - parent/superadmin: 미지원
 */
async function resolveScoresTarget(args: {
  studentName?: string;
}): Promise<ResolvedTarget> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (user.role === "student") {
    const tenantId = user.tenantId;
    if (!tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    const self = await getStudentById(user.userId, tenantId);
    const name = (self as unknown as { name?: string | null } | null)?.name ?? null;
    return { ok: true, studentId: user.userId, tenantId, studentName: name };
  }

  if (user.role === "admin" || user.role === "consultant") {
    if (!user.tenantId) return { ok: false, reason: "테넌트 정보가 없습니다." };
    if (!args.studentName || args.studentName.trim().length === 0) {
      return {
        ok: false,
        reason: "어느 학생의 성적을 조회할까요? 학생 이름을 알려주세요.",
      };
    }

    const result = await searchStudentsAction(args.studentName.trim());
    if (!result.success) {
      return { ok: false, reason: result.error ?? "학생 검색에 실패했습니다." };
    }
    if (result.students.length === 0) {
      return {
        ok: false,
        reason: `'${args.studentName}'과 일치하는 학생을 찾지 못했습니다.`,
      };
    }
    if (result.students.length > 1) {
      return {
        ok: false,
        reason: `'${args.studentName}'과 일치하는 학생이 ${result.students.length}명입니다. 학년·학교·상태로 좁혀 다시 말해주세요.`,
        candidates: result.students.slice(0, 10).map((s) => ({
          id: s.id,
          name: s.name,
          grade: s.grade,
          schoolName: s.school_name,
        })),
      };
    }

    const picked = result.students[0];
    return {
      ok: true,
      studentId: picked.id,
      tenantId: user.tenantId,
      studentName: picked.name ?? null,
    };
  }

  return {
    ok: false,
    reason: `${user.role} 역할은 성적 조회를 지원하지 않습니다.`,
  };
}

const tools = {
  navigateTo: tool({
    description:
      "사용자를 에듀엣톡 내부 페이지로 이동시킵니다. 사용자가 특정 화면을 보고 싶어하거나 이동 의사를 표현했을 때만 호출하세요. 단순 질문·설명·잡담에는 호출하지 마세요. 성적이나 구체 데이터를 '보여달라' 하면 getScores 등 데이터 조회 도구를 우선 사용하세요. **반드시 현재 사용자 role 에 허용된 경로만 호출하세요** — 시스템 프롬프트의 [navigateTo 규칙] 참조.",
    inputSchema: z.object({
      path: z
        .enum(ALL_NAV_TARGETS)
        .describe(
          "이동할 페이지 경로. role 별 허용 경로는 시스템 프롬프트 참조. student=/dashboard·/plan·/scores·/analysis·/guides·/settings, admin/consultant=/admin/*, parent=/parent/*.",
        ),
      reason: z
        .string()
        .describe("사용자에게 보여줄 짧은 이동 안내 문구"),
    }),
    execute: async ({ path, reason }) => {
      const user = await getCurrentUser();
      if (!user) {
        return {
          ok: false as const,
          path,
          reason: "로그인 세션이 만료되었습니다.",
        };
      }
      const allowed = getAllowedNavTargets(user.role);
      if (!allowed.includes(path)) {
        return {
          ok: false as const,
          path,
          reason: `${user.role} 역할은 ${path} 로 이동할 수 없어요. 현재 역할에 맞는 화면을 안내드릴게요.`,
        };
      }
      return { ok: true as const, path, reason };
    },
  }),

  getScores: tool({
    description:
      "학생의 내신 성적(student_internal_scores)을 조회합니다. 사용자가 '성적 보여줘', '내신 알려줘', '수학 점수', '1학년 1학기 성적', '김세린 성적' 등 구체 데이터 조회를 요청할 때 호출하세요. 단순 페이지 이동 요청(예: '성적 화면 열어줘')에는 navigateTo를 사용하세요. 관리자/컨설턴트가 호출할 때는 반드시 studentName을 제공해야 합니다. 학생 본인은 studentName을 비워두면 자신의 성적이 조회됩니다.",
    inputSchema: z.object({
      studentName: z
        .string()
        .optional()
        .describe(
          "조회할 학생의 이름. 관리자/컨설턴트는 반드시 제공. 학생 본인은 생략. 같은 테넌트에서만 검색됨.",
        ),
      grade: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe("필터: 학년 (1/2/3). 생략 시 전체"),
      semester: z
        .number()
        .int()
        .min(1)
        .max(2)
        .optional()
        .describe("필터: 학기 (1/2). 생략 시 전체"),
    }),
    execute: async ({
      studentName,
      grade,
      semester,
    }): Promise<GetScoresOutput> => {
      const target = await resolveScoresTarget({ studentName });
      if (!target.ok) {
        return {
          ok: false,
          reason: target.reason,
          candidates: target.candidates,
        };
      }

      const scores = await getInternalScoresByTerm(
        target.studentId,
        target.tenantId,
        grade,
        semester,
      );

      const rows: ScoreRow[] = scores.map((s) => ({
        subjectGroup: s.subject_group?.name ?? "-",
        subject: s.subject?.name ?? "-",
        grade: s.grade,
        semester: s.semester,
        rawScore: s.raw_score,
        rankGrade: s.rank_grade,
        creditHours: s.credit_hours,
      }));

      return {
        ok: true,
        studentName: target.studentName,
        filter: { grade, semester },
        count: rows.length,
        rows,
      };
    },
  }),
};

/**
 * 대화의 origin JSONB 를 읽어 handoff 시스템 프롬프트 조각을 빌드.
 * 실패·부재 시 빈 문자열 반환 (프롬프트에 빈 줄만 추가되지 않도록 호출자가 분기).
 */
async function buildHandoffSectionForConversation(
  conversationId: string,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
): Promise<string> {
  if (!user) return "";
  try {
    const origin = await getConversationOrigin(conversationId);
    if (!origin) return "";
    const source = getHandoffSource(origin.source);
    if (!source) return "";

    const params = origin.params ?? {};
    const handoff = await validateAndResolveHandoff(
      {
        from: origin.source,
        studentId:
          typeof params.studentId === "string" ? params.studentId : undefined,
        grade: typeof params.grade === "number" ? params.grade : undefined,
        semester:
          typeof params.semester === "number" ? params.semester : undefined,
        subject:
          typeof params.subject === "string" ? params.subject : undefined,
      },
      user,
    );
    if (!handoff.ok) return "";
    return buildHandoffPromptSection(handoff.source, handoff.resolved);
  } catch {
    return "";
  }
}

async function buildUserContextPrompt(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    return "[현재 사용자] 비로그인 상태입니다.";
  }

  const lines: string[] = [
    `[현재 사용자]`,
    `- user_id: ${user.userId}`,
    `- role: ${user.role}`,
  ];
  if (user.email) lines.push(`- email: ${user.email}`);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name, phone")
      .eq("id", user.userId)
      .maybeSingle();
    if (profile?.name) lines.push(`- name: ${profile.name}`);
  } catch {
    // 프로필 조회 실패 시 기본 정보만 사용
  }

  if (user.role === "student") {
    try {
      const student = await getStudentById(user.userId, user.tenantId ?? undefined);
      if (student) {
        const detail = (student as unknown as {
          grade?: number | null;
          school_name?: string | null;
        }) ?? {};
        if (detail.grade != null) lines.push(`- grade: ${detail.grade}학년`);
        if (detail.school_name) lines.push(`- school: ${detail.school_name}`);
      }
    } catch {
      // 학생 추가 정보 실패 시 공통 프로필만 사용
    }
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    id?: string;
  };
  const messages = body.messages;
  const conversationId = body.id;

  const user = await getCurrentUser();
  const userContext = await buildUserContextPrompt();
  const handoffSection = conversationId && user
    ? await buildHandoffSectionForConversation(conversationId, user)
    : "";

  // 2026-04 Vercel AI SDK 공식 권고: static prefix + variable suffix
  // 앞부분(STATIC_SYSTEM_PREFIX)이 매 요청 동일 → Ollama KV cache prefix 재사용
  const dynamicSuffix = `${userContext}${handoffSection ? "\n\n" + handoffSection : ""}`;

  const result = streamText({
    model: ollama(process.env.OLLAMA_MODEL ?? "gemma4:latest", {
      options: {
        num_ctx: 8192,
        num_predict: 500,
        num_keep: 256,
        // Gemma 4 thinking 비활성화 — 단순 질문에도 내부 reasoning 토큰 생성 방지
        // E2B/E4B 는 think:false 완전 지원. 26B/31B 는 빈 <thought> 태그만 생성
        think: false,
      },
    }),
    system: `${STATIC_SYSTEM_PREFIX}\n\n${dynamicSuffix}`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(2),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      if (!conversationId || !user) return;

      // 첫 사용자 메시지로 타이틀 생성 (간단 truncate)
      const firstUserMsg = finalMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (firstUserMsg.parts
            .filter((p) => p.type === "text")
            .map((p) => ("text" in p ? p.text : ""))
            .join(" ")
            .slice(0, 80) || null)
        : null;

      const persona = user.role as AIConversationPersona;
      const saveResult = await saveChatTurn(
        {
          conversationId,
          ownerUserId: user.userId,
          tenantId: user.tenantId,
          persona,
          title,
        },
        finalMessages,
      );

      if (!saveResult.ok) {
        console.error("[ai-chat] saveChatTurn 실패:", saveResult.error);
      }
    },
  });
}
