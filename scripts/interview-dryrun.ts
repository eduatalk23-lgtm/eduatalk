#!/usr/bin/env npx tsx
/**
 * α5 면접 모듈 dry-run CLI (Sprint 2.5, 2026-04-20)
 *
 * 학생 + root_question_id 를 받아 모의 면접 세션을 E2E 실행:
 *   1) startInterviewSession (depth=1 root chain 생성)
 *   2) appendFollowupChainRuleV1 × 4 (depth 2~5)
 *   3) 각 chain 에 sample answer 주입 (CLI 인자 또는 자동 샘플)
 *   4) analyzeAnswerRuleV1Action 호출
 *   5) completeSession → score_summary 출력
 *
 * DB 쓰기 O (interview_sessions/chains/answers).
 * LLM 호출 없음 (rule_v1 전용).
 *
 * 사용법:
 *   npx tsx scripts/interview-dryrun.ts --student=<uuid> --root=<question_id>
 *   npx tsx scripts/interview-dryrun.ts --student=<uuid> --root=<question_id> --answer-style=vague
 *
 * 옵션:
 *   --answer-style=specific (기본) | vague | mixed
 *
 * 환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createSupabaseAdminClient } from "../lib/supabase/admin";

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

const studentId = arg("student");
const rootQuestionId = arg("root");
const answerStyle = (arg("answer-style") ?? "specific").toLowerCase();

if (!studentId || !rootQuestionId) {
  console.error(
    "[interview-dryrun] 필수 인자: --student=<uuid> --root=<question_id>",
  );
  process.exit(1);
}

const SAMPLE_ANSWERS: Record<"specific" | "vague" | "mixed", string[]> = {
  specific: [
    "저는 이 실험을 시작할 때 변인 통제가 가장 어려웠습니다. 특히 온도 변화가 예상보다 컸고, 재측정 3번 중 2번 값이 달랐습니다.",
    "결과가 예상과 달랐던 이유는 측정 순서 때문이었습니다. 실험 동안 온도계가 직사광선에 노출된 사실을 뒤늦게 알았거든요.",
    "다시 한다면 온도계 위치를 먼저 고정하고 주변 조도를 통제하겠습니다. 이 판단은 기록지의 이상값 분포에서 나왔습니다.",
    "그 경험이 지금 물리학 진로에 결정적이었습니다. 설계 과정 자체에서 재미를 느꼈고, 대학원 실험실 탐방으로 이어졌습니다.",
    "후속 활동으로는 데이터 편향을 주제로 탐구 노트를 작성하고, 교내 과학 동아리 발표로 확장할 계획입니다.",
  ],
  vague: [
    "다양한 것들을 배웠고 매우 의미 있는 경험이었습니다.",
    "여러 가지 결과가 있었고 그 이유도 다양했습니다.",
    "다양한 방법으로 다시 할 수 있을 것 같습니다.",
    "이 경험이 진로에 여러 측면에서 매우 도움이 되었습니다.",
    "후속으로 다양하고 폭넓은 활동을 계획하고 있습니다.",
  ],
  mixed: [
    "저는 변인 통제에서 재측정 3번 중 2번이 달랐습니다.",
    "여러 가지 이유로 결과가 달랐던 것 같습니다.",
    "다시 한다면 기록지 정리를 더 꼼꼼히 하겠습니다.",
    "이 경험은 다양한 측면에서 매우 의미 있었습니다.",
    "후속 활동으로 교내 동아리 발표를 준비 중입니다.",
  ],
};

async function main(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[interview-dryrun] admin client 생성 실패 (env 누락)");
    process.exit(1);
  }
  if (!["specific", "vague", "mixed"].includes(answerStyle)) {
    console.error(`[interview-dryrun] --answer-style 오류: ${answerStyle}`);
    process.exit(1);
  }
  const answers = SAMPLE_ANSWERS[answerStyle as "specific" | "vague" | "mixed"];

  // 학생 + tenant 검증
  const { data: student } = await supabase
    .from("students")
    .select("id, tenant_id, grade, school_name")
    .eq("id", studentId!)
    .maybeSingle();
  if (!student) {
    console.error(`[interview-dryrun] 학생 없음: ${studentId}`);
    process.exit(1);
  }

  const { data: rootQ } = await supabase
    .from("student_record_interview_questions")
    .select("id, question, question_type")
    .eq("id", rootQuestionId!)
    .eq("student_id", student.id)
    .eq("tenant_id", student.tenant_id)
    .maybeSingle();
  if (!rootQ) {
    console.error(
      `[interview-dryrun] root 질문 없음 또는 학생/tenant 불일치: ${rootQuestionId}`,
    );
    process.exit(1);
  }

  console.log(
    `\n[interview-dryrun] 대상 학생=${student.id.slice(0, 8)} grade=${student.grade} school=${student.school_name}`,
  );
  console.log(`  root question: "${rootQ.question}"`);
  console.log(`  question_type: ${rootQ.question_type}`);
  console.log(`  answer style: ${answerStyle}`);
  console.log("─".repeat(70));

  // ─── dynamic import (tsx + dev 환경에서 Next 모듈 그래프 로드 회피) ──
  const [
    { insertSession, insertChain, findChain, findSessionChains, findSession, upsertAnswer, updateAnswerAnalysis, updateSessionStatus, findAnswersBySession },
    { analyzeAnswerRuleV1, buildFollowupChainRuleV1, aggregateSessionScore },
  ] = await Promise.all([
    import("../lib/domains/student-record/repository/interview-repository"),
    import("../lib/domains/student-record/state/interview-followup"),
  ]);

  // 1) session 시작
  const sessionId = await insertSession(
    {
      tenantId: student.tenant_id,
      studentId: student.id,
      scenario: {
        targetMajor: null,
        targetUniversityLevel: null,
        focus: null,
      },
      status: "in_progress",
    },
    supabase,
  );
  console.log(`\n1. 세션 생성: ${sessionId}`);

  // 2) depth=1 root chain
  const rootChainId = await insertChain(
    {
      sessionId,
      rootQuestionId: rootQ.id,
      parentChainId: null,
      depth: 1,
      questionText: rootQ.question,
      expectedHook: null,
      generatedBy: "seed",
    },
    supabase,
  );
  console.log(`   depth=1 root chain: ${rootChainId.slice(0, 8)}`);

  let parentId = rootChainId;
  const chainIds: string[] = [rootChainId];

  // 3) depth 2~5 follow-ups
  for (let i = 2; i <= 5; i++) {
    const parentChain = await findChain(parentId, supabase);
    const existing = await findSessionChains(sessionId, supabase);
    if (!parentChain) throw new Error("parent 복구 실패");
    const next = buildFollowupChainRuleV1({
      existingChains: existing,
      parentChain,
    });
    if (!next || next.terminal) {
      console.log(`   depth=${i} terminal 도달`);
      break;
    }
    const newId = await insertChain(
      {
        sessionId,
        rootQuestionId: rootQ.id,
        parentChainId: parentChain.id,
        depth: next.depth,
        questionText: next.questionText,
        expectedHook: next.expectedHook,
        generatedBy: "seed",
      },
      supabase,
    );
    console.log(`   depth=${i} [${next.slug}] chain ${newId.slice(0, 8)}`);
    console.log(`     Q: ${next.questionText}`);
    chainIds.push(newId);
    parentId = newId;
  }

  // 4) 각 chain 에 답변 주입 + 분석
  console.log(`\n2. 답변 제출 + 규칙 분석`);
  for (const [idx, cid] of chainIds.entries()) {
    const answerText = answers[idx] ?? answers[answers.length - 1];
    const answerId = await upsertAnswer(
      { chainId: cid, answerText },
      supabase,
    );
    const chain = await findChain(cid, supabase);
    // 간단한 evidence: root 질문 본문 자체를 증거로 사용 (Sprint 2 정책과 동일)
    const evidence = [
      { recordId: `root:${rootQ.id}`, summary: rootQ.question },
    ];
    const analysis = analyzeAnswerRuleV1({
      questionText: chain?.questionText ?? "",
      expectedHook: chain?.expectedHook ?? null,
      answerText,
      evidenceRefs: evidence,
    });
    await updateAnswerAnalysis(answerId, analysis, supabase);
    console.log(
      `   depth=${idx + 1} answer=${answerId.slice(0, 8)} consistency=${analysis.consistencyScore} authenticity=${analysis.authenticityScore} ai=${JSON.stringify(analysis.aiSignals)} gaps=${analysis.gapFindings.length}`,
    );
    if (analysis.gapFindings.length > 0) {
      for (const g of analysis.gapFindings) {
        console.log(`     ⚠ ${g.kind}: ${g.summary}`);
      }
    }
    console.log(`     coach: ${analysis.coachComment}`);
  }

  // 5) complete session + score summary
  const answersRows = await findAnswersBySession(sessionId, supabase);
  const analyzed = answersRows.flatMap((a) =>
    a.analysis
      ? [
          {
            consistencyScore: a.analysis.consistencyScore,
            authenticityScore: a.analysis.authenticityScore,
            aiSignals: a.analysis.aiSignals,
            gapFindings: a.analysis.gapFindings,
          },
        ]
      : [],
  );
  const summary = aggregateSessionScore({ answers: analyzed });
  await updateSessionStatus(sessionId, "completed", summary, supabase);

  const session = await findSession(sessionId, supabase);
  console.log(`\n3. 세션 종료 — status=${session?.status}`);
  console.log(
    `   avgConsistency=${summary.avgConsistency} / avgAuthenticity=${summary.avgAuthenticity}`,
  );
  console.log(
    `   gapCount=${summary.gapCount} / aiSuspicion=${summary.aiSuspicionLevel}`,
  );
  console.log(`\n✓ 세션 완료: ${sessionId}`);
}

main().catch((err) => {
  console.error(
    `[interview-dryrun] 치명적 에러: ${err instanceof Error ? err.stack : err}`,
  );
  process.exit(1);
});
