# 서비스 구현 개선 요소 점검

> **최종 업데이트**: 2025-01-08  
> **관리 방식**: 이 문서를 지속적으로 업데이트하여 개선 사항을 추적합니다.

---

## 📋 개요

이 문서는 TimeLevelUp 서비스의 구현 관점에서 발견된 개선 요소들을 체계적으로 정리하고 관리합니다. 각 개선 사항은 우선순위와 상태를 명확히 표시하여 단계적으로 적용할 수 있도록 구성했습니다.

---

## 🔴 긴급 개선 사항 (High Priority)

### 1. 에러 처리 표준화 미적용 파일들

**현재 상태:**
- 일부 액션 파일에서 `throw new Error()` 사용
- `AppError` 및 `withErrorHandling` 미적용
- 에러 메시지가 사용자에게 일관되게 전달되지 않음

**영향 파일:**
- ✅ `app/actions/auth.ts` - 완료
- ✅ `app/actions/blocks.ts` - 완료
- ✅ `app/actions/scores.ts` - 완료
- ✅ `app/actions/autoSchedule.ts` - 완료
- ✅ `app/(student)/actions/planActions.ts` - 완료
- ❌ `app/actions/progress.ts` - **미적용**
- ❌ `app/actions/schedule.ts` - **미적용**
- ❌ `app/analysis/_actions.ts` - **미적용**
- ❌ `app/(student)/actions/contentActions.ts` - **미적용**
- ❌ `app/(student)/actions/studentActions.ts` - 확인 필요
- ❌ `app/(student)/actions/goalActions.ts` - 확인 필요
- ❌ `app/(student)/actions/studySessionActions.ts` - 확인 필요

**개선 방안:**
```typescript
// 현재 (progress.ts)
export async function updateProgress(formData: FormData): Promise<void> {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }
  // ...
}

// 개선 후
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";

async function _updateProgress(formData: FormData): Promise<void> {
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  // ...
}

export const updateProgress = withErrorHandling(_updateProgress);
```

**예상 효과:**
- 일관된 에러 처리
- 사용자 친화적 에러 메시지
- 향후 Sentry 등 에러 트래킹 서비스 통합 용이

---

### 2. 입력 검증 미적용 파일들

**현재 상태:**
- FormData에서 직접 값을 추출하여 검증 없이 사용
- 타입 안정성 부족
- SQL Injection, XSS 방지가 부족

**영향 파일:**
- ✅ `app/actions/auth.ts` - 완료
- ✅ `app/actions/blocks.ts` - 완료
- ✅ `app/actions/scores.ts` - 완료
- ✅ `app/(student)/actions/planActions.ts` - 완료
- ❌ `app/actions/progress.ts` - **미적용**
- ❌ `app/actions/schedule.ts` - **미적용**
- ❌ `app/(student)/actions/contentActions.ts` - **미적용**

**개선 방안:**
```typescript
// 현재 (contentActions.ts)
export async function addBook(formData: FormData) {
  const title = String(formData.get("title"));
  const totalPages = Number(formData.get("total_pages") || 0);
  // 검증 없이 사용
}

// 개선 후
import { validateFormData } from "@/lib/validation/schemas";
import { bookSchema } from "@/lib/validation/schemas";

async function _addBook(formData: FormData) {
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
  const { title, total_pages } = validation.data;
  // 검증된 데이터 사용
}
```

**필요한 스키마 추가:**
- `progressSchema` - 진행률 업데이트용
- `scheduleSchema` - 스케줄 생성용
- `bookSchema`, `lectureSchema`, `customContentSchema` - 콘텐츠 관리용

---

### 3. 42703 에러 처리 코드 중복

**현재 상태:**
- `safeQuery` 헬퍼가 있으나 일부 파일에서 직접 처리
- 동일한 패턴이 여러 곳에 반복됨

