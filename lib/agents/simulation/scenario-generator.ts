// ============================================
// 시나리오 생성기
// 현실적인 학생 프로필 + 컨설턴트 질문 생성
// ============================================

import type { SimulationScenario, ScenarioPreset } from "./types";

/**
 * 시뮬레이션 시나리오 목록 반환.
 * 실제 입시 컨설팅에서 자주 발생하는 상황을 체계적으로 커버.
 */
export function getScenarios(preset: ScenarioPreset): SimulationScenario[] {
  const all = [...BASIC_SCENARIOS, ...EDGE_CASE_SCENARIOS, ...ADMISSION_SCENARIOS, ...INTERVIEW_SCENARIOS];

  switch (preset) {
    case "basic": return BASIC_SCENARIOS;
    case "edge-cases": return EDGE_CASE_SCENARIOS;
    case "admission": return ADMISSION_SCENARIOS;
    case "interview": return INTERVIEW_SCENARIOS;
    case "all": return all;
  }
}

// ── 기본 상담 시나리오 ──

const BASIC_SCENARIOS: SimulationScenario[] = [
  {
    id: "basic-1",
    difficulty: "basic",
    category: "진단",
    studentProfile: {
      name: "시뮬레이션_학생A",
      grade: 2,
      schoolCategory: "general",
      schoolName: "서울고등학교",
      targetMajor: "경영학",
      curriculumRevision: "2022 개정",
      gpa: "2.5등급",
      strengths: ["수학 성적 우수", "경제 동아리 활동"],
      weaknesses: ["영어 성적 하락 추세", "세특 기록 빈약"],
      context: "2학년 2학기, 종합전형 준비 중",
    },
    consultantQuestion: "이 학생의 생기부를 전체적으로 진단해주세요. 강점과 약점, 그리고 앞으로의 전략을 알려주세요.",
    expectedFocus: ["내신 추이 분석", "세특 보강 전략", "전공적합성 평가"],
  },
  {
    id: "basic-2",
    difficulty: "basic",
    category: "전략",
    studentProfile: {
      name: "시뮬레이션_학생B",
      grade: 1,
      schoolCategory: "general",
      schoolName: "인천여자고등학교",
      targetMajor: "간호학",
      curriculumRevision: "2022 개정",
      gpa: "3.2등급",
      strengths: ["봉사 활동 다수", "생물 성적 양호"],
      weaknesses: ["전반적 내신 불안정", "진로 탐색 부족"],
      context: "1학년, 아직 진로가 확실하지 않은 상태",
    },
    consultantQuestion: "1학년인데 간호학에 관심이 있다고 합니다. 어떤 방향으로 준비하면 좋을까요?",
    expectedFocus: ["1학년 탐색기 전략", "교과 선택 가이드", "기초 역량 구축"],
  },
  {
    id: "basic-3",
    difficulty: "basic",
    category: "세특",
    studentProfile: {
      name: "시뮬레이션_학생C",
      grade: 2,
      schoolCategory: "general",
      schoolName: "부산중앙고등학교",
      targetMajor: "컴퓨터공학",
      curriculumRevision: "2022 개정",
      gpa: "1.8등급",
      strengths: ["수학/과학 1등급대", "정보 교과 우수", "코딩 대회 수상"],
      weaknesses: ["국어 3등급", "협업 경험 부족"],
      context: "성적은 좋지만 세특에 개인 프로젝트만 있고 협업 경험이 없음",
    },
    consultantQuestion: "세특을 분석해서 부족한 점과 보완 방법을 알려주세요.",
    expectedFocus: ["세특 깊이 분석", "협업 역량 보완", "전공 연결성"],
  },
  {
    id: "basic-4",
    difficulty: "intermediate",
    category: "전형 추천",
    studentProfile: {
      name: "시뮬레이션_학생D",
      grade: 3,
      schoolCategory: "general",
      schoolName: "대전과학고등학교",
      targetMajor: "의예과",
      curriculumRevision: "2015 개정",
      gpa: "1.3등급",
      strengths: ["전 과목 1-2등급", "과학 탐구 R&E 경험", "봉사 다수"],
      weaknesses: ["면접 경험 없음", "시간 부족"],
      context: "3학년 1학기, 수시 6장 카드 배분을 고민 중",
    },
    consultantQuestion: "수시 6장 카드를 어떻게 배분하면 좋을까요? 의대 학생부종합과 정시 중 어디에 무게를 둬야 하나요?",
    expectedFocus: ["전형 병행 전략", "수시 카드 배분", "수능최저 시뮬레이션"],
  },
  {
    id: "basic-5",
    difficulty: "basic",
    category: "보완전략",
    studentProfile: {
      name: "시뮬레이션_학생E",
      grade: 2,
      schoolCategory: "general",
      schoolName: "수원고등학교",
      targetMajor: "심리학",
      curriculumRevision: "2022 개정",
      gpa: "2.8등급",
      strengths: ["국어/사회 우수", "심리 관련 독서 다수"],
      weaknesses: ["수학 4등급", "과학 미이수 과목 존재"],
      context: "인문계열이지만 심리학은 통계/연구방법론도 중요",
    },
    consultantQuestion: "수학이 약한데 심리학과에 지원하려면 어떻게 보완해야 할까요?",
    expectedFocus: ["교과 적합성 분석", "약점 보완 전략", "전공 적합 교과 추천"],
  },
];

