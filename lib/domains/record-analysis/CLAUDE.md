# Record Analysis Domain Rules

## Scope
생기부 AI 분석 파이프라인, LLM 프롬프트/액션, 평가 모듈. student-record 도메인의 CRUD/서비스 코드와 분리된 AI 분석 전용 도메인.

## Architecture
```
record-analysis/
├── pipeline/              # 3-Tier 파이프라인 (Grade 9태스크×8Phase + Synthesis 10태스크×6Phase)
│   ├── pipeline-config.ts        # client-safe 설정
│   ├── pipeline-types.ts         # client-safe 타입
│   ├── pipeline-executor.ts      # Phase별 실행 엔진
│   ├── pipeline-grade-phases.ts  # P1-P8 Phase 정의
│   ├── pipeline-data-resolver.ts # 콘텐츠 해소 4-layer
│   ├── pipeline-unified-input.ts # 통합 입력 빌더
│   ├── pipeline-task-runners*.ts # 태스크별 실행 로직 (7파일)
│   ├── pipeline-slot-generator.ts # 슬롯 생성
│   ├── pipeline-helpers.ts       # 공통 헬퍼
│   └── synthesis/                # S1-S6 Synthesis Phase (7파일)
├── llm/                   # LLM 액션, 프롬프트, 유틸리티
│   ├── actions/           # 18개 서버 액션 (generate*, analyze*, suggest*, detect*)
│   ├── prompts/           # 12개 프롬프트 빌더
│   ├── ai-client.ts       # AI SDK 래퍼
│   ├── retry.ts           # 지수 백오프 재시도 (1s→3s→10s, 최대 3회)
│   ├── extractJson.ts     # LLM 응답 JSON 파서
│   ├── types.ts           # LLM 입출력 타입
│   ├── error-handler.ts   # 에러 래퍼
│   └── edge-summary.ts    # Edge 요약 빌더
├── eval/                  # 평가 모듈 (5파일)
│   ├── executive-summary-evaluator.ts
│   ├── golden-dataset-evaluator.ts
│   ├── highlight-verifier.ts
│   ├── timeseries-analyzer.ts
│   └── university-profile-matcher.ts
└── __tests__/             # 20개 테스트 파일
```

## Dependencies
```
record-analysis/pipeline ──→ student-record/{types,constants,repository,course-plan,leveling}
record-analysis/llm      ──→ student-record/{types,constants,repository,actions/report,actions/pipeline}
record-analysis/eval     ──→ (없음, 완전 독립)

순환 의존 없음.
```

## Enforced Rules

1. **콘텐츠 해소 우선순위 (4-layer)**: `imported_content > confirmed_content > content > ai_draft_content`. pipeline-data-resolver, pipeline-unified-input, phase-s6-interview 모두 동일.
2. **Phase 간 데이터 흐름**: 원본 LLM 응답은 DB에만 저장. Phase 간 전달은 가공된 요약만 (analysisContext).
3. **태스크 의존성 가드**: `GRADE_TASK_PREREQUISITES`로 선행 실패 시 자동 스킵.
4. **LLM 재시도**: 모든 LLM 호출에 `withRetry()` 적용.
5. **Client/Server 경계**: `pipeline-config.ts`, `pipeline-types.ts`만 client-safe. 나머지는 server-only.
