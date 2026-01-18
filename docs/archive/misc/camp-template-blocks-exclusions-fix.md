# 캠프 템플릿 상세 페이지 블록 및 제외일 정보 조회 개선

## 문제 상황

캠프 템플릿 상세 페이지에서 "블록 및 제외일" 섹션의 정보가 제대로 조회되지 않았습니다. 캠프 템플릿에 설정된 정보를 제출했는데도 표시되지 않는 문제가 발생했습니다.

## 원인 분석

`getCampPlanGroupForReview` 함수에서 템플릿 블록 정보를 조회하는 로직에 문제가 있었습니다:

1. **디버깅 로그 부족**: 어디서 문제가 발생하는지 파악하기 어려움
2. **에러 처리 부족**: `template_data` 파싱 실패 시 처리 없음
3. **다중 경로 확인 부족**: `template_block_set_id`를 찾는 경로가 제한적

## 해결 방법

### 1. 디버깅 로그 추가

개발 환경에서 템플릿 블록 정보 조회 과정을 상세히 로깅하도록 개선했습니다:

- `scheduler_options`에서 `template_block_set_id` 조회 결과
- `template_data`에서 `block_set_id` 조회 결과
- 템플릿 블록 세트 조회 결과
- 템플릿 블록 조회 결과

### 2. 에러 처리 개선

- `template_data` 파싱 에러 처리 추가
- 템플릿 조회 실패 시 명확한 에러 로그
- 각 단계별 실패 시 경고 로그

### 3. 조회 경로 개선

템플릿 블록 세트 ID를 찾는 순서:
1. `scheduler_options.template_block_set_id` (우선)
2. `template_data.block_set_id` (fallback)

각 경로에서 조회 실패 시 상세한 로그를 남기도록 개선했습니다.

## 변경 사항

### `app/(admin)/actions/campTemplateActions.ts`

```typescript
// 템플릿 블록 정보 조회 로직 개선
if (result.group.camp_template_id) {
  // 템플릿 조회 (에러 처리 추가)
  const { data: template, error: templateError } = await supabase
    .from("camp_templates")
    .select("template_data")
    .eq("id", result.group.camp_template_id)
    .maybeSingle();

  if (templateError) {
    console.error("[getCampPlanGroupForReview] 템플릿 조회 에러:", templateError);
  } else if (!template) {
    console.warn("[getCampPlanGroupForReview] 템플릿을 찾을 수 없음:", result.group.camp_template_id);
  } else {
    // scheduler_options에서 template_block_set_id 확인 (우선)
    const schedulerOptions = (result.group.scheduler_options as any) || {};
    let templateBlockSetId = schedulerOptions.template_block_set_id;
    
    // 개발 환경에서 디버깅 로그
    if (process.env.NODE_ENV === "development") {
      console.log("[getCampPlanGroupForReview] 템플릿 블록 세트 ID 조회:", {
        fromSchedulerOptions: templateBlockSetId,
        schedulerOptions: JSON.stringify(schedulerOptions),
      });
    }
    
    // scheduler_options에 없으면 template_data에서 확인
    if (!templateBlockSetId && template.template_data) {
      try {
        let templateData: any = null;
        if (typeof template.template_data === "string") {
          templateData = JSON.parse(template.template_data);
        } else {
          templateData = template.template_data;
        }
        
        templateBlockSetId = templateData?.block_set_id;
        
        // 개발 환경에서 디버깅 로그
        if (process.env.NODE_ENV === "development") {
          console.log("[getCampPlanGroupForReview] template_data에서 조회:", {
            block_set_id: templateBlockSetId,
            templateDataKeys: templateData ? Object.keys(templateData) : [],
          });
        }
      } catch (parseError) {
        console.error("[getCampPlanGroupForReview] template_data 파싱 에러:", parseError);
      }
    }

    // 템플릿 블록 세트 및 블록 조회 (에러 처리 및 로그 개선)
    // ...
  }
}
```

## 개선 사항

1. **상세한 디버깅 로그**: 개발 환경에서 조회 과정을 추적 가능
2. **에러 처리 강화**: 각 단계별 실패 시 명확한 에러 메시지
3. **경고 로그 추가**: 데이터가 없을 때도 원인 파악 가능

## 테스트

1. 캠프 템플릿에 블록 세트 설정 후 플랜 그룹 생성
2. 관리자 페이지에서 플랜 그룹 검토 페이지 접근
3. Step 2 탭에서 블록 및 제외일 정보 확인
4. 개발 환경 콘솔에서 디버깅 로그 확인

## 관련 파일

- `app/(admin)/actions/campTemplateActions.ts`
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`
- `app/(student)/plan/group/[id]/_components/Step2DetailView.tsx`

## 참고

- 템플릿 블록 세트 ID는 `scheduler_options.template_block_set_id`에 저장됩니다
- `template_data.block_set_id`는 fallback으로 사용됩니다
- 제외일과 학원 일정은 `getPlanGroupWithDetailsForAdmin`에서 조회됩니다

## 날짜

2024-11-24

