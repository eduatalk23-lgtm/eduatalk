# AI 추천 콘텐츠 에러 처리 개선

## 📋 개요

학생 페이지에서 AI 추천 콘텐츠를 불러올 때 발생하는 에러를 개선했습니다. `getRecommendedMasterContentsAction`이 실제 API를 호출하도록 수정하고, `Step4RecommendedContents`에서 에러 처리를 강화했습니다.

## 🔍 문제점

### 기존 문제
- **`getRecommendedMasterContentsAction`**: 빈 배열만 반환 (TODO 주석)
- **`Step4RecommendedContents`**: API 응답 실패 시 에러 처리 없음
- **`Step3ContentSelection`**: 액션 실패 시 에러 메시지 표시

### 원인
- `getRecommendedMasterContentsAction`이 실제 API를 호출하지 않음
- `Step4RecommendedContents`에서 `response.ok`가 false일 때 처리 없음
- `result.success`가 false일 때 처리 없음

## ✅ 수정 내용

### 1. `getRecommendedMasterContentsAction` 구현

#### 수정 전
```typescript
export async function getRecommendedMasterContentsAction(
  studentId: string,
  subjects: string[],
  counts: Record<string, number>
): Promise<RecommendedContent[]> {
  // TODO: 실제 추천 로직 구현
  // 현재는 빈 배열 반환 (Phase 5.8 빌드 에러 수정용)
  
  console.log("getRecommendedMasterContentsAction called", {
    studentId,
    subjects,
    counts,
  });
  
  return [];
}
```

#### 수정 후
```typescript
export async function getRecommendedMasterContentsAction(
  studentId: string,
  subjects: string[],
  counts: Record<string, number>
): Promise<{ success: boolean; data?: { recommendations: RecommendedContent[] }; error?: string }> {
  try {
    // 교과별 추천 개수를 쿼리 파라미터로 전달
    const params = new URLSearchParams();
    subjects.forEach((subject) => {
      const count = counts[subject] || 1;
      params.append("subjects", subject);
      params.append(`count_${subject}`, String(count));
    });
    
    // student_id 파라미터 추가
    params.append("student_id", studentId);

    // API 호출
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL 
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3000';
    
    const apiUrl = `${baseUrl}/api/recommended-master-contents?${params.toString()}`;
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API 호출 실패: ${response.status} ${response.statusText}`,
      };
    }

    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || "추천 콘텐츠를 불러오는 데 실패했습니다.",
      };
    }

    return {
      success: true,
      data: {
        recommendations: result.data?.recommendations || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "추천 콘텐츠를 불러오는 데 실패했습니다.",
    };
  }
}
```

### 2. `Step4RecommendedContents` 에러 처리 강화

#### 수정 전
```typescript
const response = await fetch(
  `/api/recommended-master-contents?${params.toString()}`
);
if (response.ok) {
  const result = await response.json();
  const recommendations = result.data?.recommendations || [];
  // ...
}
```

#### 수정 후
```typescript
const response = await fetch(
  `/api/recommended-master-contents?${params.toString()}`
);

if (!response.ok) {
  const errorText = await response.text();
  console.error("[Step4RecommendedContents] API 응답 실패:", {
    status: response.status,
    statusText: response.statusText,
    error: errorText,
  });
  alert(
    `추천 콘텐츠를 불러오는 데 실패했습니다. (${response.status} ${response.statusText})`
  );
  setLoading(false);
  return;
}

const result = await response.json();

// API 응답 구조: { success: true, data: { recommendations } }
if (!result.success) {
  console.error("[Step4RecommendedContents] API 에러:", result.error);
  alert(
    result.error?.message || "추천 콘텐츠를 불러오는 데 실패했습니다."
  );
  setLoading(false);
  return;
}

const recommendations = result.data?.recommendations || [];
```

### 3. `reason` 속성 옵셔널 체이닝 추가

#### 수정 전
```typescript
const hasDetailedReasons = recommendations.some(
  (r: RecommendedContent) =>
    r.reason.includes("내신") ||
    r.reason.includes("모의고사") ||
    r.reason.includes("위험도") ||
    r.scoreDetails
);
```

#### 수정 후
```typescript
const hasDetailedReasons = recommendations.some(
  (r: RecommendedContent) =>
    r.reason?.includes("내신") ||
    r.reason?.includes("모의고사") ||
    r.reason?.includes("위험도") ||
    r.scoreDetails
);
```

## 🎯 수정 사항 상세

### 1. `getRecommendedMasterContentsAction` 구현
- 실제 API 호출 구현
- 에러 처리 추가
- 반환 타입 변경 (성공/실패 정보 포함)

### 2. `Step4RecommendedContents` 에러 처리
- `response.ok` 체크 추가
- `result.success` 체크 추가
- 에러 메시지 표시
- 로딩 상태 해제

### 3. 타입 안전성 개선
- `reason` 속성 옵셔널 체이닝 추가
- 에러 타입 명시

## 📝 테스트 시나리오

### 시나리오 1: API 호출 성공
- **입력**: 정상적인 교과 및 개수
- **기대 결과**: 추천 콘텐츠 정상 반환

### 시나리오 2: API 호출 실패 (네트워크 에러)
- **입력**: 네트워크 연결 없음
- **기대 결과**: 에러 메시지 표시, 로딩 상태 해제

### 시나리오 3: API 응답 실패 (4xx, 5xx)
- **입력**: 잘못된 요청 또는 서버 에러
- **기대 결과**: 상태 코드와 함께 에러 메시지 표시

### 시나리오 4: API 응답 success: false
- **입력**: API에서 에러 반환
- **기대 결과**: API 에러 메시지 표시

## 🚀 배포 전 확인사항

1. [x] `getRecommendedMasterContentsAction`이 실제 API를 호출하는지 확인
2. [x] API 호출 실패 시 에러 메시지가 표시되는지 확인
3. [x] `Step4RecommendedContents`에서 에러 처리가 동작하는지 확인
4. [x] 로딩 상태가 올바르게 해제되는지 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `app/(student)/actions/getRecommendedMasterContents.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

