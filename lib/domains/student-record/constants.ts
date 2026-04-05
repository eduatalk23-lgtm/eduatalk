// ============================================
// 생기부 도메인 상수
// 역량 평가 체계, 글자수 제한, 환산표, 계열별 추천교과
// 설계 문서: implementation-plan.md v5 섹션 7
// ============================================

import type { CompetencyItemCode, CompetencyArea, CompetencyGrade } from "./types";

// ============================================
// 1. NEIS 글자수 제한
// ============================================

export const CHAR_LIMITS = {
  setek: { default: 500 },
  personalSetek: { default: 500 },
  autonomy: { default: 500 },
  club: { default: 500 },
  career: { before2026: 700, from2026: 500 },
  haengteuk: { before2026: 500, from2026: 300 },
} as const;

/** 학년도 기반 글자수 제한 반환 */
export function getCharLimit(
  type: keyof typeof CHAR_LIMITS,
  schoolYear: number,
): number {
  const limit = CHAR_LIMITS[type];
  if ("default" in limit) return limit.default;
  return schoolYear >= 2026 ? limit.from2026 : limit.before2026;
}

// ============================================
// 2. 역량 평가 체계 (3대 역량 × 10항목)
// ============================================

export const COMPETENCY_ITEMS: {
  area: CompetencyArea;
  code: CompetencyItemCode;
  label: string;
  evalTarget: string;
}[] = [
  // [2026-04-03 컨설턴트 2차 피드백 반영 — evalTarget 수정]
  { area: "academic", code: "academic_achievement", label: "학업성취도", evalTarget: "전체교과평균내신, 주요교과평균내신, 성적 추이, 전공 관련 교과 성취" },
  { area: "academic", code: "academic_attitude", label: "학업태도", evalTarget: "수업 참여, 과제 성실성, 질문 태도" },
  { area: "academic", code: "academic_inquiry", label: "탐구력", evalTarget: "진로연계보고서 및 발표, 실험을 통한 이론학습, 오류분석 후 재검증" },
  { area: "career", code: "career_course_effort", label: "전공 관련 교과 이수 노력", evalTarget: "과목 선택의 적합성" },
  { area: "career", code: "career_course_achievement", label: "전공 관련 교과 성취도", evalTarget: "전공 관련 과목 성적, 전공과목 성적 추이" },
  { area: "career", code: "career_exploration", label: "진로 탐색 활동과 경험", evalTarget: "진로탐색을 위한 창의적체험활동과 교과활동" },
  { area: "community", code: "community_collaboration", label: "협업과 소통능력", evalTarget: "팀원과 역할분담 및 토론, 지식을 시각화·데이터화하여 이해하기 쉽게 발표하는 능력" },
  { area: "community", code: "community_caring", label: "나눔과 배려", evalTarget: "멘토멘티활동, 봉사, 동료 지원, 과목부장·학습부장으로서 학습자료 지원" },
  { area: "community", code: "community_integrity", label: "성실성과 규칙준수", evalTarget: "출결, 과제, 기타과목 관리" },
  { area: "community", code: "community_leadership", label: "리더십", evalTarget: "임원, 교과목 부장, 자치활동, 임원이 아니더라도 스스로 주도하여 친구들을 이끈 경험" },
];

// ============================================
// 3. 루브릭 세부질문 (42개)
// ============================================

