# camp_template_block_sets 테이블 RLS 정책 추가

## 문제 상황

관리자 영역에서 템플릿에 블록 세트를 연결하는 작업 중 RLS 정책 위반 에러가 발생했습니다.

```
"new row violates row-level security policy for table \"camp_template_block_sets\""
```

## 원인 분석

`camp_template_block_sets` 테이블이 생성되었지만 RLS 정책이 설정되지 않아 INSERT 작업이 차단되었습니다.

## 해결 방법

`camp_template_block_sets` 테이블에 다음 RLS 정책을 추가했습니다:

1. **SELECT 정책**: 자신의 테넌트에 속한 템플릿의 연결 정보 조회
2. **INSERT 정책**: 자신의 테넌트에 속한 템플릿과 블록 세트 연결 생성
3. **UPDATE 정책**: 자신의 테넌트에 속한 템플릿의 연결 정보 수정
4. **DELETE 정책**: 자신의 테넌트에 속한 템플릿의 연결 정보 삭제

## 마이그레이션 파일

**파일**: `supabase/migrations/20251222034907_add_camp_template_block_sets_rls_policies.sql`

### 주요 내용

#### 1. RLS 활성화
```sql
ALTER TABLE camp_template_block_sets ENABLE ROW LEVEL SECURITY;
```

#### 2. 정책 공통 조건
- 관리자/컨설턴트만 접근 가능
- 일반 관리자/컨설턴트: 자신의 테넌트에 속한 데이터만 접근
- Super Admin: 모든 데이터 접근 가능

#### 3. INSERT 정책 세부 조건
- 템플릿이 자신의 테넌트에 속해야 함
- 블록 세트가 자신의 테넌트에 속해야 함

#### 4. UPDATE 정책 세부 조건
- 기존 연결 정보가 자신의 테넌트에 속해야 함 (USING)
- 수정 후에도 자신의 테넌트에 속한 템플릿과 블록 세트만 연결 가능 (WITH CHECK)

## 관련 파일

- **액션 파일**: `app/(admin)/actions/campTemplateBlockSets.ts`
  - `_linkBlockSetToTemplate`: 템플릿에 블록 세트 연결 (UPSERT)
  - `_unlinkBlockSetFromTemplate`: 템플릿에서 블록 세트 연결 해제
  - `_getTemplateBlockSet`: 템플릿에 연결된 블록 세트 조회
  - `_getBlockSetTemplates`: 블록 세트를 사용하는 템플릿 목록 조회

## 테스트 방법

1. 관리자 계정으로 로그인
2. 캠프 템플릿 편집 페이지에서 블록 세트 연결 시도
3. 연결 성공 확인
4. 연결 해제 시도
5. 연결 해제 성공 확인

## 참고 사항

- RLS 정책은 `camp_invitations` 테이블의 정책 패턴을 참고하여 작성했습니다.
- Super Admin은 모든 테넌트의 데이터에 접근할 수 있습니다.
- 일반 관리자/컨설턴트는 자신의 테넌트에 속한 데이터만 접근할 수 있습니다.

