# 플랜 그룹 생성 에러 로깅 개선

**작업 일자**: 2025-01-27  
**관련 이슈**: `/plan/new-group` POST 요청 시 500 Internal Server Error 발생

## 문제 상황

프로덕션 환경에서 플랜 그룹 생성 시 다음과 같은 에러가 발생:

```
POST https://eduatalk.vercel.app/plan/new-group 500 (Internal Server Error)
PlanGroupError: An error occurred in the Server Components render. 
The specific message is omitted in production builds to avoid leaking sensitive details.
```

Next.js 15의 프로덕션 빌드에서는 Server Components 에러 메시지가 숨겨져 실제 원인 파악이 어려웠습니다.

## 해결 방안

### 1. 서버 액션 에러 로깅 강화

**파일**: `app/(student)/actions/plan-groups/create.ts`

`createPlanGroupAction`에 상세한 에러 로깅을 추가하여:
- 입력 데이터 검증 (민감 정보 제외)
- 에러 발생 시 상세 정보 로깅 (에러 타입, 스택, 코드, 상태 코드 등)
- AppError인 경우 추가 정보 포함

```typescript
export const createPlanGroupAction = withErrorHandling(
  async (
    data: PlanGroupCreationData,
    options?: {
      skipContentValidation?: boolean;
    }
  ) => {
    try {
      // 입력 데이터 로깅 (민감 정보 제외)
      console.log("[createPlanGroupAction] 플랜 그룹 생성 시작:", {
        name: data.name,
        plan_purpose: data.plan_purpose,
        // ... 기타 필드
      });

      return await _createPlanGroup(data, options);
    } catch (error) {
      // 상세한 에러 로깅
      const errorInfo: Record<string, unknown> = {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        // ... 상세 정보
      };
      console.error("[createPlanGroupAction] 에러 발생:", JSON.stringify(errorInfo, null, 2));
      throw error;
    }
  }
);
```

### 2. 클라이언트 측 데이터 검증 로그 추가

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

`handleSaveDraft` 함수에서 데이터 변환 후 검증 로그를 추가:

```typescript
// 데이터 변환 (일관성 보장)
const creationData = syncWizardDataToCreationData(wizardData);

// 데이터 검증 로그 추가
console.log("[PlanGroupWizard] 생성 데이터 검증:", {
  name: creationData.name,
  plan_purpose: creationData.plan_purpose,
  // ... 기타 필드
});
```

### 3. 클라이언트 측 에러 처리 개선

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

에러 발생 시 원본 에러 정보를 상세히 로깅:

```typescript
} catch (error) {
  // 원본 에러 상세 로깅
  console.error("[PlanGroupWizard] 원본 에러:", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    errorObject: error,
  });

  // AppError인 경우 추가 정보 로깅
  if (error instanceof Error && "code" in error) {
    console.error("[PlanGroupWizard] 에러 상세 정보:", {
      code: (error as { code?: unknown }).code,
      statusCode: (error as { statusCode?: unknown }).statusCode,
      // ... 기타 정보
    });
  }
  // ...
}
```

## 변경 사항

### 수정된 파일

1. **`app/(student)/actions/plan-groups/create.ts`**
   - `createPlanGroupAction`에 상세한 에러 로깅 추가
   - 입력 데이터 검증 로그 추가

2. **`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`**
   - `handleSaveDraft`에서 데이터 검증 로그 추가
   - 에러 처리 시 원본 에러 상세 로깅 추가

## 기대 효과

1. **에러 원인 파악 용이**: 프로덕션 환경에서도 상세한 에러 정보를 로그로 확인 가능
2. **디버깅 시간 단축**: 에러 발생 시점의 데이터 상태와 에러 정보를 즉시 확인 가능
3. **문제 해결 속도 향상**: 실제 에러 원인을 빠르게 파악하여 수정 가능

## 다음 단계

1. **Vercel 로그 확인**: 배포 후 실제 에러 발생 시 로그에서 상세 정보 확인
2. **에러 패턴 분석**: 반복되는 에러 패턴이 있는지 분석
3. **추가 개선**: 필요 시 특정 에러 타입에 대한 추가 처리 로직 구현

## 참고 사항

- 프로덕션 환경에서는 민감한 정보(비밀번호, 토큰 등)는 로그에 포함하지 않도록 주의
- 로그 양이 많아질 수 있으므로 필요시 로그 레벨 조정 고려
- 에러 트래킹 서비스(Sentry 등)와 통합 시 더욱 효과적