export const COMPETENCY_RUBRIC_QUESTIONS: Record<CompetencyItemCode, string[]> = {
  academic_achievement: [
    "대학 수학에 필요한 기본 교과목의 교과성적은 적절한가?",
    "기본 교과목 이외 과목 성적은 어느 정도인가?",
    "유난히 소홀한 과목이 있는가?",
    "학기별/학년별 성적의 추이는 어떠한가?",
  ],
  academic_attitude: [
    "성취동기와 목표의식을 가지고 자발적으로 학습하려는 의지가 있는가?",
    "새로운 지식 획득을 위해 자기주도적으로 노력하고 있는가?",
    "수업 중 발표·질문·토론 등 적극적 참여 행동이 구체적으로 관찰되는가?",
  ],
  academic_inquiry: [
    "교과와 각종 탐구활동 등을 통해 지식을 확장하려고 노력하고 있는가?",
    "교과와 탐구활동에서 구체적인 성과를 보이고 있는가?",
    "교내 활동에서 학문에 대한 열의와 지적 관심이 드러나고 있는가?",
  ],
  career_course_effort: [
    "전공 관련 과목을 적절하게 선택하고 이수한 과목은 얼마나 되는가?",
    "이수하기 위하여 추가적인 노력을 하였는가?",
    "선택과목은 교과목 학습단계에 따라 이수하였는가?",
  ],
  career_course_achievement: [
    "전공 관련 과목의 성취수준은 적절한가?",
    "동일 교과 내 일반선택 대비 진로선택 성취수준은?",
    "전공 관련 과목 성적이 학기별로 향상/유지되고 있는가?",
  ],
  career_exploration: [
    "자신의 관심 분야나 흥미와 관련한 다양한 활동에 참여하여 노력한 경험이 있는가?",
    "교과 활동이나 창체에서 전공에 대한 관심을 가지고 탐색한 경험이 있는가?",
    "목표희망학과 또는 전공을 지원하고자 하는 동기가 생기부에 드러나는가?",
  ],
  community_collaboration: [
    "단체 활동에서 서로 돕고 함께 행동하는 모습이 보이는가?",
    "공동의 과제를 수행하고 완성한 경험이 있는가?",
    "타인의 의견에 공감·수용하며 자신의 정보와 생각을 잘 전달하는가?",
  ],
  community_caring: [
    "학교생활 속에서 나눔을 실천하고 생활화한 경험이 있는가?",
    "타인을 위하여 양보하거나 배려를 실천한 구체적 경험이 있는가?",
    "상대를 이해하고 존중하는 노력을 기울이고 있는가?",
  ],
  community_integrity: [
    "교내 활동에서 자신이 맡은 역할에 최선을 다하려고 노력한 경험이 있는가?",
    "자신이 속한 공동체가 정한 규칙과 규정을 준수하고 있는가?",
  ],
  community_leadership: [
    "공동체의 목표를 달성하기 위해 계획하고 실행을 주도한 경험이 있는가?",
    "구성원들의 인정과 신뢰를 바탕으로 참여를 이끌어내고 조율한 경험이 있는가?",
    "공식적 직책 없이도 스스로 나서서 친구들을 이끌어 소통과 협업과정을 유도하여 토론, 발표, 실험, 프로젝트, 연구, 보고서를 진행한 경험이 있는가?",
  ],
};

// ============================================
// 4. 등급 루브릭 (역량별 A/B/C 설명)
// ============================================

export const COMPETENCY_GRADE_RUBRICS: Record<CompetencyArea, Record<"A" | "B" | "C", string>> = {
  academic: {
    A: "대학 입학 후 학업을 수행할 수 있는 능력이 충분히 확인됨.",
    B: "학업을 충실히 수행할 수 있는 기초 수학 능력을 꾸준히 발전시킴.",
    C: "대학에서 학업을 충실히 수행하기 위한 학업 능력이 다소 부족함.",
  },
  career: {
    A: "전공 관련 분야에 대한 관심과 이해가 높고, 탐색 활동이 충분히 확인됨.",
    B: "전공 관련 교과 이수 및 탐색 활동을 통해 진로 역량을 발전시키고 있음.",
    C: "전공 관련 교과 이수 및 진로 탐색이 다소 부족함.",
  },
  community: {
    A: "공동체 의식과 협업 능력이 뛰어나며, 나눔과 배려를 적극 실천함.",
    B: "공동체 활동에 성실히 참여하고, 소통과 협업 능력을 발전시키고 있음.",
    C: "공동체 활동 참여와 협업 능력이 다소 부족함.",
  },
};

// ============================================
// 5. 점수↔등급 환산표
// ============================================

export const GRADE_CONVERSION_TABLE: {
  grade: CompetencyGrade;
  scoreRange: [number, number];
  zScore: number;
  percentile: number;
  adjustedGrade: number;
  detailGrade: number;
}[] = [
  { grade: "A+", scoreRange: [93, 94], zScore: 3.0, percentile: 0.13, adjustedGrade: 1.08, detailGrade: 1 },
  { grade: "A-", scoreRange: [87, 87], zScore: 2.8, percentile: 0.26, adjustedGrade: 1.22, detailGrade: 3 },
  { grade: "B+", scoreRange: [83, 85], zScore: 2.1, percentile: 1.79, adjustedGrade: 1.71, detailGrade: 4 },
  { grade: "B",  scoreRange: [80, 82], zScore: 1.8, percentile: 3.59, adjustedGrade: 1.92, detailGrade: 6 },
  { grade: "B-", scoreRange: [77, 79], zScore: 1.3, percentile: 9.68, adjustedGrade: 2.93, detailGrade: 7 },
  { grade: "C",  scoreRange: [66, 72], zScore: 0.2, percentile: 42.07, adjustedGrade: 5.05, detailGrade: 9 },
];

