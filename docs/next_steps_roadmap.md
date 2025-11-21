# 다음 단계 권장 사항 로드맵

> **관련 문서**: [README.md](./README.md) - 전체 문서 인덱스 | [서비스 구현 개선 요소 점검](./service_implementation_improvements.md) - 최신 개선 사항

## 📅 현재 상태 (2025-01-08)

### ✅ 완료된 작업
1. ✅ 에러 처리 표준화 (`lib/errors/handler.ts`)
2. ✅ 입력 검증 강화 (`lib/validation/schemas.ts`)
3. ✅ 환경 변수 검증 (`lib/env.ts`)
4. ✅ Supabase 쿼리 헬퍼 (`lib/supabase/queryHelpers.ts`)
5. ✅ 데이터베이스 쿼리 최적화 (N+1 문제 해결)
6. ✅ 나머지 액션 파일에 에러 처리 및 입력 검증 적용
   - `app/actions/scores.ts`
   - `app/actions/autoSchedule.ts`
   - `app/(student)/actions/planActions.ts`
7. ✅ 관리자 대시보드 쿼리 최적화
8. ✅ 캐싱 전략 도입 (`lib/cache/dashboard.ts`)

---

## 🎯 단기 권장 사항 (1-2주 내)

### 1. 나머지 액션 파일에 에러 처리 및 입력 검증 적용

**우선순위**: 높음  
**예상 소요 시간**: 2-3일

#### 대상 파일
- [ ] `app/actions/contents.ts` - 콘텐츠 생성/수정/삭제
- [ ] `app/actions/progress.ts` - 학습 진행률 업데이트
- [ ] `app/analysis/_actions.ts` - Risk Index 재계산
- [ ] `app/(student)/actions/studentActions.ts` - 학생 정보 저장
- [ ] `app/actions/goals.ts` (존재하는 경우) - 목표 생성/수정/삭제

#### 작업 내용
```typescript
// 예시: contents.ts
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { validateFormData, bookSchema } from "@/lib/validation/schemas";

async function _createBook(formData: FormData) {
  const validation = validateFormData(formData, bookSchema);
  if (!validation.success) {
    const firstError = validation.errors.errors[0];
    throw new AppError(
      firstError?.message ?? "입력값을 확인해주세요.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }
  // ... 비즈니스 로직
}

export const createBook = withErrorHandling(_createBook);
```

#### 필요한 스키마 추가
- `lib/validation/schemas.ts`에 다음 스키마 추가:
  - 콘텐츠 수정 스키마 (기존 스키마 재사용 가능)
  - 진행률 업데이트 스키마
  - 학생 정보 스키마

---

### 2. 타입 안정성 향상

**우선순위**: 중간  
**예상 소요 시간**: 1-2일

#### 개선 대상
- [ ] `any` 타입 제거
- [ ] 타입 단언(`as`) 최소화
- [ ] 제네릭 타입 활용 강화

#### 주요 파일
- `app/actions/autoSchedule.ts` - `any` 타입 사용 (98-100줄)
- `lib/scheduler/scoreLoader.ts` - 타입 정의 강화
- `lib/risk/engine.ts` - 타입 안정성 개선

#### 작업 예시
```typescript
// Before
schoolScore?: any;
mockScore?: any;
riskIndex?: any;

// After
type SchoolScoreSummary = {
  recentGrade: number;
  averageGrade: number;
  gradeVariance: number;
  // ...
};

schoolScore?: SchoolScoreSummary;
mockScore?: MockScoreSummary;
riskIndex?: RiskIndexData;
```

---

### 3. 코드 중복 제거

**우선순위**: 중간  
**예상 소요 시간**: 1일

#### 개선 대상
- [ ] 42703 에러 처리 로직 통합 (일부 남아있을 수 있음)
- [ ] 유사한 쿼리 패턴을 헬퍼 함수로 추출
- [ ] 학생 정보 조회 로직 통합

#### 확인 필요 파일
- `app/analysis/_utils.ts`
- `app/analysis/page.tsx`
- 기타 액션 파일들

---

## 🚀 중기 권장 사항 (1개월 내)

### 4. 에러 트래킹 서비스 통합

**우선순위**: 높음  
**예상 소요 시간**: 2-3일  
**비용**: 무료 플랜 또는 유료 플랜

#### 추천 서비스
- **Sentry** (추천) - 가장 널리 사용됨
- **LogRocket** - 세션 리플레이 포함
- **Bugsnag** - 간단한 설정

#### 구현 계획
```typescript
// lib/errors/tracking.ts
import * as Sentry from "@sentry/nextjs";

export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "production") {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error("[Error]", error, context);
  }
}
```

#### 설정 파일
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

#### 통합 단계
1. Sentry 프로젝트 생성
2. 패키지 설치: `npm install @sentry/nextjs`
3. `lib/errors/handler.ts`의 `logError` 함수 수정
4. 환경 변수 추가: `NEXT_PUBLIC_SENTRY_DSN`
5. 테스트 및 모니터링 설정

---

### 5. 성능 모니터링

**우선순위**: 중간  
**예상 소요 시간**: 2-3일

