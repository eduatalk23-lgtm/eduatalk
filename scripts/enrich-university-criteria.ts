/**
 * 대학별 평가 기준 정밀 보강 스크립트
 *
 * PDF 가이드북에서 추출한 정성적 평가 방법론을 DB에 업데이트합니다.
 * collect-university-criteria.ts와 달리 LLM을 사용하지 않고 수동 정리된 데이터를 적재합니다.
 *
 * 실행: npx tsx scripts/enrich-university-criteria.ts
 *       npx tsx scripts/enrich-university-criteria.ts --dry-run
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

// ============================================
// 1. PDF 가이드북에서 추출한 정밀 평가 데이터
// ============================================

interface EnrichmentData {
  universityName: string;
  admissionName: string;
  documentEvalDetails: string;
  evaluationFactors: Record<string, number>;
  interviewDetails: string | null;
}

const ENRICHMENT_DATA: EnrichmentData[] = [
  // ── 서울대학교 ──
  // 출처: 2026학년도 서울대학교 학생부종합전형 안내 가이드북 PDF
  {
    universityName: "서울대학교",
    admissionName: "일반전형",
    documentEvalDetails: `[서류평가 3대 영역]
■ 학업역량: 교과 이수 현황(위계에 따른 과목 선택 노력) + 교과 성취도(정성평가) + 세부능력 및 특기사항(교과별 학습 활동 및 과제 수행) + 창의적 체험활동(학업 관련 동아리, 탐구 활동)
■ 학업태도: 지적 호기심 + 탐구 의지 + 학업에 대한 적극성 및 진취성 + 과목 선택의 적극성 + 진로 탐색 의지. 참조 영역: 교과학습발달상황, 창의적체험활동, 행동특성 및 종합의견
■ 학업외소양: 성품 + 리더십 + 공동체 의식 + 책임감 + 사회구성원으로서의 기여 가능성. 참조 영역: 창의적체험활동(동아리/자율활동), 행동특성, 출결상황

[평가 방식] 다수에 의한 다단계 평가. 전임 입학사정관 1차 평가 → 결과 검토 및 조정 → 위촉 입학사정관 평가 → 최종 평가
[핵심] 수치화된 성적이 아닌 학생의 잠재력과 역량을 종합 정성평가. 고교 유형이나 활동 수보다 내용의 진정성과 충실도 중시`,
    evaluationFactors: { "학업역량": 0.40, "학업태도": 0.30, "학업외소양": 0.30 },
    interviewDetails: "일반전형: 제시문 활용 면접 및 구술고사. 모집단위별 30분/45분 준비 후 15분 내외 면접. 고교 정규 교육과정 범위 내 출제. 지역균형전형: 서류 기반 면접 10분 내외, 제출 서류 확인 + 인성 평가",
  },
  {
    universityName: "서울대학교",
    admissionName: "지역균형전형",
    documentEvalDetails: `[서류평가 3대 영역 — 일반전형과 동일 체계]
■ 학업역량: 교과 이수 현황 + 교과 성취도(정성평가) + 세부능력 및 특기사항 + 창의적 체험활동
■ 학업태도: 지적 호기심 + 탐구 의지 + 적극성 + 과목 선택 적극성 + 진로 탐색 의지
■ 학업외소양: 성품 + 리더십 + 공동체 의식 + 책임감

[지역균형 특이사항] 학교장 추천 필요 (교당 2명 이내). 수능최저학력기준 적용`,
    evaluationFactors: { "학업역량": 0.40, "학업태도": 0.30, "학업외소양": 0.30 },
    interviewDetails: "서류 기반 면접 10분 내외. 제출 서류 내용 확인 + 인성 평가. 제시문 없음",
  },

  // ── 연세대학교 ──
  // 출처: 연세대학교 학생부종합전형 안내서 + 입시 분석 자료
  {
    universityName: "연세대학교",
    admissionName: "활동우수형",
    documentEvalDetails: `[서류평가 3대 역량]
■ 학업역량: 학업 성취도, 학업 태도와 의지, 탐구력
■ 진로역량: 전공 관련 교과 이수 노력, 전공 관련 교과 성취도, 진로 탐색 활동과 경험
■ 공동체역량: 협업과 소통능력, 나눔과 배려, 성실성과 규칙 준수, 리더십

[평가 방식] 1단계 서류 100% (3배수 선발) → 2단계 서류 60% + 면접 40%
[핵심] 교과 성적뿐 아니라 교과 활동 내 심화 탐구 활동이 중요. 희망 전공과 관련된 교과목 적극 이수 + 해당 분야 깊이 있는 탐색 활동`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: "제시문 기반 면접. 제시문 숙독 및 답변 준비 8분 + 면접 7분. 면접관 2인. 논리적 사고력과 의사소통 능력 평가. 고교 교과 과정에서 발췌된 제시문 사용",
  },
  {
    universityName: "연세대학교",
    admissionName: "추천형",
    documentEvalDetails: `[서류평가 — 활동우수형과 동일 3대 역량 체계]
■ 학업역량 + 진로역량 + 공동체역량 종합평가
[특이사항] 학교장 추천 필요. 수능최저학력기준 적용
[핵심] 학교생활기록부 전반의 충실도가 중요. 전공 관련 교과 이수 및 활동으로 전공적합성 입증`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: "서류 기반 면접. 면접관 2인, 수험생 1인. 제출 서류(학교생활기록부) 기반 질의응답",
  },

  // ── 고려대학교 ──
  // 출처: 2026학년도 고려대학교 입학전형시행계획 PDF
  {
    universityName: "고려대학교",
    admissionName: "학업우수전형",
    documentEvalDetails: `[서류평가 — 학생부 종합평가 100%]
■ 학업역량: 교과 성적의 우수성, 전공 관련 교과 이수 및 심화 학습 노력
■ 진로역량: 전공 적합성, 학문적 탐구 노력
■ 공동체역량: 협업, 리더십, 공동체 기여

[평가 방식] 일괄합산 서류 100%
[핵심] 수능최저학력기준 충족이 매우 중요 (인문: 4개 합 7, 자연: 4개 합 8, 의대: 4개 합 5)`,
    evaluationFactors: { "학업역량": 0.40, "진로역량": 0.30, "공동체역량": 0.30 },
    interviewDetails: null,
  },
  {
    universityName: "고려대학교",
    admissionName: "계열적합전형",
    documentEvalDetails: `[서류평가 + 면접]
■ 학업역량: 학업 성취도와 학업 발전 추이
■ 진로역량: 계열 관련 탐구 역량, 교과 이수 노력
■ 공동체역량: 자기주도성, 협업 능력

[평가 방식] 1단계 서류 100% (5배수) → 2단계 서류 60% + 면접 40%
[핵심] 수능최저 없음. 면접이 당락 결정에 중요한 역할`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: "제시문 기반 면접. 계열 관련 학술적 사고력과 논리력 평가",
  },

  // ── 성균관대학교 ──
  {
    universityName: "성균관대학교",
    admissionName: "학과모집",
    documentEvalDetails: `[서류평가 — 학생부 100%]
■ 학업역량: 과목별 성취도, 세부능력 및 특기사항을 통한 학업 역량과 태도
■ 개인역량: 자기 주도적 학습 경험과 성장 과정
■ 잠재역량: 전공(계열) 관련 탐색과 활동 참여

[핵심] 지원 전공에 대한 깊이 있는 탐색과 관련 교과 이수가 중요. 면접 없음`,
    evaluationFactors: { "학업역량": 0.40, "개인역량": 0.30, "잠재역량": 0.30 },
    interviewDetails: null,
  },
  {
    universityName: "성균관대학교",
    admissionName: "계열모집",
    documentEvalDetails: `[서류평가 — 학과모집과 동일 체계]
■ 학업역량 + 개인역량 + 잠재역량 종합평가
[특이사항] 계열(인문/자연) 단위 선발 후 2학년 진입 시 학과 배정`,
    evaluationFactors: { "학업역량": 0.40, "개인역량": 0.30, "잠재역량": 0.30 },
    interviewDetails: null,
  },

  // ── 서강대학교 ──
  // 출처: 2026학년도 서강대 입학가이드북 + 수시모집요강
  {
    universityName: "서강대학교",
    admissionName: "학생부종합(일반)",
    documentEvalDetails: `[서류평가 3대 역량]
■ 학업역량: 학업 성취도 + 학업 태도와 의지 + 탐구력. 교과 이수 현황과 세부능력 및 특기사항 중심
■ 성장역량: 자기주도성 + 경험의 다양성 + 리더십. 학교생활 전반에서의 성장 과정
■ 공동체역량: 협업과 소통 + 나눔과 배려 + 성실성과 규칙 준수

[특이사항] 서강대는 진로(전공) 적합성을 별도 평가요소로 두지 않음. 학업역량과 성장역량에서 간접 평가
[평가 방식] 서류 100% 일괄합산. 면접 없음 (의학부 제외). 수능최저 없음
[핵심] 전공 적합성보다는 학업 깊이와 자기주도적 성장 과정을 중시`,
    evaluationFactors: { "학업역량": 0.40, "성장역량": 0.30, "공동체역량": 0.30 },
    interviewDetails: null,
  },

  // ── 한양대학교 ──
  // 출처: 2026학년도 한양대학교 신입학 전형계획 PDF
  {
    universityName: "한양대학교",
    admissionName: "추천형",
    documentEvalDetails: `[학생부종합평가 — 학생부 기반 종합평가]
■ 학업역량: 학업 성취도, 학업 태도와 의지, 탐구력
■ 진로역량: 전공 관련 교과 이수 노력, 전공 관련 교과 성취도, 진로 탐색 활동과 경험
■ 공동체역량: 협업과 소통능력, 나눔과 배려, 성실성과 규칙준수, 리더십

[특이사항] 학교장 추천 필수 (3학년 재적인원 11%). 수능최저 적용 (3개 등급합 7)
[비판적 사고 역량] 자연계열: 수학/과학 교과 역량 중심, 인문계열: 언어/사회 교과 역량 중심 평가
[핵심] 면접 없음. 학교생활기록부 전반의 충실도가 중요`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: null,
  },
  {
    universityName: "한양대학교",
    admissionName: "일반",
    documentEvalDetails: `[학생부종합평가 — 학생부 기반 종합평가]
■ 학업역량 + 진로역량 + 공동체역량 종합평가 (추천형과 동일 체계)

[특이사항] 학교장 추천 불필요. 수능최저 없음. 면접 없음
[핵심] 교과 성적 정량 수치보다 교과 이수 현황, 세부능력 및 특기사항의 학업 태도와 탐구력 중시`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: null,
  },

  // ── 중앙대학교 ──
  // 출처: 2026학년도 중앙대학교 학생부전형 가이드북 PDF
  {
    universityName: "중앙대학교",
    admissionName: "다빈치형인재",
    documentEvalDetails: `[서류평가 3대 역량]
■ 학업역량: 학업 성취도, 학업 태도와 의지, 탐구력
■ 진로역량: 전공(계열) 관련 활동과 경험
■ 공동체역량: 협업, 나눔과 배려, 성실성, 리더십

[면접평가 요소 — 의학부만 면접]
■ 학업준비도: 교과 기본 개념 이해 및 활용 능력, 주도적 탐구 노력과 성취
■ 전공(계열) 적합성: 전공 관심 및 준비 노력, 진로 탐색 충실도
■ 학교생활충실도: 교내 활동 관심과 참여 노력
■ 의사소통능력 및 인성: 논리적 전개, 문제해결능력, 공동체 태도

[핵심] 의학부 외 서류 100%. 학업과 교내 다양한 활동의 균형적 성장 중시`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: "의학부만 면접. 서류 기반 개별 면접. 학업준비도 + 전공적합성 + 학교생활충실도 + 의사소통/인성 평가",
  },
  {
    universityName: "중앙대학교",
    admissionName: "탐구형인재",
    documentEvalDetails: `[서류평가 — 다빈치형과 동일 3대 역량 체계]
■ 학업역량 + 진로역량 + 공동체역량 종합평가

[특이사항] 전 모집단위 면접 실시 (1단계 서류 100%, 2단계 서류 70% + 면접 30%)
[면접] 학업준비도, 전공적합성, 학교생활충실도, 의사소통 및 인성 평가
[핵심] 탐구 활동의 깊이와 전공 관련성이 다빈치형보다 더 중시됨`,
    evaluationFactors: { "학업역량": 0.30, "진로역량": 0.40, "공동체역량": 0.30 },
    interviewDetails: "1단계 서류 100% (3.5배수) → 2단계 서류 70% + 면접 30%. 서류 기반 개별 면접",
  },

  // ── 경희대학교 ──
  // 출처: 2026학년도 경희대 수시모집요강 + 학종 가이드
  {
    universityName: "경희대학교",
    admissionName: "네오르네상스",
    documentEvalDetails: `[서류평가 3대 역량]
■ 학업역량: 학업 성취도, 학업 태도와 의지, 탐구력
■ 진로역량: 전공(계열) 관련 활동과 경험, 전공 관련 교과 이수 노력
■ 공동체역량: 협업, 나눔, 리더십, 성실성

[특이사항] 자유전공학부는 진로역량 대신 '자기주도역량' 평가
[평가 방식] 1단계 서류 100% (3배수) → 2단계 서류 70% + 면접 30%
[핵심] 문화인·세계인·창조인 인재상. 교내 활동의 균형적 참여 중시`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: "서류 기반 개별 면접. 인성, 전공적합성, 발전가능성 종합 평가",
  },

  // ── 이화여자대학교 ──
  // 출처: 2026학년도 이화여대 학생부위주전형 안내서 PDF (정확한 비율 확인)
  {
    universityName: "이화여자대학교",
    admissionName: "미래인재",
    documentEvalDetails: `[서류평가 3대 역량 — 서류형/면접형 비율 차이]
■ 학업역량: 교과 성취도, 학업 태도와 의지, 탐구력
■ 학교활동의 우수성: 지식탐구역량, 창의융합역량, 공존공감역량
■ 발전가능성: 자기주도성, 경험의 다양성, 리더십

[서류형 평가 비율] 학업역량 30% + 학교활동의 우수성 40% + 발전가능성 30%
[면접형 서류 비율] 학업역량 20% + 학교활동의 우수성 60% + 발전가능성 20%
[면접형 면접] 학업역량 + 진로역량 + 발전가능성 종합 평가

[핵심] 서류형은 학교활동 우수성 비중이 40%로 높음. 면접형은 60%로 더 높음 — 교내 활동 실적이 강한 학생에게 유리`,
    evaluationFactors: { "학업역량": 0.30, "학교활동의우수성": 0.40, "발전가능성": 0.30 },
    interviewDetails: "면접형: 1단계 서류 100% (5배수) → 2단계 서류 70% + 면접 30%. 서류 기반 일반면접",
  },

  // ── 한국외국어대학교 ──
  // 출처: 2026학년도 한국외대 수시모집요강 + 학종 가이드
  {
    universityName: "한국외국어대학교",
    admissionName: "학생부종합(일반)",
    documentEvalDetails: `[서류평가 3대 역량]
■ 학업역량: 학업 성취도, 학업 태도와 의지, 탐구력
■ 진로역량: 전공 관련 교과 이수 노력과 성취, 진로 탐색 활동과 경험
■ 공동체역량: 협업, 소통, 나눔, 성실성, 리더십

[특이사항] 서류 100% 일괄합산. 면접 없음. 수능최저 없음
[핵심] 글로벌 역량과 어학 관련 활동이 차별화 요소. 전공 분야 관련 교과 이수와 탐구 활동 중시`,
    evaluationFactors: { "학업역량": 0.35, "진로역량": 0.35, "공동체역량": 0.30 },
    interviewDetails: null,
  },
];

// ============================================
// 2. DB 업데이트
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(`\n[enrich] 대학별 평가 기준 정밀 보강`);
  console.log(`[enrich] 대상: ${ENRICHMENT_DATA.length}건`);
  console.log(`[enrich] 모드: ${dryRun ? "DRY-RUN" : "실행"}\n`);

  for (const item of ENRICHMENT_DATA) {
    console.log(`  ${item.universityName} — ${item.admissionName}`);
    console.log(`    평가요소: ${JSON.stringify(item.evaluationFactors)}`);
    console.log(`    면접: ${item.interviewDetails?.slice(0, 60) ?? "없음"}`);
    console.log(`    서류평가: ${item.documentEvalDetails.slice(0, 80)}...`);
  }

  if (dryRun) {
    console.log(`\n[enrich] DRY-RUN 완료. --dry-run 제거 후 재실행하세요.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[enrich] Supabase 환경변수 미설정");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let updated = 0;
  let errors = 0;

  for (const item of ENRICHMENT_DATA) {
    const { error } = await (supabase.from as Function)("university_evaluation_criteria")
      .update({
        document_eval_details: item.documentEvalDetails,
        evaluation_factors: item.evaluationFactors,
        interview_details: item.interviewDetails,
      })
      .eq("university_name", item.universityName)
      .eq("admission_name", item.admissionName)
      .eq("data_year", 2026);

    if (error) {
      console.error(`  ✗ ${item.universityName} ${item.admissionName}: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${item.universityName} ${item.admissionName} 업데이트 완료`);
      updated++;
    }
  }

  console.log(`\n[enrich] 완료: ${updated}건 업데이트, ${errors}건 실패`);
}

main().catch((error) => {
  console.error("[enrich] 실행 오류:", error);
  process.exit(1);
});
