// ============================================
// 에이전트 도메인 지식 — 컨설팅 판단 프레임워크
// 시스템 프롬프트에 주입하여 에이전트의 맥락적 판단력 강화
// ============================================

import { SCHOOL_CATEGORY_LABELS } from "@/lib/domains/student-record/constants";

interface DomainKnowledgeContext {
  studentGrade?: number | null;
  schoolCategory?: string | null;
  targetMajor?: string | null;
  curriculumRevision?: string | null;
}

export function buildDomainKnowledgeBlock(ctx: DomainKnowledgeContext): string {
  const sections: string[] = ["\n## 컨설팅 도메인 지식"];

  if (ctx.targetMajor) {
    sections.push(
      `\n> 이 학생의 희망 전공은 **${ctx.targetMajor}**입니다. 모든 분석과 전략 제안에서 이 전공 적합성을 우선 고려하세요.`,
    );
  }

  // ── 핵심 계층: 매 요청 필수 (컴팩트, ~2,500자) ──
  sections.push(buildAdmissionTypeStrategy());        // A. 전형별 전략
  sections.push(buildGradeLevelFramework(ctx.studentGrade)); // B. 학년별 (조건부)
  sections.push(buildUniversityTierExpectations());    // C. 대학 티어
  sections.push(buildEvaluatorPerspective());          // D. 평가자 관점

  // ── 조건부 계층: 학생 프로필에 따라 (~400-800자) ──
  const schoolBlock = buildSchoolTypeContext(ctx.schoolCategory);
  if (schoolBlock) sections.push(schoolBlock);         // E. 학교 유형
  sections.push(buildCurriculumGradingContext(ctx.curriculumRevision)); // J. 교육과정 등급

  // ── 참조 계층: 압축 요약만 포함, 상세는 도구 호출 시 활용 (~800자) ──
  // G/H/I는 이전에 ~3,000자였으나 압축 요약으로 대체
  sections.push(buildCompactReferenceBlock());

  return sections.join("\n");
}

/**
 * G+H+I+F를 ~800자 압축 요약으로 통합.
 * 상세 내용은 도구 호출 결과에서 제공됨.
 */
function buildCompactReferenceBlock(): string {
  return `
### 참조 지식 (상세는 도구 결과 활용)
- **세특 판별**: 최상=자체 설계+정량 데이터+교과 연결, 중="참여함" 수준, 하=교과서 반복
- **전형 선택**: assessExtracurricularStrength(비교과 강도) + analyzeGradeTrend(내신 추이) 결과로 의사결정 트리 적용. 내신 1-2등급+비교과 강함→종합 주력, 3등급+→정시 병행
- **학생 유형**: A.성적우등생(교과 안정+세특 심화) B.활동형(종합 주력+서사 정리) C.과학특화(과기원+SKY) D.만능형(포커싱) E.전환기(성장 서사) F.내신불리(세특 승부+논술)
- **면접**: 서류확인(10분)/제시문(준비8분+면접7분)/MMI(의약학60분)/토론. 충돌 시 합격 가능성>선호도>준비 부담 순
- **면접 기출**: getInterviewQuestionBank로 대학별 실제 기출 조회 가능. 학과별 면접 분야는 getDepartmentInterviewField로 확인`;
}

// ── A. 전형별 전략 ──

/** @verified 2026-03-29 @source 교육부 고시 제2022-33호, 주요 대학 2026학년도 입시요강 */
function buildAdmissionTypeStrategy(): string {
  return `
### 전형별 생기부 전략
- **학생부종합**: 세특 깊이 + 스토리라인 일관성이 핵심. 성적은 기본 충족 수준이면 됨. "왜 이 활동을 했는가"가 드러나야 함
- **학생부교과**: 내신 등급이 절대적. 세특은 면접 소재 수준. 교과 성적 관리가 최우선
- **논술**: 논술 실력 + 수능최저 충족이 핵심. 생기부 비중 낮음
- **정시**: 수능 점수 중심. 생기부는 면접 있는 전형에서만 활용
- **전형 병행**: 올인 금지. 내신 우수→교과 안전망+종합 주력, 비교과 강함→종합 주력+정시 병행`;
}

