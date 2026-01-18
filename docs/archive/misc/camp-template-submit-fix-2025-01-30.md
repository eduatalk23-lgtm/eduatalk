# 캠프 템플릿 제출 및 삭제 문제 수정

## 작업 일시
2025-01-30

## 문제점 분석

### 1. 콘텐츠 정보 누락 문제
- **위치**: `app/(student)/actions/campActions.ts` 364-384번 줄
- **문제**: `creationData.contents`를 매핑할 때 `start_detail_id`와 `end_detail_id`가 유지되지 않을 수 있음
- **원인**: `...c` 스프레드로 유지되어야 하지만, 명시적으로 보존되지 않을 수 있음

### 2. 추천 콘텐츠 중복 생성 문제
- **위치**: `app/(student)/actions/campActions.ts` 608-671번 줄
- **문제**: 학생이 선택한 추천 콘텐츠(`wizardData.recommended_contents`)를 자동 추천 콘텐츠 생성 시 중복 체크하지 않음
- **결과**: 학생이 1개만 선택했는데 자동 추천 시스템이 추가로 여러 개를 생성하여 저장

### 3. 초대 취소 시 academy_schedules 삭제 누락
- **위치**: `lib/data/planGroups.ts` `deletePlanGroupByInvitationId` 함수
- **문제**: `academy_schedules` 삭제 로직이 없음
- **주의사항**: 캠프 모드에서는 `plan_group_id`가 NULL로 저장되므로, 삭제 시 주의 필요

## 수정 내용

### 수정 1: 콘텐츠 정보 보존 확인
**파일**: `app/(student)/actions/campActions.ts`

- `start_detail_id`와 `end_detail_id`를 명시적으로 보존하도록 수정
- 추천 콘텐츠에 대한 로깅 추가
- 콘텐츠 매핑 완료 시 `start_detail_id`와 `end_detail_id`를 가진 콘텐츠 개수 로깅 추가

**변경 사항**:
```typescript
return {
  ...c,
  master_content_id: masterContentId,
  // start_detail_id와 end_detail_id는 ...c 스프레드로 이미 포함됨
  // 명시적으로 보존하기 위해 다시 설정 (안전장치)
  start_detail_id: startDetailId,
  end_detail_id: endDetailId,
};
```

### 수정 2: 추천 콘텐츠 중복 체크 추가
**파일**: `app/(student)/actions/campActions.ts`

- 학생이 선택한 추천 콘텐츠 ID를 중복 체크에 포함
- 학생이 선택한 추천 콘텐츠의 `master_content_id`도 체크 (추천 콘텐츠는 `content_id`가 마스터 콘텐츠 ID)
- 중복 체크 로직에 대한 상세 로깅 추가

**변경 사항**:
```typescript
// 학생이 선택한 추천 콘텐츠 ID도 체크
const studentRecommendedContentIds = new Set(
  (wizardData.recommended_contents || []).map((c: any) => c.content_id)
);

// 학생이 선택한 추천 콘텐츠의 master_content_id도 체크
const studentRecommendedMasterIds = new Set<string>();
const studentRecommendedContentsForMasterId = (wizardData.recommended_contents || []).filter(
  (c: any) => c.content_type === "book" || c.content_type === "lecture"
);

if (studentRecommendedContentsForMasterId.length > 0) {
  // 추천 콘텐츠는 content_id가 마스터 콘텐츠 ID
  studentRecommendedContentsForMasterId.forEach((content) => {
    studentRecommendedMasterIds.add(content.content_id);
  });
}

const uniqueRecommendedContents = recommendedContents.filter(
  (rec) => {
    // content_id로 직접 비교
    if (
      templateContentIds.has(rec.id) || 
      studentContentIds.has(rec.id) ||
      studentRecommendedContentIds.has(rec.id) // 추가
    ) {
      return false;
    }
    // master_content_id로 비교
    if (
      studentMasterIds.has(rec.id) ||
      studentRecommendedMasterIds.has(rec.id) // 추가
    ) {
      return false;
    }
    return true;
  }
);
```

### 수정 3: academy_schedules 삭제 로직 검토
**파일**: `lib/data/planGroups.ts`

- `academy_schedules` 삭제는 수행하지 않기로 결정
- 삭제하지 않는 이유를 주석으로 명확히 설명

**변경 사항**:
```typescript
// 5. academy_schedules 삭제는 수행하지 않음
// 이유:
// - 캠프 모드에서는 academy_schedules가 plan_group_id 없이 저장됨 (학생별 전역 관리)
// - submitCampParticipation에서 기존 학원 일정을 모두 삭제하고 템플릿 일정으로 교체
// - 초대 취소 시 academy_schedules를 삭제하면 다른 플랜 그룹의 학원 일정까지 삭제될 위험이 있음
// - 따라서 academy_schedules는 삭제하지 않고 유지 (다른 플랜 그룹 보호)
```

## 테스트 시나리오

### 1. 콘텐츠 정보 보존 테스트
- 학생 콘텐츠에 `start_detail_id`, `end_detail_id` 포함하여 제출
- 제출 후 조회 시 해당 값이 정상적으로 저장되었는지 확인
- 로그에서 `contentsWithDetailIds` 값 확인

### 2. 추천 콘텐츠 중복 방지 테스트
- 학생이 추천 콘텐츠 1개만 선택하여 제출
- 제출 후 조회 시 선택한 1개만 저장되었는지 확인
- 자동 추천 콘텐츠가 생성되지 않았는지 확인
- 로그에서 `studentRecommendedContentIdsCount`와 `afterFilter` 값 확인

### 3. 초대 취소 시 데이터 삭제 테스트
- 캠프 템플릿 제출 후 초대 취소
- `plan_groups`, `plan_contents`, `plan_exclusions` 삭제 확인
- `academy_schedules`는 삭제되지 않아야 함 (다른 플랜 그룹 보호)

## 관련 파일

- `app/(student)/actions/campActions.ts` - 캠프 템플릿 제출 로직
- `lib/data/planGroups.ts` - 플랜 그룹 삭제 로직
- `lib/utils/planGroupDataSync.ts` - 데이터 변환 로직 (변경 없음, 참고용)

## 참고 사항

- 캠프 모드에서는 `academy_schedules`가 `plan_group_id` 없이 저장되므로, 삭제 시 주의 필요
- 추천 콘텐츠는 `content_id`가 마스터 콘텐츠 ID이므로, 중복 체크 시 이를 고려해야 함
- `start_detail_id`와 `end_detail_id`는 콘텐츠 범위 선택 시 중요한 정보이므로 반드시 보존해야 함

