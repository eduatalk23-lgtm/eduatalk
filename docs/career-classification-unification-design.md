# 진로 분류 체계 통일 설계서

> 작성일: 2026-03-21
> 버전: 1.0
> 상태: 설계
> 선행: G0 ✅ + G1 ✅ 완료
> 후속: G2 (온보딩 + 가이드 매칭 + 중복 체크)의 기반

---

## 1. 문제

현재 시스템에 **3개의 서로 다른 분류 체계**가 공존하며, 상호 연결이 없다.

| 위치 | 체계 | 수 | 출처 | DB 필드 |
|------|------|---|------|---------|
| 학생 프로필 | `CAREER_FIELD_OPTIONS` | 10개 | 커스텀 (KEDI 변형) | `desired_career_field` |
| 생기부 | `MAJOR_RECOMMENDED_COURSES` | 22개 | 컨설팅 실무 커스텀 | `target_major` (전원 NULL) |
| 우회학과 | `department_classification` | 191개 (소분류) | Access DB | 별도 테이블 |

**결과**: 학생이 프로필에서 "사회계열"을 선택해도, 생기부의 교과 추천/가이드 매칭/역량 가중치에 반영되지 않음.

---

## 2. 통일안: KEDI 기반 3-Tier

### 정본(Source of Truth): `department_classification` 테이블 (이미 DB에 존재)

```
Tier 1: 대분류 7개 ← KEDI 7대계열 (학생 셀프 선택)
    ↓ 1:N
Tier 2: 중분류 ~25개 ← KEDI 중분류 (컨설턴트 1차 방향)
    ↓ 1:N
Tier 3: 소분류 ~150개 ← KEDI 소분류 (컨설턴트 정밀 설정 + 가이드 태깅)
```

### Tier 1: 대분류 7개

| 코드 | 대분류 | 현재 `CAREER_FIELD_OPTIONS` 대응 |
|------|--------|--------------------------------|
| HUM | 인문계열 | 인문계열 |
| SOC | 사회계열 | 사회계열 |
| EDU | 교육계열 | 교육계열 |
| ENG | 공학계열 | 공학계열 |
| NAT | 자연계열 | 자연계열 + 농업계열 + 해양계열 (합침) |
| MED | 의약계열 | 의약계열 |
| ART | 예체능계열 | 예체능계열 |

**변경**: 현재 10개에서 7개로 정규화. 농업/해양은 자연계열 하위 중분류. "기타" 제거.

### Tier 2: 중분류 ~26개

DB `department_classification`에서 추출한 실제 중분류 (N.C.E 제외):

| 대분류 | 중분류 | `MAJOR_RECOMMENDED_COURSES` 키 대응 |
|--------|--------|-------------------------------------|
| **인문사회** | 언어ㆍ문학 | 국어 + 외국어 |
| | 인문학 | 사학·철학 |
| | 경영ㆍ경제 | 경영·경제 |
| | 법학 | 법·행정 |
| | 사회과학 | 심리 + 사회복지 + 언론·홍보 + 정치·외교 + 사회 |
| | 교육 | 교육 |
| **자연** | 수학ㆍ물리ㆍ천문ㆍ지구 | 수리·통계 + 물리·천문 |
| | 화학ㆍ생명과학ㆍ환경 | 생명·바이오 |
| | 생활과학 | 생활과학 |
| | 농림ㆍ수산 | 농림 |
| | 간호 | (보건에 합침) |
| | 보건 | 보건 |
| | 약학 | 의학·약학 (약학 부분) |
| | 의료예과 | 의학·약학 (의학 부분) |
| | 의료 | 의학·약학 (본과) |
| **공학** | 전기ㆍ전자ㆍ컴퓨터 | 컴퓨터·정보 + 전기·전자 |
| | 건설 | 건축·사회시스템 |
| | 기계 | 기계·자동차·로봇 |
| | 재료 | 화학·신소재·에너지 (부분) |
| | 화공ㆍ고분자ㆍ에너지 | 화학·신소재·에너지 (부분) |
| | 산업ㆍ안전 | (기계에 합침) |
| | 교통ㆍ수송 | (기계에 합침) |
| **예체능** | 미술 | (신규) |
| | 음악 | (신규) |
| | 무용ㆍ체육 | (신규) |
| | 연극ㆍ영화 | (신규) |
| | 응용예술 | (신규) |

### Tier 3: 소분류 ~150개

DB `department_classification`에 이미 존재. N.C.E 제외 시 ~150개.

컨설팅에 유의미한 핵심 소분류 예시:

