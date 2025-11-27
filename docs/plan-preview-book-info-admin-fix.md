# 플랜 미리보기 교재 정보 누락 문제 수정

## 문제 분석

### 증상
관리자가 캠프 템플릿 참여자의 플랜 미리보기를 실행할 때 교재 정보(제목, 과목 등)가 누락되는 문제가 발생했습니다.

### 근본 원인
`_previewPlansFromGroup` 함수에서 교재 메타데이터를 조회할 때 마스터 콘텐츠(`master_books`, `master_lectures`)를 조회하는 부분에서 관리자 권한 우회가 누락되어 있었습니다.

- 학생 교재 조회: `queryClient` 사용 (관리자 권한 우회 적용됨)
- 마스터 교재 조회: `queryClient` 사용 (관리자 권한 우회 누락)
- 마스터 강의 조회: `queryClient` 사용 (관리자 권한 우회 누락)

관리자가 다른 학생의 플랜을 미리볼 때 RLS(Row Level Security) 정책 때문에 마스터 콘텐츠 조회가 실패하여 교재 정보가 누락되었습니다.

## 해결 방법

### 1. 마스터 콘텐츠 조회용 클라이언트 추가

관리자/컨설턴트가 조회할 때는 마스터 콘텐츠 조회에도 Admin 클라이언트를 사용하도록 수정했습니다.

```typescript
// 마스터 콘텐츠 조회용 클라이언트 (관리자가 조회할 때도 Admin 클라이언트 사용)
const masterQueryClientRaw = isAdminOrConsultant ? createSupabaseAdminClient() : supabase;

if (isAdminOrConsultant && !masterQueryClientRaw) {
  throw new AppError(
    "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}

const masterQueryClient = masterQueryClientRaw!;
```

### 2. 마스터 콘텐츠 조회 부분 수정

다음 부분들을 `masterQueryClient`를 사용하도록 수정했습니다:

1. **마스터 콘텐츠 매핑 확인** (2324번째 줄)
   - 마스터 교재/강의인지 확인하는 부분

2. **콘텐츠 소요시간 조회** (2434, 2465번째 줄)
   - 마스터 교재의 `total_pages` 조회
   - 마스터 강의의 `total_duration` 조회

3. **교재 메타데이터 조회** (2615, 2670번째 줄)
   - 마스터 교재의 `title`, `subject`, `subject_category`, `content_category` 조회
   - 마스터 강의의 `title`, `subject`, `subject_category`, `content_category` 조회

## 수정된 파일

- `app/(student)/actions/plan-groups/plans.ts`
  - `_previewPlansFromGroup` 함수 수정

## 테스트 시나리오

1. ✅ 관리자가 캠프 템플릿 참여자의 플랜 미리보기 실행
2. ✅ 교재 정보(제목, 과목 등)가 정상적으로 표시되는지 확인
3. ✅ 학생이 자신의 플랜 미리보기 실행 시 정상 작동 확인

## 보안 고려사항

- 마스터 콘텐츠 조회 시에도 Admin 클라이언트를 사용하지만, 이는 관리자/컨설턴트 권한이 있을 때만 사용됩니다.
- 학생이 자신의 플랜을 미리볼 때는 일반 서버 클라이언트를 사용하여 정상적인 RLS 정책이 적용됩니다.
- 환경 변수 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 합니다.

## 관련 문서

- `docs/plan-preview-admin-support.md` - 플랜 미리보기 Admin 지원 추가 문서

## 변경 이력

- 2025-01-XX: 플랜 미리보기에서 교재 정보 조회 시 관리자 권한 우회 로직 추가

