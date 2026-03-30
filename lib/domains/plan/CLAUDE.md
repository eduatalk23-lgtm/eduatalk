# Plan Domain Rules

## Scope
학습 플랜 CRUD, LLM 기반 생성, Cold Start 추천, 스케줄링 엔진, 트랜잭션, 캐시 무효화.

## Architecture
```
plan/
├── index.ts          # Public API (types + actions + transactions)
├── service.ts        # 비즈니스 로직 → repository 호출
├── repository.ts     # Supabase 쿼리 전용
├── transactions.ts   # RPC 원자적 연산 (createPlanGroupAtomic, generatePlansAtomic)
├── actions/          # Server Actions (26개)
├── services/         # 스케줄링 엔진 (adaptiveScheduler, conflictResolver, AvailabilityService 등)
├── utils/            # 캐시 무효화, 검증, 재정렬 계산
└── llm/              # LLM 파이프라인
    ├── ai-sdk.ts         # generateTextWithRateLimit / generateObjectWithRateLimit
    ├── providers/        # Gemini, Anthropic, OpenAI
    ├── prompts/          # 시스템/유저 프롬프트
    ├── actions/coldStart/ # Cold Start 파이프라인 (pipeline.ts → persistence/ → batch/)
    ├── transformers/     # requestBuilder, responseParser
    └── validators/       # planValidator, enhancedPlanValidator
```

## Enforced Rules

1. **다중 테이블 쓰기 → RPC 트랜잭션 필수**: plan_groups + student_plans를 별도 쿼리로 쓰지 말 것. 반드시 `transactions.ts`의 RPC 함수 사용.
2. **LLM Rate Limit**: Gemini Free = 일 20회, 분 15회. 반드시 `ai-sdk.ts`의 `generateTextWithRateLimit`/`generateObjectWithRateLimit` 래퍼 사용. 배치 전 `getGeminiQuotaStatus()` 확인.
3. **스케줄링 충돌 검사**: 플랜 배치 시 반드시 `conflictResolver.ts` 또는 `AvailabilityService.ts`로 시간 슬롯 확인. 빈 슬롯 가정 금지.
4. **Service > Repository**: 비즈니스 로직은 service.ts, 데이터 접근은 repository.ts. Actions → Service → Repository 순서.
5. **캐시 무효화**: 공통 CRUD는 `utils/cacheInvalidation.ts`의 `revalidatePlanCache()` 사용. 단, 액션별로 필요한 경로가 다를 수 있으므로(예: timezone, admin 경로) raw `revalidatePath()` 직접 ���출도 허용. 핵심은 **필요한 경로가 모두 무효화되는 것**이지 특정 유틸 사용이 아님.
6. **타입 안전**: 플랜 상태는 `PlanStatus` enum 사용. 문자열 리터럴 금지.

## Tests
```bash
pnpm test lib/domains/plan
pnpm test __tests__/plan
pnpm test __tests__/integration/aiPlanValidation
```

## Related Domains
- `admin-plan`: 관리자 측 플랜 작업 (배치/캘린더)
- `content`: 콘텐츠 CRUD/메타데이터
- `scheduling`: 캘린더, 블록, today 뷰
- `student-record`: Cold Start가 학생 프로필 데이터 참조