// ── 엣지 케이스 시나리오 ──

const EDGE_CASE_SCENARIOS: SimulationScenario[] = [
  {
    id: "edge-1",
    difficulty: "advanced",
    category: "자사고 내신",
    studentProfile: {
      name: "시뮬레이션_학생F",
      grade: 2,
      schoolCategory: "autonomous_private",
      schoolName: "하나고등학교",
      targetMajor: "경제학",
      curriculumRevision: "2022 개정",
      gpa: "3.5등급",
      strengths: ["경제 관련 심화 탐구", "교내 경시대회 다수 입상"],
      weaknesses: ["내신 등급 매우 불리", "상대평가 경쟁 치열"],
      context: "자사고 3.5등급은 일반고 기준 어떤 수준인지 해석이 필요",
    },
    consultantQuestion: "자사고 3.5등급인데 서울대 경제학부 학생부종합전형이 가능한가요?",
    expectedFocus: ["자사고 내신 보정", "학교 유형별 맥락", "현실적 목표 설정"],
  },
  {
    id: "edge-2",
    difficulty: "advanced",
    category: "전과 전환",
    studentProfile: {
      name: "시뮬레이션_학생G",
      grade: 2,
      schoolCategory: "foreign_lang",
      schoolName: "대원외국어고등학교",
      targetMajor: "생명공학",
      curriculumRevision: "2022 개정",
      gpa: "2.0등급",
      strengths: ["영어 원어민 수준", "국제 학술 경험"],
      weaknesses: ["수학/과학 교과 이수 부족", "이공계 전환 준비 미비"],
      context: "외고에서 이공계 전환 — 교과 이수 점검이 핵심",
    },
    consultantQuestion: "외고인데 생명공학으로 전공을 바꾸고 싶습니다. 가능한가요? 어떻게 준비해야 하나요?",
    expectedFocus: ["교과 이수 점검", "전과 전환 전략", "교차지원 가능 대학"],
  },
  {
    id: "edge-3",
    difficulty: "advanced",
    category: "늦은 시기",
    studentProfile: {
      name: "시뮬레이션_학생H",
      grade: 3,
      schoolCategory: "general",
      schoolName: "광주제일고등학교",
      targetMajor: "사회복지학",
      curriculumRevision: "2015 개정",
      gpa: "4.0등급",
      strengths: ["봉사 활동 300시간+", "성장 서사 있음 (1학년 5등급→3학년 3등급)"],
      weaknesses: ["절대적 내신 불리", "남은 시간 부족"],
      context: "3학년 2학기, 원서 접수 직전. 현실적 전략 필요",
    },
    consultantQuestion: "내신이 4등급인데 남은 시간에 할 수 있는 최선이 뭔가요?",
    expectedFocus: ["시간 제약 고려", "강점 극대화", "현실적 지원 대학"],
  },
];