| 중분류 | 소분류 | 왜 구분이 필요한가 |
|--------|--------|------------------|
| 전기ㆍ전자ㆍ컴퓨터 | 전산학ㆍ컴퓨터공학, 인공지능공학, 전자공학, 의공학 | 교과 추천 + 세특 방향이 다름 |
| 경영ㆍ경제 | 경영학, 경제학, 회계ㆍ세무학, 금융ㆍ보험학 | 세특 키워드가 다름 |
| 기계 | 기계공학, 항공ㆍ우주공학, 자동차공학, 조선ㆍ해양공학 | 학생 동기 + 스토리라인 |
| 의료예과 | 의예과, 치의예과, 한의예과, 수의예과 | 입시 전략이 완전히 다름 |
| 사회과학 | 심리학, 행정학, 정치외교학, 사회복지학, 언론ㆍ방송ㆍ매체학 | 각각 다른 전공 |

---

## 3. DB 스키마 설계

### 3.1 students 테이블 필드 통일

| 필드 | 현재 | 변경 후 | 용도 |
|------|------|---------|------|
| `desired_career_field` | varchar (10개 커스텀) | **Tier 1 대분류 코드** | 학생 셀프 선택 |
| `target_major` | varchar (NULL) | **Tier 2 중분류 이름** (`department_classification.mid_name`) | 컨설턴트 1차 방향 |
| `target_major_2` | varchar (NULL) | 동일 (Tier 2 2순위) | 컨설턴트 |
| `target_sub_classification_id` | **(신규)** int FK | `department_classification.id` → Tier 3 소분류 | 컨설턴트 정밀 설정 |

### 3.2 매핑 상수 통일

**신규 파일**: `lib/constants/career-classification.ts`

```typescript
/** Tier 1: KEDI 7대계열 */
export const CAREER_TIER1 = [
  { code: "HUM", label: "인문계열" },
  { code: "SOC", label: "사회계열" },
  { code: "EDU", label: "교육계열" },
  { code: "ENG", label: "공학계열" },
  { code: "NAT", label: "자연계열" },
  { code: "MED", label: "의약계열" },
  { code: "ART", label: "예체능계열" },
] as const;

/** Tier 1 → Tier 2 매핑 */
export const TIER1_TO_TIER2: Record<string, string[]> = {
  HUM: ["언어ㆍ문학", "인문학"],
  SOC: ["경영ㆍ경제", "법학", "사회과학"],
  EDU: ["교육"],
  ENG: ["전기ㆍ전자ㆍ컴퓨터", "건설", "기계", "재료", "화공ㆍ고분자ㆍ에너지", "산업ㆍ안전", "교통ㆍ수송"],
  NAT: ["수학ㆍ물리ㆍ천문ㆍ지구", "화학ㆍ생명과학ㆍ환경", "생활과학", "농림ㆍ수산"],
  MED: ["의료", "의료예과", "간호", "보건", "약학"],
  ART: ["미술", "음악", "무용ㆍ체육", "연극ㆍ영화", "응용예술"],
};

/** Tier 2 (중분류) → MAJOR_RECOMMENDED_COURSES 키 매핑 */
export const TIER2_TO_COURSE_KEY: Record<string, string[]> = {
  "언어ㆍ문학": ["국어", "외국어"],
  "인문학": ["사학·철학"],
  "경영ㆍ경제": ["경영·경제"],
  "법학": ["법·행정"],
  "사회과학": ["심리", "사회복지", "언론·홍보", "정치·외교", "사회"],
  "교육": ["교육"],
  "전기ㆍ전자ㆍ컴퓨터": ["컴퓨터·정보", "전기·전자"],
  "건설": ["건축·사회시스템"],
  "기계": ["기계·자동차·로봇"],
  "재료": ["화학·신소재·에너지"],
  "화공ㆍ고분자ㆍ에너지": ["화학·신소재·에너지"],
  "수학ㆍ물리ㆍ천문ㆍ지구": ["수리·통계", "물리·천문"],
  "화학ㆍ생명과학ㆍ환경": ["생명·바이오"],
  "생활과학": ["생활과학"],
  "농림ㆍ수산": ["농림"],
  "의료": ["의학·약학"],
  "의료예과": ["의학·약학"],
  "간호": ["보건"],
  "보건": ["보건"],
  "약학": ["의학·약학"],
};
```

### 3.3 가이드 소분류 태깅

`exploration_guides`에 소분류 태깅을 위한 junction 테이블 추가:

```sql
CREATE TABLE exploration_guide_classification_mappings (
  id serial PRIMARY KEY,
  guide_id uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  classification_id int NOT NULL REFERENCES department_classification(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guide_id, classification_id)
);
```

기존 `career_field_id` (대분류) + `subject_id` (과목) 매핑에 더해, 소분류까지 연결.