**영향 파일:**
- ✅ `app/actions/scores.ts` - `safeQuery` 사용 중
- ❌ `app/actions/progress.ts` - 직접 처리
- ❌ `app/actions/schedule.ts` - 직접 처리
- ❌ `app/analysis/_utils.ts` - 직접 처리
- ❌ `app/scores/dashboard/_utils/scoreQueries.ts` - 직접 처리

**개선 방안:**
```typescript
// 현재 (progress.ts)
let { data, error } = await selectPlan().eq("student_id", studentId).maybeSingle<PlanRow>();
if (error && error.code === "42703") {
  ({ data, error } = await selectPlan().maybeSingle<PlanRow>());
}

// 개선 후
import { safeQuery } from "@/lib/supabase/queryHelpers";

const plan = await safeQuery(
  () => selectPlan().eq("student_id", studentId).maybeSingle<PlanRow>(),
  () => selectPlan().maybeSingle<PlanRow>()
);
```

**예상 효과:**
- 코드 중복 제거
- 유지보수성 향상
- 일관된 에러 처리

---

## 🟡 중요 개선 사항 (Medium Priority)

### 4. 캐싱 전략 확장

**현재 상태:**
- 관리자 대시보드에만 캐싱 적용 (`lib/cache/dashboard.ts`)
- 학생 페이지, 리포트 페이지 등에 캐싱 미적용
- 분석 데이터는 실시간 계산으로 성능 저하 가능

**영향 파일:**
- ✅ `app/(admin)/admin/dashboard/page.tsx` - 캐싱 적용
- ❌ `app/analysis/page.tsx` - 캐싱 미적용
- ❌ `app/scores/dashboard/page.tsx` - 캐싱 미적용
- ❌ `app/reports/_utils.ts` - 캐싱 미적용
- ❌ `app/plan/page.tsx` - 캐싱 미적용

**개선 방안:**
```typescript
// lib/cache/analysis.ts 생성
import { unstable_cache } from "next/cache";

export async function getCachedRiskAnalysis(
  studentId: string,
  calculateFn: () => Promise<SubjectRiskAnalysis[]>
) {
  return unstable_cache(
    async () => calculateFn(),
    [`risk-analysis-${studentId}`],
    {
      tags: [`student-${studentId}`, "analysis"],
      revalidate: 3600, // 1시간
    }
  )();
}
```

**캐싱 전략:**
- **분석 데이터**: 1시간 (자주 변경되지 않음)
- **성적 대시보드**: 5분 (새 성적 입력 시 재검증)
- **리포트 데이터**: 10분 (주간/월간 리포트)
- **플랜 목록**: 1분 (플랜 변경 시 재검증)

---

### 5. 타입 안정성 개선

**현재 상태:**
- `any` 타입 사용
- 타입 단언(`as`) 남용
- 제네릭 타입 활용 부족

**발견된 문제:**
```typescript
// app/actions/autoSchedule.ts
type ContentItem = {
  scoreInfo: SubjectScoreInfo | null;
  schoolScore?: any; // ❌ any 타입
  mockScore?: any; // ❌ any 타입
  riskIndex?: any; // ❌ any 타입
};

// app/contents/page.tsx
async function fetchContentsByTab(
  supabase: any, // ❌ any 타입
  // ...
)

// app/analysis/page.tsx
const analyses = (savedAnalyses as AnalysisRow[] | null) ?? []; // 타입 단언
```

**개선 방안:**
```typescript
// 타입 정의 추가
type SchoolScoreSummary = {
  subject: string;
  averageGrade: number;
  recentGrade: number;
  trend: "up" | "down" | "stable";
};

type MockScoreSummary = {
  subject: string;
  averageScore: number;
  recentScore: number;
};

type RiskIndex = {
  subject: string;
  score: number;
  factors: string[];
};

// Supabase 클라이언트 타입
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type SupabaseClientType = SupabaseClient<Database>;
```

---

### 6. N+1 쿼리 문제 추가 확인

**현재 상태:**
- 관리자 대시보드의 N+1 문제는 해결됨
- 다른 페이지에서 추가 확인 필요