// ============================================
// 6. 전공 계열별 추천 교과목 (22개 계열)
// ============================================

// 2015 개정 교육과정 (고1 2018~2024학년도)
export const MAJOR_RECOMMENDED_COURSES_2015: Record<string, { general: string[]; career: string[] }> = {
  "법·행정": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화", "한문Ⅰ"],
    career: ["사회문제탐구"],
  },
  "경영·경제": {
    general: ["미적분", "확률과통계", "세계지리", "세계사", "경제", "정치와법", "사회·문화", "제2외국어Ⅰ"],
    career: ["경제수학", "사회문제탐구", "영어권문화", "제2외국어Ⅱ"],
  },
  "심리": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화", "생명과학Ⅰ"],
    career: ["사회문제탐구", "생명과학Ⅱ"],
  },
  "사회복지": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화"],
    career: ["사회문제탐구"],
  },
  "교육": {
    general: ["확률과통계"],
    career: ["사회문제탐구"],
  },
  "국어": {
    general: ["윤리와사상", "한국지리", "사회·문화", "한문Ⅰ"],
    career: ["심화국어", "고전과윤리", "한문Ⅱ"],
  },
  "외국어": {
    general: ["윤리와사상", "세계지리", "동아시아사", "세계사", "제2외국어Ⅰ", "한문Ⅰ"],
    career: ["영어권문화", "영미문학읽기", "제2외국어Ⅱ", "한문Ⅱ"],
  },
  "사학·철학": {
    general: ["확률과통계", "윤리와사상", "한국지리", "세계지리", "세계사", "동아시아사", "사회·문화", "제2외국어Ⅰ", "한문Ⅰ"],
    career: ["고전읽기", "고전과윤리", "제2외국어Ⅱ", "한문Ⅱ"],
  },
  "언론·홍보": {
    general: ["확률과통계", "세계지리", "세계사", "동아시아사", "경제", "정치와법", "사회·문화", "윤리와사상"],
    career: ["고전과윤리", "사회문제탐구"],
  },
  "정치·외교": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화", "제2외국어Ⅰ", "한문Ⅰ"],
    career: ["영어권문화", "사회문제탐구", "제2외국어Ⅱ"],
  },
  "수리·통계": {
    general: ["미적분", "확률과통계", "경제", "정보"],
    career: ["기하", "수학과제탐구", "인공지능수학"],
  },
  "물리·천문": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "지구과학Ⅰ"],
    career: ["기하", "수학과제탐구", "물리학Ⅱ", "화학Ⅱ", "지구과학Ⅱ", "과학사"],
  },
  "생명·바이오": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "생활과윤리"],
    career: ["물리학Ⅱ", "화학Ⅱ", "생명과학Ⅱ", "과학사"],
  },
  "의학·약학": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ", "생활과윤리", "정치와법", "보건"],
    career: ["화학Ⅱ", "생명과학Ⅱ"],
  },
  "컴퓨터·정보": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "생활과윤리", "정보"],
    career: ["기하", "인공지능수학", "수학과제탐구", "물리학Ⅱ", "인공지능기초"],
  },
  "기계·자동차·로봇": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "화학Ⅰ", "정보"],
    career: ["기하", "수학과제탐구", "인공지능수학", "물리학Ⅱ", "화학Ⅱ", "융합과학", "인공지능기초"],
  },
  "화학·신소재·에너지": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "화학Ⅰ", "생명과학Ⅰ"],
    career: ["기하", "물리학Ⅱ", "화학Ⅱ", "생명과학Ⅱ", "과학사", "생활과과학"],
  },
  "건축·사회시스템": {
    general: ["미적분", "확률과통계", "한국지리", "세계지리", "물리학Ⅰ", "화학Ⅰ", "지구과학Ⅰ"],
    career: ["기하", "물리학Ⅱ", "화학Ⅱ", "지구과학Ⅱ"],
  },
  "사회": {
    general: ["확률과통계", "생활과윤리", "윤리와사상", "경제", "정치와법", "사회·문화", "세계지리", "한국지리"],
    career: ["사회문제탐구"],
  },
  "전기·전자": {
    general: ["미적분", "확률과통계", "물리학Ⅰ", "정보"],
    career: ["기하", "물리학Ⅱ", "인공지능수학", "인공지능기초"],
  },
  "보건": {
    general: ["미적분", "확률과통계", "화학Ⅰ", "생명과학Ⅰ", "생활과윤리"],
    career: ["화학Ⅱ", "생명과학Ⅱ"],
  },
  "생활과학": {
    general: ["확률과통계", "화학Ⅰ", "생명과학Ⅰ", "생활과윤리"],
    career: ["화학Ⅱ", "생명과학Ⅱ", "생활과과학"],
  },
  "농림": {
    general: ["미적분", "확률과통계", "생명과학Ⅰ", "화학Ⅰ", "지구과학Ⅰ"],
    career: ["생명과학Ⅱ", "화학Ⅱ", "생활과과학"],
  },
  // 예체능 계열
  "음악": {
    general: ["음악", "생활과윤리"],
    career: ["음악 감상과 비평"],
  },
  "미술": {
    general: ["미술", "생활과윤리"],
    career: ["미술 창작", "미술 감상과 비평"],
  },
  "체육": {
    general: ["체육", "운동과건강", "생활과윤리"],
    career: ["스포츠 생활"],
  },
};

