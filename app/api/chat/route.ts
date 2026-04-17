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

const NAV_TARGETS = [
  "/dashboard",
  "/plan",
  "/scores",
  "/analysis",
  "/guides",
  "/settings",
] as const;

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
      "사용자를 에듀엣톡 내부 페이지로 이동시킵니다. 사용자가 특정 화면을 보고 싶어하거나 이동 의사를 표현했을 때만 호출하세요. 단순 질문·설명·잡담에는 호출하지 마세요. 성적이나 구체 데이터를 '보여달라' 하면 getScores 등 데이터 조회 도구를 우선 사용하세요.",
    inputSchema: z.object({
      path: z
        .enum(NAV_TARGETS)
        .describe(
          "이동할 페이지 경로. /dashboard=대시보드, /plan=학습플랜, /scores=성적, /analysis=생기부분석, /guides=탐구가이드, /settings=설정",
        ),
      reason: z
        .string()
        .describe("사용자에게 보여줄 짧은 이동 안내 문구"),
    }),
    execute: async ({ path, reason }) => ({ ok: true, path, reason }),
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

  const result = streamText({
    model: ollama(process.env.OLLAMA_MODEL ?? "gemma4:latest"),
    system: `당신은 에듀엣톡 AI 컨설턴트입니다. 학생의 교육 상담을 친근하고 명확하게 돕습니다. 모든 답변은 한국어로 합니다.

${userContext}${handoffSection ? "\n\n" + handoffSection : ""}

[도구 선택 규칙]
- 화면 이동 요청(예: "성적 화면 열어줘", "대시보드로 가줘") → navigateTo
- 실제 데이터 조회(예: "성적 보여줘", "수학 점수", "1학년 1학기 내신", "김세린 성적") → getScores
- 단순 질문·상담·잡담 → 도구 호출 없이 텍스트로 답변

[navigateTo 규칙]
- 이동 가능한 페이지: /dashboard, /plan, /scores, /analysis, /guides, /settings
- 호출 후 한 문장으로 이동 안내를 덧붙이세요.

[getScores 규칙]
- 현재 role이 admin/consultant이면 반드시 studentName을 포함해야 합니다.
- 사용자가 학생 이름을 명시하지 않았는데 role이 admin/consultant라면, 도구를 호출하지 말고 먼저 "어느 학생의 성적을 볼까요?"라고 물어보세요.
- 학생 이름은 사용자가 쓴 그대로(예: "김세린")를 전달하세요.
- 사용자가 학년·학기를 말하면 grade/semester 필터로 전달하세요.
- 결과가 0건이면 입력이 없다고 안내하고 /scores 화면 이동을 제안하세요.
- tool 결과가 대화창에 표로 렌더링되므로, 긴 숫자 나열은 피하고 1-2문장으로 해석(평균, 눈에 띄는 과목, 변화)만 덧붙이세요.

[대화 규칙]
- role이 student면 이름을 부르며 친근하게.
- admin/consultant면 전문가 톤으로 간결하게.`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
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
