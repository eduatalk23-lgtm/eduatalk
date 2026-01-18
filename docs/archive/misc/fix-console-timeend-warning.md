# Console.timeEnd() 경고 수정

## 문제 상황

대시보드 페이지에서 다음과 같은 콘솔 경고가 발생했습니다:

```
(node:47748) Warning: No such label '[dashboard] data - overview' for console.timeEnd()
(node:47748) Warning: No such label '[dashboard] render - page' for console.timeEnd()
```

## 원인 분석

`lib/utils/perfLog.ts`의 `perfTime` 함수에서:
1. `PERF_DEBUG`가 `true`일 때 `console.time(label)`을 호출하고 `end()` 메서드에서 `console.timeEnd(label)`를 호출합니다.
2. 하지만 다음과 같은 경우에 문제가 발생할 수 있습니다:
   - `console.time()` 호출이 실패한 경우
   - 서버/클라이언트 환경 차이로 인해 타이머가 제대로 시작되지 않은 경우
   - 에러가 발생하여 `console.time()`이 호출되지 않았는데 `end()`가 호출되는 경우

## 해결 방법

`perfTime` 함수를 다음과 같이 수정했습니다:

1. **타이머 시작 상태 추적**: `timerStarted` 플래그를 사용하여 `console.time()`이 실제로 호출되었는지 추적합니다.
2. **에러 처리**: `console.time()`과 `console.timeEnd()` 호출을 try-catch로 감싸서 에러가 발생해도 앱이 중단되지 않도록 했습니다.
3. **안전한 종료**: `timerStarted`가 `true`일 때만 `console.timeEnd()`를 호출하여 경고를 방지합니다.

## 수정된 코드

```typescript
export function perfTime(label: string) {
  if (!PERF_DEBUG) {
    return {
      end() {
        // 디버그 모드가 아니면 아무것도 하지 않음
      },
    };
  }

  let timerStarted = false;
  try {
    console.time(label);
    timerStarted = true;
  } catch (error) {
    // console.time이 실패해도 계속 진행
    console.warn(`[perfTime] Failed to start timer for "${label}":`, error);
  }

  return {
    end() {
      if (timerStarted) {
        try {
          console.timeEnd(label);
        } catch (error) {
          // console.timeEnd가 실패해도 무시 (타이머가 시작되지 않았을 수 있음)
          // 개발 환경에서만 경고 출력
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[perfTime] Failed to end timer for "${label}":`,
              error
            );
          }
        }
      }
    },
  };
}
```

## 영향 범위

이 수정은 다음 파일들에 영향을 미칩니다:
- `app/(student)/dashboard/page.tsx` - 학생 대시보드
- `app/(student)/today/page.tsx` - 오늘 페이지
- `app/(student)/camp/today/page.tsx` - 캠프 오늘 페이지
- `lib/data/todayPlans.ts` - todayPlans 데이터 페칭
- `app/api/dashboard/monthly-report/route.ts` - 월간 리포트 API

모든 `perfTime` 사용처에서 경고가 발생하지 않도록 보장합니다.

## 테스트

1. 개발 서버를 재시작합니다.
2. 대시보드 페이지에 접속합니다.
3. 콘솔에서 경고 메시지가 더 이상 나타나지 않는지 확인합니다.

## 참고

- `PERF_DEBUG`는 `NEXT_PUBLIC_PERF_DEBUG=true` 또는 `NODE_ENV=development`일 때 활성화됩니다.
- 프로덕션 환경에서는 성능 로깅이 비활성화되어 오버헤드가 없습니다.

