# 캠프 템플릿 액션 리팩토링 2차 작업

## 작업 일시
2024-12-15

## 작업 목표
`campTemplateActions.ts` 파일에서 진행 및 검토 관련 함수들을 `progress.ts`로 이동하고, 원본 파일을 barrel 파일로 전환

## 작업 내용

### 1. `progress.ts` 파일 생성
- 경로: `app/(admin)/actions/camp-templates/progress.ts`
- 진행 및 검토 관련 함수들을 모두 이동

#### 이동된 함수 목록
1. `getCampPlanGroupForReview` - 관리자용 캠프 플랜 그룹 조회 (검토용)
2. `continueCampStepsForAdmin` - 관리자용 캠프 단계 진행
3. `updateCampPlanGroupSubjectAllocations` - 플랜 그룹 과목 할당 업데이트
4. `updateCampPlanGroupStatus` - 플랜 그룹 상태 업데이트
5. `batchUpdateCampPlanGroupStatus` - 플랜 그룹 상태 일괄 업데이트
6. `bulkApplyRecommendedContents` - 추천 콘텐츠 일괄 적용
7. `bulkCreatePlanGroupsForCamp` - 캠프용 플랜 그룹 일괄 생성
8. `bulkAdjustPlanRanges` - 플랜 범위 일괄 조정
9. `getPlanGroupContentsForRangeAdjustment` - 범위 조정용 플랜 그룹 콘텐츠 조회
10. `bulkPreviewPlans` - 플랜 일괄 미리보기
11. `bulkGeneratePlans` - 플랜 일괄 생성

#### 필요한 Import 구문
- `getTenantContext` - 테넌트 컨텍스트 조회
- `getCampTemplate` - 캠프 템플릿 조회
- `AppError`, `ErrorCode`, `withErrorHandling` - 에러 처리
- `requireAdminOrConsultant` - 권한 검증
- `createSupabaseAdminClient`, `createSupabaseServerClient` - Supabase 클라이언트
- `WizardData` - 위저드 데이터 타입
- `SchedulerOptions`, `PlanStatus`, `PlanGroupSchedulerOptions`, `DailyScheduleInfo` - 플랜 관련 타입
- `PlanContentInsert` - 플랜 콘텐츠 삽입 타입
- `RecommendationMetadata` - 추천 메타데이터 타입
- `PreviewPlan`, `Exclusion`, `AcademySchedule`, `StudentInfo` - 타입 정의 (types.ts에서 import)
- 기타 데이터 페칭 및 유틸리티 함수들

### 2. `campTemplateActions.ts`를 Barrel 파일로 전환
- 기존의 모든 함수 구현 제거
- 4개의 모듈을 re-export하는 간단한 barrel 파일로 전환

#### 최종 파일 내용
```typescript
// app/(admin)/actions/campTemplateActions.ts
export * from './camp-templates/crud';
export * from './camp-templates/participants';
export * from './camp-templates/progress';
export * from './camp-templates/types';
```

## 파일 구조

### 리팩토링 전
```
app/(admin)/actions/
├── campTemplateActions.ts (1575줄 - 모든 함수 포함)
```

### 리팩토링 후
```
app/(admin)/actions/
├── campTemplateActions.ts (5줄 - barrel 파일)
└── camp-templates/
    ├── crud.ts (CRUD 함수들)
    ├── participants.ts (참여자 관리 함수들)
    ├── progress.ts (진행/검토 함수들) ← 새로 생성
    └── types.ts (타입 정의)
```

## 작업 결과

### 장점
1. **코드 분리**: 진행/검토 관련 로직이 별도 파일로 분리되어 가독성 향상
2. **유지보수성**: 각 도메인별로 파일이 분리되어 수정이 용이
3. **Barrel 패턴**: 외부에서는 기존과 동일하게 `campTemplateActions`에서 import 가능
4. **타입 안전성**: 모든 타입이 `types.ts`에서 중앙 관리

### 검증 사항
- ✅ Linter 에러 없음
- ✅ 모든 함수가 올바른 파일로 이동
- ✅ 필요한 import 구문 모두 포함
- ✅ Barrel 파일이 올바르게 구성됨

## 다음 단계
- 각 모듈 파일의 독립적인 테스트
- 타입 정의의 중앙화 확인
- 외부에서의 import 경로 확인 및 필요시 수정

