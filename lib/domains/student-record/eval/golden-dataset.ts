/**
 * 생기부 품질 평가 골든 데이터셋
 *
 * 20개 샘플: 세특(14) + 창체(2) + 행특(2) + 경계값(2)
 * 각 샘플은 예상 품질 기준(점수 범위, 이슈 감지 여부)을 포함.
 *
 * 사용처: scripts/eval-student-record.ts (회귀 스크립트)
 *
 * 이슈 코드 접두사 매칭 규칙:
 *   mustHaveIssues: 코드 접두사가 issues 배열 어딘가에 포함되어야 함 (부분 매칭)
 *   mustNotHaveIssues: 코드 접두사가 issues 배열에 전혀 없어야 함
 */

export interface EvalExpectation {
  /** contentQuality.overallScore >= this */
  minScore?: number;
  /** contentQuality.overallScore <= this */
  maxScore?: number;
  /** 이 코드들이 issues 배열에 모두 포함되어야 함 (접두사 매칭) */
  mustHaveIssues?: string[];
  /** 이 코드들이 issues 배열에 하나도 없어야 함 (접두사 매칭) */
  mustNotHaveIssues?: string[];
}

export interface EvalSample {
  id: string;
  description: string;
  recordType: "setek" | "changche" | "haengteuk";
  subjectName?: string;
  grade?: number;
  content: string;
  expected: EvalExpectation;
}

