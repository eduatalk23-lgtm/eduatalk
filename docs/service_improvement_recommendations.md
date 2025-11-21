# 서비스 개선 추천 사항

## 📋 프로젝트 개요
- **프로젝트명**: TimeLevelUp - 학습 관리 시스템
- **기술 스택**: Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS
- **주요 기능**: 학습 계획, 성적 관리, 리포트, 자동 스케줄러, 멀티테넌트 지원

---

## ✅ 수정 완료된 오류

### 1. 빌드 오류 수정
- ❌ **문제**: `union()` 메서드가 Supabase PostgrestFilterBuilder에 존재하지 않음
- ✅ **해결**: 두 테이블을 각각 조회 후 JavaScript에서 합치는 방식으로 변경
- **영향 파일**: 
  - `app/(admin)/admin/dashboard/page.tsx`
  - `app/(admin)/admin/students/page.tsx`

### 2. TypeScript 타입 오류 수정
- ❌ **문제**: `PromiseLike`에 `catch` 메서드 없음
- ✅ **해결**: `Promise.resolve()`로 감싸서 `Promise`로 변환
- **영향 파일**: `app/(admin)/admin/students/page.tsx`

### 3. React 타입 오류 수정
- ❌ **문제**: `child.props`가 `unknown` 타입
- ✅ **해결**: 타입 가드 추가
- **영향 파일**: `app/(admin)/admin/students/[id]/_components/StudentDetailTabs.tsx`

### 4. 추천 엔진 타입 오류 수정
- ❌ **문제**: `getRecommendations`의 에러 핸들러가 잘못된 타입 반환
- ✅ **해결**: 올바른 `Recommendations` 타입 객체 반환
- **영향 파일**: `app/(student)/today/_components/TodayRecommendations.tsx`

### 5. 스케줄 페이지 타입 오류 수정
- ❌ **문제**: `PromiseSettledResult`에서 직접 속성 접근
- ✅ **해결**: 올바른 변수(`schedule`) 사용
- **영향 파일**: `app/schedule/[date]/page.tsx`

---

## 🔴 긴급 개선 사항 (High Priority)

### 1. 에러 처리 표준화
**현재 문제:**
- `console.error` 사용이 일관성 없음
- 에러 메시지가 사용자에게 전달되지 않음
- 프로덕션에서 민감한 정보 노출 가능

**개선 방안:**
```typescript
// lib/errors/handler.ts 생성
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isUserFacing: boolean = true
  ) {
    super(message);
  }
}

// 에러 로깅 서비스 통합 (예: Sentry, LogRocket)
export function logError(error: unknown, context?: Record<string, unknown>) {
  // 프로덕션: 에러 트래킹 서비스로 전송
  // 개발: console.error
}
```

**영향 파일:**
- 모든 `actions/*.ts` 파일
- 모든 `page.tsx` 파일

### 2. 데이터베이스 쿼리 최적화
**현재 문제:**
- N+1 쿼리 패턴 발견
- 불필요한 반복 쿼리
- 인덱스 최적화 필요

**개선 방안:**
```typescript
// 예시: 학생 목록 페이지
// 현재: 각 학생마다 개별 쿼리
// 개선: 배치 쿼리로 통합

// lib/data/optimizedQueries.ts
export async function getStudentsWithStatsBatch(
  supabase: SupabaseClient,
  studentIds: string[],
  weekStart: Date,
  weekEnd: Date
) {
  // 한 번의 쿼리로 모든 데이터 조회
  const [sessions, plans, scores] = await Promise.all([
    supabase
      .from("student_study_sessions")
      .select("student_id, duration_seconds")
      .in("student_id", studentIds)
      .gte("started_at", weekStart.toISOString())
      .lte("started_at", weekEnd.toISOString()),
    // ... 나머지 쿼리
  ]);
  
  // 메모리에서 집계
  return aggregateStats(sessions, plans, scores);
}
```

**영향 파일:**
- `app/(admin)/admin/students/page.tsx` (220-248줄)
- `app/(admin)/admin/dashboard/page.tsx` (338-355줄)
- `app/analysis/_utils.ts` (113-232줄)

