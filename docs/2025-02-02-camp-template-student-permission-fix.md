# 캠프 템플릿 작성 시 학생 권한 문제 수정

## 문제 분석

Admin 페이지에서 캠프 템플릿 작성 중 학생 권한 문제로 진행이 어려운 부분을 점검하고 수정했습니다.

### 발견된 문제점

1. **`getStudentContentMasterIdsAction` 함수**
   - 학생 권한만 허용하여 Admin/Consultant가 다른 학생의 콘텐츠를 조회할 수 없음
   - `user.userId`를 직접 사용하여 현재 로그인한 사용자의 콘텐츠만 조회 가능

2. **템플릿 모드에서 추천 콘텐츠 조회**
   - 템플릿 모드에서는 `studentId`가 없어서 추천 콘텐츠 조회 시 에러 발생 가능
   - `useRecommendations` 훅에서 `studentId` 없이 API 호출 시도

## 수정 내용

### 1. `getStudentContentMasterIdsAction` 함수 수정

**파일**: `app/(student)/actions/getStudentContentMasterIds.ts`

**변경 사항**:
- Admin/Consultant 권한 지원 추가
- `studentIdParam` 파라미터 추가 (선택적)
- Admin 클라이언트 사용하여 RLS 우회 (다른 학생의 콘텐츠 조회 시)

**주요 코드**:
```typescript
export async function getStudentContentMasterIdsAction(
  contents: Array<{
    content_id: string;
    content_type: "book" | "lecture";
  }>,
  studentIdParam?: string // Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때 사용
): Promise<{
  success: boolean;
  data?: Map<string, string | null>;
  error?: string;
}> {
  const { role } = await getCurrentUserRole();
  const isAdminOrConsultant = role === "admin" || role === "consultant";

  // 학생 ID 결정: 관리자/컨설턴트인 경우 studentIdParam 사용, 학생인 경우 자신의 ID 사용
  let targetStudentId: string;
  if (isAdminOrConsultant) {
    if (!studentIdParam) {
      return {
        success: false,
        error: "관리자/컨설턴트의 경우 student_id가 필요합니다.",
      };
    }
    targetStudentId = studentIdParam;
  } else {
    targetStudentId = user.userId;
  }

  // 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용 (RLS 우회)
  let supabase;
  if (isAdminOrConsultant && studentIdParam) {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[getStudentContentMasterIds] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      supabase = await createSupabaseServerClient();
    } else {
      supabase = adminClient;
    }
  } else {
    supabase = await createSupabaseServerClient();
  }
  // ...
}
```

### 2. `useRecommendations` 훅 수정

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

**변경 사항**:
- `getStudentContentMasterIdsAction` 호출 시 `studentId` 전달
- 템플릿 모드에서 `studentId`가 없을 때 추천 콘텐츠 조회 스킵
- 에러 처리 개선 (템플릿 모드에서는 studentId가 없어서 실패할 수 있으므로 에러를 무시)

**주요 코드**:
```typescript
// collectStudentMasterIds 함수 내부
if (studentContentsWithoutMasterId.length > 0) {
  try {
    const { getStudentContentMasterIdsAction } = await import(
      "@/app/(student)/actions/getStudentContentMasterIds"
    );
    // studentId가 있으면 전달 (템플릿 모드에서는 studentId가 없을 수 있음)
    const masterIdResult = await getStudentContentMasterIdsAction(
      studentContentsWithoutMasterId,
      studentId
    );
    // ...
  } catch (error) {
    console.warn(
      "[useRecommendations] master_content_id 조회 실패:",
      error
    );
    // 템플릿 모드에서는 studentId가 없어서 실패할 수 있으므로 에러를 무시
  }
}

// fetchRecommendationsWithSubjects 함수 내부
if (!studentId) {
  console.warn("[useRecommendations] studentId가 없어 추천 콘텐츠를 조회할 수 없습니다. (템플릿 모드)");
  alert("템플릿 모드에서는 추천 콘텐츠를 조회할 수 없습니다.");
  setLoading(false);
  return;
}

// fetchRecommendations 함수 내부
if (!studentId) {
  console.warn("[useRecommendations] studentId가 없어 추천 콘텐츠를 조회할 수 없습니다. (템플릿 모드)");
  setLoading(false);
  setHasRequestedRecommendations(false);
  return;
}
```

## 영향 범위

### 수정된 파일
1. `app/(student)/actions/getStudentContentMasterIds.ts`
   - Admin/Consultant 권한 지원 추가
   - `studentIdParam` 파라미터 추가

2. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - `getStudentContentMasterIdsAction` 호출 시 `studentId` 전달
   - 템플릿 모드에서 `studentId` 없을 때 처리 추가

### 영향받는 기능
- 캠프 템플릿 작성 (Admin/Consultant)
- 캠프 템플릿 수정 (Admin/Consultant)
- 캠프 참여자 남은 단계 진행 (Admin/Consultant)
- 학생 플랜 그룹 생성 (Student) - 기존 동작 유지

## 테스트 시나리오

### 1. Admin/Consultant가 캠프 템플릿 작성
- ✅ 템플릿 모드에서 Step 4 (추천 콘텐츠)에서 `studentId` 없이도 에러 없이 동작
- ✅ 추천 콘텐츠 조회 시도 시 적절한 안내 메시지 표시

### 2. Admin/Consultant가 캠프 참여자 남은 단계 진행
- ✅ 다른 학생의 콘텐츠 `master_content_id` 조회 가능
- ✅ 추천 콘텐츠 조회 시 `studentId` 파라미터 전달하여 정상 동작

### 3. 학생이 플랜 그룹 생성
- ✅ 기존 동작 유지 (자신의 콘텐츠만 조회)

## 참고 사항

### 템플릿 모드에서 추천 콘텐츠
- 템플릿 모드에서는 학생이 없으므로 추천 콘텐츠를 조회할 수 없습니다.
- 템플릿 작성 시에는 Step 4에서 추천 콘텐츠를 선택하지 않고, 템플릿 데이터만 저장합니다.
- 실제 캠프 참여 시 (학생이 초대를 수락한 후) 학생별로 추천 콘텐츠를 조회합니다.

### Admin 클라이언트 사용
- Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때는 RLS를 우회하기 위해 Admin 클라이언트를 사용합니다.
- Admin 클라이언트 생성 실패 시 일반 클라이언트로 폴백합니다.

## 관련 이슈

- 캠프 템플릿 작성 중 학생 권한 문제
- Admin/Consultant가 다른 학생의 콘텐츠 조회 불가
- 템플릿 모드에서 추천 콘텐츠 조회 시 에러

## 완료 일자

2025-02-02

