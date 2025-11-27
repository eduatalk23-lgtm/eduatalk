# 플랜 미리보기 마스터 콘텐츠 조회 RLS 정책 위반 문제 해결

## 작업 일시
2025년 1월

## 문제 분석

### 근본 원인
- `_previewPlansFromGroup` 함수에서 마스터 콘텐츠(교재/강의) 조회 시 일반 서버 클라이언트(`supabase`) 사용
- 관리자/컨설턴트가 다른 학생의 플랜을 미리볼 때 마스터 콘텐츠 조회에서 RLS 정책에 막힘
- 특히 테넌트별 마스터 콘텐츠가 있는 경우, 다른 테넌트의 마스터 콘텐츠를 조회할 수 없음

### 문제 흐름
1. 관리자 페이지에서 캠프 모드 Step 7 플랜 미리보기 진행
2. `_previewPlansFromGroup` 함수에서 교재 정보 조회 시도
3. 마스터 교재 조회 시 `supabase` 사용 → RLS 정책 때문에 실패
4. 교재 정보(제목, 과목 등)가 제대로 조회되지 않음

### 영향받는 부분
- 마스터 콘텐츠 확인 (ID만 조회)
- 마스터 콘텐츠 duration 조회 (total_pages, total_duration)
- 마스터 콘텐츠 메타데이터 조회 (title, subject, subject_category, content_category)

## 해결 방법

### 근본적인 해결 (구현 완료)

`_previewPlansFromGroup` 함수에서 마스터 콘텐츠 조회 시 `queryClient`를 사용하도록 수정했습니다. `queryClient`는 관리자/컨설턴트가 다른 학생의 콘텐츠를 조회할 때 Admin 클라이언트를 사용하도록 이미 설정되어 있습니다.

## 구현 내용

### 1. 마스터 콘텐츠 확인 부분 수정

**변경 사항:**
- 마스터 교재/강의 확인 시 `supabase` → `queryClient` 변경

**수정된 위치:**
- 2312-2316 라인: 마스터 교재 확인
- 2336-2340 라인: 마스터 강의 확인

```typescript
// ❌ 수정 전
const { data: masterBook } = await supabase
  .from("master_books")
  .select("id")
  .eq("id", content.content_id)
  .maybeSingle();

// ✅ 수정 후
const { data: masterBook } = await queryClient
  .from("master_books")
  .select("id")
  .eq("id", content.content_id)
  .maybeSingle();
```

### 2. 마스터 콘텐츠 duration 조회 부분 수정

**변경 사항:**
- 마스터 교재/강의의 total_pages, total_duration 조회 시 `supabase` → `queryClient` 변경

**수정된 위치:**
- 2422-2426 라인: 마스터 교재 total_pages 조회
- 2453-2457 라인: 마스터 강의 total_duration 조회

```typescript
// ❌ 수정 전
const { data: masterBook } = await supabase
  .from("master_books")
  .select("id, total_pages")
  .eq("id", studentBook.master_content_id)
  .maybeSingle();

// ✅ 수정 후
const { data: masterBook } = await queryClient
  .from("master_books")
  .select("id, total_pages")
  .eq("id", studentBook.master_content_id)
  .maybeSingle();
```

### 3. 마스터 콘텐츠 메타데이터 조회 부분 수정

**변경 사항:**
- 마스터 교재/강의의 메타데이터(title, subject 등) 조회 시 `supabase` → `queryClient` 변경

**수정된 위치:**
- 2603-2607 라인: 마스터 교재 메타데이터 조회
- 2658-2662 라인: 마스터 강의 메타데이터 조회

```typescript
// ❌ 수정 전
const { data: masterBook } = await supabase
  .from("master_books")
  .select("title, subject, subject_category, content_category")
  .eq("id", masterContentId)
  .maybeSingle();

// ✅ 수정 후
const { data: masterBook } = await queryClient
  .from("master_books")
  .select("title, subject, subject_category, content_category")
  .eq("id", masterContentId)
  .maybeSingle();
```

## 동작 방식

### queryClient 설정

`_previewPlansFromGroup` 함수에서 이미 `queryClient`가 설정되어 있습니다:

```typescript
// Admin/Consultant가 다른 학생의 콘텐츠를 조회할 때는 Admin 클라이언트 사용
const isAdminOrConsultant = role === "admin" || role === "consultant";
const isOtherStudent = isAdminOrConsultant && studentId !== user.userId;
const queryClient = isOtherStudent ? createSupabaseAdminClient() : supabase;
```

### 권한별 동작

1. **학생이 자신의 플랜 미리보기**
   - `queryClient = supabase` (일반 서버 클라이언트)
   - 정상적인 RLS 정책 적용
   - 자신의 콘텐츠만 조회 가능

2. **관리자/컨설턴트가 다른 학생의 플랜 미리보기**
   - `queryClient = createSupabaseAdminClient()` (Admin 클라이언트)
   - RLS 정책 우회
   - 다른 학생의 콘텐츠 및 마스터 콘텐츠 조회 가능

## 테스트 시나리오

1. ✅ 관리자 페이지에서 캠프 모드 Step 7 플랜 미리보기 시 교재 정보 정상 조회
2. ✅ 학생 페이지에서 자신의 플랜 미리보기 시 교재 정보 정상 조회
3. ✅ 마스터 콘텐츠 메타데이터(제목, 과목 등) 정상 조회
4. ✅ 테넌트별 마스터 콘텐츠도 정상 조회

## 보안 고려사항

- Admin 클라이언트는 RLS를 우회하므로 보안에 주의
- 다른 학생의 콘텐츠를 조회할 때만 Admin 클라이언트 사용
- 학생이 자신의 콘텐츠를 조회할 때는 일반 서버 클라이언트 사용 (정상적인 RLS 적용)
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 함

## 관련 파일

- `app/(student)/actions/plan-groups/plans.ts` - 수정된 함수
- `lib/supabase/admin.ts` - Admin 클라이언트 생성 함수
- `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx` - 호출하는 관리자 페이지

## 변경 이력

- 2025-01-XX: `_previewPlansFromGroup` 함수에서 마스터 콘텐츠 조회 시 `queryClient` 사용하도록 수정

## 참고 문서

- `docs/plan-preview-admin-support.md` - 플랜 미리보기 Admin 지원 추가
- `docs/plan-generation-book-query-rls-fix.md` - 플랜 생성 시 교재 조회 RLS 정책 위반 문제 해결

