# 작업 일지: Supabase 500 에러 처리 개선

## 날짜
2025-01-13

## 문제 상황

터미널 로그에서 Supabase 500 Internal Server Error가 발생하고 있습니다:

```
[data/studentPlans] 플랜 조회 실패
에러 메시지: <!DOCTYPE html>... (Cloudflare 500 에러 페이지)
```

### 에러 특징
- Cloudflare를 통해 Supabase에 접근할 때 500 에러 발생
- HTML 응답이 반환됨 (정상적인 JSON 에러 응답이 아님)
- Supabase 호스트: `yiswawnxsrdmvvihhpne.supabase.co`
- 일시적인 서버 문제일 가능성이 높음

## 원인 분석

1. **Supabase 서버 측 문제**: Cloudflare를 통해 Supabase에 접근할 때 일시적인 서버 에러 발생
2. **에러 처리 부족**: HTML 응답이 반환되는 경우를 감지하지 못함
3. **재시도 로직 없음**: 일시적인 서버 에러에 대한 재시도 메커니즘이 없음

## 해결 방법

### 1. HTML 응답 감지 및 서버 에러 판별

```typescript
// HTML 응답이 반환된 경우 (500 에러 등) 감지
const isHtmlError = typeof errorMessage === "string" && errorMessage.includes("<!DOCTYPE html>");
const isServerError = isHtmlError || supabaseError?.code === "500" || supabaseError?.statusCode === 500;
```

### 2. 재시도 로직 추가

- 서버 에러인 경우 최대 2번 재시도 (총 3번 시도)
- 지수 백오프 적용: 1초, 2초 대기
- 간단한 쿼리로 재시도하여 복잡한 쿼리로 인한 타임아웃 방지

```typescript
if (isServerError) {
  // 최대 2번 재시도 (총 3번 시도)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // 재시도 전 대기 (지수 백오프: 1초, 2초)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      
      // 간단한 쿼리로 재시도
      const retryQuery = supabase
        .from("student_plan")
        .select("*")
        .eq("student_id", filters.studentId)
        .limit(1000); // 제한을 두어 복잡한 쿼리 방지
      
      // ... 필터링 로직 ...
      
      if (!retryError && retryData) {
        // 애플리케이션 레벨에서 추가 필터링
        return filtered;
      }
    } catch (retryError) {
      console.warn(`[data/studentPlans] 재시도 ${attempt}번째 실패:`, retryError);
    }
  }
}
```

### 3. 에러 로깅 개선

- 불필요한 상세 로깅 제거
- 핵심 정보만 로깅 (에러 코드, 필터 조건)
- HTML 응답인 경우 간단한 메시지로 표시

```typescript
console.error("[data/studentPlans] 플랜 조회 실패", {
  errorCode: supabaseError?.code,
  errorMessage: isHtmlError ? "서버 에러 (HTML 응답)" : errorMessage.substring(0, 200),
  filters: {
    studentId: filters.studentId,
    dateRange: filters.dateRange,
    planDate: filters.planDate,
    contentType: filters.contentType,
    planGroupIdsCount: filters.planGroupIds?.length || 0,
  },
});
```

## 📝 변경 사항

### 파일
- `lib/data/studentPlans.ts`
  - HTML 응답 감지 로직 추가
  - 서버 에러 재시도 로직 추가 (최대 2번, 지수 백오프)
  - 에러 로깅 개선 (핵심 정보만 로깅)

## 🎯 효과

### 안정성 개선
- **일시적인 서버 에러 자동 복구**: 재시도 로직으로 일시적인 서버 문제 자동 해결
- **에러 감지 정확도 향상**: HTML 응답을 감지하여 서버 에러를 정확히 판별
- **사용자 경험 개선**: 일시적인 서버 에러로 인한 빈 화면 방지

### 성능 개선
- **불필요한 로깅 제거**: 핵심 정보만 로깅하여 로그 파일 크기 감소
- **간단한 쿼리로 재시도**: 복잡한 쿼리로 인한 타임아웃 방지

## 📅 작업 일자
2025-01-13