**확인 필요 파일:**
- `app/plan/page.tsx` - 플랜 목록 조회 시 콘텐츠 정보 조회
- `app/contents/page.tsx` - 콘텐츠 목록 조회
- `app/scores/page.tsx` - 성적 목록 조회
- `app/(student)/today/page.tsx` - 오늘의 추천 데이터 조회

**개선 방안:**
```typescript
// 배치 조회 패턴 적용
// 현재: 각 플랜마다 콘텐츠 조회
for (const plan of plans) {
  const content = await fetchContent(plan.content_id);
}

// 개선: 배치 조회
const contentIds = plans.map(p => p.content_id);
const contentsMap = await fetchContentsBatch(contentIds);
```

---

### 7. 로딩 상태 및 에러 바운더리 개선

**현재 상태:**
- 일부 페이지에만 `loading.tsx` 존재
- 에러 바운더리(`error.tsx`)는 있으나 일관성 부족
- Suspense 경계 부족

**개선 방안:**
- 모든 페이지에 `loading.tsx` 추가
- Suspense 경계를 세분화하여 부분 로딩 지원
- 에러 바운더리에서 사용자 친화적 메시지 표시

---

## 🟢 개선 권장 사항 (Low Priority)

### 8. 코드 중복 제거

**발견된 중복:**
- 콘텐츠 조회 로직 (book, lecture, custom)
- 42703 에러 처리 패턴
- 날짜/시간 파싱 로직
- 플랜 정규화 로직

**개선 방안:**
```typescript
// lib/utils/contentQueries.ts 생성
export async function fetchContentById(
  supabase: SupabaseServerClient,
  contentType: "book" | "lecture" | "custom",
  contentId: string,
  studentId: string
) {
  const tableMap = {
    book: "books",
    lecture: "lectures",
    custom: "student_custom_contents",
  };
  
  return safeQuery(
    () => supabase.from(tableMap[contentType]).select("*").eq("id", contentId).eq("student_id", studentId).single(),
    () => supabase.from(tableMap[contentType]).select("*").eq("id", contentId).single()
  );
}
```

---

### 9. 환경 변수 검증 확장

**현재 상태:**
- 기본 Supabase 환경 변수만 검증
- 추가 환경 변수 검증 필요

**확인 필요:**
- 이메일 서비스 환경 변수
- PDF 생성 서비스 환경 변수
- 기타 외부 서비스 API 키

---

### 10. 성능 모니터링 도입

**개선 방안:**
- Web Vitals 측정
- 데이터베이스 쿼리 성능 추적
- 서버 액션 실행 시간 측정
- 캐시 히트율 모니터링

---

## 📊 개선 우선순위 매트릭스

| 우선순위 | 개선 사항 | 예상 작업 시간 | 예상 효과 | 상태 |
|---------|----------|--------------|----------|------|
| 🔴 High | 에러 처리 표준화 | 4-6시간 | 높음 | 진행 중 |
| 🔴 High | 입력 검증 강화 | 6-8시간 | 높음 | 진행 중 |
| 🔴 High | 42703 에러 처리 통합 | 2-3시간 | 중간 | 진행 중 |
| 🟡 Medium | 캐싱 전략 확장 | 4-6시간 | 높음 | 대기 |
| 🟡 Medium | 타입 안정성 개선 | 6-8시간 | 중간 | 대기 |
| 🟡 Medium | N+1 쿼리 추가 확인 | 3-4시간 | 중간 | 대기 |
| 🟡 Medium | 로딩/에러 상태 개선 | 4-6시간 | 중간 | 대기 |
| 🟢 Low | 코드 중복 제거 | 4-6시간 | 낮음 | 대기 |
| 🟢 Low | 환경 변수 검증 확장 | 1-2시간 | 낮음 | 대기 |
| 🟢 Low | 성능 모니터링 도입 | 8-12시간 | 중간 | 대기 |

