// ─── 생기부 4단계 TOC 정의 ────────────────────────────────
// StudentRecordClient + RecordSidebar 공용

export type TocItem = {
  id: string;
  label: string;
  number?: string;
  indent?: boolean;
};

export type StageId = "record" | "diagnosis" | "design" | "strategy";

export type StageConfig = {
  id: StageId;
  emoji: string;
  label: string;
  hasYearSelector: boolean;
  sections: TocItem[];
};

export const STAGES: StageConfig[] = [
  {
    id: "record",
    emoji: "📋",
    label: "기록",
    hasYearSelector: true,
    sections: [
      { id: "sec-1", number: "1", label: "인적·학적사항" },
      { id: "sec-2", number: "2", label: "출결상황" },
      { id: "sec-3", number: "3", label: "수상경력" },
      { id: "sec-4", number: "4", label: "자격증 및 인증" },
      { id: "sec-5", number: "5", label: "학교폭력 조치사항" },
      { id: "sec-6", number: "6", label: "창의적 체험활동" },
      { id: "sec-6-volunteer", label: "봉사활동실적", indent: true },
      { id: "sec-7", number: "7", label: "교과학습발달" },
      { id: "sec-7-grades", label: "성적", indent: true },
      { id: "sec-7-setek", label: "세특", indent: true },
      { id: "sec-7-personal", label: "개인세특", indent: true },
      { id: "sec-8", number: "8", label: "독서활동" },
      { id: "sec-9", number: "9", label: "행동특성 및 종합의견" },
    ],
  },
  {
    id: "diagnosis",
    emoji: "🔍",
    label: "진단",
    hasYearSelector: true,
    sections: [
      { id: "sec-diagnosis-analysis", label: "역량 분석" },
      { id: "sec-diagnosis-crossref", label: "교차 분석" },
      { id: "sec-diagnosis-four-axis", label: "4축 진단" },
      { id: "sec-projected-analysis", label: "설계 예상" },
      { id: "sec-diagnosis-overall", label: "종합진단" },
      { id: "sec-diagnosis-adequacy", label: "교과이수적합" },
      { id: "sec-warnings", label: "경보" },
    ],
  },
  {
    id: "design",
    emoji: "📐",
    label: "설계",
    hasYearSelector: false,
    sections: [
      { id: "sec-pipeline-results", label: "AI 분석 결과" },
      { id: "sec-course-plan", label: "수강 계획" },
      { id: "sec-storyline", label: "스토리라인" },
      { id: "sec-roadmap", label: "로드맵" },
      { id: "sec-compensation", label: "보완전략" },
      { id: "sec-activity-summary", label: "활동 요약서" },
      { id: "sec-setek-guide", label: "세특 방향 가이드" },
      { id: "sec-exploration-guide", label: "활동 가이드" },
      { id: "sec-bypass-major", label: "우회학과" },
    ],
  },
  {
    id: "strategy",
    emoji: "🎯",
    label: "전략",
    hasYearSelector: false,
    sections: [
      { id: "sec-applications", label: "지원현황" },
      { id: "sec-minscore", label: "최저시뮬" },
      { id: "sec-placement", label: "배치 분석" },
      { id: "sec-allocation", label: "배분 시뮬" },
      { id: "sec-interview", label: "면접 질문" },
      { id: "sec-alumni", label: "졸업생 DB" },
    ],
  },
];