// 2022 개정 교육과정 (고1 2025학년도~)
// 교육부 고시 제2022-33호 기반
export const MAJOR_RECOMMENDED_COURSES_2022: Record<string, { general: string[]; career: string[]; fusion?: string[] }> = {
  "법·행정": {
    general: ["확률과 통계", "생활과 윤리", "윤리와 사상", "경제", "정치와 법", "사회와 문화", "한문"],
    career: ["국제 경제", "사회과제 탐구"],
    fusion: ["세계시민과 지리", "사회문제 탐구"],
  },
  "경영·경제": {
    general: ["미적분", "확률과 통계", "세계지리", "세계사", "경제", "정치와 법", "사회와 문화"],
    career: ["경제수학", "국제 경제", "사회과제 탐구"],
    fusion: ["금융과 경제생활", "창업과 경영"],
  },
  "심리": {
    general: ["확률과 통계", "생활과 윤리", "윤리와 사상", "경제", "사회와 문화", "생명과학"],
    career: ["사회과제 탐구"],
    fusion: ["심리학"],
  },
  "사회복지": {
    general: ["확률과 통계", "생활과 윤리", "윤리와 사상", "경제", "사회와 문화"],
    career: ["사회과제 탐구"],
    fusion: ["사회문제 탐구"],
  },
  "교육": {
    general: ["확률과 통계"],
    career: ["사회과제 탐구"],
  },
  "국어": {
    general: ["윤리와 사상", "한국지리", "사회와 문화", "한문"],
    career: ["주제 탐구 독서", "문학과 영상", "고전과 윤리"],
  },
  "외국어": {
    general: ["윤리와 사상", "세계지리", "동아시아 역사", "세계사", "한문"],
    career: ["영미 문학 읽기", "심화 영어"],
    fusion: ["세계시민과 지리"],
  },
  "사학·철학": {
    general: ["확률과 통계", "윤리와 사상", "한국지리", "세계지리", "세계사", "동아시아 역사", "사회와 문화", "한문"],
    career: ["고전과 윤리", "주제 탐구 독서"],
    fusion: ["역사로 탐구하는 현대 세계"],
  },
  "언론·홍보": {
    general: ["확률과 통계", "세계지리", "세계사", "동아시아 역사", "경제", "정치와 법", "사회와 문화"],
    career: ["사회과제 탐구"],
    fusion: ["미디어 콘텐츠와 활용"],
  },
  "정치·외교": {
    general: ["확률과 통계", "생활과 윤리", "윤리와 사상", "경제", "정치와 법", "사회와 문화"],
    career: ["국제 경제", "사회과제 탐구"],
    fusion: ["세계시민과 지리"],
  },
  "수리·통계": {
    general: ["미적분", "확률과 통계", "경제", "정보"],
    career: ["기하", "수학과제 탐구", "인공지능 수학"],
    fusion: ["직무 수학"],
  },
  "물리·천문": {
    general: ["미적분", "확률과 통계", "물리학", "화학", "생명과학", "지구과학"],
    career: ["기하", "수학과제 탐구", "역학과 에너지", "전자기와 양자"],
    fusion: ["과학의 역사와 문화"],
  },
  "생명·바이오": {
    general: ["미적분", "확률과 통계", "물리학", "화학", "생명과학", "생활과 윤리"],
    career: ["세포와 물질대사", "생물다양성과 생태"],
    fusion: ["과학의 역사와 문화"],
  },
  "의학·약학": {
    general: ["미적분", "확률과 통계", "물리학", "화학", "생명과학", "생활과 윤리"],
    career: ["화학 반응의 세계", "세포와 물질대사"],
    fusion: ["과학의 역사와 문화"],
  },
  "컴퓨터·정보": {
    general: ["미적분", "확률과 통계", "물리학", "생활과 윤리", "정보"],
    career: ["기하", "인공지능 수학", "수학과제 탐구", "역학과 에너지"],
    fusion: ["정보과학", "인공지능 기초", "데이터 과학"],
  },
  "기계·자동차·로봇": {
    general: ["미적분", "확률과 통계", "물리학", "화학", "정보"],
    career: ["기하", "수학과제 탐구", "인공지능 수학", "역학과 에너지"],
    fusion: ["인공지능 기초", "로봇과 공학세계"],
  },
  "화학·신소재·에너지": {
    general: ["미적분", "확률과 통계", "물리학", "화학", "생명과학"],
    career: ["기하", "화학 반응의 세계", "역학과 에너지"],
    fusion: ["과학의 역사와 문화"],
  },
  "건축·사회시스템": {
    general: ["미적분", "확률과 통계", "한국지리", "세계지리", "물리학", "화학", "지구과학"],
    career: ["기하", "역학과 에너지", "지구시스템과학"],
    fusion: ["도시의 미래 탐구"],
  },
  "사회": {
    general: ["확률과 통계", "생활과 윤리", "윤리와 사상", "경제", "정치와 법", "사회와 문화", "세계지리", "한국지리"],
    career: ["사회과제 탐구"],
    fusion: ["사회문제 탐구"],
  },
  "전기·전자": {
    general: ["미적분", "확률과 통계", "물리학", "정보"],
    career: ["기하", "전자기와 양자", "인공지능 수학"],
    fusion: ["인공지능 기초"],
  },
  "보건": {
    general: ["미적분", "확률과 통계", "화학", "생명과학", "생활과 윤리"],
    career: ["화학 반응의 세계", "세포와 물질대사"],
  },
  "생활과학": {
    general: ["확률과 통계", "화학", "생명과학", "생활과 윤리"],
    career: ["화학 반응의 세계", "세포와 물질대사"],
    fusion: ["생활 속의 바이오"],
  },
  "농림": {
    general: ["미적분", "확률과 통계", "생명과학", "화학", "지구과학"],
    career: ["생물다양성과 생태", "지구시스템과학"],
    fusion: ["생활 속의 바이오"],
  },
  // 예체능 계열
  "음악": {
    general: ["음악", "생활과 윤리"],
    career: ["음악 감상과 비평"],
    fusion: ["음악과 미디어"],
  },
  "미술": {
    general: ["미술", "생활과 윤리"],
    career: ["미술 창작", "미술 감상과 비평"],
    fusion: ["미술과 매체"],
  },
  "체육": {
    general: ["체육", "운동과 건강", "생활과 윤리"],
    career: ["스포츠 생활"],
    fusion: ["스포츠 문화"],
  },
};