---

## 📝 진행 상황 추적

### 완료된 작업 ✅

1. ✅ 에러 처리 표준화 (일부 파일)
   - `app/actions/auth.ts`
   - `app/actions/blocks.ts`
   - `app/actions/scores.ts`
   - `app/actions/autoSchedule.ts`
   - `app/(student)/actions/planActions.ts`

2. ✅ 입력 검증 강화 (일부 파일)
   - `app/actions/auth.ts`
   - `app/actions/blocks.ts`
   - `app/actions/scores.ts`
   - `app/(student)/actions/planActions.ts`

3. ✅ 관리자 대시보드 쿼리 최적화
   - N+1 문제 해결
   - 배치 쿼리 적용

4. ✅ 캐싱 전략 도입
   - 관리자 대시보드 캐싱 적용

### 진행 중 🚧

1. 🚧 에러 처리 표준화 (나머지 파일)
   - `app/actions/progress.ts`
   - `app/actions/schedule.ts`
   - `app/analysis/_actions.ts`
   - `app/(student)/actions/contentActions.ts`

2. 🚧 입력 검증 강화 (나머지 파일)
   - `app/actions/progress.ts`
   - `app/actions/schedule.ts`
   - `app/(student)/actions/contentActions.ts`

### 대기 중 ⏳

1. ⏳ 캐싱 전략 확장
2. ⏳ 타입 안정성 개선
3. ⏳ N+1 쿼리 추가 확인
4. ⏳ 로딩/에러 상태 개선

---

## 🎯 다음 단계 액션 아이템

### 즉시 적용 (1주일 내)

1. **에러 처리 표준화 완료**
   - [ ] `app/actions/progress.ts` - `AppError` 및 `withErrorHandling` 적용
   - [ ] `app/actions/schedule.ts` - `AppError` 및 `withErrorHandling` 적용
   - [ ] `app/analysis/_actions.ts` - `AppError` 적용
   - [ ] `app/(student)/actions/contentActions.ts` - `AppError` 및 `withErrorHandling` 적용

2. **입력 검증 스키마 추가 및 적용**
   - [ ] `lib/validation/schemas.ts`에 `progressSchema` 추가
   - [ ] `lib/validation/schemas.ts`에 `scheduleSchema` 추가
   - [ ] `lib/validation/schemas.ts`에 콘텐츠 스키마 추가
   - [ ] 각 액션 파일에 검증 적용

3. **42703 에러 처리 통합**
   - [ ] `app/actions/progress.ts` - `safeQuery` 사용
   - [ ] `app/actions/schedule.ts` - `safeQuery` 사용
   - [ ] `app/analysis/_utils.ts` - `safeQuery` 사용

### 단기 개선 (1개월 내)

4. **캐싱 전략 확장**
   - [ ] `lib/cache/analysis.ts` 생성
   - [ ] `lib/cache/scores.ts` 생성
   - [ ] `lib/cache/reports.ts` 생성
   - [ ] 각 페이지에 캐싱 적용

5. **타입 안정성 개선**
   - [ ] `any` 타입 제거
   - [ ] 타입 단언 최소화
   - [ ] 제네릭 타입 활용

6. **N+1 쿼리 추가 확인 및 해결**
   - [ ] 각 페이지 쿼리 패턴 분석
   - [ ] 배치 조회 함수 생성
   - [ ] 적용 및 성능 측정

---

## 🎯 기능 관점에서 구현해야 할 사항

### 현재 구현된 기능 요약

#### 학생 기능 ✅
- 오늘 페이지 (학습 계획, 추천)
- 대시보드 (통계, 목표, 진행률)
- 플랜 관리 (생성, 수정, 삭제, 진행률 업데이트)
- 자동 스케줄러 (AI 기반 학습 계획 생성)
- 콘텐츠 관리 (책, 강의, 커스텀 콘텐츠)
- 시간 블록 관리
- 성적 관리 (내신, 모의고사)
- 성적 대시보드 (트렌드, 분석)
- 리포트 (주간, 월간, PDF 생성)
- 목표 관리 (생성, 추적, 진행률)
- 분석 (Risk Index 계산)
- 학습 세션 관리 (시작, 종료, 취소)
- 집중 모드 (타이머)

