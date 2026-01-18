# 캠프 템플릿 삭제 시 플랜 그룹 처리 개선

## 📋 작업 개요

캠프 템플릿 삭제 시 관련된 플랜 그룹도 함께 삭제하도록 로직을 추가하고, 학생 페이지의 캠프 플랜 캘린더와 학습관리에서 삭제된 템플릿의 플랜 그룹이 조회되지 않도록 개선했습니다.

## 🔍 문제 분석

### 기존 문제점

1. **템플릿 삭제 시 플랜 그룹 미처리**
   - `deleteCampTemplateAction`에서 템플릿만 삭제하고 관련 플랜 그룹을 처리하지 않음
   - 초대 삭제(`deleteCampInvitation`)는 플랜 그룹을 함께 삭제하지만, 템플릿 삭제에는 해당 로직이 없음

2. **캠프 플랜 캘린더 조회 로직**
   - `app/(student)/camp/calendar/page.tsx`에서 `camp_template_id !== null` 조건으로만 필터링
   - 템플릿이 삭제되어도 `camp_template_id`가 남아있어 플랜 그룹이 조회됨

3. **캠프 학습관리 조회 로직**
   - `app/(student)/camp/today/page.tsx`에서 동일한 필터링 조건 사용
   - 템플릿이 삭제되어도 플랜 그룹이 조회됨

### 데이터베이스 제약 조건

- `plan_groups.camp_template_id`는 외래키로 설정되어 있지만, 템플릿 삭제 시 자동 처리되지 않음
- 템플릿 삭제 시 플랜 그룹의 `camp_template_id`만 NULL로 변경되거나 그대로 남아있을 수 있음

## ✅ 해결 방안

### 1. 템플릿 삭제 시 플랜 그룹 삭제 (데이터 정합성)

템플릿 삭제 시 관련된 플랜 그룹을 함께 삭제하도록 로직을 추가했습니다.

### 2. 조회 시 템플릿 존재 여부 확인 (안전장치)

캠프 플랜 캘린더와 학습관리에서 템플릿 존재 여부를 확인하여, 존재하지 않는 템플릿의 플랜 그룹은 제외하도록 개선했습니다.

## 📝 변경 사항

### 1. `lib/data/planGroups.ts`

#### 1.1 템플릿 ID로 플랜 그룹 삭제 함수 추가

**새로 추가된 함수**: `deletePlanGroupsByTemplateId`

```typescript
export async function deletePlanGroupsByTemplateId(
  templateId: string
): Promise<{ success: boolean; error?: string; deletedGroupIds?: string[] }>
```

**기능**:
- `camp_template_id`로 플랜 그룹 조회 (여러 개일 수 있음)
- 각 플랜 그룹에 대해:
  - 관련 `student_plan` 삭제 (hard delete)
  - 관련 `plan_contents` 삭제 (hard delete)
  - 관련 `plan_exclusions` 삭제 (hard delete)
  - `plan_groups` 삭제 (hard delete)
- 플랜 그룹이 없으면 성공으로 처리 (삭제할 것이 없음)
- 삭제된 플랜 그룹 ID 목록 반환

**주요 특징**:
- 여러 플랜 그룹이 있을 수 있으므로 반복문으로 처리
- 개별 플랜 그룹 삭제 실패해도 계속 진행 (다른 플랜 그룹은 삭제)
- 삭제된 플랜 그룹 ID 목록을 반환하여 로깅 가능

### 2. `app/(admin)/actions/campTemplateActions.ts`

#### 2.1 `deleteCampTemplateAction` 함수 수정

**변경 내용**:
- 템플릿 삭제 전에 관련된 플랜 그룹 삭제
- 플랜 그룹 삭제 실패해도 템플릿 삭제는 계속 진행 (경고 로그만 출력)
- 삭제된 플랜 그룹 개수 로깅

**주요 코드**:
```typescript
// 템플릿 삭제 전에 관련된 플랜 그룹 삭제
const { deletePlanGroupsByTemplateId } = await import(
  "@/lib/data/planGroups"
);
const planGroupResult = await deletePlanGroupsByTemplateId(templateId);

if (!planGroupResult.success) {
  console.error(
    "[campTemplateActions] 플랜 그룹 삭제 실패",
    planGroupResult.error
  );
  // 플랜 그룹 삭제 실패해도 템플릿 삭제는 계속 진행
} else if (planGroupResult.deletedGroupIds && planGroupResult.deletedGroupIds.length > 0) {
  console.log(
    `[campTemplateActions] 템플릿 삭제 전 ${planGroupResult.deletedGroupIds.length}개의 플랜 그룹 삭제 완료`
  );
}
```