---

## 4. 영향 범위

### 4.1 변경이 필요한 파일

| 파일 | 현재 | 변경 |
|------|------|------|
| `lib/utils/studentProfile.ts` | `CAREER_FIELD_OPTIONS` 10개 | KEDI 7대계열 + Tier 2 연동 |
| `lib/domains/student-record/constants.ts` | `MAJOR_RECOMMENDED_COURSES` 22개 | 유지 (Tier 2→Course 매핑으로 연결) |
| `lib/domains/bypass-major/constants.ts` | `CLASSIFICATION_TO_CAREER_FIELD` 28→22 | `TIER2_TO_COURSE_KEY`로 교체 |
| `lib/domains/bypass-major/competency-matcher.ts` | `CAREER_FIELD_COMPETENCY_WEIGHTS` 22개 | Tier 2 키 기준으로 정규화 |
| 학생 프로필 UI (`CareerInfoSection.tsx`) | 대분류 드롭다운만 | 대→중→소 3단계 드롭다운 |
| Admin 학생 상세 | `target_major` 설정 UI 없음 | 중분류+소분류 설정 UI 추가 |
| `course-adequacy.ts` | `target_major` 직접 참조 | `target_major` → `TIER2_TO_COURSE_KEY` 경유 |
| 가이드 매칭 (벡터 검색) | career_field + subject만 | + 소분류 필터 추가 |
| 생기부 레이어 탭 (G1) | 가이드 탭 전체 표시 | 소분류 기반 정밀 필터 |

### 4.2 변경이 불필요한 파일

| 파일 | 이유 |
|------|------|
| `MAJOR_RECOMMENDED_COURSES` | Tier 2→Course 매핑으로 연결. 상수 자체는 유지 |
| `department_classification` 테이블 | 이미 3-Tier 구조로 존재 (정본) |
| `university_departments` | 소분류 FK 이미 있음 |
| `department_curriculum` | 소분류와 무관 (학과 직접 연결) |
| 벡터 검색 RPC (`search_guides`) | 필터 파라미터 추가만 |

---

## 5. 기능별 개선 효과

### 5.1 가이드 매칭

**현재**: 벡터 유사도 + career_field(대분류) + subject_id(과목)
**이후**: 벡터 유사도 + career_field + subject_id + **classification_id(소분류)**

```
"인공지능공학" 학생:
  현재: "공학계열" → 공학 관련 가이드 전체 (수백건)
  이후: "인공지능공학" 소분류 태깅 가이드 우선 + 벡터 유사도 보조
```

### 5.2 세특 방향 가이드 생성

**현재**: `target_major` 없음 → 일반적 방향
**이후**: 소분류 "인공지능공학" → AI 특화 키워드, 관련 교수 연구 분야 반영

### 5.3 교과 추천

**현재**: 중분류 기반 추천 (컴퓨터·정보 전체)
**이후**: 소분류별 미세 조정 (AI→수학 심화, 소프트웨어→정보 강조)

### 5.4 우회학과

**현재**: 중분류 내 Jaccard 유사도
**이후**: 소분류 특성 반영 가중치 (같은 소분류→점수 부스트)

### 5.5 스토리라인 자동 감지

**현재**: 키워드 기반
**이후**: 소분류 관련 키워드 사전으로 감지 정밀도 향상

---

## 6. 구현 로드맵

### Phase C0: 매핑 상수 통일 (0.5일)

```
C0-1: lib/constants/career-classification.ts 생성 (CAREER_TIER1 + TIER1_TO_TIER2 + TIER2_TO_COURSE_KEY)
C0-2: CAREER_FIELD_OPTIONS → CAREER_TIER1으로 교체
C0-3: CLASSIFICATION_TO_CAREER_FIELD → TIER2_TO_COURSE_KEY로 교체
C0-4: 기존 참조 코드 일괄 업데이트
```

### Phase C1: DB 스키마 + 학생 필드 연결 (0.5일)

```
C1-1: students 테이블에 target_sub_classification_id 컬럼 추가 (FK)
C1-2: desired_career_field 기존 값 마이그레이션 (10개→7개 정규화)
C1-3: exploration_guide_classification_mappings 테이블 생성
```

### Phase C2: UI — 프로필 3단계 선택 (1일)

```
C2-1: CareerInfoSection.tsx — 대분류 선택 시 중분류 드롭다운 연동
C2-2: 중분류 선택 시 소분류 드롭다운 연동 (department_classification 쿼리)
C2-3: Admin 학생 상세에 target_major + target_sub_classification 설정 UI
```

### Phase C3: 가이드 소분류 태깅 (1일)

