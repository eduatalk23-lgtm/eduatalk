# Camp Domain Rules

## Scope
캠프(윈터/썸머/파이널) 템플릿 CRUD, 학생 초대/참여, 플랜 그룹 진행 위저드, 출석/학습 통계, 블록 세트 연결, 콘텐츠 배정 및 검증.

## Architecture
```
camp/
├── index.ts              # Public API (types + actions + errors)
├── types.ts              # DB 파생 타입 (CampTemplate, CampInvitation, 통계 등)
├── permissions.ts        # 권한 가드 (requireCampAdminAuth, requireCampTemplateAccess 등)
├── errors.ts             # 에러 분류/복구 (CampErrorInfo, handleCampError, handlePartialSuccess)
├── attendance.ts         # 캠프 출석 통계 (server-only, 직접 import 필요)
├── learningStats.ts      # 캠프 학습 통계 (server-only, 직접 import 필요)
├── actions/
│   ├── index.ts          # 전체 Server Actions re-export
│   ├── types.ts          # 공통 타입 (PreviewPlan, Exclusion, AcademySchedule)
│   ├── crud.ts           # 템플릿 CRUD (생성/수정/복사/삭제/상태변경)
│   ├── participants.ts   # 초대 발송/조회/삭제, 참여자 관리
│   ├── student.ts        # 학생 측 참여/거절/취소/수정
│   ├── blockSets.ts      # 블록 세트 연결/해제
│   ├── slotPresets.ts    # 슬롯 템플릿 프리셋 CRUD
│   ├── reschedule.ts     # 콘텐츠 일정 재배치
│   └── progress/         # 플랜 그룹 진행 (위저드 기반)
│       ├── wizard.ts     # continueCampStepsForAdmin (핵심 위저드 로직)
│       ├── bulk.ts       # 대량 처리 (플랜 생성/미리보기/범위 조정/콘텐츠 적용)
│       ├── status.ts     # 상태 업데이트/배치 상태 변경
│       └── review.ts     # 리뷰 조회/범위 조정용 콘텐츠 조회
├── services/
│   ├── contentService.ts          # 콘텐츠 검증/복사/저장 (마스터→학생 자동 복사)
│   ├── updateService.ts           # 메타데이터/제외일/학원일정 업데이트
│   └── learningProgressService.ts # 학습 진행률 계산 (통계 집계)
└── utils/
    ├── templateBlockSetResolver.ts # 블록 세트 ID 3단계 폴백 조회
    └── progressCalculation.ts      # 진행률/완료율/과목분포 계산 (순수 함수)
```

## Enforced Rules

1. **권한 가드 필수**: 모든 Server Action은 `permissions.ts`의 가드 함수(`requireCampAdminAuth`, `requireCampTemplateAccess` 등)로 시작. 템플릿 접근 시 반드시 `tenant_id` 소유권 검증 포함.

2. **마스터 콘텐츠 자동 복사**: 학생에게 콘텐츠 배정 시 `contentService.validateAndResolveContent()`를 거쳐야 함. 마스터 교재/강의는 학생 소유본으로 자동 복사되며, 복사 실패 시 해당 콘텐츠를 제외하고 `content_copy_warnings`에 기록.

3. **attendance/learningStats는 직접 import**: `index.ts`에서 re-export하지 않음 (server-only 코드). 반드시 `@/lib/domains/camp/attendance`, `@/lib/domains/camp/learningStats`에서 직접 import.

4. **블록 세트 조회 3단계 폴백**: `templateBlockSetResolver.ts`의 `resolveTemplateBlockSetId()` 사용. 순서: (1) `camp_template_block_sets` 연결 테이블 (2) `scheduler_options.template_block_set_id` (3) `template_data.block_set_id` (하위 호환).

5. **위저드 콘텐츠 보존 로직**: `prepareContentsToSave()`에서 `student_contents`/`recommended_contents`가 undefined 또는 빈 배열이면 기존 콘텐츠를 보존. 새 배열이 있으면 기존을 대체. 혼합 불가.

6. **plan_purpose 정규화**: "수능" 또는 "모의고사" 입력은 `updateService.ts`에서 자동으로 "모의고사(수능)"으로 통일.

7. **에러 처리 패턴**: 서버 액션 결과는 `{ success, error? }` 형태. 클라이언트에서는 `errors.ts`의 `handleCampError()`로 통합 처리 (네트워크/권한/비즈니스 에러 자동 분류 + 복구 액션 제공).

## Tests
```bash
pnpm test lib/domains/camp/services/contentService.test.ts
pnpm test lib/domains/camp/services/updateService.test.ts
pnpm test lib/domains/camp/actions/slotPresets.test.ts
# 전체 camp 테스트
pnpm test lib/domains/camp
```

## Related Domains
- `plan`: 플랜 그룹/콘텐츠 CRUD, 스케줄링 엔진 (camp은 plan_groups에 `plan_type: "camp"` 저장)
- `content` / `master-content`: 마스터 교재/강의 복사 (`copyMasterBookToStudent`, `copyMasterLectureToStudent`)
- `attendance`: 출석 기록 조회 (camp은 템플릿 기간으로 필터링)
- `block`: 블록 세트/시간 슬롯 (`tenant_block_sets`, `tenant_blocks`)
- `scheduling`: 캘린더 이벤트와 제외일 연동
