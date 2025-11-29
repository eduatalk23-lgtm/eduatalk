# scoreLoader 에러 로깅 개선

## 작업 개요

`lib/scheduler/scoreLoader.ts`의 여러 함수에서 발생하는 에러가 빈 객체 `{}`로만 표시되어 디버깅이 어려운 문제를 해결했습니다.

## 문제 상황

- **에러 메시지**: `[scoreLoader] 내신 성적 조회 실패 {}`
- **위치**: `lib/scheduler/scoreLoader.ts:59:15`
- **문제**: 에러 객체가 제대로 직렬화되지 않아 빈 객체로만 표시됨
- **영향받는 함수들**:
  - `getSchoolScoreSummary` - 내신 성적 조회 및 요약 계산
  - `getMockScoreSummary` - 모의고사 성적 요약 계산 (catch 블록만)
  - `getRiskIndexBySubject` - Risk Index 계산

## 해결 방법

에러 로깅을 개선하여 다음 정보를 포함하도록 수정:

1. **에러 메시지**: Error 객체의 message 속성
2. **에러 코드**: Supabase 에러 코드 (있는 경우)
3. **에러 상세 정보**: details 속성 (있는 경우)
4. **에러 힌트**: hint 속성 (있는 경우, `getSchoolScoreSummary`만)
5. **에러 객체 전체**: Error 객체의 name, message, stack
6. **컨텍스트 정보**: studentId

## 변경 사항

### 파일: `lib/scheduler/scoreLoader.ts`

#### 1. `getSchoolScoreSummary` - 내신 성적 조회 에러 (59번째 줄)

**변경 전:**
```typescript
if (error) {
  console.error("[scoreLoader] 내신 성적 조회 실패", error);
  return result;
}
```

**변경 후:**
```typescript
if (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
  const errorHint = error && typeof error === "object" && "hint" in error ? error.hint : undefined;
  
  console.error("[scoreLoader] 내신 성적 조회 실패", {
    message: errorMessage,
    code: errorCode,
    details: errorDetails,
    hint: errorHint,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    context: {
      studentId,
    },
  });
  return result;
}
```

#### 2. `getSchoolScoreSummary` - 내신 성적 요약 계산 에러 (158번째 줄)

**변경 전:**
```typescript
} catch (error) {
  console.error("[scoreLoader] 내신 성적 요약 계산 실패", error);
}
```

**변경 후:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
  
  console.error("[scoreLoader] 내신 성적 요약 계산 실패", {
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
    },
  });
}
```

#### 3. `getMockScoreSummary` - 모의고사 성적 요약 계산 에러 (256번째 줄)

**변경 전:**
```typescript
} catch (error) {
  console.error("[scoreLoader] 모의고사 성적 요약 계산 실패", error);
}
```

**변경 후:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
  
  console.error("[scoreLoader] 모의고사 성적 요약 계산 실패", {
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
    },
  });
}
```

**참고**: `getMockScoreSummary`의 에러 조회 부분(189번째 줄)은 이미 상세한 로깅이 구현되어 있어 수정하지 않았습니다.

#### 4. `getRiskIndexBySubject` - Risk Index 계산 에러 (340번째 줄)

**변경 전:**
```typescript
} catch (error) {
  console.error("[scoreLoader] Risk Index 계산 실패", error);
}
```

**변경 후:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const errorDetails = error && typeof error === "object" && "details" in error ? error.details : undefined;
  
  console.error("[scoreLoader] Risk Index 계산 실패", {
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
    },
  });
}
```

## 효과

이제 에러가 발생하면 다음과 같은 상세한 정보가 로그에 기록됩니다:

```javascript
{
  message: "에러 메시지",
  code: "에러 코드 (있는 경우)",
  details: "상세 정보 (있는 경우)",
  hint: "힌트 (있는 경우, getSchoolScoreSummary만)",
  error: {
    name: "Error",
    message: "에러 메시지",
    stack: "스택 트레이스"
  },
  context: {
    studentId: "학생 ID"
  }
}
```

이를 통해 에러의 원인을 더 쉽게 파악할 수 있습니다.

## 관련 이슈

- 콘솔에서 빈 객체 `{}`로만 표시되던 에러가 이제 상세 정보와 함께 표시됨
- 디버깅 시 컨텍스트 정보를 통해 문제 발생 시점의 상태를 확인 가능
- `getMonthlyWeakSubjectTrend` 함수에서 `getRiskIndexBySubject`를 호출할 때 발생하는 에러도 상세히 로깅됨

## 작업 일시

2024-11-29