#### 관리자 기능 ✅
- 대시보드 (학생 통계, 위험 학생, Top 학생)
- 학생 관리 (목록, 상세, 통계)
- 상담 노트 (작성, 조회, 수정, 삭제)
- 리포트 조회
- 학생 비교 기능
- 설정 (계정 정보, 기관 관리)
- 테넌트 관리 (SuperAdmin)

#### 부모 기능 ✅
- 대시보드 (자녀 학습 현황)
- 목표 관리
- 히스토리 조회
- 리포트 조회
- 성적 조회
- 설정

---

### 🔴 긴급 구현 필요 기능 (High Priority)

#### 1. 알림 및 리마인더 시스템

**현재 상태:**
- 알림 시스템 미구현
- 리마인더 기능 없음
- 학습 계획 미완료 알림 없음

**구현 필요 사항:**
- 학습 계획 시작 시간 알림
- 미완료 플랜 리마인더
- 목표 마감일 알림
- 성적 입력 리마인더
- 주간/월간 리포트 자동 알림
- 취약 과목 집중 학습 알림

**기술 스택 제안:**
- 이메일 알림: Resend, SendGrid, Nodemailer
- 푸시 알림: Firebase Cloud Messaging (FCM)
- 인앱 알림: 데이터베이스 알림 테이블 + 실시간 업데이트 (Supabase Realtime)

**구현 파일:**
```
lib/notifications/
  - email.ts          # 이메일 알림 서비스
  - push.ts           # 푸시 알림 서비스
  - scheduler.ts      # 알림 스케줄러
  - templates.ts       # 알림 템플릿

app/api/notifications/
  - route.ts          # 알림 API

supabase/migrations/
  - create_notifications_table.sql
```

---

#### 2. 이메일 알림 실제 구현

**현재 상태:**
- `app/reports/_actions.ts`에 구조만 존재
- 실제 이메일 전송 미구현 (TODO 주석)

**구현 필요 사항:**
- 이메일 서비스 연동 (Resend 권장)
- 리포트 PDF 이메일 전송
- 주간/월간 리포트 자동 전송
- 알림 이메일 템플릿
- 이메일 구독 설정

**구현 파일:**
```
lib/email/
  - client.ts         # 이메일 클라이언트 설정
  - templates.ts      # 이메일 템플릿
  - sendReport.ts     # 리포트 전송
  - sendNotification.ts # 알림 전송

app/(student)/settings/
  - notifications/    # 알림 설정 페이지
```

---

#### 3. 비밀번호 재설정 기능

**현재 상태:**
- 비밀번호 재설정 기능 없음
- 로그인/회원가입만 구현

**구현 필요 사항:**
- 비밀번호 재설정 요청 페이지
- 이메일 인증 링크 전송
- 비밀번호 재설정 페이지
- 비밀번호 변경 기능

**구현 파일:**
```
app/forgot-password/
  - page.tsx          # 비밀번호 재설정 요청

app/reset-password/
  - page.tsx          # 비밀번호 재설정

app/actions/
  - password.ts       # 비밀번호 관련 액션
```

---

#### 4. 계정 관리 기능

**현재 상태:**
- 계정 삭제/탈퇴 기능 없음
- 프로필 수정 기능 제한적

**구현 필요 사항:**
- 프로필 수정 (이름, 이메일)
- 비밀번호 변경
- 계정 탈퇴
- 데이터 삭제 확인 및 처리
- 계정 비활성화

**구현 파일:**
```
app/(student)/settings/
  - profile/          # 프로필 수정
  - account/          # 계정 관리
  - delete/           # 계정 삭제

app/actions/
  - account.ts        # 계정 관리 액션
```

