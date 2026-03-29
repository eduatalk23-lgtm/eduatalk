/**
 * 면접 기출 + 모집단위별 면접 분야 시드 데이터
 *
 * 서울대 아로리 공식 기출, 전남교육청 면접자료, 각 대학 입시 안내에서 추출
 *
 * 실행: npx tsx scripts/seed-interview-bank.ts
 *       npx tsx scripts/seed-interview-bank.ts --dry-run
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

// ============================================
// 1. 면접 기출 데이터 (서울대/연세대/고려대)
// ============================================

const INTERVIEW_QUESTIONS = [
  // ── 서울대 서류 기반 면접 (지역균형) ──
  {
    university_name: "서울대학교",
    admission_name: "지역균형전형",
    department_category: "물리학과",
    interview_type: "서류확인",
    data_year: 2025,
    question_text: "수업시간에 발표한 '전자기 유도 현상을 이용한 터널 내부 전력 공급과 문제점'에 대해 이야기해 보세요.",
    question_context: "학생부 세특 기반 질문",
    source: "전남교육청 2025학년도 면접자료 정리해DREAM",
  },
  {
    university_name: "서울대학교",
    admission_name: "일반전형",
    department_category: "인문계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "제시문에 나타난 관점의 차이를 비교하고, 각 관점이 사회 현상을 설명하는 방식의 장단점을 논하시오.",
    question_context: "인문학, 사회과학 관련 제시문. 30분 준비 후 15분 구술",
    source: "서울대학교 입학본부 기출문항 공개 (admission.snu.ac.kr)",
  },
  {
    university_name: "서울대학교",
    admission_name: "일반전형",
    department_category: "자연계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "주어진 수학적 조건을 만족하는 함수의 성질을 분석하고, 이를 활용하여 제시된 문제를 풀어보시오.",
    question_context: "수학(자연) 관련 제시문. 45분 준비 후 15분 구술",
    source: "서울대학교 입학본부 기출문항 공개",
  },
  {
    university_name: "서울대학교",
    admission_name: "일반전형",
    department_category: "의예과",
    interview_type: "mmi",
    data_year: 2025,
    question_text: "의료 자원이 제한된 상황에서 환자 치료의 우선순위를 어떻게 결정해야 하는지, 윤리적 관점에서 논하시오.",
    question_context: "상황/제시문 기반 면접. 의과대학 60분 (복수 면접실)",
    source: "서울대 의대 면접 유형 안내",
  },
  // ── 서울대 교직적성·인성면접 ──
  {
    university_name: "서울대학교",
    admission_name: "일반전형",
    department_category: "사범대학",
    interview_type: "서류확인",
    data_year: 2025,
    question_text: "인공지능 시대에 교사의 역할은 어떻게 변화해야 한다고 생각하십니까?",
    question_context: "교직적성·인성면접 제시문 예시",
    source: "서울대 아로리 면접안내",
  },
  {
    university_name: "서울대학교",
    admission_name: "일반전형",
    department_category: "사범대학",
    interview_type: "서류확인",
    data_year: 2025,
    question_text: "유능한 교사가 갖추어야 할 인성적 자질과 역량에는 무엇이 있다고 생각하십니까?",
    question_context: "교직적성·인성면접 제시문 예시",
    source: "서울대 아로리 면접안내",
  },

  // ── 연세대 활동우수형 제시문 면접 ──
  {
    university_name: "연세대학교",
    admission_name: "활동우수형",
    department_category: "인문·통합계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "세상을 바라보는 관점에서 제시문 [가], [나], [다]를 비교하여 설명하시오.",
    question_context: "제시문 숙독 8분 + 면접 7분. 교과서, 대중적 논의, 심리학적 실험에서 발췌",
    answer_guide: "각 제시문의 핵심 관점(경험주의/합리주의/실증주의 등)을 명확히 구분하고, 상호 비교를 통해 차이점과 공통점을 논리적으로 설명",
    source: "연세대학교 면접 예시 문항 공개",
  },
  {
    university_name: "연세대학교",
    admission_name: "활동우수형",
    department_category: "인문·통합계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "제시문 [라]에서 사람이 동물과 다른 전략을 쓰는 이유를 제시문 [다]의 내용과 연관지어 설명하시오.",
    question_context: "제시문 간 연결 분석 능력 평가",
    answer_guide: "인간의 사고방식의 특수성을 [다]의 사회적 현상과 연결하여 설명. 추론 능력과 통합적 사고력 평가",
    source: "연세대학교 면접 예시 문항 공개",
  },

  // ── 고려대 계열적합전형 제시문 면접 ──
  {
    university_name: "고려대학교",
    admission_name: "계열적합전형",
    department_category: "인문계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "제시문에 나타난 두 가지 관점의 차이를 설명하고, 현대 사회에서 어떤 관점이 더 타당한지 자신의 견해를 논리적으로 서술하시오.",
    question_context: "고교 교과 과정 범위 내 인문·사회 제시문",
    answer_guide: "관점 구분 → 논거 제시 → 자신의 주장 논리적 전개. 우수 답변: 반론 예상 및 재반박 포함",
    source: "고려대학교 제시문 기반 면접 안내 영상 (인문계)",
  },
  {
    university_name: "고려대학교",
    admission_name: "계열적합전형",
    department_category: "자연계열",
    interview_type: "제시문",
    data_year: 2025,
    question_text: "주어진 과학적 현상에 대해 제시문의 원리를 적용하여 설명하고, 추가적으로 예측할 수 있는 결과를 논하시오.",
    question_context: "고교 교과 과정 범위 내 수학·과학 제시문",
    answer_guide: "과학적 원리 정확한 적용 → 논리적 추론 → 예측의 타당성. 우수 답변: 실험 설계까지 제안",
    source: "고려대학교 제시문 기반 면접 안내 영상 (자연계)",
  },
];

// ============================================
// 2. 서울대 모집단위별 면접 분야 + 교과이수 권장과목
// ============================================

const DEPARTMENT_INTERVIEW_FIELDS = [
  // 인문대학
  { university_name: "서울대학교", college_name: "인문대학", department_name: "국어국문학과", interview_field: "인문학, 사회과학 관련 제시문 (영어 또는 한자 활용 가능)", interview_duration: "15분 내외", prep_time: "30분 내외" },
  { university_name: "서울대학교", college_name: "인문대학", department_name: "영어영문학과", interview_field: "인문학, 사회과학 관련 제시문 (영어 또는 한자 활용 가능)", interview_duration: "15분 내외", prep_time: "30분 내외" },
  { university_name: "서울대학교", college_name: "인문대학", department_name: "철학과", interview_field: "인문학, 사회과학 관련 제시문 (영어 또는 한자 활용 가능)", interview_duration: "15분 내외", prep_time: "30분 내외" },

  // 사회과학대학
  { university_name: "서울대학교", college_name: "사회과학대학", department_name: "정치외교학부", interview_field: "사회과학, 수학(인문) 관련 제시문", interview_duration: "15분 내외", prep_time: "30분 내외" },
  { university_name: "서울대학교", college_name: "사회과학대학", department_name: "경제학부", interview_field: "사회과학, 수학(인문) 관련 제시문", interview_duration: "15분 내외", prep_time: "30분 내외" },

  // 경영대학
  { university_name: "서울대학교", college_name: "경영대학", department_name: "경영학과", interview_field: "사회과학, 수학(인문) 관련 제시문 (영어 또는 한자 활용 가능)", interview_duration: "15분 내외", prep_time: "30분 내외" },

  // 자연과학대학
  { university_name: "서울대학교", college_name: "자연과학대학", department_name: "수리과학부", interview_field: "수학(자연) 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "자연과학대학", department_name: "물리·천문학부", interview_field: "물리학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "자연과학대학", department_name: "화학부", interview_field: "화학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "자연과학대학", department_name: "생명과학부", interview_field: "생명과학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },

  // 공과대학
  { university_name: "서울대학교", college_name: "공과대학", department_name: "기계공학부", interview_field: "수학(자연), 물리학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "공과대학", department_name: "전기·정보공학부", interview_field: "수학(자연), 물리학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "공과대학", department_name: "컴퓨터공학부", interview_field: "수학(자연) 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "공과대학", department_name: "화학생물공학부", interview_field: "수학(자연), 화학 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },

  // 의과대학
  { university_name: "서울대학교", college_name: "의과대학", department_name: "의예과", interview_field: "상황/제시문 기반 면접 + 서류 기반 면접 (복수 면접실)", interview_duration: "60분 내외", prep_time: "별도 안내" },

  // 사범대학
  { university_name: "서울대학교", college_name: "사범대학", department_name: "수학교육과", interview_field: "수학(자연) 관련 제시문 + 교직적성·인성면접", interview_duration: "15분+15분", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "사범대학", department_name: "물리교육과", interview_field: "물리학 관련 제시문 + 교직적성·인성면접", interview_duration: "15분+15분", prep_time: "45분 내외" },
  { university_name: "서울대학교", college_name: "사범대학", department_name: "화학교육과", interview_field: "화학 관련 제시문 + 교직적성·인성면접", interview_duration: "15분+15분", prep_time: "45분 내외" },

  // 약학대학
  { university_name: "서울대학교", college_name: "약학대학", department_name: "약학계열", interview_field: "수학(자연) 관련 제시문", interview_duration: "15분 내외", prep_time: "45분 내외" },

  // 학부대학
  { university_name: "서울대학교", college_name: "학부대학", department_name: "자유전공학부", interview_field: "인문학 또는 사회과학 또는 수학(자연) — 지원자 선택", interview_duration: "15분 내외", prep_time: "30분/45분" },
];

// ============================================
// 3. Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(`\n[seed] 면접 기출 + 모집단위별 면접 분야 시드`);
  console.log(`[seed] 면접 기출: ${INTERVIEW_QUESTIONS.length}건`);
  console.log(`[seed] 모집단위: ${DEPARTMENT_INTERVIEW_FIELDS.length}건`);
  console.log(`[seed] 모드: ${dryRun ? "DRY-RUN" : "실행"}\n`);

  if (dryRun) {
    console.log("── 면접 기출 ──");
    for (const q of INTERVIEW_QUESTIONS) {
      console.log(`  ${q.university_name} ${q.department_category} (${q.interview_type}): ${q.question_text.slice(0, 60)}...`);
    }
    console.log("\n── 모집단위 면접 분야 ──");
    for (const d of DEPARTMENT_INTERVIEW_FIELDS) {
      console.log(`  ${d.department_name}: ${d.interview_field.slice(0, 50)}... (${d.prep_time})`);
    }
    console.log(`\n[seed] DRY-RUN 완료.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Supabase 환경변수 미설정"); process.exit(1); }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // 면접 기출 INSERT
  let qInserted = 0;
  for (const q of INTERVIEW_QUESTIONS) {
    const { error } = await (supabase.from as Function)("university_interview_bank").insert(q);
    if (error) {
      console.error(`  ✗ ${q.university_name} ${q.department_category}: ${error.message}`);
    } else {
      qInserted++;
    }
  }

  // 모집단위 UPSERT
  let dInserted = 0;
  for (const d of DEPARTMENT_INTERVIEW_FIELDS) {
    const { error } = await (supabase.from as Function)("university_department_interview_fields")
      .upsert(d, { onConflict: "university_name,department_name,data_year" });
    if (error) {
      console.error(`  ✗ ${d.department_name}: ${error.message}`);
    } else {
      dInserted++;
    }
  }

  console.log(`[seed] 완료: 면접 기출 ${qInserted}/${INTERVIEW_QUESTIONS.length}건, 모집단위 ${dInserted}/${DEPARTMENT_INTERVIEW_FIELDS.length}건`);
}

main().catch((e) => { console.error("[seed] 오류:", e); process.exit(1); });
