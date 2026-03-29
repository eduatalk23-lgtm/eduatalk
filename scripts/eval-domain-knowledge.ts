/**
 * 도메인 지식 주입 효과 평가 — 기준 기반 채점 (Criteria-Based Scoring)
 *
 * 각 시나리오에 MUST(필수 판단) / MUST_NOT(금지 판단) / KEYWORD(핵심 개념) 기준을 정의하고,
 * 패턴 매칭 → LLM 시맨틱 검증 2단계로 객관적 채점합니다.
 *
 * 실행: npx tsx scripts/eval-domain-knowledge.ts
 * 옵션: --scenario=1   특정 시나리오만
 *       --verbose       LLM 응답 원문 출력
 *       --skip-llm      LLM 시맨틱 검증 생략 (패턴 매칭만)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { z } from "zod";
import {
  generateTextWithRateLimit,
  generateObjectWithRateLimit,
} from "../lib/domains/plan/llm/ai-sdk";
import { buildDomainKnowledgeBlock } from "../lib/agents/domain-knowledge";

// ============================================
// 1. 기준 타입 정의
// ============================================

interface Criterion {
  /** 기준 설명 (사람이 읽는 용) */
  desc: string;
  /** 정규식 패턴 (여러 표현 OR) — 하나라도 매칭되면 통과 */
  patterns: RegExp[];
  /** 패턴으로 판별 불가 시 LLM에게 보낼 시맨틱 질문 */
  semanticQuery?: string;
  /** 가중치 (기본 1) */
  weight?: number;
}

interface Scenario {
  id: number;
  name: string;
  studentProfile: {
    studentGrade?: number | null;
    schoolCategory?: string | null;
    targetMajor?: string | null;
  };
  question: string;
  /** 반드시 포함해야 하는 판단 */
  must: Criterion[];
  /** 절대 하면 안 되는 판단 */
  mustNot: Criterion[];
  /** 핵심 개념 키워드 (단순 포함 여부) */
  keywords: string[];
}

