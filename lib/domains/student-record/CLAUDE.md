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
└── llm/                  # AI 진단/전략 생성
```

## Enforced Rules

1. **NEIS 바이트 카운팅 (2계층)**: "500자" = 1500바이트. 한글=3B, ASCII=1B, 줄바꿈=2B.
   - **NEIS 제한 검증** (저장/표시): 반드시 `countNeisBytes()` + `validateNeisContent()` 사용. `detectNeisInvalidChars()`로 이모지 검출. → `service.ts`, `CharacterCounter.tsx`
   - **콘텐츠 실질성 휴리스틱** (경고/AI필터/배치추정): `string.length` 사용 OK. "내용이 있는가?" "AI에 보낼 만한가?" 판별에는 string.length가 한/영 공정하고 토큰 수 근사로도 적절.
2. **성적 정규화**: 9등급/5등급 양방향 변환. `GRADE_9_TO_5_MAP`, `GRADE_5_TO_9_MAP` 사용. 2022 개정은 진로선택 A/B/C (숫자 등급 없음). 비교/표시 전 `normalizeGrade()` 필수.
3. **역량 루브릭**: `COMPETENCY_RUBRIC_QUESTIONS`, `COMPETENCY_GRADE_RUBRICS` 상수 사용. 루브릭 기준 하드코딩 금지.
4. **Import 파이프라인**: parser → extractor → mapper → importer 체인. 각 단계 독립 테스트 가능해야 함.
5. **Client/Server 경계**: `index.ts`는 client-safe만 export. `repository.ts`, `service.ts`는 server-only. 클라이언트 컴포넌트에서 import 금지.
6. **타입 완전성**: RecordType union의 모든 variant를 switch에서 처리할 것.

## Tests
```bash
pnpm test lib/domains/student-record
```

## Related Domains
- `admission`: 수능최저 시뮬레이터, 교과 적합성 데이터
- `guide`: guide-context.ts → 오케스트레이터 가이드 도구
- `plan`: Cold Start가 학생 프로필 참조
- `lib/agents/tools/record-tools.ts`: 런타임 에이전트가 이 도메인에 강하게 의존