```
C3-1: 가이드 에디터에 소분류 태깅 UI 추가
C3-2: AI 가이드 생성 시 소분류 자동 태깅
C3-3: 벡터 검색 RPC에 classification_id 필터 추가
```

### Phase C4: 기존 시스템 연결 (1일)

```
C4-1: course-adequacy.ts — target_major → TIER2_TO_COURSE_KEY 경유
C4-2: competency-matcher.ts — Tier 2 키 정규화
C4-3: SetekEditor 가이드 탭 — 소분류 기반 정밀 필터
C4-4: 세특 방향 가이드 생성 — 소분류 컨텍스트 프롬프트 주입
```

---

## 7. 검증

1. `pnpm build` 성공
2. 기존 테스트 전체 통과 (247+)
3. 프로필 UI에서 대→중→소 3단계 선택 동작
4. 김가영 `desired_career_field: "사회계열"` → Tier 1 정규화 확인
5. 가이드 검색 시 소분류 필터 적용 확인
6. 교과 추천이 소분류에 따라 달라지는지 확인

---

## 부록: department_classification 소분류 전체 목록 (N.C.E 제외)

### 인문사회계열
- 언어ㆍ문학: 언어학, 국어ㆍ국문학, 독일어ㆍ문학, 러시아어ㆍ문학, 스페인어ㆍ문학, 영어ㆍ영문학, 일본어ㆍ문학, 중국어ㆍ문학, 프랑스어ㆍ문학, 기타아시아어ㆍ문학, 기타유럽어ㆍ문학, 교양어ㆍ문학, 문예창작학
- 인문학: 철학ㆍ윤리학, 역사ㆍ고고학, 종교학, 문화ㆍ민속ㆍ미술사학, 국제지역학, 교양인문학
- 경영ㆍ경제: 경영학, 경제학, 경영정보학, 무역ㆍ유통학, 광고ㆍ홍보학, 관광학, 부동산, 금융ㆍ보험학, 회계ㆍ세무학
- 법학: 법학
- 사회과학: 심리학, 사회학, 정치외교학, 국제학, 아동ㆍ가족학, 사회복지학, 소비자ㆍ가정자원, 언론ㆍ방송ㆍ매체학, 도시ㆍ지역ㆍ지리학, 행정학, 인류학, 문헌정보학, 교양사회과학, 군사ㆍ국방ㆍ안보
- 교육: 교육학, 언어교육, 초등교육, 사회과교육, 유아교육, 특수교육

### 자연과학계열
- 수학ㆍ물리ㆍ천문ㆍ지구: 수학, 통계학, 물리학, 천문ㆍ기상학, 지구과학, 해양학
- 화학ㆍ생명과학ㆍ환경: 화학, 생명과학, 환경학, 바이오테크놀로지학
- 생활과학: 식품영양학, 조리과학, 의류ㆍ의상학, 주거학
- 농림ㆍ수산: 작물ㆍ원예학, 산림학, 축산학, 수산학, 농림수산환경생태학, 농림수산바이오시스템공학, 식품가공학
- 간호: 간호학
- 보건: 보건학, 재활치료, 임상보건, 보건관리, 피부미용, 동물보건
- 약학: 약학, 한약학
- 의료예과: 의예과, 치의예과, 한의예과, 수의예과

### 공학계열
- 전기ㆍ전자ㆍ컴퓨터: 전기공학, 전자공학, 제어계측공학, 광학공학, 의공학, 응용소프트웨어공학, 전산학ㆍ컴퓨터공학, 정보ㆍ통신공학, 인공지능공학
- 건설: 건축학, 건축공학, 조경학, 토목공학, 도시공학, 환경공학
- 기계: 기계공학, 기전공학, 조선ㆍ해양공학, 항공ㆍ우주공학, 철도공학, 자동차공학
- 재료: 금속공학, 반도체공학, 신소재공학, 세라믹공학, 재료공학
- 화공ㆍ고분자ㆍ에너지: 화학공학, 에너지공학, 고분자공학, 생명공학, 섬유공학
- 산업ㆍ안전: 산업공학, 안전공학, 방재공학
- 교통ㆍ수송: 교통시스템공학, 철도운전제어학, 선박운항학, 항공운항학, 무인항공기(운항)학

### 의학계열
- 의료: 수의학, 의학, 치의학, 한의학

### 예체능계열
- 미술: 공예, 디자인, 순수미술, 응용미술, 미술학
- 음악: 작곡, 성악, 기악, 국악, 실용음악, 음악학
- 무용ㆍ체육: 무용, 체육
- 연극ㆍ영화: 연극, 영화, 방송연예
- 응용예술: 사진, 만화, 애니메이션, 게임, 영상예술, 음향