// ============================================
// 2. 시나리오 정의 (기준 포함)
// ============================================

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "일반고 1학년 — 전공 미정, 세특 방향 상담",
    studentProfile: { studentGrade: 1, schoolCategory: "general", targetMajor: null },
    question:
      "이 학생은 아직 진로가 정해지지 않았습니다. 1학년 1학기 세특이 대부분 '수업에 성실히 참여함' 수준입니다. 어떤 방향으로 개선하면 좋을까요?",
    must: [
      {
        desc: "1학년은 탐색기이므로 다양한 활동 탐색을 권장해야 함",
        patterns: [/탐색/, /다양한.*활동/, /폭넓/, /여러.*분야/],
        semanticQuery: "응답이 1학년 학생에게 특정 전공에 집중하기보다 다양한 분야를 탐색하라고 권장하고 있는가?",
      },
      {
        desc: "'참여함' 수준의 세특이 문제가 있다고 진단해야 함",
        patterns: [/부족/, /미흡/, /개선/, /불충분/, /나열/, /일반적/],
        semanticQuery: "응답이 '수업에 성실히 참여함' 수준의 세특이 충분하지 않다고 진단하고 있는가?",
      },
      {
        desc: "세특 개선을 위한 구체적 활동 예시를 제시해야 함",
        patterns: [/보고서/, /발표/, /탐구/, /프로젝트/, /실험/, /독서/],
        semanticQuery: "응답이 세특 개선을 위해 학생이 할 수 있는 구체적인 활동 예시를 제시하고 있는가?",
      },
      {
        desc: "진로가 미정이어도 괜찮다는 안심을 주어야 함",
        patterns: [/괜찮/, /자연스러/, /충분히/, /가능/, /기회/, /여유/],
        semanticQuery: "응답이 진로가 아직 정해지지 않은 것에 대해 불안감을 줄여주는 긍정적 메시지를 포함하고 있는가?",
      },
    ],
    mustNot: [
      {
        desc: "1학년에게 특정 전공 심화 탐구를 강하게 밀어서는 안 됨",
        patterns: [/반드시.*전공.*정해/, /지금.*전공.*확정/, /전공.*늦/],
        semanticQuery: "응답이 1학년 학생에게 지금 당장 전공을 정하고 그에 맞는 심화 활동을 해야 한다고 압박하고 있는가?",
      },
      {
        desc: "SKY급 입시 전략을 1학년에게 주입해서는 안 됨",
        patterns: [/서울대.*전략/, /SKY.*지원/, /1학년.*배치/],
      },
    ],
    keywords: ["세특", "역량", "교과", "활동"],
  },
  {
    id: 2,
    name: "자사고 3학년 — 경영학 종합전형 전략",
    studentProfile: { studentGrade: 3, schoolCategory: "autonomous_private", targetMajor: "경영학" },
    question:
      "이 학생은 내신 2.5등급이고 학생부종합전형으로 상위권 대학 경영학과에 지원하려 합니다. 3학년 1학기가 시작되었는데, 남은 기간 동안 생기부를 어떻게 보완해야 할까요?",
    must: [
      {
        desc: "자사고의 내신 불리함(상대평가 경쟁)을 언급해야 함",
        patterns: [/자사고.*내신.*불리/, /내신.*경쟁.*치열/, /상대평가/, /내신.*열세/, /자사고.*등급/],
        semanticQuery: "응답이 자율형 사립고(자사고) 학생이 내신에서 불리할 수 있다는 점을 언급하고 있는가?",
        weight: 2,
      },
      {
        desc: "3학년이므로 새 활동 시작보다 기존 활동 연결/마무리를 권해야 함",
        patterns: [/기존.*활동.*연결/, /마무리/, /연결성/, /스토리라인.*완성/, /일관/, /강점.*극대화/],
        semanticQuery: "응답이 3학년 학생에게 새로운 활동을 시작하기보다 기존 활동을 연결하고 마무리하라고 권하고 있는가?",
        weight: 2,
      },
      {
        desc: "교과전형도 병행 검토를 제안해야 함",
        patterns: [/교과전형/, /교과.*병행/, /학생부교과/, /교과.*지원/],
        semanticQuery: "응답이 학생부종합전형 외에 학생부교과전형이나 다른 전형도 함께 검토할 것을 제안하고 있는가?",
      },
      {
        desc: "면접 대비 필요성을 언급해야 함",
        patterns: [/면접/, /구술/, /인터뷰/],
      },
      {
        desc: "시간 제약을 명시해야 함 (3학년 1학기 시작)",
        patterns: [/시간.*제한/, /남은.*기간/, /시간.*촉박/, /얼마.*남지/, /제한적/],
        semanticQuery: "응답이 3학년 1학기라는 시간적 제약을 명시적으로 인식하고 있는가?",
        weight: 2,
      },
    ],
    mustNot: [
      {
        desc: "내신 2.5면 SKY 교과전형 가능하다고 해서는 안 됨",
        patterns: [/2\.5.*SKY.*교과.*가능/, /서울대.*교과.*지원/],
        semanticQuery: "응답이 내신 2.5등급으로 SKY 교과전형에 합격 가능하다고 낙관적으로 말하고 있는가?",
        weight: 2,
      },
      {
        desc: "3학년에게 새 동아리 개설을 권해서는 안 됨",
        patterns: [/새.*동아리.*만들/, /동아리.*개설/, /동아리.*창설/],
        semanticQuery: "응답이 3학년 학생에게 새로운 동아리를 만들라고 권하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["종합전형", "스토리라인", "경영", "면접", "내신"],
  },
  {
    id: 3,
    name: "과학고 2학년 — 의대 지망, 세특 분석",
    studentProfile: { studentGrade: 2, schoolCategory: "science", targetMajor: "의예과" },
    question:
      "이 학생의 화학 세특에 '산화환원 반응의 열역학적 해석에 관한 탐구를 수행하여 보고서를 작성함'이라고 되어 있습니다. 의대 지원을 위해 이 세특의 수준은 어떤지, 어떻게 개선할 수 있을지 분석해주세요.",
    must: [
      {
        desc: "이 세특이 구체성 부족하다고 진단해야 함 (방법론/결과 없음)",
        patterns: [/구체.*부족/, /방법론.*없/, /결과.*언급.*없/, /과정.*생략/, /구체적.*내용.*부족/, /추상적/],
        semanticQuery: "응답이 이 세특에서 탐구 방법론이나 구체적 결과가 빠져있어 부족하다고 진단하고 있는가?",
        weight: 2,
      },
      {
        desc: "의학과의 연결성을 언급해야 함",
        patterns: [/의학.*연결/, /의료.*적용/, /생체.*화학/, /약물/, /인체/, /생명.*과학/, /의예과.*적합/],
        semanticQuery: "응답이 의대 지원을 위해 화학 탐구와 의학/생명과학 분야를 연결할 필요성을 언급하고 있는가?",
      },
      {
        desc: "개선된 세특 예시 또는 방향을 제시해야 함",
        patterns: [/예시|예를 들|개선.*방향|구체적.*작성|보완.*방법/],
        semanticQuery: "응답이 이 세특을 어떻게 개선하면 좋을지 구체적인 방향이나 예시를 제시하고 있는가?",
      },
      {
        desc: "과학고 학생의 차별화된 심화 수준을 기대해야 함",
        patterns: [/과학고.*수준/, /심화.*탐구/, /R&E/, /연구.*활동/, /과학고.*기대/],
        semanticQuery: "응답이 과학고 학생에게는 일반고보다 높은 수준의 과학 탐구가 기대된다는 점을 반영하고 있는가?",
      },
    ],
    mustNot: [
      {
        desc: "이 세특을 '충분하다' 또는 '잘 작성됨'으로 평가해서는 안 됨",
        patterns: [/충분.*잘/, /잘.*작성/, /문제.*없/, /괜찮/, /우수한.*세특/],
        semanticQuery: "응답이 이 세특이 이미 충분하거나 잘 작성되었다고 긍정적으로만 평가하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["산화환원", "탐구", "방법론", "의대", "세특"],
  },
  {
    id: 4,
    name: "외고 2학년 — 정치외교학, 교과전형 vs 종합전형",
    studentProfile: { studentGrade: 2, schoolCategory: "foreign_lang", targetMajor: "정치외교학" },
    question:
      "이 학생은 내신 1.8등급이지만 비교과가 약합니다. 정치외교학과에 지원하려는데 학생부교과전형과 학생부종합전형 중 어떤 전략이 유리할까요?",
    must: [
      {
        desc: "내신 1.8등급이면 교과전형이 안정적이라는 판단을 제시해야 함",
        patterns: [/교과전형.*유리/, /교과.*안정/, /내신.*강점.*교과/, /교과.*우선/],
        semanticQuery: "응답이 내신 1.8등급이라면 학생부교과전형이 상대적으로 유리하거나 안정적이라는 판단을 제시하고 있는가?",
        weight: 2,
      },
      {
        desc: "비교과 약점 때문에 종합전형 위험성을 언급해야 함",
        patterns: [/비교과.*약.*종합.*불리/, /종합.*비교과.*부족/, /종합.*위험/, /종합.*리스크/, /비교과.*보완/],
        semanticQuery: "응답이 비교과가 약한 상태에서 학생부종합전형 지원의 위험성이나 보완 필요성을 언급하고 있는가?",
        weight: 2,
      },
      {
        desc: "외고의 어학 강점을 정치외교학과 연결해야 함",
        patterns: [/외고.*어학/, /외국어.*강점/, /국제.*역량/, /외고.*정치.*외교.*유리/, /어학.*활용/],
        semanticQuery: "응답이 외고의 어학 역량을 정치외교학 지원의 강점으로 연결하고 있는가?",
      },
      {
        desc: "두 전형 병행(투 트랙) 전략을 제안해야 함",
        patterns: [/병행/, /투.*트랙/, /두.*전형.*동시/, /교과.*종합.*모두/, /양쪽/],
        semanticQuery: "응답이 교과전형과 종합전형을 병행하는 전략을 제안하고 있는가?",
      },
    ],
    mustNot: [
      {
        desc: "종합전형만 추천하면서 비교과 약점을 무시해서는 안 됨",
        patterns: [/종합전형.*만.*추천/, /교과.*전형.*의미.*없/],
        semanticQuery: "응답이 비교과 약점을 무시하고 학생부종합전형만을 일방적으로 추천하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["교과전형", "종합전형", "내신", "비교과", "외고", "정치외교"],
  },
  {
    id: 5,
    name: "일반고 2학년 — 컴퓨터공학, 스토리라인 괴리",
    studentProfile: { studentGrade: 2, schoolCategory: "general", targetMajor: "컴퓨터공학" },
    question:
      "이 학생은 1학년 때 수학 동아리에서 활동했고, 2학년에서 정보 과목을 선택했습니다. 그런데 세특에는 수학 탐구 위주이고 코딩이나 알고리즘 관련 내용이 없습니다. 컴퓨터공학과 스토리라인으로 괜찮은가요?",
    must: [
      {
        desc: "코딩/알고리즘 내용 부재를 스토리라인 약점으로 지적해야 함",
        patterns: [/코딩.*부재/, /알고리즘.*없/, /컴퓨터.*관련.*부족/, /정보.*과목.*세특/, /프로그래밍.*없/],
        semanticQuery: "응답이 컴퓨터공학과 지원인데 코딩/알고리즘 관련 세특이 없는 것을 문제로 지적하고 있는가?",
        weight: 2,
      },
      {
        desc: "수학→컴퓨터공학 연결 가능성을 제시해야 함",
        patterns: [/수학.*컴퓨터.*연결/, /수학.*기반/, /알고리즘.*수학/, /수리.*논리/, /수학적.*사고.*프로그래밍/],
        semanticQuery: "응답이 수학 탐구를 컴퓨터공학과 연결시킬 수 있는 방법을 제시하고 있는가?",
      },
      {
        desc: "2학년 2학기에 보완할 구체적 활동을 제안해야 함",
        patterns: [/정보.*과목.*세특/, /코딩.*프로젝트/, /알고리즘.*탐구/, /SW/, /프로그래밍.*활동/],
        semanticQuery: "응답이 남은 2학년 기간에 컴퓨터 관련 세특을 보완하기 위한 구체적 활동을 제안하고 있는가?",
      },
      {
        desc: "스토리라인 일관성의 중요성을 강조해야 함",
        patterns: [/스토리라인/, /일관성/, /연결.*고리/, /흐름/, /서사/],
        weight: 2,
      },
    ],
    mustNot: [
      {
        desc: "수학 동아리만으로 컴퓨터공학 스토리라인이 충분하다고 해서는 안 됨",
        patterns: [/수학.*동아리.*충분/, /수학.*만으로.*괜찮/, /문제.*없/],
        semanticQuery: "응답이 수학 동아리 활동만으로 컴퓨터공학 전공 적합성이 충분하다고 판단하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["스토리라인", "코딩", "알고리즘", "수학", "컴퓨터공학", "정보"],
  },
  // ── 함정 시나리오 (LLM 기본 지식이 틀리기 쉬운 케이스) ──
  {
    id: 6,
    name: "[함정] 외고 학생이 자연계(생명공학) 전환 희망",
    studentProfile: { studentGrade: 2, schoolCategory: "foreign_lang", targetMajor: "생명공학" },
    question:
      "이 학생은 외고 2학년인데, 최근 생명공학에 관심이 생겨서 이공계로 진로를 바꾸고 싶습니다. 어떻게 해야 할까요?",
    must: [
      {
        desc: "외고→자연계 전환 시 수학·과학 교과 이수 문제를 경고해야 함",
        patterns: [/교과.*이수/, /수학.*과학.*부족/, /미적분/, /물리/, /화학/, /과학.*과목.*없/, /이수.*점검/],
        semanticQuery: "응답이 외고 학생이 자연계로 전환할 때 수학/과학 교과 이수가 부족할 수 있다는 문제를 경고하고 있는가?",
        weight: 3,
      },
      {
        desc: "전환의 현실적 어려움을 솔직하게 전달해야 함",
        patterns: [/어렵|불리|도전적|현실적|제한|쉽지 않/],
        semanticQuery: "응답이 외고에서 이공계 전환이 현실적으로 쉽지 않다는 점을 솔직하게 전달하고 있는가?",
        weight: 2,
      },
      {
        desc: "학교에서 제공하지 않는 과목에 대한 대안을 제시해야 함",
        patterns: [/공동교육과정|온라인.*수업|학점제|타학교.*수강|자기주도/],
        semanticQuery: "응답이 외고에서 개설되지 않는 과학 과목을 수강할 수 있는 대안(공동교육과정, 온라인 등)을 제시하고 있는가?",
      },
    ],
    mustNot: [
      {
        desc: "외고에서 자연계 전환이 쉽다고 해서는 안 됨",
        patterns: [/충분히.*가능/, /문제.*없/, /걱정.*할.*필요.*없/, /외고.*자연계.*유리/],
        semanticQuery: "응답이 외고에서 자연계(생명공학) 전환이 별 문제 없이 가능하다고 낙관적으로 말하고 있는가?",
        weight: 3,
      },
    ],
    keywords: ["외고", "이수", "과학", "생명공학", "교과"],
  },
  {
    id: 7,
    name: "[함정] 내신 4등급 학생이 SKY 종합전형 질문",
    studentProfile: { studentGrade: 3, schoolCategory: "general", targetMajor: "사회학" },
    question:
      "이 학생은 내신 평균 4등급입니다. 서울대 학생부종합전형으로 사회학과에 지원하고 싶은데 가능성이 있을까요?",
    must: [
      {
        desc: "내신 4등급으로 서울대 종합전형은 매우 어렵다고 솔직하게 말해야 함",
        patterns: [/매우.*어렵|현실적.*어렵|가능성.*낮|합격.*어렵|불가능에.*가까/],
        semanticQuery: "응답이 내신 4등급으로 서울대 학생부종합전형 합격이 현실적으로 매우 어렵다고 솔직하게 전달하고 있는가?",
        weight: 3,
      },
      {
        desc: "현실적인 대안 대학/전형을 제시해야 함",
        patterns: [/대안|다른.*대학|현실적.*목표|지원.*전략.*조정|눈높이|하향/],
        semanticQuery: "응답이 서울대 외에 현실적으로 지원 가능한 대안 대학이나 전형을 제시하고 있는가?",
        weight: 2,
      },
      {
        desc: "정시 전형 가능성도 언급해야 함",
        patterns: [/정시/, /수능/, /수능.*성적/],
      },
    ],
    mustNot: [
      {
        desc: "내신 4등급으로 서울대 합격 가능하다고 해서는 안 됨",
        patterns: [/충분히.*가능|합격.*가능성.*높|도전.*해볼.*만/],
        semanticQuery: "응답이 내신 4등급으로 서울대 학생부종합전형 합격이 충분히 가능하다고 장밋빛 전망을 하고 있는가?",
        weight: 3,
      },
    ],
    keywords: ["서울대", "내신", "종합전형", "사회학"],
  },

  // ── Phase 2 신규 시나리오 (8~12) ──

  {
    id: 8,
    name: "내신 추이 분석 — 도구 추천 검증",
    studentProfile: { studentGrade: 2, schoolCategory: "general", targetMajor: "경제학" },
    question:
      "이 학생의 내신 등급이 1학년 때 3등급대에서 2학년 1학기에 2등급대로 올라왔습니다. 이 추세를 어떻게 분석하고 활용할 수 있나요?",
    must: [
      {
        desc: "내신 추이 분석 도구 사용을 언급/추천해야 함",
        patterns: [/analyzeGradeTrend|내신.*추이.*분석|등급.*변화.*분석|학기별.*등급/],
        semanticQuery: "응답이 학기별 내신 등급 변화를 체계적으로 분석하는 도구나 기능을 언급하고 있는가?",
      },
      {
        desc: "상승 추이를 긍정적으로 평가해야 함",
        patterns: [/상승.*긍정|개선.*추세|성장|등급.*향상|꾸준.*개선/],
        semanticQuery: "응답이 3등급에서 2등급으로의 상승 추이를 긍정적으로 평가하고 있는가?",
      },
      {
        desc: "종합전형에서의 활용법을 제시해야 함",
        patterns: [/종합전형|학생부종합|성장.*서사|면접.*활용|자기소개서/],
      },
    ],
    mustNot: [
      {
        desc: "상승 추이를 부정적으로 해석해서는 안 됨",
        patterns: [/2등급.*부족|2등급.*불충분|하락/],
        semanticQuery: "응답이 3등급에서 2등급으로의 상승을 부정적으로 해석하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["추이", "등급", "내신", "분석"],
  },

  {
    id: 9,
    name: "비교과 강도 판별 — 전형 결정 연계",
    studentProfile: { studentGrade: 3, schoolCategory: "general", targetMajor: "사회복지학" },
    question:
      "이 학생은 내신 2.3등급이고 봉사 활동이 많지만 학술 동아리 경험이 없습니다. 교과전형과 종합전형 중 어떤 게 유리할까요?",
    must: [
      {
        desc: "비교과 강도 판별을 언급해야 함",
        patterns: [/assessExtracurricularStrength|비교과.*강도|비교과.*평가|비교과.*분석/],
        semanticQuery: "응답이 비교과 강도를 체계적으로 평가하는 도구나 분석을 언급하고 있는가?",
      },
      {
        desc: "봉사 활동을 비교과 강점으로 인식해야 함",
        patterns: [/봉사.*강점|봉사.*긍정|비교과.*봉사|사회복지.*봉사/],
        semanticQuery: "응답이 봉사 활동을 비교과 강점으로 인식하고 있는가?",
      },
      {
        desc: "학술 동아리 부재를 약점으로 지적해야 함",
        patterns: [/동아리.*부재|학술.*활동.*부족|동아리.*없|연구.*부족/],
      },
      {
        desc: "전형 선택 조합을 구체적으로 추천해야 함",
        patterns: [/종합.*주력|교과.*병행|교과.*안전|내신.*2.*종합|전형.*조합/],
        semanticQuery: "응답이 내신 2.3등급과 비교과 상태를 기반으로 구체적인 전형 조합을 추천하고 있는가?",
        weight: 2,
      },
    ],
    mustNot: [
      {
        desc: "봉사가 있는 학생에게 종합전형을 완전 배제해서는 안 됨",
        patterns: [/교과전형.*만|종합.*포기|종합.*불가/],
        semanticQuery: "응답이 봉사 활동이 있는 학생에게 종합전형을 완전히 배제하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["비교과", "전형", "봉사", "내신", "종합전형"],
  },

  {
    id: 10,
    name: "수능최저 시뮬레이션 — 현실적 진단",
    studentProfile: { studentGrade: 3, schoolCategory: "general", targetMajor: "간호학" },
    question:
      "이 학생은 연세대 간호학과 학생부종합전형에 지원하려는데, 수능 모의고사 등급이 국어3 수학4 영어2 탐구3,4입니다. 수능최저를 맞출 수 있을까요?",
    must: [
      {
        desc: "수능최저 시뮬레이션 도구 사용을 언급해야 함",
        patterns: [/simulateMinScoreRequirement|수능최저.*시뮬레이션|수능최저.*확인|최저.*기준.*확인/],
        semanticQuery: "응답이 수능최저 충족 여부를 체계적으로 시뮬레이션하는 도구나 기능을 언급하고 있는가?",
      },
      {
        desc: "구체적인 등급합 계산을 시도해야 함",
        patterns: [/등급합|합.*\d|국수영탐.*합|3.*4.*2/],
        semanticQuery: "응답이 주어진 등급으로 구체적인 등급합을 계산하거나 시뮬레이션하고 있는가?",
      },
      {
        desc: "수학 등급 개선 필요성을 언급해야 함",
        patterns: [/수학.*개선|수학.*4등급.*부족|수학.*올|수학.*보완/],
        semanticQuery: "응답이 수학 4등급이 수능최저 충족에 불리하다고 지적하고 있는가?",
      },
    ],
    mustNot: [
      {
        desc: "현재 등급으로 확실히 충족한다고 단언해서는 안 됨",
        patterns: [/확실.*충족|문제.*없.*충족|무난.*통과/],
        semanticQuery: "응답이 현재 모의고사 등급으로 수능최저를 확실히 맞출 수 있다고 단언하고 있는가?",
        weight: 2,
      },
    ],
    keywords: ["수능최저", "등급합", "시뮬레이션", "간호"],
  },

  {
    id: 11,
    name: "서사 연결 분석 — 스토리라인 진단",
    studentProfile: { studentGrade: 2, schoolCategory: "general", targetMajor: "생명과학" },
    question:
      "이 학생의 세특을 보면 생물 과목에서 유전학 탐구를 했고, 화학에서 생체분자 분석을 다뤘습니다. 하지만 수학과 국어 세특은 전공과 무관합니다. 기록 간 연결성은 어떤가요?",
    must: [
      {
        desc: "서사 연결 분석 도구를 언급해야 함",
        patterns: [/analyzeNarrativeConnections|교차.*연결.*분석|서사.*연결|엣지.*분석|기록.*간.*연결/],
        semanticQuery: "응답이 기록 간 교차 연결을 분석하는 도구나 기능을 언급하고 있는가?",
      },
      {
        desc: "생물-화학 연결을 강점으로 인식해야 함",
        patterns: [/생물.*화학.*연결|유전.*생체분자|과학.*교과.*연결|자연과학.*연결/],
        semanticQuery: "응답이 생물과 화학 세특 사이의 연결을 강점으로 인식하고 있는가?",
      },
      {
        desc: "수학/국어 전공 미연결을 약점으로 지적해야 함",
        patterns: [/수학.*무관|국어.*미연결|수학.*국어.*보완|전공.*무관|비연결/],
        semanticQuery: "응답이 수학과 국어 세특이 전공과 연결되지 않는 점을 약점으로 지적하고 있는가?",
      },
      {
        desc: "교과 간 연결 보완 방법을 제시해야 함",
        patterns: [/통계.*활용|데이터.*분석|수학.*생명.*연결|과학.*에세이|수리.*모델|생물통계/],
        semanticQuery: "응답이 수학이나 국어 세특을 생명과학과 연결하기 위한 구체적 방법을 제시하고 있는가?",
      },
    ],
    mustNot: [],
    keywords: ["연결", "스토리라인", "서사", "교과", "생명과학"],
  },

  {
    id: 12,
    name: "[E2E] 복합 질문 — 다중 도구 체이닝 추천",
    studentProfile: { studentGrade: 3, schoolCategory: "general", targetMajor: "경영학" },
    question:
      "이 학생 서울대 종합전형 가능성 분석해줘. 내신은 1.8등급이고 비교과는 경영 관련 활동을 했습니다.",
    must: [
      {
        desc: "학생 기록/데이터 조회를 먼저 수행해야 함을 언급",
        patterns: [/getStudentRecords|기록.*조회|데이터.*먼저|분석.*위해.*조회/],
        semanticQuery: "응답이 분석을 위해 먼저 학생 기록이나 데이터를 조회해야 한다고 언급하고 있는가?",
      },
      {
        desc: "대학 평가 기준 조회를 언급해야 함",
        patterns: [/getUniversityEvalCriteria|서울대.*평가.*기준|인재상|서류평가/],
        semanticQuery: "응답이 서울대의 평가 기준이나 인재상을 확인해야 한다고 언급하고 있는가?",
      },
      {
        desc: "내신 추이 또는 비교과 강도 분석을 언급해야 함",
        patterns: [/analyzeGradeTrend|assessExtracurricularStrength|내신.*추이|비교과.*강도|비교과.*분석/],
        semanticQuery: "응답이 내신 추이 분석이나 비교과 강도 판별을 언급하고 있는가?",
      },
      {
        desc: "1.8등급 서울대 종합전형의 현실적 가능성을 평가해야 함",
        patterns: [/가능.*높|도전.*가능|1\.8.*SKY|교과.*안전|경쟁력/],
        semanticQuery: "응답이 내신 1.8등급으로 서울대 종합전형 지원의 현실적 가능성을 평가하고 있는가?",
        weight: 2,
      },
    ],
    mustNot: [
      {
        desc: "데이터 없이 단정적 불가 결론을 내려서는 안 됨",
        patterns: [/절대.*불가능|합격.*불가/],
        semanticQuery: "응답이 학생 기록을 확인하지 않고 합격 불가능하다고 단정하고 있는가?",
      },
    ],
    keywords: ["서울대", "종합전형", "내신", "경영", "분석"],
  },
];

// ============================================
// 3. 시스템 프롬프트 빌더
// ============================================

function buildBasePrompt(studentName: string): string {
  return `당신은 대입 컨설팅 AI 어시스턴트입니다. 컨설턴트가 학생의 생기부를 분석하고 전략을 수립하는 것을 도와줍니다.

## 현재 학생 정보
- 학생 이름: ${studentName}
- 학년도: 2026

## 중요 규칙
1. 한국어로 응답하세요.
2. 분석 결과는 항목별로 정리하여 가독성 있게 제공하세요.
3. 모든 평가와 제안에는 구체적 근거를 포함하세요.`;
}

function buildEnrichedPrompt(
  studentName: string,
  profile: Scenario["studentProfile"],
): string {
  const base = buildBasePrompt(studentName);
  const domain = buildDomainKnowledgeBlock(profile);
  return `${base}${domain}`;
}

// ============================================
// 4. 채점 엔진
// ============================================

interface CriterionResult {
  desc: string;
  patternMatch: boolean;
  semanticMatch: boolean | null; // null = 시맨틱 검증 안 함
  passed: boolean;
  weight: number;
}

interface ScoreBreakdown {
  must: { results: CriterionResult[]; score: number; max: number };
  mustNot: { results: CriterionResult[]; score: number; max: number };
  keywords: { hits: string[]; misses: string[]; score: number; max: number };
  total: number; // 100점 만점
}

function checkPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

const SemanticCheckSchema = z.object({
  answer: z.boolean(),
  evidence: z.string(),
});

async function checkSemantic(
  response: string,
  query: string,
  skipLlm: boolean,
): Promise<boolean | null> {
  if (skipLlm || !query) return null;

  try {
    const result = await generateObjectWithRateLimit({
      system:
        "당신은 텍스트 분석 전문가입니다. 주어진 응답에 대해 질문에 Yes/No로만 답하세요. 엄격하게 판단하세요.",
      messages: [
        {
          role: "user",
          content: `## 분석할 응답\n${response.slice(0, 3000)}\n\n## 질문\n${query}\n\n응답에 해당 내용이 명시적으로 또는 실질적으로 포함되어 있으면 true, 아니면 false로 답하세요.`,
        },
      ],
      schema: SemanticCheckSchema,
      modelTier: "fast",
      temperature: 0.0,
    });
    return result.object.answer;
  } catch {
    return null;
  }
}

async function scoreResponse(
  response: string,
  scenario: Scenario,
  skipLlm: boolean,
): Promise<ScoreBreakdown> {
  // MUST 채점
  const mustResults: CriterionResult[] = [];
  for (const c of scenario.must) {
    const patternMatch = checkPatterns(response, c.patterns);
    let semanticMatch: boolean | null = null;

    // 패턴 미매칭 시에만 시맨틱 검증 (비용 절약)
    if (!patternMatch && c.semanticQuery) {
      semanticMatch = await checkSemantic(response, c.semanticQuery, skipLlm);
    }

    const passed = patternMatch || semanticMatch === true;
    mustResults.push({
      desc: c.desc,
      patternMatch,
      semanticMatch,
      passed,
      weight: c.weight ?? 1,
    });
  }

  const mustMax = mustResults.reduce((s, r) => s + r.weight, 0);
  const mustScore = mustResults
    .filter((r) => r.passed)
    .reduce((s, r) => s + r.weight, 0);

  // MUST_NOT 채점 (통과 = 해당 패턴이 없어야 함)
  const mustNotResults: CriterionResult[] = [];
  for (const c of scenario.mustNot) {
    const patternMatch = checkPatterns(response, c.patterns);
    let semanticMatch: boolean | null = null;

    // 패턴 매칭됐으면 시맨틱으로 재확인 (false positive 방지)
    if (patternMatch && c.semanticQuery) {
      semanticMatch = await checkSemantic(response, c.semanticQuery, skipLlm);
    }

    // MUST_NOT: 패턴 미매칭이면 통과, 패턴 매칭이면 시맨틱으로 재확인
    const violated = patternMatch && (semanticMatch === null || semanticMatch === true);
    mustNotResults.push({
      desc: c.desc,
      patternMatch,
      semanticMatch,
      passed: !violated,
      weight: c.weight ?? 1,
    });
  }

  const mustNotMax = mustNotResults.reduce((s, r) => s + r.weight, 0);
  const mustNotScore = mustNotResults
    .filter((r) => r.passed)
    .reduce((s, r) => s + r.weight, 0);

  // KEYWORD 채점
  const keywordHits = scenario.keywords.filter((k) => response.includes(k));
  const keywordMisses = scenario.keywords.filter((k) => !response.includes(k));

  // 종합 점수: MUST 50% + MUST_NOT 30% + KEYWORD 20%
  const mustPct = mustMax > 0 ? (mustScore / mustMax) * 100 : 100;
  const mustNotPct = mustNotMax > 0 ? (mustNotScore / mustNotMax) * 100 : 100;
  const kwPct =
    scenario.keywords.length > 0
      ? (keywordHits.length / scenario.keywords.length) * 100
      : 100;

  const total = Math.round(mustPct * 0.5 + mustNotPct * 0.3 + kwPct * 0.2);

  return {
    must: { results: mustResults, score: mustScore, max: mustMax },
    mustNot: { results: mustNotResults, score: mustNotScore, max: mustNotMax },
    keywords: {
      hits: keywordHits,
      misses: keywordMisses,
      score: keywordHits.length,
      max: scenario.keywords.length,
    },
    total,
  };
}

// ============================================
// 5. 실행 & 출력
// ============================================

interface EvalResult {
  scenarioId: number;
  scenarioName: string;
  variant: "baseline" | "enriched";
  response: string;
  score: ScoreBreakdown;
  latencyMs: number;
}

async function runSingleEval(
  scenario: Scenario,
  variant: "baseline" | "enriched",
  skipLlm: boolean,
): Promise<EvalResult> {
  const studentName = "테스트 학생";
  const systemPrompt =
    variant === "baseline"
      ? buildBasePrompt(studentName)
      : buildEnrichedPrompt(studentName, scenario.studentProfile);

  const startTime = Date.now();
  const agentResult = await generateTextWithRateLimit({
    system: systemPrompt,
    messages: [{ role: "user", content: scenario.question }],
    modelTier: "fast",
    maxTokens: 2000,
    temperature: 0.3,
  });
  const latencyMs = Date.now() - startTime;

  const score = await scoreResponse(agentResult.content, scenario, skipLlm);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    variant,
    response: agentResult.content,
    score,
    latencyMs,
  };
}

function printCriterionResults(
  label: string,
  results: CriterionResult[],
  isNegative: boolean,
) {
  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    const method = r.patternMatch
      ? "패턴"
      : r.semanticMatch !== null
        ? "시맨틱"
        : "미검출";
    const weightStr = r.weight > 1 ? ` (x${r.weight})` : "";
    console.log(
      `    ${icon} [${method}]${weightStr} ${r.desc}`,
    );
  }
}

function printResults(results: EvalResult[], verbose: boolean) {
  console.log("\n" + "=".repeat(80));
  console.log("  도메인 지식 주입 효과 — 기준 기반 채점 결과");
  console.log("=".repeat(80));

  const scenarioIds = [...new Set(results.map((r) => r.scenarioId))];

  for (const id of scenarioIds) {
    const baseline = results.find(
      (r) => r.scenarioId === id && r.variant === "baseline",
    );
    const enriched = results.find(
      (r) => r.scenarioId === id && r.variant === "enriched",
    );
    if (!baseline || !enriched) continue;

    const scenario = SCENARIOS.find((s) => s.id === id)!;
    const diff = enriched.score.total - baseline.score.total;

    console.log(`\n${"─".repeat(80)}`);
    console.log(`시나리오 ${id}: ${scenario.name}`);
    console.log(`${"─".repeat(80)}`);

    // 총점 비교
    console.log(
      `\n  총점: Baseline ${baseline.score.total}/100 → Enriched ${enriched.score.total}/100 (${diff >= 0 ? "+" : ""}${diff})`,
    );

    // 세부 점수
    for (const [label, v] of [
      ["Baseline", baseline],
      ["Enriched", enriched],
    ] as const) {
      const s = v.score;
      console.log(
        `\n  [${label}] MUST ${s.must.score}/${s.must.max} | MUST_NOT ${s.mustNot.score}/${s.mustNot.max} | KW ${s.keywords.score}/${s.keywords.max} | ${v.latencyMs}ms`,
      );

      // MUST 상세
      if (s.must.results.some((r) => !r.passed)) {
        console.log("    ── MUST 실패 항목 ──");
        for (const r of s.must.results.filter((r) => !r.passed)) {
          const method =
            r.semanticMatch === null ? "패턴+시맨틱 모두 미매칭" : "시맨틱 미통과";
          console.log(`    FAIL (x${r.weight}) ${r.desc} [${method}]`);
        }
      }

      // MUST_NOT 상세
      if (s.mustNot.results.some((r) => !r.passed)) {
        console.log("    ── MUST_NOT 위반 항목 ──");
        for (const r of s.mustNot.results.filter((r) => !r.passed)) {
          console.log(`    FAIL (x${r.weight}) ${r.desc}`);
        }
      }

      // 키워드 누락
      if (s.keywords.misses.length > 0) {
        console.log(`    ── 누락 키워드: ${s.keywords.misses.join(", ")}`);
      }
    }

    if (verbose) {
      console.log(`\n  ── Baseline 응답 ──\n${baseline.response.slice(0, 500)}...`);
      console.log(`\n  ── Enriched 응답 ──\n${enriched.response.slice(0, 500)}...`);
    }
  }

  // 전체 요약
  console.log(`\n${"=".repeat(80)}`);
  console.log("  전체 요약");
  console.log("=".repeat(80));

  const baselineResults = results.filter((r) => r.variant === "baseline");
  const enrichedResults = results.filter((r) => r.variant === "enriched");

  const avgB =
    baselineResults.reduce((s, r) => s + r.score.total, 0) /
    baselineResults.length;
  const avgE =
    enrichedResults.reduce((s, r) => s + r.score.total, 0) /
    enrichedResults.length;

  console.log(`\n  Baseline 평균: ${avgB.toFixed(1)}/100`);
  console.log(`  Enriched 평균: ${avgE.toFixed(1)}/100`);
  console.log(
    `  개선폭: ${avgE - avgB >= 0 ? "+" : ""}${(avgE - avgB).toFixed(1)}점`,
  );

  // 시나리오별 한줄 요약
  console.log("\n  시나리오별 요약:");
  for (const id of scenarioIds) {
    const b = results.find((r) => r.scenarioId === id && r.variant === "baseline");
    const e = results.find((r) => r.scenarioId === id && r.variant === "enriched");
    if (!b || !e) continue;
    const d = e.score.total - b.score.total;
    const icon = d > 5 ? "UP" : d < -5 ? "DN" : "==";
    console.log(
      `    ${icon} #${id} ${b.scenarioName.padEnd(45)} ${b.score.total} → ${e.score.total} (${d >= 0 ? "+" : ""}${d})`,
    );
  }

  // MUST 실패율 비교
  const bMustFails = baselineResults.reduce(
    (s, r) => s + r.score.must.results.filter((c) => !c.passed).length,
    0,
  );
  const eMustFails = enrichedResults.reduce(
    (s, r) => s + r.score.must.results.filter((c) => !c.passed).length,
    0,
  );
  const totalMust = baselineResults.reduce(
    (s, r) => s + r.score.must.results.length,
    0,
  );

  console.log(
    `\n  MUST 기준 실패: Baseline ${bMustFails}/${totalMust} → Enriched ${eMustFails}/${totalMust}`,
  );
  console.log("");
}

// ============================================
// 6. Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose");
  const skipLlm = args.includes("--skip-llm");
  const scenarioArg = args.find((a) => a.startsWith("--scenario="));
  const targetIds = scenarioArg
    ? [parseInt(scenarioArg.split("=")[1])]
    : SCENARIOS.map((s) => s.id);

  const targetScenarios = SCENARIOS.filter((s) => targetIds.includes(s.id));

  const llmCalls = targetScenarios.length * 2;
  console.log(
    `\n[eval] ${targetScenarios.length}개 시나리오 × 2 variant = ${llmCalls}회 LLM 호출${skipLlm ? "" : " + 시맨틱 검증"}`,
  );

  const results: EvalResult[] = [];

  for (const scenario of targetScenarios) {
    console.log(`\n[eval] 시나리오 ${scenario.id}: ${scenario.name}`);

    console.log("  → Baseline...");
    const baseline = await runSingleEval(scenario, "baseline", skipLlm);
    results.push(baseline);

    console.log("  → Enriched...");
    const enriched = await runSingleEval(scenario, "enriched", skipLlm);
    results.push(enriched);

    const diff = enriched.score.total - baseline.score.total;
    console.log(
      `  → B:${baseline.score.total} E:${enriched.score.total} (${diff >= 0 ? "+" : ""}${diff})`,
    );
  }

  printResults(results, verbose);
}

main().catch((error) => {
  console.error("[eval] 실행 오류:", error);
  process.exit(1);
});
