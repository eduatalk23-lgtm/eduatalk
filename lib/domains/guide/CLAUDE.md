# Guide Domain Rules

## Scope
탐구 가이드 관리, 벡터 검색 (pgvector), LLM 생성, 가이드 import/export, 섹션 설정, 품질 티어, 가이드 배정, 자동 추천, 산출물, 공유.

## Architecture
```
guide/
├── index.ts           # Public API
├── repository.ts      # 1453줄 — 가이드 CRUD, 배정, 버전, 커리어, 교육과정, 추천 토픽
├── types.ts           # GuideListFilter, GuideUpsertInput, ExplorationGuide, GuideDetail 등
├── section-config.ts  # 가이드 타입별 섹션 구조 설정
├── actions/           # crud, assignment, student-guide, auto-recommend, ai-image, share, deliverable
├── llm/               # AI 가이드 생성 파이프라인
├── vector/            # 벡터 검색 시스템
│   ├── search-service.ts   # pgvector 하이브리드 검색 (벡터 + SQL 메타필터)
│   └── embedding-service.ts # Gemini text-embedding-004 (768차원)
├── import/            # transformer, subject-matcher, bulk-inserter, access-parser
├── export/            # guide-export.ts
└── utils/             # subject matching, URL parsing
```

## Enforced Rules

1. **벡터 검색 Rate Limit**: Gemini text-embedding-004 사용. `geminiRateLimiter` 통과 필수. 임베딩 저장: `exploration_guide_content.embedding` vector(768).
2. **repository.ts 수술적 수정**: 1453줄. 수정 시 관련 섹션만 읽고 수정. 명시적 요청 없이 리팩토링 금지.
3. **섹션 설정**: 새 가이드 타입 추가 시 `section-config.ts` 업데이트 필수. 타입별 섹션 요구사항 상이.
4. **가이드 공유**: 공유 가이드는 토큰 기반 (인증 불필요). 토큰 검증 + 만료 확인 필수.
5. **Import 파이프라인**: parse → subject match → transform → bulk insert. admission과 유사한 다단계 구조.
6. **품질 티어**: 가이드별 품질 티어 존재. 추천에 영향. 기존 티어 로직 준수.

## Tests
```bash
pnpm test lib/domains/guide
```

## Related Domains
- `student-record`: guide-context.ts가 학생 가이드 배정용 컨텍스트 빌드.
- `plan/llm`: Gemini rate limiter 공유 (`lib/domains/plan/llm/providers/gemini.ts`).
- `lib/agents/tools/guide-tools.ts`: 런타임 에이전트가 가이드 검색/추천 사용.
- `content`: 가이드 추천이 콘텐츠 아이템 참조.
