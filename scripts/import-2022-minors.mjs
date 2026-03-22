import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

// SQL 파일들 순차 실행
for (let i = 0; i < 5; i++) {
  const file = `/tmp/cu2022_${i}.sql`;
  if (!fs.existsSync(file)) continue;
  const sql = fs.readFileSync(file, 'utf-8');
  
  // SQL을 직접 실행할 수 없으므로, 파싱하여 upsert
  console.log(`Batch ${i}: processing...`);
}

// 직접 데이터 삽입
const data2022 = {
  "통합과학1": {
    "과학의 기초": ["시간과 공간 측정", "기본량과 단위", "측정과 어림", "정보와 신호"],
    "물질과 규칙성": ["천체 스펙트럼 분석", "원소 형성과 우주 역사", "원소의 주기성", "화학결합", "지각·생명체 물질 구성", "물질의 전기적 성질"],
    "시스템과 상호작용": ["지구시스템 구성과 상호작용", "판구조론과 지각변동", "중력장 내의 운동", "운동량과 충격량", "생명 시스템 화학반응", "세포 내 정보 흐름"],
  },
  "통학과학2": {
    "변화와 다양성": ["지질시대 환경 변화", "변이와 자연선택", "산화와 환원", "산·염기 반응", "물질 변화의 에너지"],
    "환경과 에너지": ["생태계 구성요소", "생태계 평형", "온실효과와 지구온난화", "핵융합과 에너지", "발전 원리", "신재생에너지와 효율"],
    "과학과 미래 사회": ["감염병 진단과 병원체", "빅데이터 활용", "인공지능과 로봇", "과학기술 윤리"],
  },
  "물리학": {
    "힘과 에너지": ["힘의 평형과 돌림힘", "뉴턴 운동 법칙", "운동량 보존 법칙", "일과 운동 에너지", "역학적 에너지 보존", "열과 에너지 전환"],
    "전기와 자기": ["전하와 전기장", "저항과 소비 전력", "축전기와 전기 에너지", "자성체", "전류의 자기 작용", "전자기 유도"],
    "빛과 물질": ["빛의 중첩과 간섭", "빛의 굴절과 렌즈", "빛과 물질의 이중성", "원자 에너지 준위", "반도체 에너지띠", "특수상대성이론"],
  },
  "화학": {
    "화학의 언어": ["화학의 기여", "몰과 물질의 양", "화학 반응식과 양적 관계"],
    "물질의 구조와 성질": ["화학 결합의 전기적 성질", "전기음성도와 결합 극성", "루이스 전자점식과 분자 구조", "분자 구조와 물질 성질"],
    "화학 평형": ["가역 반응과 화학 평형", "평형 상수", "반응 지수와 반응 방향", "평형 이동"],
    "역동적인 화학 반응": ["물의 자동 이온화와 pH", "몰 농도와 용액 제조", "중화 반응의 양적 관계", "중화 적정"],
  },
  "생명과학": {
    "생명 시스템의 구성": ["세포의 구조와 기능", "세포막과 물질 이동", "효소"],
    "항상성과 몸의 조절": ["신경계", "호르몬과 항상성", "방어 작용"],
    "생명의 연속성과 다양성": ["세포분열", "유전의 원리", "사람의 유전", "생물의 진화"],
  },
  "지구과학": {
    "대기와 해양의 상호작용": ["대기 대순환", "해수의 순환", "대기와 해양의 상호작용"],
    "지구의 역사와 한반도의 암석": ["지질시대", "한반도의 지질", "한반도의 암석"],
    "태양계 천체와 별과 우주의 진화": ["태양계 행성", "별의 물리량", "별의 진화", "우주의 팽창"],
  },
  "공통수학1": {
    "다항식": ["다항식의 사칙연산", "항등식과 나머지정리", "다항식의 인수분해"],
    "방정식과 부등식": ["복소수", "이차방정식", "이차함수", "삼차·사차방정식", "이차부등식"],
    "경우의 수": ["합의 법칙과 곱의 법칙", "순열", "조합"],
    "행렬": ["행렬의 뜻", "행렬의 연산"],
  },
  "공통수학2": {
    "도형의 방정식": ["선분의 내분", "두 직선의 관계", "점과 직선 사이의 거리", "원의 방정식", "평행이동과 대칭이동"],
    "집합과 명제": ["집합", "집합의 연산", "명제와 조건", "충분조건과 필요조건", "증명"],
    "함수와 그래프": ["함수의 개념", "합성함수", "역함수", "유리함수", "무리함수"],
  },
  "대수": {
    "지수함수와 로그함수": ["지수", "로그", "지수함수", "로그함수"],
    "삼각함수": ["일반각과 호도법", "삼각함수", "삼각함수의 그래프"],
    "수열": ["등차수열과 등비수열", "수열의 합", "수학적 귀납법"],
  },
  "미적분1": {
    "함수의 극한과 연속": ["함수의 극한", "함수의 연속"],
    "미분": ["미분계수와 도함수", "접선의 방정식", "함수의 증가·감소와 극대·극소"],
    "적분": ["부정적분과 정적분", "넓이"],
  },
  "확률과 통계": {
    "경우의 수": ["중복순열과 중복조합", "이항정리"],
    "확률": ["확률의 뜻과 성질", "조건부확률", "독립시행"],
    "통계": ["확률분포", "정규분포", "통계적 추정"],
  },
};

// 대단원 ID 조회
const { data: allMajors } = await supabase
  .from('exploration_guide_curriculum_units')
  .select('id, subject_name, unit_name')
  .eq('unit_type', 'major')
  .eq('curriculum_year', '2022');

const lookup = {};
for (const m of allMajors || []) {
  lookup[m.subject_name + '|' + m.unit_name] = m.id;
}

let sort = 700;
let totalInserted = 0;

for (const [subjectName, units] of Object.entries(data2022)) {
  const area = (subjectName.includes('수학') || subjectName === '대수' || subjectName === '미적분1' || subjectName === '확률과 통계') 
    ? '수학과' : '과학과';
  
  for (const [majorName, minors] of Object.entries(units)) {
    const parentId = lookup[subjectName + '|' + majorName];
    if (!parentId) {
      console.warn(`Parent not found: ${subjectName}|${majorName}`);
      continue;
    }
    
    const rows = minors.map(name => ({
      curriculum_year: '2022',
      subject_area: area,
      subject_name: subjectName,
      unit_type: 'minor',
      unit_name: name,
      parent_unit_id: parentId,
      sort_order: sort++,
    }));
    
    const { error } = await supabase.from('exploration_guide_curriculum_units').upsert(rows, {
      onConflict: 'curriculum_year,subject_area,subject_name,unit_type,unit_name',
      ignoreDuplicates: true,
    });
    
    if (error) console.error(`${subjectName}/${majorName}: ${error.message}`);
    else { totalInserted += rows.length; }
  }
}

console.log(`\n2022 소단원 삽입: ${totalInserted}건`);

const { count } = await supabase.from('exploration_guide_curriculum_units').select('*', { count: 'exact', head: true });
console.log(`최종 총 건수: ${count}건`);
