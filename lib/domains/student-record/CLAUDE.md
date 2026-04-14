# Student Record Domain Rules

## Scope
생기부 관리, 역량 진단, 성적 정규화, NEIS 검증, 데이터 import/export, 수강 계획, 경고 엔진, 면접 준비, 전략 관리.

## Architecture
```
student-record/
├── index.ts              # Public API (client-safe exports만)
├── service.ts            # 비즈니스 로직 (NEIS 바이트 검증, 줄바꿈 정규화)
├── repository.ts         # 데이터 접근 (탭별 lazy loading)
├── types.ts              # 60+ 타입 (RecordSetek, Diagnosis, Strategy 등)
├── constants.ts          # CHAR_LIMITS, COMPETENCY_ITEMS, GRADE_CONVERSION_TABLE
├── validation.ts         # countNeisBytes(), detectNeisInvalidChars()
├── grade-normalizer.ts   # grade9To5(), grade5To9(), normalizeGrade()
├── rubric-matcher.ts     # 역량 루브릭 매칭 엔진
├── min-score-simulator.ts # 수능최저 시뮬레이션
├── course-adequacy.ts    # 전공 적합 교과 분석
├── stale-detection.ts    # 데이터 신선도 감지
├── warnings/             # 경고 엔진 (engine.ts, types.ts)
├── course-plan/          # 수강 계획 (recommendation.ts, sync.ts)
├── import/               # parser → extractor → mapper → importer 체인
├── export/               # report-export.ts
├── leveling/             # L0~L6 설계 모드 레벨링 (engine.ts, types.ts, resolve-tier.ts)
├── evaluation-criteria/  # 루브릭/포맷터/flow-completion (record-analysis/llm 에서도 사용)
├── cohort/               # 코호트 분석
├── repository/           # 12개 repository (record/competency/diagnosis/edge/hyperedge/storyline/...)
├── actions/              # CRUD/오케스트레이터 액션 (24파일)
└── report/               # 리포트 빌드/공유
```

**AI 분석/파이프라인 코드**는 별도 도메인 `lib/domains/record-analysis/`로 분리됨.
- 파이프라인 엔진(`pipeline/`), LLM 액션(`llm/`), 평가 모듈(`eval/`)의 실제 구현과 규칙·다이어그램·DB 테이블·LLM 모델 매핑 등은 모두 `lib/domains/record-analysis/CLAUDE.md`에서 단일 관리한다.
- 신규 코드는 `@/lib/domains/record-analysis/...`를 직접 import. (re-export stub은 제거됨)

## Enforced Rules

1. **NEIS 바이트 카운팅 (2계층)**: "500자" = 1500바이트. 한글=3B, ASCII=1B, 줄바꿈=2B.
   - **NEIS 제한 검증** (저장/표시): 반드시 `countNeisBytes()` + `validateNeisContent()` 사용. `detectNeisInvalidChars()`로 이모지 검출. → `service.ts`, `CharacterCounter.tsx`
   - **콘텐츠 실질성 휴리스틱** (경고/AI필터/배치추정): `string.length` 사용 OK. "내용이 있는가?" "AI에 보낼 만한가?" 판별에는 string.length가 한/영 공정하고 토큰 수 근사로도 적절.
2. **성적 정규화**: 9등급/5등급 양방향 변환. `GRADE_9_TO_5_MAP`, `GRADE_5_TO_9_MAP` 사용. 2022 개정은 진로선택 A/B/C (숫자 등급 없음). 비교/표시 전 `normalizeGrade()` 필수.
3. **역량 루브릭**: `COMPETENCY_RUBRIC_QUESTIONS`, `COMPETENCY_GRADE_RUBRICS` 상수 사용. 루브릭 기준 하드코딩 금지.
4. **Import 파이프라인**: parser → extractor → mapper → importer 체인. 각 단계 독립 테스트 가능해야 함.
5. **Client/Server 경계**: `index.ts`는 client-safe만 export. `repository.ts`, `service.ts`는 server-only. 클라이언트 컴포넌트에서 import 금지.
6. **타입 완전성**: RecordType union의 모든 variant를 switch에서 처리할 것.

## 생기부 평가 프레임워크 (입시 전문가 기준)

### 정량평가 핵심 (중요도 순)
1. 주요교과 내신성적 → `academic_achievement` + 루브릭 4개 질문
2. 진로(계열)교과 성취도 → `career_course_achievement` + `course-adequacy.ts`
3. 학기별 성적 추이 → 합격자는 3학년 1학기 상승 뚜렷

### 정성평가 핵심 (중요도 순)
1. 진로교과 세특 (~40%) — 가장 변별력 높은 영역
2. 진로교과 이수 (~30%) — 관문 역할
3. 동아리/진로 창체 세특 (~30%) — 세특 보완 역할

### 좋은 세특 8단계 순환 흐름
```
①지적호기심 → ②주제선정(진로연결) → ③탐구내용/이론 → ④참고문헌
→ ⑤결론(해결/제언/고안) → ⑥교사관찰(구체적 근거) → ⑦성장서사
→ ⑧오류분석→재탐구 (→①순환)
```

### 진로교과 vs 비진로교과 차등 (대학 수준별)
- **진로교과**: 최소 ①②③⑤ 충족 필수. SKY카+는 ①②③④⑤(참고문헌 포함)
- **비진로교과**: 교과 역량 중심이 정상. 진로 연결 없어도 감점 없음
- **진로 연결 비율**: 상위권=가능한 모든 진로교과, 중하위=3~4과목
- **주의**: 모든 교과에 진로 도배하면 역효과 (입학사정관 감점, F16=major)

### 창체 가중치: 동아리 = 진로 (동등) > 자율

### 합격률 낮은 패턴 14개 (경고 엔진 반영)
- P1 나열식 / P3 키워드만 / P4 내신↔탐구불일치(critical)
- F1~F6: 별개활동포장, 인과단절(critical), 출처불일치, 전제불일치, 비교군오류, 자명한결론
- F10 성장부재(minor) / F12 자기주도성부재 / F16 진로과잉도배(major) / M1 교사관찰불가(minor)

### 품질 5축 평가 (ContentQualityScore)
specificity(25) + coherence(15) + depth(25) + grammar(10) + scientificValidity/연구정합성(25) = overallScore
- 이공계: 과학·수리적 정합성 / 인문·사회계: 사회연구방법론 정합성

## Pipeline Architecture

AI 분석 파이프라인 (Grade 9태스크×8Phase + Synthesis 10태스크×6Phase), DB 테이블, 분석 데이터 3중 저장 전략, 삭제 정책, Polymorphic FK 패턴, LLM Actions 매핑, UI 4단계 탭 구조, 새 태스크 추가 체크리스트, 파이프라인 변경 시 문서 동기화 규칙 등은 모두 record-analysis 도메인이 단일 관리한다.

→ **`lib/domains/record-analysis/CLAUDE.md`** 참조.

이 파일(student-record/CLAUDE.md)에는 CRUD/서비스/도메인 모델·검증·평가 프레임워크만 다룬다.

## Tests
```bash
pnpm test lib/domains/student-record
```

## Related Domains
- `admission`: 수능최저 시뮬레이터, 교과 적합성 데이터
- `guide`: guide-context.ts → 오케스트레이터 가이드 도구
- `plan`: Cold Start가 학생 프로필 참조
- `lib/agents/tools/record-tools.ts`: 런타임 에이전트가 이 도메인에 강하게 의존
