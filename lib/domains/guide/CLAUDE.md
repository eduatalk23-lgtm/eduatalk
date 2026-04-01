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

## 가이드 품질 — 세특 활용도 및 과학적 정합성

### 리뷰 6축 평가 (guideReviewSchema)
1. **academicDepth**: 학술적 깊이, 개념 정확성, 이론 전개
2. **scientificAccuracy**: 과학적 정합성 — 개념 혼동/논리적 비약/실험설계 타당성/결론 비자명성/출처 일치성
3. **studentAccessibility**: 고등학생 수준 적합성, AI 의존도
4. **structuralCompleteness**: 필수 섹션, 분량, 습니다 체 일관성
5. **practicalRelevance**: 생기부 세특/창체 활용 가능성, 교과 연계, 후속 탐구
6. **outlineQuality**: 목차형 아웃라인, depth 계층, tip, resources

### scientificAccuracy 감점 패턴 (F1~F6)
- 별개 원리의 활동을 하나로 포장 (F1)
- 실험결과→결론 인과 단절 (F2)
- 참고 도서 내용과 주장 불일치 (F3)
- 탐구 전제와 실험 방법의 개념 불일치 (F4)
- 비교군/대조군 설계 오류 (F5)
- 자명한 결론을 발견처럼 포장 (F6)

### 세특 기재 예시 — 8단계 흐름 기반
가이드의 세특 예시(setek_examples)는 아래 흐름을 반영해야 함:
호기심→주제→탐구→참고문헌→결론/제언→교사관찰→성장→오류→재탐구

## Tests
```bash
pnpm test lib/domains/guide
```

## Related Domains
- `student-record`: guide-context.ts가 학생 가이드 배정용 컨텍스트 빌드.
- `plan/llm`: Gemini rate limiter 공유 (`lib/domains/plan/llm/providers/gemini.ts`).
- `lib/agents/tools/guide-tools.ts`: 런타임 에이전트가 가이드 검색/추천 사용.
- `content`: 가이드 추천이 콘텐츠 아이템 참조.
