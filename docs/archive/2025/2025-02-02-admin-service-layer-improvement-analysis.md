# 관리자 영역 서비스 레이어 개선, 기능 확장, 최적화 분석

**작성 일자**: 2025-02-02  
**분석 대상**: 관리자 영역 (`app/(admin)/`) 서비스 레이어 및 도메인 로직  
**목적**: 서비스 레이어 개선, 기능 확장 가능성, 성능 최적화 분석

---

## 📋 목차

1. [현재 구조 분석](#1-현재-구조-분석)
2. [서비스 레이어 개선 분석](#2-서비스-레이어-개선-분석)
3. [기능 확장 분석](#3-기능-확장-분석)
4. [최적화 분석](#4-최적화-분석)
5. [개선 로드맵](#5-개선-로드맵)

---

## 1. 현재 구조 분석

### 1.1 아키텍처 현황

#### 계층 구조

```
app/(admin)/                    # 프레젠테이션 레이어
├── admin/
│   ├── dashboard/             # 대시보드 (직접 데이터 페칭)
│   ├── students/              # 학생 관리
│   ├── camp-templates/        # 캠프 템플릿 관리
│   ├── content-management/     # 콘텐츠 관리
│   └── ...
│
lib/domains/                    # 도메인 레이어
├── admin-plan/                 # 관리자 플랜 관리
│   ├── actions/               # Server Actions
│   ├── services/              # 비즈니스 로직 (미구현)
│   └── transformers/          # 데이터 변환
├── student/                    # 학생 도메인
├── camp/                       # 캠프 도메인
└── ...
│
lib/services/                   # 인프라 서비스 레이어
├── inAppNotificationService.ts
├── smsService.ts
├── campNotificationService.ts
└── ...
│
lib/data/                       # 데이터 접근 레이어
├── students.ts
├── campTemplates.ts
└── ...
```

### 1.2 현재 패턴 분석

#### ✅ 잘 구현된 부분

1. **도메인별 분리**
   - `lib/domains/` 하위에 도메인별로 명확히 분리
   - 각 도메인은 `actions/`, `types.ts`, `index.ts` 구조

2. **에러 처리 패턴**
   - `withErrorHandling` 래퍼 사용
   - `AppError`, `ErrorCode` 표준화
   - 도메인별 에러 타입 정의 (`CampErrorInfo` 등)

3. **권한 검증**
   - `requireAdminOrConsultant()` 가드 함수
   - 역할 기반 접근 제어

4. **캐싱 전략**
   - 대시보드 데이터 캐싱 (`lib/cache/dashboard.ts`)
   - Next.js `unstable_cache` 활용

#### ⚠️ 개선이 필요한 부분

1. **서비스 레이어 부재**
   - 페이지에서 직접 데이터 페칭 (`app/(admin)/admin/dashboard/page.tsx`)
   - 비즈니스 로직이 Server Actions에 혼재
   - 재사용 가능한 서비스 함수 부족

2. **일관성 부족**
   - 일부는 `lib/data/` 사용, 일부는 직접 쿼리
   - 캐싱 전략이 일관되지 않음
   - 에러 처리 패턴이 통일되지 않음

3. **N+1 쿼리 문제**
   - 대시보드에서 학생별 위험 점수 계산 시 순차 처리
   - 플랜 조회 시 개별 쿼리 실행

4. **타입 안전성**
   - 일부 함수에서 `any` 타입 사용
   - Supabase 응답 타입이 명시적이지 않음

---

## 2. 서비스 레이어 개선 분석

### 2.1 현재 문제점 상세

#### 문제 1: 페이지에서 직접 데이터 페칭

**현재 코드** (`app/(admin)/admin/dashboard/page.tsx`):

```typescript
// ❌ 문제: 페이지 컴포넌트에 비즈니스 로직 포함
async function getStudentStatistics(
  supabase: SupabaseServerClient,
  weekStart: Date,
  weekEnd: Date
) {
  // 복잡한 통계 계산 로직이 페이지에 있음
  const { count: totalCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  // ...
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd } = getWeekRange();
  
  const studentStats = await getCachedStudentStatistics(
    supabase,
    weekStart,
    weekEnd,
    getStudentStatistics  // 페이지 내부 함수 전달
  );
}
```

**문제점**:
- 비즈니스 로직이 페이지에 결합
- 테스트 어려움
- 재사용 불가능
- 유지보수 어려움

#### 문제 2: 서비스 레이어 구조 부재

**현재 상태**:
- `lib/services/`는 인프라 서비스만 존재 (알림, SMS 등)
- 도메인별 서비스 레이어가 없음
- `lib/domains/*/services/` 디렉토리는 대부분 비어있음

**예외**:
- `lib/domains/camp/services/` - 일부 서비스 존재
- `lib/domains/analysis/services/` - 분석 서비스 존재

### 2.2 개선 방안

#### 개선안 1: 도메인별 서비스 레이어 구축

**제안 구조**:

```
lib/domains/admin-dashboard/
├── services/
│   ├── dashboardStatisticsService.ts    # 통계 서비스
│   ├── dashboardTopStudentsService.ts   # Top 학생 서비스
│   └── dashboardRiskAnalysisService.ts  # 위험 분석 서비스
├── actions/
│   └── dashboard.ts                     # Server Actions (서비스 호출)
└── types.ts
```

**구현 예시**:

```typescript
// lib/domains/admin-dashboard/services/dashboardStatisticsService.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseServerClient } from "@/lib/types/supabase";

export interface StudentStatistics {
  total: number;
  activeThisWeek: number;
  withScores: number;
  withPlans: number;
}

export interface StudentStatisticsParams {
  weekStart: Date;
  weekEnd: Date;
  tenantId?: string;
}

/**
 * 학생 통계 조회 서비스
 */
export async function getStudentStatistics(
  params: StudentStatisticsParams
): Promise<StudentStatistics> {
  const supabase = await createSupabaseServerClient();
  const { weekStart, weekEnd, tenantId } = params;

  // 쿼리 빌더 패턴으로 확장 가능하게
  let query = supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // 테넌트 필터링 (필요시)
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { count: totalCount, error: countError } = await query;

  if (countError) {
    throw new Error(`학생 통계 조회 실패: ${countError.message}`);
  }

  // 이번주 학습한 학생 수
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data: activeStudents } = await supabase
    .from("student_study_sessions")
    .select("student_id", { count: "exact" })
    .gte("started_at", weekStartStr)
    .lte("started_at", weekEndStr);

  const activeStudentIds = new Set(
    (activeStudents ?? [])
      .map((s) => s.student_id)
      .filter(Boolean)
  );

  // 성적 입력 학생 수
  const [schoolScores, mockScores] = await Promise.all([
    supabase.from("student_internal_scores").select("student_id"),
    supabase.from("student_mock_scores").select("student_id"),
  ]);

  const studentIdsWithScores = new Set<string>();
  (schoolScores.data ?? []).forEach((s) => {
    if (s.student_id) studentIdsWithScores.add(s.student_id);
  });
  (mockScores.data ?? []).forEach((s) => {
    if (s.student_id) studentIdsWithScores.add(s.student_id);
  });

  // 이번주 플랜이 있는 학생 수
  const { data: plansData } = await supabase
    .from("student_plan")
    .select("student_id")
    .gte("plan_date", weekStartStr)
    .lte("plan_date", weekEndStr);

  const studentIdsWithPlans = new Set(
    (plansData ?? [])
      .map((p) => p.student_id)
      .filter(Boolean)
  );

  return {
    total: totalCount ?? 0,
    activeThisWeek: activeStudentIds.size,
    withScores: studentIdsWithScores.size,
    withPlans: studentIdsWithPlans.size,
  };
}
```

**Server Action에서 사용**:

```typescript
// lib/domains/admin-dashboard/actions/dashboard.ts

"use server";

import { getStudentStatistics } from "../services/dashboardStatisticsService";
import { getCachedStudentStatistics } from "@/lib/cache/dashboard";
import { getWeekRange } from "@/lib/date/weekRange";

export async function getDashboardStatisticsAction() {
  const { weekStart, weekEnd } = getWeekRange();
  
  return getCachedStudentStatistics(
    await createSupabaseServerClient(),
    weekStart,
    weekEnd,
    () => getStudentStatistics({ weekStart, weekEnd })
  );
}
```

**페이지에서 사용**:

```typescript
// app/(admin)/admin/dashboard/page.tsx

import { getDashboardStatisticsAction } from "@/lib/domains/admin-dashboard/actions/dashboard";

export default async function AdminDashboardPage() {
  const studentStats = await getDashboardStatisticsAction();
  // ...
}
```

#### 개선안 2: 서비스 레이어 표준 패턴 정의

**서비스 인터페이스 표준화**:

```typescript
// lib/domains/_shared/types/service.ts

/**
 * 서비스 레이어 공통 인터페이스
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedServiceResult<T> extends ServiceResult<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 서비스 레이어 공통 에러 처리
 */
export function createServiceError(
  message: string,
  code?: string
): ServiceResult<never> {
  return {
    success: false,
    error: message,
    metadata: code ? { code } : undefined,
  };
}

/**
 * 서비스 레이어 성공 응답
 */
export function createServiceSuccess<T>(
  data: T,
  metadata?: Record<string, unknown>
): ServiceResult<T> {
  return {
    success: true,
    data,
    metadata,
  };
}
```

**서비스 함수 표준 패턴**:

```typescript
// lib/domains/admin-dashboard/services/dashboardTopStudentsService.ts

import { createServiceSuccess, createServiceError } from "@/lib/domains/_shared/types/service";

export interface TopStudent {
  studentId: string;
  name: string;
  minutes: number;
}

export interface TopStudentsParams {
  weekStart: Date;
  weekEnd: Date;
  limit?: number;
  tenantId?: string;
}

/**
 * 이번주 학습시간 Top 학생 조회
 */
export async function getTopStudyTimeStudents(
  params: TopStudentsParams
): Promise<ServiceResult<TopStudent[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { weekStart, weekEnd, limit = 5, tenantId } = params;

    // 쿼리 로직...
    const topStudents = []; // 실제 구현

    return createServiceSuccess(topStudents);
  } catch (error) {
    return createServiceError(
      error instanceof Error ? error.message : "학습시간 Top 학생 조회 실패"
    );
  }
}
```

#### 개선안 3: 캐싱 전략 통합

**통합 캐싱 서비스**:

```typescript
// lib/services/cacheService.ts

import { unstable_cache } from "next/cache";

export interface CacheOptions {
  tags?: string[];
  revalidate?: number;
  key?: string;
}

/**
 * 통합 캐싱 래퍼
 */
export async function withCache<T>(
  fn: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const { tags = [], revalidate = 60, key } = options;

  if (!key) {
    throw new Error("Cache key is required");
  }

  return unstable_cache(fn, [key], {
    tags,
    revalidate,
  })();
}

/**
 * 도메인별 캐시 태그 관리
 */
export const CACHE_TAGS = {
  DASHBOARD: {
    STATS: "dashboard:stats",
    TOP_STUDENTS: "dashboard:top-students",
    AT_RISK: "dashboard:at-risk",
  },
  STUDENTS: {
    LIST: "students:list",
    DETAIL: "students:detail",
  },
  // ...
} as const;
```

**서비스에서 사용**:

```typescript
import { withCache, CACHE_TAGS } from "@/lib/services/cacheService";

export async function getStudentStatistics(
  params: StudentStatisticsParams
): Promise<StudentStatistics> {
  const cacheKey = `student-stats-${params.weekStart.toISOString()}-${params.weekEnd.toISOString()}`;
  
  return withCache(
    async () => {
      // 실제 데이터 조회 로직
      return await fetchStudentStatistics(params);
    },
    {
      key: cacheKey,
      tags: [CACHE_TAGS.DASHBOARD.STATS],
      revalidate: 60, // 1분
    }
  );
}
```

### 2.3 개선 효과

#### ✅ 장점

1. **관심사 분리**
   - 페이지는 UI 렌더링에만 집중
   - 비즈니스 로직은 서비스 레이어에 집중

2. **재사용성 향상**
   - 서비스 함수를 여러 곳에서 재사용 가능
   - API 라우트, Server Actions, 다른 페이지에서 활용

3. **테스트 용이성**
   - 서비스 함수를 독립적으로 테스트 가능
   - Mock 데이터로 단위 테스트 작성 가능

4. **유지보수성 향상**
   - 로직 변경 시 한 곳만 수정
   - 코드 중복 제거

5. **타입 안전성**
   - 명시적인 타입 정의
   - TypeScript의 이점 최대 활용

---

## 3. 기능 확장 분석

### 3.1 현재 기능 현황

#### 구현된 기능

1. **학생 관리**
   - 학생 목록 조회, 검색, 필터링
   - 학생 상세 정보 관리
   - 학생 구분(division) 관리
   - 부모 연결 관리

2. **플랜 관리**
   - AI 플랜 생성 (일괄/개별)
   - Ad-hoc 플랜 관리
   - 플랜 필터링 및 검색
   - 플랜 이벤트 로깅

3. **캠프 관리**
   - 캠프 템플릿 생성/수정
   - 캠프 참여자 관리
   - 캠프 출석 관리
   - 캠프 진행률 모니터링

4. **콘텐츠 관리**
   - 마스터 교재/강의 관리
   - 커스텀 콘텐츠 관리
   - 콘텐츠 메타데이터 관리

5. **대시보드**
   - 학생 통계
   - Top 학생 리스트
   - 위험 학생 분석
   - 상담노트 조회

### 3.2 확장 가능한 기능 영역

#### 확장 영역 1: 고급 분석 및 리포팅

**현재 상태**:
- 기본 통계만 제공
- 위험 학생 분석은 있으나 시각화 부족

**제안 기능**:

1. **학습 패턴 분석**
   ```typescript
   // lib/domains/admin-dashboard/services/learningPatternService.ts
   
   export interface LearningPatternAnalysis {
     studentId: string;
     preferredStudyTime: "morning" | "afternoon" | "evening";
     studyConsistency: number; // 0-100
     subjectPreferences: Array<{
       subjectId: string;
       studyTime: number;
       completionRate: number;
     }>;
     recommendations: string[];
   }
   
   export async function analyzeLearningPattern(
     studentId: string,
     dateRange: { start: Date; end: Date }
   ): Promise<ServiceResult<LearningPatternAnalysis>> {
     // 학습 세션 데이터 분석
     // 시간대별, 과목별 패턴 추출
     // AI 기반 추천 생성
   }
   ```

2. **성적 추이 분석**
   ```typescript
   export interface ScoreTrendAnalysis {
     studentId: string;
     trends: Array<{
       subjectId: string;
       scores: Array<{
         date: Date;
         score: number;
         type: "internal" | "mock";
       }>;
       trend: "improving" | "stable" | "declining";
       predictedScore?: number;
     }>;
   }
   
   export async function analyzeScoreTrends(
     studentId: string
   ): Promise<ServiceResult<ScoreTrendAnalysis>> {
     // 시계열 데이터 분석
     // 머신러닝 기반 예측
   }
   ```

3. **커스텀 리포트 생성**
   ```typescript
   export interface ReportTemplate {
     id: string;
     name: string;
     sections: ReportSection[];
   }
   
   export interface ReportSection {
     type: "statistics" | "chart" | "table" | "text";
     config: Record<string, unknown>;
   }
   
   export async function generateCustomReport(
     templateId: string,
     params: ReportParams
   ): Promise<ServiceResult<Report>> {
     // 템플릿 기반 리포트 생성
     // PDF/Excel 내보내기
   }
   ```

#### 확장 영역 2: 자동화 및 워크플로우

**제안 기능**:

1. **자동 알림 규칙**
   ```typescript
   // lib/domains/admin-automation/services/notificationRuleService.ts
   
   export interface NotificationRule {
     id: string;
     name: string;
     trigger: {
       type: "risk_score" | "low_activity" | "score_drop" | "custom";
       condition: Record<string, unknown>;
     };
     actions: Array<{
       type: "sms" | "email" | "in_app";
       template: string;
       recipients: string[];
     }>;
     enabled: boolean;
   }
   
   export async function createNotificationRule(
     rule: Omit<NotificationRule, "id">
   ): Promise<ServiceResult<NotificationRule>> {
     // 알림 규칙 생성
   }
   
   export async function evaluateNotificationRules(
     studentId: string
   ): Promise<ServiceResult<void>> {
     // 규칙 평가 및 알림 발송
   }
   ```

2. **자동 플랜 조정**
   ```typescript
   export interface AutoAdjustmentRule {
     id: string;
     name: string;
     condition: {
       metric: "completion_rate" | "study_time" | "score";
       threshold: number;
       operator: "lt" | "gt" | "eq";
     };
     action: {
       type: "reduce_volume" | "increase_volume" | "change_subject";
       params: Record<string, unknown>;
     };
   }
   
   export async function applyAutoAdjustments(
     studentId: string
   ): Promise<ServiceResult<AdjustmentResult[]>> {
     // 자동 조정 규칙 적용
   }
   ```

3. **배치 작업 스케줄러**
   ```typescript
   export interface BatchJob {
     id: string;
     type: "plan_generation" | "report_generation" | "data_export";
     schedule: string; // Cron expression
     params: Record<string, unknown>;
     status: "pending" | "running" | "completed" | "failed";
   }
   
   export async function scheduleBatchJob(
     job: Omit<BatchJob, "id" | "status">
   ): Promise<ServiceResult<BatchJob>> {
     // 배치 작업 스케줄링
   }
   ```

#### 확장 영역 3: 협업 및 커뮤니케이션

**제안 기능**:

1. **팀 협업 기능**
   ```typescript
   export interface TeamMember {
     id: string;
     role: "admin" | "consultant" | "teacher";
     assignedStudents: string[];
     permissions: string[];
   }
   
   export interface CollaborationNote {
     id: string;
     studentId: string;
     authorId: string;
     content: string;
     tags: string[];
     mentions: string[]; // 멘션된 사용자 ID
     createdAt: Date;
   }
   
   export async function createCollaborationNote(
     note: Omit<CollaborationNote, "id" | "createdAt">
   ): Promise<ServiceResult<CollaborationNote>> {
     // 협업 노트 생성
     // 멘션된 사용자에게 알림 발송
   }
   ```

2. **학부모 커뮤니케이션**
   ```typescript
   export interface ParentCommunication {
     id: string;
     studentId: string;
     parentId: string;
     type: "report" | "alert" | "message";
     content: string;
     attachments?: string[];
     sentAt: Date;
   }
   
   export async function sendParentReport(
     studentId: string,
     reportType: "weekly" | "monthly"
   ): Promise<ServiceResult<ParentCommunication>> {
     // 주간/월간 리포트 자동 생성 및 발송
   }
   ```

#### 확장 영역 4: 데이터 내보내기 및 통합

**제안 기능**:

1. **다양한 형식 내보내기**
   ```typescript
   export interface ExportOptions {
     format: "excel" | "csv" | "pdf" | "json";
     dataType: "students" | "plans" | "scores" | "reports";
     filters?: Record<string, unknown>;
     columns?: string[];
   }
   
   export async function exportData(
     options: ExportOptions
   ): Promise<ServiceResult<{ downloadUrl: string }>> {
     // 데이터 내보내기
     // S3/Storage에 업로드 후 URL 반환
   }
   ```

2. **외부 시스템 연동**
   ```typescript
   export interface ExternalIntegration {
     id: string;
     type: "lms" | "sis" | "analytics";
     config: Record<string, unknown>;
     syncSchedule?: string;
   }
   
   export async function syncWithExternalSystem(
     integrationId: string
   ): Promise<ServiceResult<SyncResult>> {
     // 외부 시스템과 데이터 동기화
   }
   ```

### 3.3 기능 확장 우선순위

#### 🔥 High Priority (즉시 구현 권장)

1. **고급 분석 대시보드**
   - 학습 패턴 분석
   - 성적 추이 차트
   - 예측 분석

2. **자동 알림 시스템**
   - 위험 학생 자동 알림
   - 학습 활동 저조 알림
   - 성적 하락 알림

3. **데이터 내보내기**
   - Excel/CSV 내보내기
   - 리포트 PDF 생성

#### 🟡 Medium Priority (단기 구현)

1. **자동 플랜 조정**
   - 완료율 기반 자동 조정
   - 학습 시간 기반 조정

2. **협업 기능**
   - 팀 멤버 간 노트 공유
   - 멘션 시스템

3. **배치 작업**
   - 일괄 플랜 생성 스케줄링
   - 리포트 자동 생성

#### 🟢 Low Priority (장기 계획)

1. **외부 시스템 연동**
   - LMS 연동
   - SIS 연동

2. **AI 기반 추천**
   - 학습 콘텐츠 추천
   - 학습 방법 추천

---

## 4. 최적화 분석

### 4.1 성능 병목 지점

#### 병목 1: 대시보드 데이터 페칭

**현재 문제** (`app/(admin)/admin/dashboard/page.tsx`):

```typescript
// ❌ 문제: 위험 학생 조회 시 모든 학생에 대해 순차 처리
async function getAtRiskStudents(supabase: SupabaseServerClient) {
  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .eq("is_active", true);

  // 각 학생의 위험 점수를 순차적으로 계산
  const riskResults = await Promise.all(
    studentRows.map(async (student) => {
      const risk = await getStudentRiskScore(supabase, student.id);
      // ...
    })
  );
}
```

**문제점**:
- 학생 수가 많을 경우 매우 느림 (N번의 쿼리)
- `getStudentRiskScore` 내부에서도 여러 쿼리 실행 가능
- 병렬 처리하더라도 DB 부하 증가

**최적화 방안**:

```typescript
// ✅ 개선: 배치 처리 및 쿼리 최적화
async function getAtRiskStudentsOptimized(
  supabase: SupabaseServerClient,
  limit: number = 5
) {
  // 1. 위험 점수 계산을 DB 뷰 또는 함수로 이동
  const { data: riskScores } = await supabase
    .rpc('calculate_student_risk_scores', {
      limit_count: limit
    });

  // 2. 또는 배치로 필요한 데이터만 조회
  const studentIds = riskScores?.map(r => r.student_id) ?? [];
  
  if (studentIds.length === 0) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id,name")
    .in("id", studentIds);

  // 3. 메모리에서 조인
  return riskScores.map(risk => ({
    studentId: risk.student_id,
    name: students?.find(s => s.id === risk.student_id)?.name ?? "이름 없음",
    riskScore: risk.score,
    level: risk.level,
    reasons: risk.reasons,
  }));
}
```

**DB 함수 생성** (Supabase):

```sql
-- supabase/migrations/XXXXXX_create_risk_score_function.sql

CREATE OR REPLACE FUNCTION calculate_student_risk_scores(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  student_id UUID,
  score INTEGER,
  level TEXT,
  reasons TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH risk_calculations AS (
    SELECT 
      s.id AS student_id,
      -- 위험 점수 계산 로직
      CASE 
        WHEN last_activity_days > 7 THEN 30
        WHEN completion_rate < 0.5 THEN 20
        ELSE 0
      END AS risk_score,
      -- ...
    FROM students s
    WHERE s.is_active = true
  )
  SELECT 
    rc.student_id,
    rc.risk_score::INTEGER,
    CASE 
      WHEN rc.risk_score >= 50 THEN 'high'
      WHEN rc.risk_score >= 20 THEN 'medium'
      ELSE 'low'
    END AS level,
    ARRAY[]::TEXT[] AS reasons -- 실제 구현 필요
  FROM risk_calculations rc
  ORDER BY rc.risk_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

#### 병목 2: 통계 쿼리 최적화

**현재 문제**:

```typescript
// ❌ 문제: 여러 개의 개별 쿼리 실행
async function getStudentStatistics(...) {
  // 쿼리 1: 전체 학생 수
  const { count: totalCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true });

  // 쿼리 2: 이번주 학습한 학생
  const { data: activeStudents } = await supabase
    .from("student_study_sessions")
    .select("student_id")
    .gte("started_at", weekStartStr)
    .lte("started_at", weekEndStr);

  // 쿼리 3: 성적 입력 학생 (2개 테이블)
  const [schoolScores, mockScores] = await Promise.all([...]);

  // 쿼리 4: 플랜이 있는 학생
  const { data: plansData } = await supabase
    .from("student_plan")
    .select("student_id")
    .gte("plan_date", weekStartStr)
    .lte("plan_date", weekEndStr);
}
```

**최적화 방안**:

```typescript
// ✅ 개선: 단일 쿼리로 통합 또는 DB 뷰 활용
async function getStudentStatisticsOptimized(
  params: StudentStatisticsParams
): Promise<StudentStatistics> {
  // 옵션 1: DB 뷰 활용
  const { data } = await supabase
    .from("student_statistics_view")
    .select("*")
    .eq("week_start", params.weekStart.toISOString().slice(0, 10))
    .eq("week_end", params.weekEnd.toISOString().slice(0, 10))
    .single();

  // 옵션 2: RPC 함수 활용
  const { data } = await supabase.rpc('get_student_statistics', {
    week_start: params.weekStart.toISOString().slice(0, 10),
    week_end: params.weekEnd.toISOString().slice(0, 10),
    tenant_id: params.tenantId ?? null
  });

  return {
    total: data.total,
    activeThisWeek: data.active_this_week,
    withScores: data.with_scores,
    withPlans: data.with_plans,
  };
}
```

**DB 뷰 생성**:

```sql
-- supabase/migrations/XXXXXX_create_student_statistics_view.sql

CREATE OR REPLACE VIEW student_statistics_view AS
SELECT 
  DATE_TRUNC('week', CURRENT_DATE)::DATE AS week_start,
  (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE AS week_end,
  (SELECT COUNT(*) FROM students WHERE is_active = true) AS total,
  (SELECT COUNT(DISTINCT student_id) 
   FROM student_study_sessions 
   WHERE started_at >= DATE_TRUNC('week', CURRENT_DATE)
     AND started_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
  ) AS active_this_week,
  (SELECT COUNT(DISTINCT student_id)
   FROM (
     SELECT student_id FROM student_internal_scores
     UNION
     SELECT student_id FROM student_mock_scores
   ) AS scores
  ) AS with_scores,
  (SELECT COUNT(DISTINCT student_id)
   FROM student_plan
   WHERE plan_date >= DATE_TRUNC('week', CURRENT_DATE)
     AND plan_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
  ) AS with_plans;
```

#### 병목 3: 캐싱 전략 개선

**현재 상태**:
- `lib/cache/dashboard.ts`에 기본 캐싱 존재
- 재검증 시간이 고정적 (1분, 5분, 10분)
- 태그 기반 무효화 미활용

**개선 방안**:

```typescript
// lib/services/cacheService.ts

export interface SmartCacheOptions {
  key: string;
  tags: string[];
  revalidate: number;
  staleWhileRevalidate?: number; // SWR 시간
}

/**
 * 스마트 캐싱: 태그 기반 무효화 + SWR
 */
export async function smartCache<T>(
  fn: () => Promise<T>,
  options: SmartCacheOptions
): Promise<T> {
  const { key, tags, revalidate, staleWhileRevalidate = 300 } = options;

  return unstable_cache(
    fn,
    [key],
    {
      tags,
      revalidate,
      // Next.js 15+ 지원 시
      // staleWhileRevalidate,
    }
  )();
}

/**
 * 태그 기반 캐시 무효화
 */
export async function invalidateCacheByTags(tags: string[]) {
  // Next.js revalidateTag 사용
  for (const tag of tags) {
    revalidateTag(tag);
  }
}
```

**사용 예시**:

```typescript
// 학생 정보 업데이트 시 관련 캐시 무효화
export async function updateStudentInfo(studentId: string, data: StudentUpdateData) {
  // 업데이트 로직...
  
  // 관련 캐시 무효화
  await invalidateCacheByTags([
    CACHE_TAGS.STUDENTS.DETAIL,
    CACHE_TAGS.DASHBOARD.STATS,
    CACHE_TAGS.DASHBOARD.TOP_STUDENTS,
  ]);
}
```

### 4.2 쿼리 최적화

#### 최적화 1: 인덱스 확인 및 추가

**필요한 인덱스**:

```sql
-- 학생 조회 최적화
CREATE INDEX IF NOT EXISTS idx_students_active 
ON students(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_students_tenant 
ON students(tenant_id) WHERE tenant_id IS NOT NULL;

-- 학습 세션 조회 최적화
CREATE INDEX IF NOT EXISTS idx_study_sessions_student_date 
ON student_study_sessions(student_id, started_at);

CREATE INDEX IF NOT EXISTS idx_study_sessions_date_range 
ON student_study_sessions(started_at) 
WHERE started_at >= CURRENT_DATE - INTERVAL '30 days';

-- 플랜 조회 최적화
CREATE INDEX IF NOT EXISTS idx_student_plan_student_date 
ON student_plan(student_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_student_plan_date_range 
ON student_plan(plan_date) 
WHERE plan_date >= CURRENT_DATE - INTERVAL '30 days';

-- 성적 조회 최적화
CREATE INDEX IF NOT EXISTS idx_internal_scores_student 
ON student_internal_scores(student_id);

CREATE INDEX IF NOT EXISTS idx_mock_scores_student 
ON student_mock_scores(student_id);
```

#### 최적화 2: 쿼리 배치 처리

**현재 문제**: N+1 쿼리 패턴

**개선 방안**:

```typescript
// ❌ 나쁜 예: N+1 쿼리
async function getStudentsWithPlans(studentIds: string[]) {
  const students = [];
  for (const id of studentIds) {
    const { data: plans } = await supabase
      .from("student_plan")
      .select("*")
      .eq("student_id", id);
    students.push({ id, plans });
  }
}

// ✅ 좋은 예: 배치 쿼리
async function getStudentsWithPlansOptimized(studentIds: string[]) {
  // 한 번의 쿼리로 모든 플랜 조회
  const { data: allPlans } = await supabase
    .from("student_plan")
    .select("*")
    .in("student_id", studentIds);

  // 메모리에서 그룹화
  const plansByStudent = new Map<string, Plan[]>();
  (allPlans ?? []).forEach(plan => {
    const existing = plansByStudent.get(plan.student_id) ?? [];
    existing.push(plan);
    plansByStudent.set(plan.student_id, existing);
  });

  return studentIds.map(id => ({
    id,
    plans: plansByStudent.get(id) ?? [],
  }));
}
```

### 4.3 렌더링 최적화

#### 최적화 1: Suspense 경계 활용

**현재 문제**: 모든 데이터를 기다린 후 렌더링

**개선 방안**:

```typescript
// app/(admin)/admin/dashboard/page.tsx

import { Suspense } from "react";
import { DashboardStatsSkeleton } from "./_components/DashboardStatsSkeleton";
import { TopStudentsSkeleton } from "./_components/TopStudentsSkeleton";

export default async function AdminDashboardPage() {
  return (
    <div className="p-6 md:p-8 lg:p-10">
      <PageHeader title="관리자 대시보드" />
      
      {/* 즉시 렌더링 가능한 부분 */}
      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Suspense fallback={<TopStudentsSkeleton />}>
          <TopStudyTimeStudents />
        </Suspense>
        
        <Suspense fallback={<TopStudentsSkeleton />}>
          <TopPlanCompletionStudents />
        </Suspense>
      </div>

      {/* 느린 부분은 별도 Suspense */}
      <Suspense fallback={<AtRiskStudentsSkeleton />}>
        <AtRiskStudents />
      </Suspense>
    </div>
  );
}

// 컴포넌트 분리
async function DashboardStats() {
  const stats = await getDashboardStatisticsAction();
  return <StatCards stats={stats} />;
}

async function TopStudyTimeStudents() {
  const students = await getTopStudyTimeStudentsAction();
  return <TopStudentsList students={students} />;
}
```

#### 최적화 2: 부분 렌더링 (Streaming)

**Next.js 15 Streaming 활용**:

```typescript
// app/(admin)/admin/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4.4 최적화 효과 예상

#### 성능 개선 목표

| 항목 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| 대시보드 초기 로딩 | ~3-5초 | ~1-2초 | 60-70% |
| 위험 학생 조회 | ~2-3초 | ~0.5초 | 75-83% |
| 통계 조회 | ~1-2초 | ~0.3초 | 70-85% |
| Top 학생 조회 | ~1초 | ~0.2초 | 80% |

---

## 5. 개선 로드맵

### 5.1 Phase 1: 서비스 레이어 구축 (2-3주)

#### Week 1: 기본 구조 설정

- [ ] 서비스 레이어 표준 패턴 정의
- [ ] `lib/domains/admin-dashboard/services/` 생성
- [ ] 통계 서비스 함수 구현
- [ ] Top 학생 서비스 함수 구현

#### Week 2: 기존 코드 리팩토링

- [ ] 대시보드 페이지 리팩토링
- [ ] Server Actions로 서비스 함수 래핑
- [ ] 타입 정의 및 검증

#### Week 3: 테스트 및 문서화

- [ ] 서비스 함수 단위 테스트 작성
- [ ] API 문서 작성
- [ ] 마이그레이션 가이드 작성

### 5.2 Phase 2: 최적화 (2주)

#### Week 1: 쿼리 최적화

- [ ] DB 인덱스 추가
- [ ] DB 뷰/함수 생성
- [ ] N+1 쿼리 제거

#### Week 2: 캐싱 개선

- [ ] 스마트 캐싱 구현
- [ ] 태그 기반 무효화 적용
- [ ] 캐시 전략 문서화

### 5.3 Phase 3: 기능 확장 (4-6주)

#### Week 1-2: 고급 분석

- [ ] 학습 패턴 분석 서비스
- [ ] 성적 추이 분석 서비스
- [ ] 대시보드 UI 개선

#### Week 3-4: 자동화

- [ ] 알림 규칙 시스템
- [ ] 자동 플랜 조정
- [ ] 배치 작업 스케줄러

#### Week 5-6: 데이터 내보내기

- [ ] Excel/CSV 내보내기
- [ ] PDF 리포트 생성
- [ ] API 엔드포인트 추가

### 5.4 우선순위 매트릭스

| 항목 | 중요도 | 긴급도 | 우선순위 |
|------|--------|--------|----------|
| 서비스 레이어 구축 | High | High | 🔥 P0 |
| 쿼리 최적화 | High | High | 🔥 P0 |
| 캐싱 개선 | High | Medium | 🟡 P1 |
| 고급 분석 | Medium | Medium | 🟡 P1 |
| 자동화 | Medium | Low | 🟢 P2 |
| 데이터 내보내기 | Low | Medium | 🟢 P2 |

---

## 6. 결론 및 권장사항

### 6.1 핵심 개선 사항

1. **서비스 레이어 구축**
   - 도메인별 서비스 레이어 분리
   - 표준 패턴 및 인터페이스 정의
   - 재사용 가능한 서비스 함수 구현

2. **성능 최적화**
   - DB 쿼리 최적화 (인덱스, 뷰, 함수)
   - N+1 쿼리 제거
   - 스마트 캐싱 전략 적용

3. **기능 확장**
   - 고급 분석 기능 추가
   - 자동화 시스템 구축
   - 데이터 내보내기 기능

### 6.2 즉시 시작 가능한 작업

1. **서비스 레이어 기본 구조 생성**
   ```bash
   mkdir -p lib/domains/admin-dashboard/services
   touch lib/domains/admin-dashboard/services/dashboardStatisticsService.ts
   ```

2. **DB 인덱스 추가**
   - 위에 제시한 인덱스 생성 마이그레이션 작성

3. **대시보드 페이지 리팩토링**
   - 통계 조회 로직을 서비스 함수로 이동

### 6.3 장기 비전

- **마이크로서비스 아키텍처로의 전환 가능성**
  - 서비스 레이어가 잘 구축되면 API 서버로 분리 가능
  - GraphQL 또는 tRPC 도입 검토

- **실시간 모니터링**
  - WebSocket 기반 실시간 대시보드
  - 실시간 알림 시스템

- **AI/ML 통합**
  - 예측 분석 강화
  - 개인화 추천 시스템

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰 및 우선순위 조정  
**다음 단계**: Phase 1 Week 1 작업 시작