#### Web Vitals 측정
```typescript
// app/layout.tsx 또는 _app.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

#### 데이터베이스 쿼리 성능 추적
- Supabase Dashboard에서 쿼리 성능 확인
- 느린 쿼리 식별 및 최적화
- 인덱스 추가 검토

#### 구현 항목
- [ ] Vercel Analytics 또는 Google Analytics 통합
- [ ] Web Vitals 측정 (LCP, FID, CLS)
- [ ] 데이터베이스 쿼리 로깅 (개발 환경)
- [ ] 성능 대시보드 구축

---

### 6. 캐싱 전략 확장

**우선순위**: 중간  
**예상 소요 시간**: 1-2일

#### 추가 캐싱 대상
- [ ] 학생 상세 페이지 데이터
- [ ] 분석 페이지 (Risk Index)
- [ ] 리포트 데이터
- [ ] 콘텐츠 목록

#### 구현 계획
```typescript
// lib/cache/student.ts
export async function getCachedStudentDetail(
  studentId: string,
  getDataFn: () => Promise<StudentDetail>
) {
  return unstable_cache(
    async () => getDataFn(),
    [`student-detail-${studentId}`],
    {
      tags: [`student-${studentId}`],
      revalidate: 300, // 5분
    }
  )();
}
```

#### 캐시 무효화 전략
- 데이터 업데이트 시 관련 캐시 태그 무효화
- `revalidateTag` 활용

---

## 🔮 장기 권장 사항 (2-3개월 내)

### 7. 테스트 코드 작성

**우선순위**: 중간  
**예상 소요 시간**: 지속적

#### 테스트 범위
- [ ] 단위 테스트 (유틸리티 함수)
- [ ] 통합 테스트 (액션 함수)
- [ ] E2E 테스트 (주요 사용자 플로우)

#### 추천 도구
- **Jest** - 단위/통합 테스트
- **React Testing Library** - 컴포넌트 테스트
- **Playwright** - E2E 테스트

---

### 8. API 문서화

**우선순위**: 낮음  
**예상 소요 시간**: 1주

#### 문서화 대상
- 서버 액션 API
- 데이터베이스 스키마
- 비즈니스 로직 플로우

#### 추천 도구
- **Next.js API Routes 문서화** (있는 경우)
- **OpenAPI/Swagger** (API가 있는 경우)
- **Markdown 문서** (현재 방식 유지)

---

### 9. 보안 강화

**우선순위**: 높음 (프로덕션 배포 전 필수)  
**예상 소요 시간**: 1주

#### 보안 체크리스트
- [ ] Rate Limiting 구현
- [ ] CSRF 보호 확인
- [ ] XSS 방지 검증
- [ ] SQL Injection 방지 확인 (Supabase가 처리하지만 추가 검증)
- [ ] 인증/인가 로직 검토
- [ ] 민감 정보 로깅 방지

---

## 📊 우선순위 매트릭스

| 작업 | 우선순위 | 소요 시간 | 영향도 | 난이도 |
|------|---------|---------|--------|--------|
| 나머지 액션 파일 에러 처리 | 높음 | 2-3일 | 높음 | 낮음 |
| 에러 트래킹 서비스 통합 | 높음 | 2-3일 | 높음 | 중간 |
| 타입 안정성 향상 | 중간 | 1-2일 | 중간 | 중간 |
| 성능 모니터링 | 중간 | 2-3일 | 중간 | 중간 |
| 코드 중복 제거 | 중간 | 1일 | 낮음 | 낮음 |
| 캐싱 전략 확장 | 중간 | 1-2일 | 중간 | 낮음 |
| 테스트 코드 작성 | 중간 | 지속적 | 높음 | 높음 |
| 보안 강화 | 높음 | 1주 | 높음 | 중간 |
| API 문서화 | 낮음 | 1주 | 낮음 | 낮음 |

---

## 🎯 추천 진행 순서

### 1주차
1. 나머지 액션 파일에 에러 처리 및 입력 검증 적용
2. 타입 안정성 향상 (주요 `any` 타입 제거)

### 2주차
3. 에러 트래킹 서비스 통합 (Sentry)
4. 코드 중복 제거

### 3-4주차
5. 성능 모니터링 설정
6. 캐싱 전략 확장

### 이후
7. 보안 강화 (프로덕션 배포 전 필수)
8. 테스트 코드 작성 (지속적)
9. API 문서화 (필요시)

---

## 📝 참고 사항

- 각 작업은 독립적으로 진행 가능
- 우선순위는 프로젝트 상황에 따라 조정 가능
- 프로덕션 배포 전에는 **보안 강화**와 **에러 트래킹**이 필수
- 성능 개선은 사용자 증가에 따라 점진적으로 진행

---

## 🔗 관련 문서

- **[README.md](./README.md)** - 전체 문서 인덱스 및 구조
- [개선 작업 완료 요약](./improvements_summary.md) - 완료된 개선 작업 요약
- [서비스 구현 개선 요소 점검](./service_implementation_improvements.md) - 최신 개선 사항 추적
- [서비스 개선 추천 사항](./service_improvement_recommendations.md) - 초기 분석 단계의 종합 개선 권장사항
- [Supabase 마이그레이션 가이드](./supabase_migration_guide.md) - 마이그레이션 실행 방법

