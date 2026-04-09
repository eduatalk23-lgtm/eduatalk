/**
 * Gemini 2.5 Pro vs Claude Sonnet — 세특 역량 분석 시뮬레이션
 *
 * 김세린 학생의 물리학I 세특 레코드 1건을 동일 프롬프트로 분석하여
 * 추론 결과와 소요시간을 비교합니다.
 *
 * Usage: npx tsx scripts/test-gemini-vs-sonnet.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
} from "@/lib/domains/record-analysis/llm/prompts/competencyHighlight";

// ─── 김세린 물리학I 세특 (2학년 1학기) ───
const SETEK_CONTENT = `세심하고 성실한 태도로 학습에 임하며, 우수한 학업 성취를 꾸준히 유지하는 학생임. 수업 중 진행된 자율 탐구 활동에서 열역학 법칙을 배우면서 엔트로피가 확률적으로 설명될 수 있다는 점에 흥미를 느껴 관련 탐구를 수행함. 이 탐구를 통해 엔트로피가 단순히 무질서의 개념을 넘어, 물리학적으로 가능한 미시 상태의 수에 대한 통계적 개념임을 설명함. 나아가 광통신에 대하여 학습하며 고속 멀티미디어 콘텐츠 전송 원리에 호기심을 느껴 추가 탐구를 진행함. 탐구에서 고속 멀티미디어 전송이 파동의 주파수와 한 번에 전달할 수 있는 정보량, 그리고 광섬유에서의 전반사 현상과 같은 복합적인 물리학적 원리를 바탕으로 구현되는 복합적인 기술임을 설명함. 더 나아가 심화 탐구를 하기 위해 '세상을 바꾼 물리학'(원정현)을 읽고 독서보고서를 작성함. 독서보고서에서 교과서에서 다루지 않는 빛의 성질과 전자기 이론의 역사적 발전에 대해 알아보고자 하였음. 또한, 파동의 원리에 대해 학습하면서 일반적인 파동과 물질파에서의 속도와 파장의 관계 차이점에 대해 궁금증을 가지고 스스로 탐구하여 보고서를 제출함. 이처럼 학습에 대한 열의가 뛰어나 호기심을 과학적 탐구로 연결하는 탁월한 모습을 보여주었음.`;

const SUBJECT_NAME = "물리학I";
const GRADE = 2;
const TARGET_MAJOR = "물리·천문";

// ─── 실제 성적 데이터 (student_internal_scores 기반) ───
const TAKEN_SUBJECTS = [
  "국어", "수학", "영어", "정보", "통합과학", "통합사회", "한국사",
  "빅 히스토리", "문학", "물리학I", "생명과학I", "수학I", "수학II",
  "언어와 매체", "영어Ⅰ", "영어Ⅱ", "일본어Ⅰ", "지구과학I",
  "화법과 작문", "기하", "데이터과학과 머신러닝", "인공지능 기초",
];

const RELEVANT_SCORES = [
  { subjectName: "국어", rankGrade: 1 },
  { subjectName: "수학", rankGrade: 1 },
  { subjectName: "영어", rankGrade: 1 },
  { subjectName: "정보", rankGrade: 1 },
  { subjectName: "통합과학", rankGrade: 1 },
  { subjectName: "통합사회", rankGrade: 2 },
  { subjectName: "한국사", rankGrade: 1 },
  { subjectName: "문학", rankGrade: 1 },
  { subjectName: "물리학I", rankGrade: 2 },
  { subjectName: "생명과학I", rankGrade: 2 },
  { subjectName: "수학I", rankGrade: 2 },
  { subjectName: "수학II", rankGrade: 1 },
  { subjectName: "언어와 매체", rankGrade: 1 },
  { subjectName: "영어Ⅰ", rankGrade: 2 },
  { subjectName: "영어Ⅱ", rankGrade: 1 },
  { subjectName: "일본어Ⅰ", rankGrade: 2 },
  { subjectName: "지구과학I", rankGrade: 1 },
  { subjectName: "화법과 작문", rankGrade: 2 },
];

const GRADE_TREND = [
  { grade: 1, semester: 1, subjectName: "국어", rankGrade: 1 },
  { grade: 1, semester: 1, subjectName: "수학", rankGrade: 1 },
  { grade: 1, semester: 1, subjectName: "영어", rankGrade: 1 },
  { grade: 1, semester: 1, subjectName: "정보", rankGrade: 1 },
  { grade: 1, semester: 1, subjectName: "통합과학", rankGrade: 1 },
  { grade: 1, semester: 1, subjectName: "통합사회", rankGrade: 2 },
  { grade: 1, semester: 1, subjectName: "한국사", rankGrade: 1 },
  { grade: 1, semester: 2, subjectName: "국어", rankGrade: 1 },
  { grade: 1, semester: 2, subjectName: "수학", rankGrade: 1 },
  { grade: 1, semester: 2, subjectName: "영어", rankGrade: 2 },
  { grade: 1, semester: 2, subjectName: "정보", rankGrade: 1 },
  { grade: 1, semester: 2, subjectName: "통합과학", rankGrade: 2 },
  { grade: 1, semester: 2, subjectName: "통합사회", rankGrade: 1 },
  { grade: 1, semester: 2, subjectName: "한국사", rankGrade: 1 },
  { grade: 2, semester: 1, subjectName: "문학", rankGrade: 1 },
  { grade: 2, semester: 1, subjectName: "물리학I", rankGrade: 2 },
  { grade: 2, semester: 1, subjectName: "생명과학I", rankGrade: 2 },
  { grade: 2, semester: 1, subjectName: "수학I", rankGrade: 2 },
  { grade: 2, semester: 1, subjectName: "언어와 매체", rankGrade: 1 },
  { grade: 2, semester: 1, subjectName: "영어Ⅰ", rankGrade: 2 },
  { grade: 2, semester: 1, subjectName: "일본어Ⅰ", rankGrade: 2 },
  { grade: 2, semester: 1, subjectName: "지구과학I", rankGrade: 1 },
  { grade: 2, semester: 1, subjectName: "화법과 작문", rankGrade: 2 },
  { grade: 2, semester: 2, subjectName: "문학", rankGrade: 3 },
  { grade: 2, semester: 2, subjectName: "물리학I", rankGrade: 2 },
  { grade: 2, semester: 2, subjectName: "생명과학I", rankGrade: 2 },
  { grade: 2, semester: 2, subjectName: "수학II", rankGrade: 1 },
  { grade: 2, semester: 2, subjectName: "언어와 매체", rankGrade: 2 },
  { grade: 2, semester: 2, subjectName: "영어Ⅱ", rankGrade: 1 },
  { grade: 2, semester: 2, subjectName: "일본어Ⅰ", rankGrade: 3 },
  { grade: 2, semester: 2, subjectName: "지구과학I", rankGrade: 1 },
  { grade: 2, semester: 2, subjectName: "화법과 작문", rankGrade: 2 },
];

// ─── 프롬프트 빌드 (실제 성적 데이터 포함) ───
const userPrompt = buildHighlightUserPrompt({
  recordType: "setek",
  content: SETEK_CONTENT,
  subjectName: SUBJECT_NAME,
  grade: GRADE,
  careerContext: {
    targetMajor: TARGET_MAJOR,
    takenSubjects: TAKEN_SUBJECTS,
    relevantScores: RELEVANT_SCORES,
    gradeTrend: GRADE_TREND,
  },
});

// ─── 결과 파싱 헬퍼 ───
function extractJsonFromText(text: string): unknown {
  // ```json ... ``` 블록 추출 또는 전체 파싱
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/);
  const raw = jsonBlock ? jsonBlock[1].trim() : text.trim();
  return JSON.parse(raw);
}

interface CompetencyGradeEntry {
  item: string;
  grade: string;
  reasoning: string;
}

interface ContentQuality {
  specificity: number;
  coherence: number;
  depth: number;
  grammar: number;
  scientificValidity: number;
  overallScore: number;
  issues: string[];
  feedback: string;
}

interface AnalysisResult {
  sections: Array<{
    sectionType: string;
    tags: Array<{
      competencyItem: string;
      evaluation: string;
      highlight: string;
      reasoning: string;
    }>;
  }>;
  competencyGrades: CompetencyGradeEntry[];
  summary: string;
  contentQuality?: ContentQuality;
}

// ─── 모델별 호출 ───
async function runGemini(): Promise<{ result: AnalysisResult; elapsed: number; tokenUsage: string }> {
  const start = Date.now();
  const response = await generateText({
    model: google("gemini-2.5-pro"),
    system: HIGHLIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.3,
    maxTokens: 16384,
  });
  const elapsed = Date.now() - start;
  const parsed = extractJsonFromText(response.text) as AnalysisResult;
  const usage = response.usage;
  const tokenUsage = `prompt=${usage?.promptTokens ?? "?"}, completion=${usage?.completionTokens ?? "?"}, total=${usage?.totalTokens ?? "?"}`;
  return { result: parsed, elapsed, tokenUsage };
}

async function runSonnet(): Promise<{ result: AnalysisResult; elapsed: number; tokenUsage: string }> {
  const start = Date.now();
  const response = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: HIGHLIGHT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    temperature: 0.3,
    maxTokens: 16384,
  });
  const elapsed = Date.now() - start;
  const parsed = extractJsonFromText(response.text) as AnalysisResult;
  const usage = response.usage;
  const tokenUsage = `prompt=${usage?.promptTokens ?? "?"}, completion=${usage?.completionTokens ?? "?"}, total=${usage?.totalTokens ?? "?"}`;
  return { result: parsed, elapsed, tokenUsage };
}

// ─── 결과 비교 출력 ───
function printGrades(label: string, grades: CompetencyGradeEntry[]) {
  console.log(`\n  [${label} 역량 등급]`);
  const gradeOrder = ["A+", "A-", "B+", "B", "B-", "C"];
  const sorted = [...grades].sort(
    (a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade),
  );
  for (const g of sorted) {
    console.log(`    ${g.item.padEnd(28)} ${g.grade.padEnd(4)} ${g.reasoning}`);
  }
}

function printQuality(label: string, q?: ContentQuality) {
  if (!q) {
    console.log(`\n  [${label} 품질 점수] — 없음`);
    return;
  }
  console.log(`\n  [${label} 품질 점수]`);
  console.log(`    specificity=${q.specificity}  coherence=${q.coherence}  depth=${q.depth}  grammar=${q.grammar}  scientificValidity=${q.scientificValidity}`);
  console.log(`    overallScore=${q.overallScore}`);
  if (q.issues?.length) console.log(`    issues: ${q.issues.join(", ")}`);
  if (q.feedback) console.log(`    feedback: ${q.feedback}`);
}

function countTags(result: AnalysisResult): number {
  return result.sections.reduce((sum, s) => sum + s.tags.length, 0);
}

// ─── 메인 ───
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Gemini 2.5 Pro vs Claude Sonnet — 세특 역량 분석 시뮬레이션");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`학생: 김세린 | 과목: ${SUBJECT_NAME} | 학년: ${GRADE} | 전공: ${TARGET_MAJOR}`);
  console.log(`세특 길이: ${SETEK_CONTENT.length}자\n`);

  // 순차 실행 (rate limit 방지)
  console.log("▶ Gemini 2.5 Pro 호출 중...");
  let geminiResult: Awaited<ReturnType<typeof runGemini>> | null = null;
  let geminiError: string | null = null;
  try {
    geminiResult = await runGemini();
    console.log(`  ✓ 완료: ${(geminiResult.elapsed / 1000).toFixed(1)}초`);
  } catch (err) {
    geminiError = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ 실패: ${geminiError.slice(0, 200)}`);
  }

  console.log("\n▶ Claude Sonnet 호출 중...");
  let sonnetResult: Awaited<ReturnType<typeof runSonnet>> | null = null;
  let sonnetError: string | null = null;
  try {
    sonnetResult = await runSonnet();
    console.log(`  ✓ 완료: ${(sonnetResult.elapsed / 1000).toFixed(1)}초`);
  } catch (err) {
    sonnetError = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ 실패: ${sonnetError.slice(0, 200)}`);
  }

  // ─── 비교 리포트 ───
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  비교 결과");
  console.log("═══════════════════════════════════════════════════════════════");

  // 소요 시간
  console.log("\n📊 소요 시간");
  if (geminiResult) console.log(`  Gemini 2.5 Pro : ${(geminiResult.elapsed / 1000).toFixed(1)}초  (${geminiResult.tokenUsage})`);
  else console.log(`  Gemini 2.5 Pro : 실패 — ${geminiError?.slice(0, 100)}`);
  if (sonnetResult) console.log(`  Claude Sonnet  : ${(sonnetResult.elapsed / 1000).toFixed(1)}초  (${sonnetResult.tokenUsage})`);
  else console.log(`  Claude Sonnet  : 실패 — ${sonnetError?.slice(0, 100)}`);

  if (geminiResult && sonnetResult) {
    const faster = geminiResult.elapsed < sonnetResult.elapsed ? "Gemini" : "Sonnet";
    const ratio = Math.max(geminiResult.elapsed, sonnetResult.elapsed) / Math.min(geminiResult.elapsed, sonnetResult.elapsed);
    console.log(`  → ${faster}가 ${ratio.toFixed(1)}배 빠름`);
  }

  // 태그 수
  console.log("\n📊 태그 커버리지");
  if (geminiResult) console.log(`  Gemini : ${countTags(geminiResult.result)}개 태그, ${geminiResult.result.sections.length}개 섹션`);
  if (sonnetResult) console.log(`  Sonnet : ${countTags(sonnetResult.result)}개 태그, ${sonnetResult.result.sections.length}개 섹션`);

  // 역량 등급 비교
  if (geminiResult) printGrades("Gemini", geminiResult.result.competencyGrades);
  if (sonnetResult) printGrades("Sonnet", sonnetResult.result.competencyGrades);

  // 등급 차이 분석
  if (geminiResult && sonnetResult) {
    console.log("\n📊 등급 차이 분석");
    const gradeToNum: Record<string, number> = { "A+": 6, "A-": 5, "B+": 4, "B": 3, "B-": 2, "C": 1 };
    const geminiMap = new Map(geminiResult.result.competencyGrades.map((g) => [g.item, g.grade]));
    const sonnetMap = new Map(sonnetResult.result.competencyGrades.map((g) => [g.item, g.grade]));
    const allItems = new Set([...geminiMap.keys(), ...sonnetMap.keys()]);
    let diffs = 0;
    for (const item of allItems) {
      const gGrade = geminiMap.get(item) ?? "-";
      const sGrade = sonnetMap.get(item) ?? "-";
      if (gGrade !== sGrade) {
        diffs++;
        const gNum = gradeToNum[gGrade] ?? 0;
        const sNum = gradeToNum[sGrade] ?? 0;
        const arrow = gNum > sNum ? "Gemini↑" : gNum < sNum ? "Sonnet↑" : "=";
        console.log(`    ${item.padEnd(28)} Gemini=${gGrade.padEnd(4)} Sonnet=${sGrade.padEnd(4)} ${arrow}`);
      }
    }
    if (diffs === 0) console.log("    모든 등급 동일!");
    else console.log(`    → ${diffs}/${allItems.size}개 항목에서 등급 차이`);
  }

  // 품질 점수
  if (geminiResult) printQuality("Gemini", geminiResult.result.contentQuality);
  if (sonnetResult) printQuality("Sonnet", sonnetResult.result.contentQuality);

  // Summary
  console.log("\n📊 요약");
  if (geminiResult) console.log(`  Gemini: ${geminiResult.result.summary}`);
  if (sonnetResult) console.log(`  Sonnet: ${sonnetResult.result.summary}`);

  // 18건 추정
  console.log("\n\n═══════════════════════════════════════════════════════════════");
  console.log("  18건 전체 실행 시간 추정 (동시성 3)");
  console.log("═══════════════════════════════════════════════════════════════");
  if (geminiResult) {
    const perRecord = geminiResult.elapsed / 1000;
    const rounds = Math.ceil(18 / 3);
    console.log(`  Gemini : ${perRecord.toFixed(1)}초/건 × 6라운드 = ~${Math.ceil(perRecord * rounds)}초 (${(perRecord * rounds / 60).toFixed(1)}분)`);
  }
  if (sonnetResult) {
    const perRecord = sonnetResult.elapsed / 1000;
    const rounds = Math.ceil(18 / 3);
    console.log(`  Sonnet : ${perRecord.toFixed(1)}초/건 × 6라운드 = ~${Math.ceil(perRecord * rounds)}초 (${(perRecord * rounds / 60).toFixed(1)}분)`);
  }

  console.log("\n완료.");
}

main().catch(console.error);
