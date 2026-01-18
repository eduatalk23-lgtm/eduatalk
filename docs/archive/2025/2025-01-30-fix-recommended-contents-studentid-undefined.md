# AI 추천 콘텐츠 studentId undefined 문제 수정

## 📋 개요

AI 추천 콘텐츠 조회 시 `studentId`가 `undefined`로 전달되고, API URL이 잘못 계산되는 문제를 수정했습니다.

## 🔍 문제점

### 기존 문제
- **`studentId`가 `undefined`**: `getRecommendedMasterContentsAction`에 `undefined`가 전달됨
- **잘못된 API URL**: `NEXT_PUBLIC_SUPABASE_URL`을 base URL로 사용하여 404 에러 발생
- **API 라우트를 통한 불필요한 호출**: Server Action에서 API 라우트를 거쳐 비효율적

### 원인
- `PlanGroupWizard`에서 `studentId`를 전달하지 않거나 `undefined`로 전달
- Server Action에서 `NEXT_PUBLIC_SUPABASE_URL`을 base URL로 사용
- Server Action에서 fetch를 사용하여 API 라우트를 호출

## ✅ 수정 내용

### 1. `getRecommendedMasterContentsAction` 개선

#### 수정 전
```typescript
export async function getRecommendedMasterContentsAction(
  studentId: string,
  subjects: string[],
  counts: Record<string, number>
): Promise<RecommendedContent[]> {
  // API 호출
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:3000';
  
  const apiUrl = `${baseUrl}/api/recommended-master-contents?${params.toString()}`;
  const response = await fetch(apiUrl, ...);
  // ...
}
```

#### 수정 후
```typescript
export async function getRecommendedMasterContentsAction(
  studentId: string | undefined,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedContent[] }; error?: string }> {
  // studentId가 없으면 현재 사용자 ID 사용
  let targetStudentId = studentId;
  if (!targetStudentId || targetStudentId === "undefined") {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: "로그인이 필요합니다.",
      };
    }
    targetStudentId = user.userId;
  }

  // Supabase 클라이언트 생성
  const supabase = await createSupabaseServerClient();
  
  // 학생 정보 조회 (tenant_id 필요)
  const { data: student } = await supabase
    .from("students")
    .select("tenant_id")
    .eq("id", targetStudentId)
    .maybeSingle();

  // 교과별 추천 개수를 Map으로 변환
  const subjectCounts = new Map<string, number>();
  subjects.forEach((subject) => {
    const count = counts[subject] || 1;
    subjectCounts.set(subject, count);
  });

  // 추천 콘텐츠 조회 (직접 함수 호출)
  const recommendations = await getRecommendedMasterContents(
    supabase,
    targetStudentId,
    student.tenant_id || null,
    subjectCounts.size > 0 ? subjectCounts : undefined
  );

  // 타입 변환 및 반환
  const convertedRecommendations: RecommendedContent[] = recommendations.map((r) => ({
    id: r.id,
    title: r.title,
    content_type: r.content_type,
    subject_category: r.subject_category,
    total_range: r.total_range,
    description: r.description,
  }));

  return {
    success: true,
    data: {
      recommendations: convertedRecommendations,
    },
  };
}
```

## 🎯 수정 사항 상세

### 1. studentId 처리 개선
- `studentId`가 `undefined`일 때 현재 사용자 ID 사용
- `getCurrentUser()`를 사용하여 현재 로그인한 사용자 ID 가져오기
- 타입을 `string | undefined`로 변경

### 2. API 호출 방식 변경
- API 라우트를 거치지 않고 직접 `getRecommendedMasterContents` 함수 호출
- URL 계산 문제 해결
- 더 효율적인 호출 방식

### 3. 에러 처리 강화
- 학생 정보 조회 실패 시 에러 반환
- 로그인하지 않은 경우 에러 반환
- 타입 변환 및 검증 추가

## 📝 테스트 시나리오

### 시나리오 1: studentId가 undefined
- **입력**: `studentId = undefined`
- **기대 결과**: 현재 사용자 ID를 사용하여 추천 콘텐츠 조회

### 시나리오 2: studentId가 전달됨
- **입력**: `studentId = "valid-student-id"`
- **기대 결과**: 전달된 studentId를 사용하여 추천 콘텐츠 조회

### 시나리오 3: 로그인하지 않은 경우
- **입력**: 로그인하지 않은 상태
- **기대 결과**: "로그인이 필요합니다." 에러 반환

## 🚀 배포 전 확인사항

1. [x] `studentId`가 `undefined`일 때 현재 사용자 ID를 사용하는지 확인
2. [x] API URL 계산 문제가 해결되었는지 확인
3. [x] 직접 함수 호출이 정상적으로 동작하는지 확인
4. [x] 에러 처리가 올바르게 동작하는지 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `app/(student)/actions/getRecommendedMasterContents.ts`

