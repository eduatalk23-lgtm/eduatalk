# Admin Plan Domain Rules

## Scope
관리자 측 플랜 수정, 배치 작업, AI 플랜 생성, 캘린더 페이지 데이터, 플랜 그룹 CRUD, LLM 응답 변환, 품질 분석, 시간 관리.

## Architecture
```
admin-plan/
├── types.ts           # PlanStatus, ContainerType, SubjectType + option 배열
├── validation.ts      # 상태 type guard 함수
├── types/             # streaming, retry, aiPlanSlot, qualityMetrics, preview
├── constants/         # schedulerDefaults
├── transformers/      # llmResponseTransformer.ts (AI → DB 포맷)
├── utils/             # calendarPermission, toastMessages, statusColorUtils, planNaming 등 (9개)
├── actions/           # 40개 Server Action 파일
│   ├── CRUD: editPlan, copyPlan, deletedPlans, planGroupOperations
│   ├── Calendar: calendarPageData, calendarEvents, searchCalendarEvents
│   ├── Generation: aiPlanGeneration, batchAIPlanGeneration, generateSlotBasedPlan
│   ├── Batch: batchOperations, batchRetry, batchPreviewPlans
│   ├── Movement: movePlanToDate, moveToGroup, carryover
│   └── planCreation/  # scheduleGenerator, singleDayScheduler, timelineAdjustment
└── services/          # 캘린더 비즈니스 로직
```

## Enforced Rules

1. **캘린더 권한 3단계**: full / execute_only / view_only. `calendarPermission.ts`는 **UI 렌더링용** (버튼 표시/숨김). Server Action 인증은 `getCurrentUser()` + `resolveAuthContext()` + Supabase RLS로 처리됨. 둘을 혼동하지 말 것.
2. **LLM 응답 변환**: AI 생성 플랜은 반드시 `llmResponseTransformer.ts` 통과 후 DB 저장. raw LLM 출력 직접 저장 금지.
3. **배치 재시도 멱등성**: `batchRetry.ts` 패턴 준수. 배치 작업은 멱등적이어야 하며 진행률 추적 필수.
4. **Toast 메시지 표준화**: `utils/toastMessages.ts` 상수 사용 (VALIDATION, ERROR, SUCCESS). 문자열 하드코딩 금지.
5. **PlanStatus (개별 플랜) ≠ plan_groups.status (플랜 그룹)**: 개별 플랜 = pending/in_progress/completed/skipped/cancelled. 플랜 그룹 = draft/saved/active/paused/completed/cancelled. 혼동 금지. "하나만 active" 제약: 다른 그룹 active 시 기존 active → paused 자동 전환.
6. **모달 테마**: blue=조회/액션, amber=편집, purple=그룹/정리, green=생성, red=삭제.

## Tests
```bash
pnpm test __tests__/integration/aiPlanValidation
pnpm test __tests__/integration/planGroupTimeBlock
```

## Related Domains
- `plan`: 핵심 플랜 타입, 트랜잭션, LLM 모듈. `plan/llm/`에서 heavy import.
- `scheduling`: 캘린더 이벤트, 블록 셋 공유.
- `content`: 플랜 생성 시 콘텐츠 선택/연결.