/** 교육과정 연도별 추천 과목 조회 */
export function getMajorRecommendedCourses(
  majorCategory: string,
  curriculumYear?: number,
): { general: string[]; career: string[]; fusion?: string[] } | undefined {
  const source = (curriculumYear ?? 2015) >= 2022
    ? MAJOR_RECOMMENDED_COURSES_2022
    : MAJOR_RECOMMENDED_COURSES_2015;
  return source[majorCategory];
}

// 하위호환: curriculum_revision 없으면 2015 반환
export const MAJOR_RECOMMENDED_COURSES = MAJOR_RECOMMENDED_COURSES_2015;

// ============================================
// 7. 9등급↔5등급 환산 상수
// ============================================

/** 9등급 → 5등급 근사 환산 */
export const GRADE_9_TO_5_MAP: Record<number, string> = {
  1: "A", 2: "A",
  3: "B", 4: "B",
  5: "C", 6: "C",
  7: "D", 8: "D",
  9: "E",
};

/** 5등급 → 9등급 범위 환산 (백분위 기준, 경계 겹침 없이) */
export const GRADE_5_TO_9_MAP: Record<string, { min: number; max: number; typical: number }> = {
  A: { min: 1, max: 2, typical: 2 },   // ~10% → 9등급 1~2
  B: { min: 3, max: 4, typical: 3 },   // ~34% → 9등급 3~4
  C: { min: 5, max: 6, typical: 5 },   // ~66% → 9등급 5~6
  D: { min: 7, max: 8, typical: 7 },   // ~90% → 9등급 7~8
  E: { min: 9, max: 9, typical: 9 },   // ~100% → 9등급 9
};