---

### 🟡 중요 구현 필요 기능 (Medium Priority)

#### 5. 데이터 내보내기/가져오기

**현재 상태:**
- 데이터 내보내기 기능 없음
- 데이터 가져오기 기능 없음

**구현 필요 사항:**
- 전체 데이터 JSON/CSV 내보내기
- 성적 데이터 Excel 내보내기
- 학습 계획 템플릿 내보내기
- 데이터 가져오기 (CSV, Excel)
- 백업/복원 기능

**구현 파일:**
```
app/(student)/settings/
  - export/           # 데이터 내보내기
  - import/           # 데이터 가져오기

lib/export/
  - json.ts           # JSON 내보내기
  - csv.ts            # CSV 내보내기
  - excel.ts          # Excel 내보내기

lib/import/
  - parser.ts         # 데이터 파서
  - validator.ts      # 데이터 검증
```

---

#### 6. 검색 기능

**현재 상태:**
- 전역 검색 기능 없음
- 각 페이지별 필터만 존재

**구현 필요 사항:**
- 전역 검색 (콘텐츠, 플랜, 성적, 목표)
- 고급 검색 (필터, 정렬)
- 검색 히스토리
- 자동완성

**구현 파일:**
```
app/search/
  - page.tsx          # 검색 페이지
  - _components/
    - SearchBar.tsx
    - SearchResults.tsx
    - AdvancedFilters.tsx

lib/search/
  - engine.ts         # 검색 엔진
  - indexer.ts        # 검색 인덱싱
```

---

#### 7. 소셜 로그인

**현재 상태:**
- 이메일/비밀번호 로그인만 지원

**구현 필요 사항:**
- Google 로그인
- Kakao 로그인 (한국 서비스)
- Naver 로그인 (한국 서비스)
- Apple 로그인

**구현 파일:**
```
app/login/
  - _components/
    - SocialLoginButtons.tsx

lib/auth/
  - social.ts         # 소셜 로그인 처리
```

---

#### 8. 대량 작업 (Bulk Operations)

**현재 상태:**
- 개별 작업만 가능
- 대량 선택/삭제 기능 없음

**구현 필요 사항:**
- 여러 플랜 선택/삭제
- 여러 콘텐츠 선택/삭제
- 여러 성적 선택/삭제
- 대량 수정

**구현 파일:**
```
app/plan/
  - _components/
    - BulkActions.tsx

app/contents/
  - _components/
    - BulkActions.tsx
```

---

#### 9. 템플릿 기능

**현재 상태:**
- 학습 계획 템플릿 없음
- 반복적인 플랜 생성 불편

**구현 필요 사항:**
- 학습 계획 템플릿 생성/저장
- 템플릿 기반 플랜 생성
- 공유 템플릿
- 템플릿 라이브러리

**구현 파일:**
```
app/templates/
  - page.tsx          # 템플릿 목록
  - [id]/
    - page.tsx        # 템플릿 상세
  - new/
    - page.tsx        # 템플릿 생성

lib/templates/
  - manager.ts       # 템플릿 관리
```

---

#### 10. 리포트 자동 전송

**현재 상태:**
- 수동으로만 리포트 생성/전송 가능

**구현 필요 사항:**
- 주간 리포트 자동 전송 (매주 월요일)
- 월간 리포트 자동 전송 (매월 1일)
- 자동 전송 설정
- 전송 대상 선택 (학생, 부모, 관리자)

**구현 파일:**
```
lib/cron/
  - reportScheduler.ts # 리포트 스케줄러

app/(student)/settings/
  - reports/         # 리포트 설정
```

---

### 🟢 개선 권장 기능 (Low Priority)

#### 11. 다국어 지원 (i18n)

**현재 상태:**
- 한국어만 지원

**구현 필요 사항:**
- 영어 지원
- 다국어 리소스 관리
- 언어 선택 기능