### 3. `app/(student)/camp/calendar/page.tsx`

#### 3.1 템플릿 존재 여부 확인 로직 추가

**변경 내용**:
- `getCampTemplate` import 추가
- 캠프 모드 플랜 그룹 필터링 후 템플릿 존재 여부 확인
- 존재하지 않는 템플릿의 플랜 그룹은 제외

**주요 코드**:
```typescript
// 캠프 모드 플랜 그룹만 필터링
const campModePlanGroups = allActivePlanGroups.filter(
  (group) =>
    group.plan_type === "camp" ||
    group.camp_template_id !== null ||
    group.camp_invitation_id !== null
);

// 템플릿 존재 여부 확인 (삭제된 템플릿의 플랜 그룹 제외)
const activePlanGroups = await Promise.all(
  campModePlanGroups.map(async (group) => {
    // camp_template_id가 있는 경우 템플릿 존재 여부 확인
    if (group.camp_template_id) {
      const template = await getCampTemplate(group.camp_template_id);
      // 템플릿이 존재하지 않으면 null 반환 (필터링됨)
      return template ? group : null;
    }
    // camp_template_id가 없으면 그대로 반환
    return group;
  })
).then((groups) => groups.filter((group): group is NonNullable<typeof group> => group !== null));
```

### 4. `app/(student)/camp/today/page.tsx`

#### 4.1 템플릿 존재 여부 확인 로직 추가

**변경 내용**:
- `getCampTemplate` import 추가
- 캠프 모드 플랜 그룹 필터링 후 템플릿 존재 여부 확인
- 존재하지 않는 템플릿의 플랜 그룹은 제외

**주요 코드**:
```typescript
// 캠프 모드 플랜 그룹만 필터링
const campModePlanGroups = allActivePlanGroups.filter(
  (group) =>
    group.plan_type === "camp" ||
    group.camp_template_id !== null ||
    group.camp_invitation_id !== null
);

// 템플릿 존재 여부 확인 (삭제된 템플릿의 플랜 그룹 제외)
const activeCampPlanGroups = await Promise.all(
  campModePlanGroups.map(async (group) => {
    // camp_template_id가 있는 경우 템플릿 존재 여부 확인
    if (group.camp_template_id) {
      const template = await getCampTemplate(group.camp_template_id);
      // 템플릿이 존재하지 않으면 null 반환 (필터링됨)
      return template ? group : null;
    }
    // camp_template_id가 없으면 그대로 반환
    return group;
  })
).then((groups) => groups.filter((group): group is NonNullable<typeof group> => group !== null));
```

## 🎯 개선 효과

1. **데이터 정합성 향상**: 템플릿 삭제 시 관련 플랜 그룹도 함께 삭제되어 데이터 일관성 유지
2. **사용자 경험 개선**: 삭제된 템플릿의 플랜 그룹이 조회되지 않아 혼란 방지
3. **안전장치 추가**: 템플릿 삭제 로직이 실패하더라도 조회 시 필터링되어 문제 방지
4. **로깅 개선**: 삭제된 플랜 그룹 개수를 로깅하여 추적 가능

## 🧪 테스트 시나리오

1. ✅ 템플릿 삭제 시 관련 플랜 그룹도 함께 삭제되는지 확인
2. ✅ 템플릿 삭제 후 캠프 플랜 캘린더에서 해당 플랜 그룹이 조회되지 않는지 확인
3. ✅ 템플릿 삭제 후 캠프 학습관리에서 해당 플랜 그룹이 조회되지 않는지 확인
4. ✅ 여러 플랜 그룹이 있는 템플릿 삭제 시 모든 플랜 그룹이 삭제되는지 확인
5. ✅ 플랜 그룹 삭제 실패 시에도 템플릿 삭제는 정상 진행되는지 확인

## 📌 관련 파일

- `lib/data/planGroups.ts` - 템플릿 ID로 플랜 그룹 삭제 함수 추가
- `app/(admin)/actions/campTemplateActions.ts` - 템플릿 삭제 액션 개선
- `app/(student)/camp/calendar/page.tsx` - 캠프 플랜 캘린더 조회 로직 개선
- `app/(student)/camp/today/page.tsx` - 캠프 학습관리 조회 로직 개선

## 🔗 참고

- 이전 개선 작업: `docs/camp-invitation-delete-plan-group-handling.md` (초대 삭제 시 플랜 그룹 처리)
- 캠프 템플릿 삭제 리다이렉트 개선: `docs/camp-template-delete-redirect-fix-improved.md`

