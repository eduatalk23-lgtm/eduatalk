# 성적 대시보드 인증 문제 해결 및 코드 최적화

## 작업 일시
2025-01-XX

## 문제 분석

### 1. 인증 실패 문제
- 서버 컴포넌트에서 `fetchScoreDashboard` 호출 시 쿠키가 전달되지 않아 인증 실패
- 로그: `currentUserId: undefined`, `currentRole: null`
- 결과: `404 - Student not found` 에러 발생

### 2. RLS 정책 문제
- 인증 정보가 없을 때 Admin Client를 사용하지 않아 학생 조회 실패
- 서버 컴포넌트에서 fetch 호출 시 인증 정보가 전달되지 않는 경우 처리 필요

### 3. 중복 코드 문제
- 여러 파일에서 동일한 로직 반복:
  - tenantId 결정 로직
  - 학생 조회 및 tenantId 검증
  - tenantId 불일치 경고
  - 에러 처리

## 해결 방안

### 1. fetchScoreDashboard 함수 개선
**파일**: `lib/api/scoreDashboard.ts`

- 서버 컴포넌트에서 쿠키를 전달할 수 있도록 옵션 파라미터 추가
- `cookies()` API를 사용하여 쿠키 헤더 자동 전달
- 클라이언트/서버 환경 자동 감지

**변경 사항**:
```typescript
export async function fetchScoreDashboard(
  params: ScoreDashboardParams,
  options?: {
    cookies?: Awaited<ReturnType<typeof cookies>>;
  }
): Promise<ScoreDashboardResponse>
```

### 2. API 라우트 인증 로직 개선
**파일**: `app/api/students/[id]/score-dashboard/route.ts`

- 인증 정보가 없을 때도 Admin Client 사용하도록 수정
- 서버 컴포넌트에서 fetch 호출 시에도 작동하도록 보장

**변경 사항**:
```typescript
const useAdminClient =
  currentRole === "admin" ||
  currentRole === "parent" ||
  process.env.NODE_ENV === "development" ||
  (currentRole === "student" && currentUser?.userId === studentId) ||
  (!currentUser && !currentRole); // 인증 정보가 없을 때도 Admin Client 사용
```

### 3. 공통 유틸리티 함수 생성
**새 파일**: `lib/api/scoreDashboardUtils.ts`

다음 함수들을 생성하여 중복 코드 제거:

- `getStudentWithTenant`: 학생 정보와 tenant_id를 함께 조회
- `getEffectiveTenantId`: tenantId 결정 로직 통합
- `validateTenantIdMismatch`: tenantId 불일치 검증 및 경고
- `handleScoreDashboardError`: 에러 처리 통합
- `hasScoreDashboardData`: 성적 데이터 존재 여부 확인

### 4. 중복 코드 제거
**수정 파일들**:
- `app/(student)/scores/dashboard/unified/page.tsx`
- `app/(parent)/parent/scores/page.tsx`
- `app/(admin)/admin/students/[id]/_components/ScoreTrendSection.tsx`
- `app/(admin)/admin/students/[id]/_components/ScoreSummarySection.tsx`

**변경 사항**:
- 공통 유틸리티 함수 사용
- 동일한 에러 처리 패턴 통합
- tenantId 결정 로직 통합
- 쿠키 전달 추가

## 구현 세부사항

### Phase 1: fetchScoreDashboard 개선 ✅
- `lib/api/scoreDashboard.ts` 수정
  - `cookies` 옵션 파라미터 추가
  - 서버 환경에서 쿠키 자동 전달
  - 클라이언트 환경에서는 기존 동작 유지

### Phase 2: API 라우트 개선 ✅
- `app/api/students/[id]/score-dashboard/route.ts` 수정
  - `useAdminClient` 조건에 인증 정보 없음 케이스 추가
  - 로깅 개선 (디버깅 용이성 향상)

### Phase 3: 공통 유틸리티 생성 ✅
- `lib/api/scoreDashboardUtils.ts` 생성
  - `getStudentWithTenant` 함수
  - `getEffectiveTenantId` 함수
  - `validateTenantIdMismatch` 함수
  - `handleScoreDashboardError` 함수
  - `hasScoreDashboardData` 함수

### Phase 4: 중복 코드 제거 ✅
- 각 페이지/컴포넌트에서 공통 유틸리티 사용
- 동일한 패턴의 코드 제거
- 에러 처리 통합
- 쿠키 전달 추가

## 수정된 파일 목록

1. `lib/api/scoreDashboard.ts` - 쿠키 전달 옵션 추가
2. `app/api/students/[id]/score-dashboard/route.ts` - Admin Client 사용 조건 개선
3. `lib/api/scoreDashboardUtils.ts` - 공통 유틸리티 함수 생성 (신규)
4. `app/(student)/scores/dashboard/unified/page.tsx` - 공통 유틸리티 사용 및 쿠키 전달
5. `app/(parent)/parent/scores/page.tsx` - 공통 유틸리티 사용 및 쿠키 전달
6. `app/(admin)/admin/students/[id]/_components/ScoreTrendSection.tsx` - 공통 유틸리티 사용 및 쿠키 전달
7. `app/(admin)/admin/students/[id]/_components/ScoreSummarySection.tsx` - 공통 유틸리티 사용 및 쿠키 전달

## 예상 효과

1. **인증 문제 해결**: 서버 컴포넌트에서도 정상 작동
2. **코드 중복 제거**: 약 200줄 이상의 중복 코드 제거
3. **유지보수성 향상**: 공통 로직 변경 시 한 곳만 수정
4. **에러 처리 개선**: 일관된 에러 메시지 및 처리

## 테스트 계획

1. 서버 컴포넌트에서 `fetchScoreDashboard` 호출 테스트
2. 인증 정보 없을 때 Admin Client 사용 확인
3. 각 역할별 접근 권한 테스트 (student, parent, admin)
4. 에러 케이스 테스트 (학생 없음, tenantId 없음 등)

## 참고 사항

- Next.js 15의 `cookies()` API 사용
- 서버 컴포넌트에서 fetch 호출 시 쿠키 전달 방법
- Supabase RLS 정책과 Admin Client 사용 전략