### 3. 캐싱 전략 도입
**현재 문제:**
- 매 요청마다 동일한 데이터 재조회
- 분석 데이터 실시간 계산으로 인한 성능 저하

**개선 방안:**
```typescript
// lib/cache/redis.ts 또는 Next.js Cache API 사용
import { unstable_cache } from 'next/cache';

export const getCachedStudentStats = unstable_cache(
  async (studentId: string) => {
    // 데이터 조회 로직
  },
  ['student-stats'],
  {
    revalidate: 300, // 5분
    tags: [`student-${studentId}`]
  }
);
```

**영향 파일:**
- `app/analysis/page.tsx` (65-75줄)
- `app/(admin)/admin/dashboard/page.tsx`
- `app/scores/dashboard/page.tsx`

### 4. 입력 검증 강화
**현재 문제:**
- FormData 검증이 부족
- SQL Injection 방지 (Supabase가 일부 처리하지만 추가 검증 필요)
- XSS 방지

**개선 방안:**
```typescript
// lib/validation/schemas.ts
import { z } from 'zod';

export const scoreSchema = z.object({
  subject: z.string().min(1).max(50),
  grade: z.number().int().min(1).max(9),
  rawScore: z.number().min(0).max(100),
  testDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// 사용 예시
export async function addStudentScore(formData: FormData) {
  const rawData = Object.fromEntries(formData);
  const validated = scoreSchema.parse(rawData);
  // 검증된 데이터만 사용
}
```

**영향 파일:**
- 모든 `actions/*.ts` 파일
- `app/actions/scores.ts`
- `app/actions/autoSchedule.ts`

---

## 🟡 중요 개선 사항 (Medium Priority)

### 5. 코드 중복 제거
**현재 문제:**
- `42703` 에러 코드 처리 로직이 여러 곳에 반복
- 유사한 쿼리 패턴 반복

**개선 방안:**
```typescript
// lib/supabase/queryHelpers.ts
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallbackQueryFn?: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  const result = await queryFn();
  
  if (result.error?.code === "42703" && fallbackQueryFn) {
    const fallback = await fallbackQueryFn();
    return fallback.data;
  }
  
  if (result.error) {
    throw result.error;
  }
  
  return result.data;
}
```

**영향 파일:**
- `app/analysis/_utils.ts`
- `app/analysis/page.tsx`
- `lib/tenant/getTenantContext.ts`

### 6. 타입 안정성 향상
**현재 문제:**
- `any` 타입 사용
- 타입 단언(`as`) 남용
- 제네릭 타입 활용 부족

**개선 방안:**
```typescript
// 엄격한 타입 정의
type SupabaseQueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

// 제네릭 유틸리티 함수
function mapSupabaseResult<T, R>(
  result: SupabaseQueryResult<T>,
  mapper: (data: T) => R
): R | null {
  if (result.error || !result.data) return null;
  return mapper(result.data);
}
```

### 7. 환경 변수 검증
**현재 문제:**
- 환경 변수 존재 여부만 확인 (`!`)
- 런타임 에러 가능성

**개선 방안:**
```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
```

**영향 파일:**
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`

### 8. 로딩 상태 개선
**현재 문제:**
- 로딩 상태가 일관성 없음
- 사용자 경험 저하

**개선 방안:**
- Suspense 경계 추가
- 로딩 스켈레톤 통일
- 에러 바운더리 추가

**영향 파일:**
- 모든 `page.tsx` 파일
- `loading.tsx` 파일들

---

## 🟢 개선 권장 사항 (Low Priority)

### 9. 테스트 코드 작성
**현재 상태:**
- 테스트 코드 없음

**개선 방안:**
```typescript
// __tests__/lib/recommendations/engine.test.ts
import { describe, it, expect } from '@jest/globals';
import { getTopRecommendations } from '@/lib/recommendations/engine';