**구현 파일:**
```
lib/i18n/
  - config.ts        # i18n 설정
  - locales/
    - ko.json
    - en.json

app/[locale]/
  - ...              # 다국어 라우팅
```

---

#### 12. 접근성 개선

**현재 상태:**
- 기본적인 접근성만 고려

**구현 필요 사항:**
- ARIA 레이블 추가
- 키보드 네비게이션 개선
- 스크린 리더 지원
- 색상 대비 개선
- 폰트 크기 조절

---

#### 13. 모바일 앱

**현재 상태:**
- 웹 앱만 존재

**구현 필요 사항:**
- React Native 앱
- 푸시 알림
- 오프라인 지원
- 모바일 최적화

---

#### 14. AI 챗봇/상담

**현재 상태:**
- AI 추천 기능만 존재

**구현 필요 사항:**
- 학습 상담 챗봇
- 학습 방법 질의응답
- 개인화된 학습 조언

**기술 스택 제안:**
- OpenAI GPT API
- Anthropic Claude API
- LangChain

---

#### 15. 학습 패턴 분석 고급 기능

**현재 상태:**
- 기본적인 Risk Index 계산만 존재

**구현 필요 사항:**
- 학습 시간대 패턴 분석
- 효율적인 학습 시간대 추천
- 학습 습관 분석
- 학습 효과성 분석

**구현 파일:**
```
lib/analytics/
  - patternAnalysis.ts
  - habitAnalysis.ts
  - effectivenessAnalysis.ts
```

---

#### 16. 공유 기능

**현재 상태:**
- 공유 기능 없음

**구현 필요 사항:**
- 학습 계획 공유
- 리포트 공유
- 목표 공유
- 공개/비공개 설정

---

#### 17. 댓글/피드백 기능

**현재 상태:**
- 상담 노트만 존재 (관리자-학생 간)

**구현 필요 사항:**
- 학습 계획에 댓글
- 목표에 피드백
- 관리자 피드백 시스템

---

#### 18. 통계 대시보드 고급 기능

**현재 상태:**
- 기본 통계만 제공

**구현 필요 사항:**
- 커스터마이징 가능한 대시보드
- 위젯 추가/제거
- 차트 타입 선택
- 기간별 비교

---

#### 19. 데이터 시각화 고급 기능

**현재 상태:**
- 기본 차트만 제공

**구현 필요 사항:**
- 인터랙티브 차트
- 3D 시각화
- 히트맵
- 트렌드 예측 그래프

**기술 스택 제안:**
- Recharts
- Chart.js
- D3.js
- Plotly

---

#### 20. 협업 기능

**현재 상태:**
- 개인 학습 관리만 지원

**구현 필요 사항:**
- 그룹 학습
- 학습 그룹 생성
- 그룹 목표 설정
- 그룹 리포트

---

### 📊 기능 구현 우선순위 매트릭스