// ── B. 학년별 접근법 ──

/** @verified 2026-03-29 @source 컨설턴트 실무 경험 기반 */
function buildGradeLevelFramework(grade?: number | null): string {
  if (grade === 1) {
    return `
### 현재 학년 전략: 1학년 (탐색기)
- 다양한 교과·비교과에서 관심 분야를 발견하는 시기
- 기초 역량(학업태도, 성실성) 구축이 우선. 전공 심화보다 폭넓은 탐색 권장
- 진로 방향이 확정되지 않아도 괜찮음. 다양한 활동 경험 자체가 자산
- 이 시기 약점 지적은 최소화하고 가능성과 방향을 제시`;
  }
  if (grade === 2) {
    return `
### 현재 학년 전략: 2학년 (집중기)
- 전공 관련 교과 심화 + 탐구 주제 구체화가 핵심
- 1학년 탐색을 바탕으로 스토리라인 형성. 교과 간 연결고리를 만들어야 함
- 핵심 탐구 활동 1~2개를 깊이 있게 수행. "넓게"보다 "깊게"
- 수시 지원 전형을 구체화하고, 그에 맞는 활동 비중 조정`;
  }
  if (grade === 3) {
    return `
### 현재 학년 전략: 3학년 (완성기)
- 3년 성장 서사를 완결하는 마지막 기회. 남은 시간이 제한적임을 항상 고려
- 1~2학년 활동과의 연결성을 강화하여 일관된 스토리라인 완성
- 약점 보완보다 강점 극대화에 집중 (새로운 역량 개발은 늦음)
- 면접 대비를 병행. 자신의 기록에 대한 깊은 이해 필요`;
  }
  // grade 없으면 압축 버전
  return `
### 학년별 접근법
- **1학년(탐색기)**: 다양성 우선, 기초 역량 구축, 진로 방향 탐색
- **2학년(집중기)**: 전공 연결 심화, 스토리라인 형성, 핵심 탐구 구축
- **3학년(완성기)**: 성장 서사 마무리, 시간 제약 고려, 강점 극대화`;
}

// ── C. 대학 티어별 기대 수준 ──

/** @verified 2026-03-29 @source 주요 대학 입시 결과 + 컨설턴트 경험치 @note 매년 정원조정 시 재검증 필요 */
function buildUniversityTierExpectations(): string {
  return `
### 대학 티어별 기록 기대 수준
- **SKY** (내신 1~2등급대, 종합전형 기준): 교과 간 연결 + 독창적 탐구(자기만의 질문) + 명확한 성장 서사 필수. 단순 참여는 의미 없음
- **상위 서울권** (내신 2~3등급대): 전공적합성 명확 + 2개 이상 깊이 있는 탐구. 스토리라인 일관성 중요
- **서울권** (내신 3~4등급대): 기본 역량 충족 + 주요 활동 1~2건의 구체적 증거
- **지방거점국립** (내신 2~4등급대, 지역 차이 큼): 지역 내 교과 성적 우수 + 기본적인 활동 참여 증거
- ※ 내신 기준은 종합전형 일반 기준이며, 자사고/외고는 1~2등급 상향 보정하여 판단하세요`;
}

// ── D. 평가자(입학사정관) 관점 ──

/** @verified 2026-03-29 @source 한국대학교육협의회 대입전형 공통기준, 서류평가 가이드북 */
function buildEvaluatorPerspective(): string {
  return `
### 입학사정관 평가 관점
- **서류 평가 시간**: 학생당 8~15분. 핵심이 즉시 눈에 띄어야 함
- **Red Flag**: 활동 나열식 기록 | 추상적 성찰("많은 것을 배웠다") | 교과-활동 간 괴리 | 전공 무관 활동 과다
- **Green Flag**: 구체적 산출물(보고서, 발표자료) | 자기주도 심화 과정 | 교과 간 연결 | 실패→극복→성장 서사
- **핵심 질문**: "왜 이 활동을 했는가?"의 답이 기록에서 자연스럽게 드러나는지 확인하세요`;
}

// ── E. 학교 유형별 맥락 ──