describe('getTopRecommendations', () => {
  it('should return top N recommendations', () => {
    const recs = {
      subjects: ['수학', '영어'],
      goals: ['목표1'],
      studyPlan: [],
      contents: []
    };
    const result = getTopRecommendations(recs, 2);
    expect(result).toHaveLength(2);
  });
});
```

### 10. API 문서화
**현재 상태:**
- API 엔드포인트 문서 없음

**개선 방안:**
- OpenAPI/Swagger 스펙 작성
- 또는 간단한 README에 API 목록 정리

### 11. 성능 모니터링
**개선 방안:**
- Web Vitals 측정
- 데이터베이스 쿼리 성능 모니터링
- 서버 응답 시간 추적

### 12. 접근성 개선
**개선 방안:**
- ARIA 레이블 추가
- 키보드 네비게이션 지원
- 색상 대비 개선

---

## 📊 성능 최적화 우선순위

### 즉시 적용 (1주일 내)
1. ✅ 빌드 오류 수정 (완료)
2. 데이터베이스 쿼리 최적화
3. 에러 처리 표준화
4. 입력 검증 강화

### 단기 개선 (1개월 내)
5. 캐싱 전략 도입
6. 코드 중복 제거
7. 타입 안정성 향상
8. 환경 변수 검증

### 중장기 개선 (3개월 내)
9. 테스트 코드 작성
10. API 문서화
11. 성능 모니터링
12. 접근성 개선

---

## 🔒 보안 개선 사항

### 1. 인증/인가 강화
- JWT 토큰 만료 시간 설정
- 세션 관리 개선
- 역할 기반 접근 제어(RBAC) 명확화

### 2. 데이터 보호
- 민감한 정보 암호화
- PII(개인 식별 정보) 마스킹
- 로그에서 민감 정보 제거

### 3. API 보안
- Rate Limiting 도입
- CORS 정책 명확화
- CSRF 보호 강화

---

## 📝 코드 품질 개선

### 1. ESLint 규칙 강화
```javascript
// eslint.config.mjs에 추가
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': 'error',
  'no-console': ['warn', { allow: ['error', 'warn'] }],
}
```

### 2. Prettier 설정
- 코드 포맷팅 자동화
- Git hooks로 포맷팅 강제

### 3. 코드 리뷰 체크리스트
- 타입 안정성
- 에러 처리
- 성능 고려
- 보안 검토

---

## 🚀 배포 및 운영 개선

### 1. CI/CD 파이프라인
- 자동 테스트 실행
- 자동 빌드 및 배포
- 롤백 전략

### 2. 모니터링 및 알림
- 에러 알림 설정
- 성능 임계값 모니터링
- 사용자 활동 추적

### 3. 백업 및 복구
- 데이터베이스 자동 백업
- 복구 절차 문서화
- 재해 복구 계획

---

## 📚 문서화 개선

### 1. README 업데이트
- 프로젝트 개요
- 설치 및 실행 방법
- 환경 변수 설정 가이드
- 배포 가이드

### 2. 코드 주석
- 복잡한 로직 설명
- API 문서 주석
- 타입 정의 설명

### 3. 아키텍처 문서
- 시스템 아키텍처 다이어그램
- 데이터베이스 스키마
- API 엔드포인트 목록

---

## 결론

현재 프로젝트는 기본적인 기능은 잘 구현되어 있으나, 프로덕션 환경을 고려한 개선이 필요합니다. 특히 **에러 처리**, **성능 최적화**, **보안 강화**가 우선순위입니다.

빌드 오류는 모두 수정되었으므로, 이제 위의 개선 사항들을 단계적으로 적용하시면 더욱 안정적이고 확장 가능한 서비스가 될 것입니다.

---

## 📚 관련 문서

### 관련 문서
- **[README.md](./README.md)** - 전체 문서 인덱스 및 구조
- **[서비스 구현 개선 요소 점검](./service_implementation_improvements.md)** - 지속적으로 관리되는 개선 사항 추적 문서 (최신)
- [개선 작업 완료 요약](./improvements_summary.md) - 완료된 개선 작업 요약
- [다음 단계 권장 사항 로드맵](./next_steps_roadmap.md) - 단기/중기 개발 로드맵

