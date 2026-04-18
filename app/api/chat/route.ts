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
import {
  lookupRecordAnalysis,
  type AnalyzeRecordOutput,
} from "@/lib/domains/ai-chat/actions/record-analysis";
import {
  ALL_NAV_TARGETS,
  navigateToDescription,
  navigateToExecute,
} from "@/lib/mcp/tools/navigateTo";
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
- 생기부 분석 상태·요약 요청 → analyzeRecord (admin/consultant 전용)
- 현재 대화 보관/아카이브 요청 → archiveConversation (사용자 승인 필요)
- 단순 질문·상담 → 도구 없이 텍스트

[archiveConversation 규칙]
- "이 대화 보관", "대화 정리", "archive", "이 대화 아카이브" 등 현재 대화를 보관 요청할 때만 호출.
- 단순 질문이나 다른 대화 언급에는 호출 금지.
- reason 에 사용자 요청 요약 1문장 담기.
- 호출 후 사용자가 승인/취소하므로 이행 여부는 도구 결과를 보고 판단.

[analyzeRecord 규칙]
- "XXX 생기부 분석 요약", "YYY 분석 어디까지 됐어", "ZZZ 진단 결과" 등 특정 학생의 생기부 분석 상태·요약 요청 시 호출.
- studentName 은 반드시 제공 (mention @이름 포함 시 그 이름을 사용).
- 실제 분석 재실행은 하지 않음. 결과에 포함된 detailPath 로 이동을 제안.
- 결과 summary 가 있으면 핵심(종합등급·강점·약점) 1~2문장 요약 + 상세는 카드 참조라고 안내.
- no_analysis 상태면 "아직 분석 전"임을 알리고 detailPath 이동을 권장.

[navigateTo 규칙]
- 반드시 현재 사용자 role 에 맞는 경로만 호출. role 은 [현재 사용자] 참조.
  · student: /dashboard, /plan, /scores, /analysis, /guides, /settings
  · admin/consultant: /admin/dashboard, /admin/students, /admin/guides, /admin/settings
  · parent: /parent/dashboard, /parent/record, /parent/scores, /parent/settings
  · superadmin: admin + student 경로
- 호출 후 한 문장으로 이동 안내.

[getScores 규칙]
- admin/consultant는 studentName 필수.
- **[대화 맥락]에 "대상 학생: XXX" 가 있으면 XXX 를 그대로 studentName 으로 사용.**
  · 이 경우 사용자에게 "어느 학생?" 재질문 금지. 바로 도구 호출.
- 대화 맥락에 학생이 없고 사용자도 이름을 말하지 않은 경우에만 "어느 학생?" 질문.
- 학년·학기 언급 시 grade/semester 필터 전달.
- 결과 0건이면 입력 안내 + /scores 이동 제안.
- 긴 숫자 나열 금지. 1~2문장 해석(평균·눈에 띄는 과목·변화)만.