// ============================================
// 8. 라벨 맵
// ============================================

export const COMPETENCY_AREA_LABELS: Record<CompetencyArea, string> = {
  academic: "학업역량",
  career: "진로역량",
  community: "공동체역량",
};

export const CHANGCHE_TYPE_LABELS: Record<string, string> = {
  autonomy: "자율·자치활동",
  club: "동아리활동",
  career: "진로활동",
};

export const APPLICATION_ROUND_LABELS: Record<string, string> = {
  early_comprehensive: "학생부종합",
  early_subject: "학생부교과",
  early_essay: "논술",
  early_practical: "실기/실적",
  early_special: "특별전형",
  early_other: "기타 수시",
  regular_ga: "정시 가군",
  regular_na: "정시 나군",
  regular_da: "정시 다군",
  additional: "추가모집",
  special_quota: "정원외전형",
};

// ============================================
// 9. 전형별 역량 분석 힌트 (에이전트 도구용)
// ============================================

export const ADMISSION_TYPE_HINTS: Record<string, string> = {
  "종합":
    "세특 깊이와 스토리라인 일관성에 높은 가중치를 두세요. 역량 분석 시 탐구력(academic_inquiry)과 진로탐색(career_exploration)을 특히 주목하세요.",
  "교과":
    "교과 성적 중심 전형입니다. 학업성취도(academic_achievement)와 교과이수노력(career_course_effort)에 집중하세요.",
  "논술":
    "논술 전형이므로 역량 분석은 면접 소재 수준으로 간략히 하세요.",
  "정시":
    "수능 점수 중심이므로 역량 분석은 면접 대비 관점으로만 수행하세요.",
};

// ============================================
// 10. 전략 영역 (9개)
// ============================================

export const STRATEGY_TARGET_AREAS = {
  autonomy: "자율활동",
  club: "동아리활동",
  career: "진로활동",
  setek: "교과 세특",
  personal_setek: "개인 세특",
  reading: "독서활동",
  haengteuk: "행동특성 및 종합의견",
  score: "성적",
  general: "종합 (스토리라인, 일관성)",
} as const;

export type StrategyTargetArea = keyof typeof STRATEGY_TARGET_AREAS;

// ============================================
// 11. 라벨 맵
// ============================================

// ============================================
// 12. 파이프라인 임계값
// ============================================

/** 파이프라인 콘텐츠 실질성 판별 임계값 */
export const PIPELINE_THRESHOLDS = {
  /** imported_content 최소 길이 (이보다 짧으면 분석 무의미) */
  MIN_IMPORTED_LENGTH: 20,
  /** confirmed/content 최소 길이 */
  MIN_CONTENT_LENGTH: 10,
  /** LLM maxTokens 기본값 (세특/창체/행특 초안) */
  DEFAULT_DRAFT_MAX_TOKENS: 2000,
} as const;

export const SCHOOL_CATEGORY_LABELS: Record<string, string> = {
  general: "일반고",
  autonomous_private: "자사고",
  autonomous_public: "자공고",
  science: "과학고",
  foreign_lang: "외고",
  international: "국제고",
  art: "예고",
  sports: "체고",
  meister: "마이스터고",
  specialized: "특성화고",
  other: "기타",
};
