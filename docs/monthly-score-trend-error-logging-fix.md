# 월간 성적 변화 조회 에러 로깅 개선

## 작업 개요

`lib/reports/monthly.ts`의 `getMonthlyScoreTrend` 함수에서 발생하는 에러가 빈 객체 `{}`로만 표시되어 디버깅이 어려운 문제를 해결했습니다.

## 문제 상황

- **에러 메시지**: `[reports/monthly] 성적 변화 조회 실패 {}`
- **위치**: `lib/reports/monthly.ts:582:13`
- **문제**: 에러 객체가 제대로 직렬화되지 않아 빈 객체로만 표시됨

## 해결 방법

에러 로깅을 개선하여 다음 정보를 포함하도록 수정:

1. **에러 메시지**: Error 객체의 message 속성
2. **에러 코드**: Supabase 에러 코드 (있는 경우)
3. **에러 상세 정보**: details 속성 (있는 경우)
4. **에러 객체 전체**: Error 객체의 name, message, stack
5. **컨텍스트 정보**: 
   - studentId
   - monthStart
   - monthEnd
   - lastMonthStart
   - lastMonthEnd

## 변경 사항

### 파일: `lib/reports/monthly.ts`

**변경 전:**
```typescript
} catch (error) {
  console.error("[reports/monthly] 성적 변화 조회 실패", error);
  return {
    thisMonth: [],
    lastMonth: [],
    trend: "stable",
  };
}
```

**변경 후:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
  
  console.error("[reports/monthly] 성적 변화 조회 실패", {
    message: errorMessage,
    code: errorCode,
    details: errorDetails,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    context: {
      studentId,
      monthStart: monthStart.toISOString().slice(0, 10),
      monthEnd: monthEnd.toISOString().slice(0, 10),
      lastMonthStart: lastMonthStart.toISOString().slice(0, 10),
      lastMonthEnd: lastMonthEnd.toISOString().slice(0, 10),
    },
  });
  return {
    thisMonth: [],
    lastMonth: [],
    trend: "stable",
  };
}
```

## 효과

이제 에러가 발생하면 다음과 같은 상세한 정보가 로그에 기록됩니다:

```javascript
{
  message: "에러 메시지",
  code: "에러 코드 (있는 경우)",
  details: "상세 정보 (있는 경우)",
  error: {
    name: "Error",
    message: "에러 메시지",
    stack: "스택 트레이스"
  },
  context: {
    studentId: "학생 ID",
    monthStart: "2024-11-01",
    monthEnd: "2024-11-30",
    lastMonthStart: "2024-10-01",
    lastMonthEnd: "2024-10-31"
  }
}
```

이를 통해 에러의 원인을 더 쉽게 파악할 수 있습니다.

## 관련 이슈

- 콘솔에서 빈 객체 `{}`로만 표시되던 에러가 이제 상세 정보와 함께 표시됨
- 디버깅 시 컨텍스트 정보를 통해 문제 발생 시점의 상태를 확인 가능

## 작업 일시

2024-11-29