[대화 규칙]
- student: 이름 부르며 친근하게.
- admin/consultant: 전문가 톤으로 간결.`;

// Phase F-1a: navigateTo 경로·실행 로직은 `lib/mcp/tools/navigateTo.ts` 로 이전.
// Chat Shell 과 MCP 서버가 동일 구현을 재사용.

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

/**
 * Phase B-4 후속: archiveConversation HITL 도구 결과.
 * 클라이언트가 InlineConfirm 승인 후 addToolResult 로 주입.
 */
export type ArchiveConversationOutput =
  | { ok: true; conversationId: string }
  | { ok: false; reason: string };

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
    description: navigateToDescription,
    inputSchema: z.object({
      path: z
        .enum(ALL_NAV_TARGETS)
        .describe(
          "이동할 페이지 경로. role 별 허용 경로는 시스템 프롬프트 참조. student=/dashboard·/plan·/scores·/analysis·/guides·/settings, admin/consultant=/admin/*, parent=/parent/*.",
        ),
      reason: z.string().describe("사용자에게 보여줄 짧은 이동 안내 문구"),
    }),
    execute: navigateToExecute,
  }),

  /**
   * Phase E-1: 학생 생기부 분석 상태·요약 조회 (read-only).
   * 분석 재실행은 포함하지 않음 — detailPath 로 admin 페이지 이동 유도.
   */
  analyzeRecord: tool({
    description:
      "학생의 생기부 AI 분석 상태와 최신 진단 요약(종합등급·강점·약점·추천 전공)을 조회합니다. 관리자/컨설턴트가 '@XXX 분석 요약', '김세린 진단 어디까지', 'YYY 생기부 분석 결과' 등 특정 학생의 분석 결과·진행 상태를 물을 때 호출하세요. 분석 재실행은 하지 않으며, 필요 시 결과에 담긴 detailPath 로 이동을 안내합니다.",
    inputSchema: z.object({
      studentName: z
        .string()
        .min(1)
        .describe("조회 대상 학생의 이름. 반드시 제공. 같은 테넌트에서만 검색됨."),
    }),
    execute: async ({ studentName }): Promise<AnalyzeRecordOutput> => {
      return lookupRecordAnalysis(studentName);
    },
  }),

  /**
   * Phase B-4 후속: HITL 도구. `execute` 를 의도적으로 생략해 AI SDK v6 가
   * input-available 상태에서 스트림을 대기하게 하고, 클라이언트가
   * InlineConfirm 승인 후 `addToolResult` 로 결과를 주입한다. 승인 거부 시
   * 클라이언트가 ok:false 결과를 주입해 어시스턴트가 취소 안내를 생성한다.
   */
  archiveConversation: tool({
    description:
      "현재 대화를 '보관(archive)' 처리합니다. 사용자가 이 대화 자체를 정리/보관/아카이브 요청할 때만 호출하세요. 다른 데이터(학생·플랜·성적) 삭제에는 사용 금지. 호출 후 사용자 승인을 거쳐 실제 보관이 이뤄집니다.",
    inputSchema: z.object({
      reason: z
        .string()
        .describe("사용자가 보관을 요청한 이유를 1문장으로 요약"),
    }),
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

/**
 * Phase B-1 UIMessage metadata 스키마.
 * 응답 완료 시 어시스턴트 메시지에 duration/model/toolCallCount 등 첨부.
 */
export type AIChatMessageMetadata = {
  /** 응답 생성 소요 ms (서버 기준 startedAt→finishedAt) */
  durationMs?: number;
  /** 실제 사용된 모델 식별자 */
  model?: string;
  /** 해당 턴에 호출된 tool 수 */
  toolCallCount?: number;
  /** AI SDK 종료 사유 */
  finishReason?: string;
};

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

  const modelName = process.env.OLLAMA_MODEL ?? "gemma4:latest";

  // 2026-04 Vercel AI SDK 공식 권고: static prefix + variable suffix
  // 앞부분(STATIC_SYSTEM_PREFIX)이 매 요청 동일 → Ollama KV cache prefix 재사용
  const dynamicSuffix = `${userContext}${handoffSection ? "\n\n" + handoffSection : ""}`;

  const startedAt = Date.now();

  const result = streamText({
    model: ollama(modelName, {
      // Gemma 4 thinking 비활성화 — OllamaChatSettings top-level (options 아님)
      // E2B/E4B 완전 비활성화. 단순 질문에도 내부 reasoning 수백 토큰 생성하던 문제 해결.
      think: false,
      options: {
        num_ctx: 8192,
        num_predict: 500,
        num_keep: 256,
      },
    }),
    system: `${STATIC_SYSTEM_PREFIX}\n\n${dynamicSuffix}`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(2),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // Phase B-1: assistant 메시지에 메타데이터 첨부
    messageMetadata: ({ part }): AIChatMessageMetadata | undefined => {
      if (part.type === "finish") {
        return {
          durationMs: Date.now() - startedAt,
          model: modelName,
          finishReason: part.finishReason,
        };
      }
      return undefined;
    },
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
