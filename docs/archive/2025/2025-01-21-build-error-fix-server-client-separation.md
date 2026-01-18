# 빌드 에러 수정: 서버/클라이언트 분리

## 작업 일시
2025-01-21

## 문제점

Next.js 16 빌드 시 다음과 같은 에러가 발생했습니다:

```
Error: You're importing a component that needs "next/headers". 
That only works in a Server Component which is not supported in the pages/ directory.
```

**원인**: 클라이언트 컴포넌트에서 서버 전용 함수(`createSupabaseServerClient`를 사용하는 함수)를 직접 호출하고 있었습니다.

## 수정 내용

### 1. 블록 세트 조회 API Route 생성

**파일**: `app/api/block-sets/route.ts`
- `GET /api/block-sets` 엔드포인트 생성
- `fetchBlockSetsWithBlocks` 함수를 서버에서 호출

**수정 파일**: `lib/hooks/useBlockSets.ts`
- `fetchBlockSetsWithBlocks` 직접 호출 제거
- API Route 호출로 변경

### 2. 캠프 템플릿 조회 API Route 생성

**파일**: `app/api/camp-templates/route.ts`
- `GET /api/camp-templates` 엔드포인트 생성
- 페이지네이션 및 필터링 지원
- `getCampTemplatesForTenantWithPagination` 함수를 서버에서 호출

**수정 파일**: `lib/hooks/useCampTemplates.ts`
- `getCampTemplatesForTenantWithPagination` 직접 호출 제거
- API Route 호출로 변경

### 3. 학생 콘텐츠 조회 API Route 생성

**파일**: `app/api/student-contents/route.ts`
- `GET /api/student-contents` 엔드포인트 생성
- `fetchAllStudentContents` 함수를 서버에서 호출

**수정 파일**: `lib/hooks/useStudentContents.ts`
- `fetchAllStudentContents` 직접 호출 제거
- API Route 호출로 변경

### 4. 캠프 통계 조회 API Route 생성

**파일**: `app/api/camp-stats/route.ts`
- `GET /api/camp-stats?templateId=xxx` 엔드포인트 생성
- 출석 통계와 학습 통계를 함께 반환
- `calculateCampAttendanceStats`와 `calculateCampLearningStats` 함수를 서버에서 호출

**수정 파일**: `lib/hooks/useCampStats.ts`
- `calculateCampAttendanceStats`와 `calculateCampLearningStats` 직접 호출 제거
- 통합 API Route 호출로 변경
- 레거시 호환성을 위한 별도 쿼리 옵션 함수도 API Route 호출로 수정

**수정 파일**: `app/(admin)/admin/camp-templates/[id]/reports/_components/CampReportDashboard.tsx`
- `useCampStats` 훅의 반환 타입 변경에 맞춰 수정
- `attendance.data` → `attendance`로 변경

### 5. 플랜 그룹 조회 API Route 생성

**파일**: `app/api/plan-groups/route.ts`
- `GET /api/plan-groups` 엔드포인트 생성
- 필터링 파라미터 지원 (status, planPurpose, dateRange, includeDeleted)
- `getPlanGroupsWithStats` 함수를 서버에서 호출

**수정 파일**: `lib/hooks/usePlanGroups.ts`
- `getPlanGroupsWithStats` 직접 호출 제거
- API Route 호출로 변경
- 배열 타입 필터 파라미터 처리 추가

## 패턴

모든 수정은 다음 패턴을 따릅니다:

1. **서버 전용 함수를 API Route로 래핑**
   - 서버에서만 실행 가능한 함수를 API Route로 노출
   - 인증 및 권한 검증 포함

2. **클라이언트 훅에서 API Route 호출**
   - `fetch`를 사용하여 API Route 호출
   - 에러 처리 및 응답 파싱

3. **타입 안전성 유지**
   - API 응답 타입 정의
   - `apiSuccess` 헬퍼 함수 사용

## 생성된 API Routes

1. `/api/block-sets` - 블록 세트 조회
2. `/api/camp-templates` - 캠프 템플릿 목록 조회 (페이지네이션)
3. `/api/student-contents` - 학생 콘텐츠 목록 조회
4. `/api/camp-stats` - 캠프 통계 조회 (출석 + 학습)
5. `/api/plan-groups` - 플랜 그룹 목록 조회 (필터링)

## 결과

✅ 빌드 에러 해결
✅ 서버/클라이언트 분리 명확화
✅ 타입 안전성 유지
✅ 기존 기능 유지

## 참고

- Next.js 16에서는 `next/headers`를 사용하는 모듈은 서버 컴포넌트나 API Route에서만 사용 가능
- 클라이언트 컴포넌트에서 서버 전용 함수를 호출하려면 API Route를 통해야 함
- React Query의 `queryFn`에서도 동일한 제약이 적용됨