// ── 입시 전형 특화 시나리오 ──

const ADMISSION_SCENARIOS: SimulationScenario[] = [
  {
    id: "adm-1",
    difficulty: "intermediate",
    category: "배치 분석",
    studentProfile: {
      name: "시뮬레이션_학생I",
      grade: 3,
      schoolCategory: "general",
      schoolName: "서울영등포고등학교",
      targetMajor: "전자공학",
      curriculumRevision: "2015 개정",
      gpa: "2.2등급",
      strengths: ["수학/물리 1등급", "로봇 동아리 활동"],
      weaknesses: ["영어 3등급", "수능최저 충족 불확실"],
      context: "정시와 수시를 병행 중, 배치 분석 필요",
    },
    consultantQuestion: "이 학생의 배치 분석을 해주세요. 어느 대학까지 가능하고 안전/적정/상향은 어떻게 될까요?",
    expectedFocus: ["배치 분석", "수능최저 시뮬레이션", "전형 병행 전략"],
  },
  {
    id: "adm-2",
    difficulty: "intermediate",
    category: "논술 전형",
    studentProfile: {
      name: "시뮬레이션_학생J",
      grade: 3,
      schoolCategory: "general",
      schoolName: "경기도 안양고등학교",
      targetMajor: "국어국문학",
      curriculumRevision: "2015 개정",
      gpa: "3.8등급",
      strengths: ["글쓰기 능력 우수", "독서 활동 풍부"],
      weaknesses: ["내신 매우 불리", "수능도 불안정"],
      context: "내신이 불리하여 논술전형에 집중하고 싶음",
    },
    consultantQuestion: "논술전형으로 갈 수 있는 대학과 준비 전략을 알려주세요.",
    expectedFocus: ["논술전형 분석", "수능최저 충족 전략", "현실적 목표"],
  },
];

// ── 면접 준비 시나리오 ──

const INTERVIEW_SCENARIOS: SimulationScenario[] = [
  {
    id: "int-1",
    difficulty: "intermediate",
    category: "서류확인 면접",
    studentProfile: {
      name: "시뮬레이션_학생K",
      grade: 3,
      schoolCategory: "general",
      schoolName: "서울강남고등학교",
      targetMajor: "정치외교학",
      curriculumRevision: "2022 개정",
      gpa: "1.5등급",
      strengths: ["사회과학 탐구 다수", "모의UN 활동", "시사 분석 보고서"],
      weaknesses: ["면접 경험 없음", "긴장 시 논리 흐름 약해짐"],
      context: "고려대 정치외교학과 학생부종합 서류 합격, 면접 준비 필요",
    },
    consultantQuestion: "고려대 정치외교학과 면접을 준비해야 합니다. 예상 질문을 만들고 면접 연습을 도와주세요.",
    expectedFocus: ["서류확인 면접 준비", "예상 질문 생성", "답변 평가"],
  },
  {
    id: "int-2",
    difficulty: "advanced",
    category: "MMI 면접",
    studentProfile: {
      name: "시뮬레이션_학생L",
      grade: 3,
      schoolCategory: "science",
      schoolName: "서울과학고등학교",
      targetMajor: "의예과",
      curriculumRevision: "2015 개정",
      gpa: "1.2등급",
      strengths: ["R&E 연구 경험", "과학 올림피아드 수상", "봉사 활동 풍부"],
      weaknesses: ["윤리적 딜레마 대응 미숙", "환자 관점 경험 부족"],
      context: "연세대 의예과 면접 대비, MMI 형식",
    },
    consultantQuestion: "연세대 의예과 MMI 면접 준비를 도와주세요. 의약학 특화 질문이 필요합니다.",
    expectedFocus: ["MMI 면접 형식", "윤리적 딜레마", "상황 판단 질문"],
  },
];