| 우선순위 | 기능 | 예상 작업 시간 | 비즈니스 가치 | 기술 난이도 | 상태 |
|---------|------|--------------|-------------|------------|------|
| 🔴 High | 알림 시스템 | 2-3주 | 매우 높음 | 중간 | 미구현 |
| 🔴 High | 이메일 알림 | 1주 | 높음 | 낮음 | 구조만 존재 |
| 🔴 High | 비밀번호 재설정 | 3-5일 | 높음 | 낮음 | 미구현 |
| 🔴 High | 계정 관리 | 1주 | 높음 | 낮음 | 부분 구현 |
| 🟡 Medium | 데이터 내보내기/가져오기 | 2주 | 중간 | 중간 | 미구현 |
| 🟡 Medium | 검색 기능 | 1-2주 | 중간 | 중간 | 미구현 |
| 🟡 Medium | 소셜 로그인 | 1주 | 중간 | 낮음 | 미구현 |
| 🟡 Medium | 대량 작업 | 1주 | 중간 | 낮음 | 미구현 |
| 🟡 Medium | 템플릿 기능 | 2주 | 중간 | 중간 | 미구현 |
| 🟡 Medium | 리포트 자동 전송 | 1주 | 중간 | 낮음 | 미구현 |
| 🟢 Low | 다국어 지원 | 2-3주 | 낮음 | 중간 | 미구현 |
| 🟢 Low | 접근성 개선 | 1-2주 | 중간 | 낮음 | 부분 구현 |
| 🟢 Low | 모바일 앱 | 2-3개월 | 높음 | 높음 | 미구현 |
| 🟢 Low | AI 챗봇 | 1-2개월 | 중간 | 높음 | 미구현 |
| 🟢 Low | 학습 패턴 분석 고급 | 2-3주 | 중간 | 높음 | 부분 구현 |
| 🟢 Low | 공유 기능 | 1-2주 | 낮음 | 중간 | 미구현 |
| 🟢 Low | 댓글/피드백 | 1주 | 낮음 | 낮음 | 부분 구현 |
| 🟢 Low | 통계 대시보드 고급 | 2-3주 | 중간 | 중간 | 부분 구현 |
| 🟢 Low | 데이터 시각화 고급 | 2-3주 | 중간 | 높음 | 부분 구현 |
| 🟢 Low | 협업 기능 | 1-2개월 | 낮음 | 높음 | 미구현 |

---

### 🎯 다음 단계 액션 아이템 (기능 구현)

#### 즉시 시작 (1개월 내)

1. **알림 시스템 구현**
   - [ ] 알림 테이블 스키마 설계
   - [ ] 이메일 알림 서비스 연동
   - [ ] 인앱 알림 시스템 구축
   - [ ] 알림 설정 페이지 구현

2. **이메일 알림 실제 구현**
   - [ ] Resend 또는 SendGrid 연동
   - [ ] 이메일 템플릿 작성
   - [ ] 리포트 자동 전송 구현
   - [ ] 알림 이메일 전송 구현

3. **비밀번호 재설정**
   - [ ] 비밀번호 재설정 요청 페이지
   - [ ] 이메일 인증 링크 전송
   - [ ] 비밀번호 재설정 페이지
   - [ ] Supabase Auth 연동

4. **계정 관리 기능**
   - [ ] 프로필 수정 페이지
   - [ ] 비밀번호 변경 기능
   - [ ] 계정 탈퇴 기능
   - [ ] 데이터 삭제 처리

#### 단기 구현 (3개월 내)

5. **데이터 내보내기/가져오기**
6. **검색 기능**
7. **소셜 로그인**
8. **대량 작업**
9. **템플릿 기능**
10. **리포트 자동 전송**

---

## 📚 참고 자료

### 관련 문서
- **[README.md](./README.md)** - 전체 문서 인덱스 및 구조
- [개선 작업 완료 요약](./improvements_summary.md) - 완료된 개선 작업 요약
- [서비스 개선 추천 사항](./service_improvement_recommendations.md) - 초기 분석 단계의 종합 개선 권장사항
- [다음 단계 권장 사항 로드맵](./next_steps_roadmap.md) - 단기/중기 개발 로드맵

### 스키마 관련
- [데이터 스키마 분석 보고서](./schema_analysis.md) - 전체 스키마 구조
- [멀티테넌트 구조 구현 가이드](./multitenant_implementation.md) - 멀티테넌트 구현 방법

---

## 🔄 문서 업데이트 가이드

이 문서는 지속적으로 업데이트되어야 합니다:

1. **작업 완료 시**: 해당 항목의 상태를 "완료"로 변경하고 완료 날짜 기록
2. **새로운 개선 사항 발견 시**: 적절한 우선순위 섹션에 추가
3. **우선순위 변경 시**: 매트릭스와 섹션 업데이트
4. **주기적 검토**: 월 1회 전체 개선 사항 검토 및 우선순위 재평가

---

**마지막 검토일**: 2025-01-08  
**다음 검토 예정일**: 2025-02-08

