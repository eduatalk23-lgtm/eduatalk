# Admission Domain Rules

## Scope
대학 입시 분석: 배치 엔진 (배치 분석), 배분 엔진 (수시 6장 최적화), 점수 계산기, Excel 입시 데이터 import, 별칭 검색.

## Architecture
```
admission/
├── index.ts           # Public API
├── repository.ts      # 대학/학과/입시 쿼리
├── types.ts           # 핵심 타입
├── placement/         # 배치 분석 엔진
│   ├── engine.ts      # 스냅샷 비교, 충원 확률 계산
│   ├── score-converter.ts  # 점수 변환
│   └── types.ts
├── allocation/        # 수시 6장 배분 최적화
│   ├── engine.ts      # C(n,6) 조합, 면접 겹침 확인, 티어 점수화 — 순수 함수
│   └── types.ts
├── calculator/        # 정시 점수 계산
│   ├── calculator.ts          # 메인 계산기
│   ├── config-parser.ts       # 대학별 점수 설정 파싱
│   ├── subject-selector.ts    # 과목 선택 최적화
│   ├── weighted-scorer.ts     # 가중 점수 전략
│   ├── percentage-scorer.ts   # 백분위 전략
│   └── restriction-checker.ts # 지원 제한 확인
├── search/            # 대학/학과 검색
│   ├── alias-resolver.ts  # 대학명 별칭 해소
│   └── constants.ts
└── import/            # Excel import 파이프라인
    ├── excel-parser.ts → header-detector.ts → cleaner.ts → transformer.ts → bulk-inserter.ts
    └── conversion/percentage/restriction/score-config parsers
```

## Enforced Rules

1. **엔진 함수 순수성**: `allocation/engine.ts`, `placement/engine.ts`는 순수 함수 (DB 접근 없음, async 없음). 이 원칙 위반 금지.
2. **면접 겹침 검사**: 배분 엔진에서 면접 날짜 overlap 체크 필수. 절대 생략 금지.
3. **점수 부동소수점 비교 금지**: 고정 정밀도 사용. 허용 오차 또는 정수 표현으로 비교.
4. **별칭 해소**: DB 쿼리 전 반드시 `alias-resolver.ts` 통과. 대학명 약칭 다수 존재.
5. **Excel Import 단계별 테스트**: parse → detect headers → clean → transform → validate → bulk insert. 각 단계 독립 테스트 가능.
6. **점수 계산 전략 패턴**: weighted/percentage/optional/mandatory scorer가 config로 조합. 기존 scorer 인터페이스 준수.

## Tests
```bash
pnpm test lib/domains/admission
```

## Related Domains
- `student-record`: 교과 적합성, 수능최저 시뮬레이터, 성적 데이터.
- `score`: 성적 데이터 → 배치 분석 입력.
- `lib/agents/tools/admission-tools.ts`: 런타임 에이전트가 입시 액션 호출.