/** @verified 2026-03-29 @source 학교유형별 입시 실적 분석 @note 자사고 폐지 정책 변경 시 재검증 필요 */
function buildSchoolTypeContext(category?: string | null): string | null {
  if (!category) return null;

  const label = SCHOOL_CATEGORY_LABELS[category] ?? null;
  if (!label) return null;

  const contextMap: Record<string, string> = {
    general:
      "내신 경쟁이 상대적으로 유리. 교과 선택이 제한적일 수 있으므로 자기주도 탐구 활동으로 차별화 필요",
    autonomous_private:
      "내신 경쟁 치열(상대평가로 불리). 교과 심화·비교과 기회 풍부. 내신 불리를 감안한 학생부종합 전략 필요",
    autonomous_public:
      "내신 경쟁 치열(상대평가로 불리). 교과 심화·비교과 기회 풍부. 내신 불리를 감안한 학생부종합 전략 필요",
    science:
      "R&E 등 연구 활동 풍부, 조기졸업 가능. 과기원(KAIST 등) 별도 전형 고려. 수학·과학 심화 이수가 기본",
    foreign_lang:
      "어학 특화, 인문·사회 계열에 유리. 외국어 역량을 전공(정치외교, 국제학, 통상 등)과 적극 연결하세요. 자연계 전환 시 수학·과학 교과 이수 점검 필수",
    international:
      "글로벌 역량 강점, 인문·사회·국제 계열 유리. 국제적 시각을 전공 탐구와 연결하세요. 자연계 전환 시 교과 이수 점검 필수",
  };

  const detail = contextMap[category];
  if (!detail) return null;

  return `
### 학교 유형 맥락: ${label}
- ${detail}`;
}

// ── J. 교육과정별 등급 체계 ──

/** @verified 2026-03-29 @source 교육부 고시 제2022-33호, 2015 개정교육과정 총론 */
function buildCurriculumGradingContext(curriculum?: string | null): string {
  const is2022 = curriculum?.includes("2022");

  if (is2022) {
    return `
### 교육과정 등급 체계: 2022 개정 (이 학생에 해당)
- **일반선택과목**: 9등급 상대평가 (1~9등급, 기존과 동일)
- **진로선택과목**: 성취평가제 A/B/C (절대평가, 등급 없음)
- **융합선택과목**: 성취평가제 A/B/C (절대평가)
- ⚠️ **핵심 주의**: 진로선택 A등급은 학교마다 A비율이 다름 (10%~40%). 단순히 "A등급"만으로 우수성을 판단하면 안 됨
- **내신 산출 시**: 일반선택 9등급만 정량적으로 비교 가능. 진로선택은 성취도+이수자 수+A비율을 종합 고려
- **대학 반영 방식**: 대학마다 진로선택 A/B/C 반영 방법이 다름. 일부 대학은 A=1등급 환산, 일부는 별도 가산점
- **전략적 함의**: 진로선택 과목은 "A를 받는 것"보다 "어떤 과목을 선택했는가"가 더 중요. 전공 관련 진로선택 이수 자체가 평가 요소`;
  }

  if (curriculum?.includes("2015")) {
    return `
### 교육과정 등급 체계: 2015 개정 (이 학생에 해당)
- **일반선택과목**: 9등급 상대평가
- **진로선택과목**: 3단계 성취평가 (A/B/C) + 석차등급 병기
- **내신 비교**: 일반선택과 진로선택 모두 9등급 상대평가 기반이므로 직접 비교 가능
- **전략적 함의**: 진로선택도 등급이 산출되므로, 전공 관련 진로선택 과목의 등급 관리가 중요`;
  }

  // 교육과정 미지정 시 양쪽 모두 안내
  return `
### 교육과정별 등급 체계 차이 (학생 교육과정 미확인)
- **2015 개정**: 일반선택/진로선택 모두 9등급 상대평가. 직접 비교 가능
- **2022 개정**: 일반선택은 9등급 상대평가, 진로선택/융합선택은 A/B/C 성취평가제(절대평가)
- ⚠️ 2022 학생의 경우 진로선택 A등급은 학교별 A비율이 달라 단순 비교 불가
- 학생의 교육과정을 먼저 확인한 후 등급 해석에 반영하세요`;
}