export const GOLDEN_DATASET: EvalSample[] = [
  // ─── 카테고리 A: 고품질 세특 (score ≥ 65) ─────────────────────────────────

  {
    id: "setek-high-math",
    description: "수학I — 8단계 완전, 자기주도 탐구, 교사 평가 구체",
    recordType: "setek",
    subjectName: "수학I",
    grade: 2,
    content:
      "미분과 적분의 관계를 탐구하는 과정에서 단순 공식 암기를 넘어 극한의 개념에서 미분이 유도되는 과정을 직접 증명함. ε-δ 정의를 통해 연속성과 미분가능성의 관계를 탐구하고, 연속이지만 미분 불가능한 바이어슈트라스 함수를 조사하여 발표함. 수업 중 리만 합의 한계를 발견하고 르베그 적분의 개념을 교사에게 질문하여 토론함. 처음에는 ε-δ 논법의 추상성에 어려움을 겪었으나 수학적 귀납법과 연결하여 이해하게 됨. 교사는 '수학적 사고의 깊이가 고등학생 수준을 넘는다'고 평가함. 이를 통해 수학의 엄밀성이 응용보다 선행되어야 함을 깨달음.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-physics",
    description: "물리학I — 실험설계, 오차 분석, 성장서사 완비",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 2,
    content:
      "빛의 파동-입자 이중성 탐구에서 이중 슬릿 실험을 직접 설계하여 간섭무늬를 관찰함. 예상 파장과 실측값의 오차율 7.3%를 분석하여 슬릿 폭의 부정확성과 단색광 순도가 원인임을 밝힘. 드브로이 파장 공식을 적용하여 전자의 파동성을 수리적으로 검증함. 교사는 '오차 분석의 깊이가 고등학생 수준을 넘는다'고 평가함. 초기에는 간섭무늬 재현이 어려웠으나 광원 정렬을 개선하여 문제를 극복함. 이 경험을 통해 측정 불확실성이 양자역학의 불확정성 원리와 근본적으로 다름을 이해하게 됨.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10", "F2"],
    },
  },

  {
    id: "setek-high-chem",
    description: "화학I — 갈바니전지 실험, 네른스트 방정식, 전공 연계",
    recordType: "setek",
    subjectName: "화학I",
    grade: 2,
    content:
      "산화-환원 반응에서 전자 전달 메커니즘을 탐구하여 갈바니 전지의 기전력(EMF) 변화를 실험으로 확인함. 네른스트 방정식을 이용하여 이론값(1.10V)과 실측값(1.07V)의 차이를 반응물 농도 변화로 설명함. 리튬이온 전지에서 흑연 대신 실리콘 음극재를 사용할 때의 이론적 에너지 밀도를 계산하여 발표함. 교사는 열역학적 접근 방식이 탁월하다고 평가함. 실험 초기 오차가 컸으나 온도 보정을 추가하여 정확도를 높임. 배터리 연구자를 목표로 구체적인 진로를 설계하게 됨.",
    expected: {
      minScore: 68,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-bio",
    description: "생명과학I — CRISPR 탐구, 윤리적 검토, 교사 평가",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 1,
    content:
      "유전자 편집 기술에 관심을 가지고 CRISPR-Cas9의 작동 원리를 탐구함. gRNA의 염기 서열 설계 원리와 Cas9 단백질의 절단 메커니즘을 논문을 통해 이해하고 이를 도식화하여 발표함. 특히 off-target 편집 문제를 발견하고 이를 최소화하는 고정밀 Cas9 변이체에 대한 최신 연구를 조사함. 교사는 생명윤리 쟁점까지 균형 있게 검토했다고 평가함. 처음에는 분자생물학 개념이 낯설었으나 생화학 교재를 참고하여 이해를 심화함. 이 탐구를 통해 기초과학 연구의 사회적 책임을 실감하게 됨.",
    expected: {
      minScore: 65,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "setek-high-lit",
    description: "문학 — 텍스트 비판적 분석, 사회문화적 맥락 연결",
    recordType: "setek",
    subjectName: "문학",
    grade: 3,
    content:
      "김승옥의 「무진기행」을 읽고 안개의 상징성을 분석하여 발표함. 안개를 현실 회피와 자아 분열의 메타포로 읽으면서, 1960년대 산업화 시대의 지식인이 겪는 실존적 위기를 사회문화적 맥락에서 해석함. 주인공 윤희중의 귀향과 이탈 구조를 카뮈의 이방인과 비교하여 실존주의적 독해를 시도함. 교사는 문학작품을 사회사적 텍스트로 읽는 시각이 탁월하다고 평가함. 처음에는 텍스트 표면 읽기에 머물렀으나 토론을 통해 심층 읽기의 방법을 익히게 됨. 비판적 읽기가 모든 인문학의 출발점임을 깨달음.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  // ─── 카테고리 B: P1 나열식 ────────────────────────────────────────────────

  {
    id: "setek-p1-bio",
    description: "생명과학 나열식 — 단원명만 열거, 연결성 없음",
    recordType: "setek",
    subjectName: "생명과학I",
    grade: 1,
    content:
      "세포 분열에 대해 배웠다. 체세포 분열은 간기·전기·중기·후기·말기로 이루어진다. 감수 분열도 배웠다. 감수 1분열과 감수 2분열로 나뉜다. DNA 복제를 배웠다. 전사와 번역 과정을 배웠다. 리보솜에서 단백질이 합성된다. 다양한 실험을 하였다. 교사가 성실하다고 칭찬하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-chem",
    description: "화학I 나열식 — 개념 열거, 탐구 흐름 없음",
    recordType: "setek",
    subjectName: "화학I",
    grade: 1,
    content:
      "원소 주기율표를 공부했다. 원소의 전자배치를 배웠다. 이온화 에너지를 배웠다. 전기음성도를 배웠다. 공유결합, 이온결합, 금속결합을 배웠다. 분자의 구조를 배웠다. 루이스 전자점식을 배웠다. 문제를 열심히 풀었다. 수업에 성실히 참여하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  {
    id: "setek-p1-social",
    description: "사회 나열식 — 키워드만, 과정 서술 없음",
    recordType: "setek",
    subjectName: "사회·문화",
    grade: 2,
    content:
      "문화의 속성, 문화 변동, 문화 상대주의, 자문화 중심주의, 문화 사대주의를 배웠다. 사회화, 사회 집단, 일탈 행동 이론도 공부했다. 사회 계층, 사회 이동, 사회 불평등을 배웠다. 각 단원의 개념을 이해하고 문제를 풀었다. 발표도 하였다.",
    expected: {
      maxScore: 55,
      mustHaveIssues: ["P1"],
    },
  },

  // ─── 카테고리 C: F2 인과단절 ──────────────────────────────────────────────

  {
    id: "setek-f2-physics",
    description: "물리학 → 블랙홀 → 환경문제: 논리 비약 3단 도약",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 2,
    content:
      "뉴턴의 운동법칙을 공부하다가 블랙홀에 관심이 생겨 호킹 복사를 조사하였다. 양자역학과 일반 상대성이론의 통합 문제를 알게 되었다. 이를 통해 환경오염 문제의 심각성을 깨달았고, 탄소중립 실현을 위해 헌신하고 싶다는 생각을 하게 되었다. 앞으로 환경 정책을 연구하는 사회학자가 되고 싶다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  {
    id: "setek-f2-math",
    description: "수학 미적분 → AI → 사회 불평등: 비약적 결론",
    recordType: "setek",
    subjectName: "수학II",
    grade: 2,
    content:
      "미적분을 공부하다가 AI 알고리즘에 관심을 갖게 되었다. AI 기술이 발전하면 일자리를 빼앗아 사회 불평등이 심화될 것이라고 생각했다. 따라서 기본소득제 도입이 반드시 필요하다고 결론 내렸다. 앞으로 복지정책을 연구하는 사회학자가 되고 싶다.",
    expected: {
      maxScore: 65,
      mustHaveIssues: ["F2"],
    },
  },

  // ─── 카테고리 D: F10 성장부재 ────────────────────────────────────────────

  {
    id: "setek-f10-physics",
    description: "전자기 학습 — 활동 나열, 성장·깨달음 서사 없음",
    recordType: "setek",
    subjectName: "물리학II",
    grade: 3,
    content:
      "전기와 자기 단원에서 쿨롱 법칙, 가우스 법칙, 앙페르 법칙을 학습하였다. 맥스웰 방정식의 의미를 파악하고 정리하여 발표하였다. 전자기 유도와 패러데이 법칙을 이해하고 문제를 풀었다. 교사가 이해력이 좋다고 평가하였다. 다음 단원도 열심히 공부할 계획이다.",
    expected: {
      maxScore: 62,
      mustHaveIssues: ["F10"],
    },
  },

  {
    id: "setek-f10-chem",
    description: "유기화합물 — 개념 정리, 변화·극복 서사 없음",
    recordType: "setek",
    subjectName: "화학II",
    grade: 3,
    content:
      "유기화합물 단원에서 알케인, 알켄, 알카인의 구조와 성질을 공부하였다. 작용기별 반응 특성을 표로 정리하였다. 고분자 화합물의 합성 과정을 이해하였다. 수업 중 제시된 문제를 모두 해결하였다. 화학에 대한 관심이 높아졌다.",
    expected: {
      maxScore: 62,
      mustHaveIssues: ["F10"],
    },
  },

  // ─── 카테고리 E: F16 진로과잉도배 ───────────────────────────────────────

  {
    id: "setek-f16-pe",
    description: "체육 — 모든 활동에 의학 진로 억지 연결",
    recordType: "setek",
    subjectName: "체육",
    grade: 2,
    content:
      "체육 수업에서 달리기 훈련을 하며 심폐기능 향상을 위한 유산소 운동의 의학적 효과를 탐구하였다. 의사가 되기 위해 심박수와 심장질환의 상관관계를 조사하였다. 배드민턴 경기에서 부상 예방을 위한 의학적 원리를 적용하여 의사의 관점으로 운동을 분석하였다. 근육 회복 메커니즘을 의학 교재로 조사하며 의과대학 진학 준비를 하였다. 모든 체육 활동을 의사가 되기 위한 과정으로 연결하여 진로를 구체화하였다.",
    expected: {
      mustHaveIssues: ["F16"],
    },
  },

  // ─── 카테고리 F: M1 교사관찰불가 ────────────────────────────────────────

  {
    id: "setek-m1-math",
    description: "수학 — 교사 관찰·평가 문장 완전 부재, 학생 자술",
    recordType: "setek",
    subjectName: "수학I",
    grade: 1,
    content:
      "함수의 극값과 변곡점을 직접 계산하는 연습을 많이 했다. 복잡한 합성함수의 미분도 할 수 있게 되었다. 정적분의 기하학적 의미를 이해하고 넓이 계산에 적용할 수 있다. 로피탈 정리를 적용하는 방법을 익혔다. 앞으로도 꾸준히 공부할 것이다.",
    expected: {
      mustHaveIssues: ["M1"],
    },
  },

  // ─── 카테고리 G: 창체 ─────────────────────────────────────────────────────

  {
    id: "changche-high-club",
    description: "수학탐구 동아리 — 몬테카를로, 주도적 역할, 발견",
    recordType: "changche",
    grade: 2,
    content:
      "수학 탐구 동아리에서 뷔퐁의 바늘 실험을 프로그래밍으로 구현하여 몬테카를로 시뮬레이션의 원리를 탐구함. 반복 횟수 증가에 따른 π 근사값의 수렴 속도를 분석하고 중심극한정리와의 연관성을 발견함. 1만 회 시뮬레이션에서 오차율 0.02%를 달성하여 부원들에게 발표함. 교사는 확률론적 사고의 깊이가 놀랍다고 평가함. 처음에는 수렴 속도가 느려 실망했으나 난수 생성 알고리즘을 개선하여 극복함. 확률론이 현실 세계 모델링의 핵심임을 깨달음.",
    expected: {
      minScore: 63,
      mustNotHaveIssues: ["P1", "F10"],
    },
  },

  {
    id: "changche-p1-career",
    description: "진로 창체 나열식 — 활동명만 나열, 성과 없음",
    recordType: "changche",
    grade: 1,
    content:
      "진로 동아리 활동에 참여하였다. 직업 탐색 활동을 하였다. 봉사 활동을 다녀왔다. 진로 체험 학습에 참가하였다. 자기 이해 검사를 실시하였다. 다양한 활동을 통해 진로에 대해 알게 되었다.",
    expected: {
      maxScore: 52,
      mustHaveIssues: ["P1"],
    },
  },

  // ─── 카테고리 H: 행특 ─────────────────────────────────────────────────────

  {
    id: "haengteuk-high",
    description: "행특 고품질 — 5단계(태도·학습·관계·리더십·전망) 완비",
    recordType: "haengteuk",
    grade: 3,
    content:
      "학습에 대한 자발적 의지가 강하며 어려운 개념도 포기하지 않고 끝까지 이해하려는 태도가 돋보임. 수학 시간에 동급생이 이해하지 못한 부분을 스스로 정리하여 친구들에게 설명하는 등 협력적 학습자의 면모를 보임. 학생회 부회장으로서 축제 준비 과정에서 갈등 상황을 중재하고 팀원들의 의견을 조율하는 리더십을 발휘함. 실패한 기획에서도 원인을 분석하고 개선안을 제시하는 성숙한 태도를 보임. 3년간 꾸준한 성장세를 보이며 명확한 진로 계획을 갖추고 있어 앞으로의 발전이 기대됨.",
    expected: {
      minScore: 60,
      mustNotHaveIssues: ["P1"],
    },
  },

  {
    id: "haengteuk-low",
    description: "행특 단순 — 형식적 칭찬, 구체성 없음",
    recordType: "haengteuk",
    grade: 1,
    content:
      "수업에 성실히 참여하고 과제를 잘 수행함. 친구들과 사이가 좋고 학교생활에 잘 적응함. 예의 바르고 성실한 학생임. 앞으로도 발전할 것으로 기대됨.",
    expected: {
      maxScore: 58,
    },
  },

  // ─── 카테고리 I: 경계값/복합 ──────────────────────────────────────────────

  {
    id: "setek-borderline",
    description: "생명과학 기본 탐구 — 완성도 중간, 구체성 부족",
    recordType: "setek",
    subjectName: "생명과학II",
    grade: 3,
    content:
      "줄기세포의 종류와 특성을 조사하여 발표하였다. 전능성, 만능성, 다능성 줄기세포의 차이를 이해함. 유도만능줄기세포(iPSC) 기술의 의학적 활용 가능성을 검토하였다. 교사는 자료 조사가 충실하다고 평가함. 더 깊이 탐구하고 싶다는 생각을 가지게 됨.",
    expected: {
      minScore: 42,
      maxScore: 72,
    },
  },

  {
    id: "setek-p1-f10-combo",
    description: "물리 나열식 + 성장부재 복합 — 두 패턴 동시 감지",
    recordType: "setek",
    subjectName: "물리학I",
    grade: 1,
    content:
      "힘과 운동을 배웠다. 뉴턴의 운동 3법칙을 배웠다. 등가속도 운동을 배웠다. 포물선 운동을 배웠다. 원운동을 배웠다. 각 단원의 공식을 외우고 문제를 풀었다. 교사가 문제 풀이 능력이 좋다고 평가하였다.",
    expected: {
      maxScore: 50,
      mustHaveIssues: ["P1"],
    },
  },
];
