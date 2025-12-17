# 약관 관리 기능 에러 수정 및 최적화 문서

## 수정 일자

2025년 12월 14일

## 문제 상황

### 발생한 에러

```
Error [AppError]: Could not find the table 'public.terms_contents' in the schema cache
code: 'PGRST205'
```

### 원인 분석

1. 마이그레이션 파일은 생성되었으나 데이터베이스에 적용되지 않음
2. Supabase 스키마 캐시가 업데이트되지 않음
3. PGRST205 에러에 대한 특별 처리가 없어 사용자에게 불명확한 에러 메시지 제공

## 수정 내용

### 1. 마이그레이션 적용

- `supabase/migrations/20251214133504_create_terms_contents.sql`: 테이블 생성 마이그레이션 적용
- `supabase/migrations/20251214133942_seed_terms_contents.sql`: 초기 데이터 삽입 마이그레이션 적용
- 트리거 함수 보안 개선: `SECURITY DEFINER` 및 `SET search_path` 추가

### 2. 코드 최적화

#### 2.1 함수 네이밍 및 주석 개선

**파일**: `lib/data/termsContents.ts`
- 공개 조회용 함수임을 명시하는 주석 추가
- RLS 정책에 따라 활성 버전만 조회 가능함을 문서화

**파일**: `app/(superadmin)/actions/termsContents.ts`
- Super Admin 전용 함수임을 명시하는 주석 추가
- 모든 버전 조회 가능함을 문서화

#### 2.2 에러 처리 개선

**PGRST205 에러 처리 추가**
- 모든 Server Actions에 PGRST205 에러 처리 추가
- 명확한 에러 메시지: "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요."
- `lib/data/termsContents.ts`의 모든 함수에도 PGRST205 에러 처리 추가

**수정된 함수들**:
- `createTermsContent()`
- `updateTermsContent()`
- `activateTermsContent()`
- `getTermsContents()`
- `getActiveTermsContent()`
- `getTermsContentById()`
- `lib/data/termsContents.ts`의 모든 함수

#### 2.3 타입 안전성 개선

**파일**: `lib/types/terms.ts`
- `TermsContentRow` 타입에 주석 추가
- 각 타입의 용도 명시

### 3. 데이터베이스 검증

- 테이블 생성 확인: ✅
- 초기 데이터 삽입 확인: ✅ (3개 약관 모두 삽입됨)
- RLS 정책 확인: ✅ (2개 정책 모두 적용됨)
- 인덱스 확인: ✅ (5개 인덱스 모두 생성됨)
- 트리거 함수 확인: ✅

## 검증 결과

### 데이터베이스 상태

```sql
-- 약관 데이터 확인
SELECT content_type, version, title, is_active 
FROM terms_contents 
ORDER BY content_type, version;

-- 결과:
-- terms, 1, TimeLevelUp 서비스 이용약관, true
-- privacy, 1, TimeLevelUp 개인정보취급방침, true
-- marketing, 1, [선택] 마케팅 및 광고 활용 동의, true
```

### RLS 정책

1. **Super Admin can manage terms contents**
   - Super Admin의 모든 작업 (SELECT, INSERT, UPDATE, DELETE) 허용
   - `admin_users.role = 'superadmin'` 조건 확인

2. **Users can view active terms contents**
   - 모든 사용자의 활성 버전 조회 (SELECT) 허용
   - `is_active = true` 조건 확인

### 인덱스

1. `terms_contents_pkey`: Primary Key
2. `terms_contents_content_type_version_key`: Unique Constraint
3. `idx_terms_contents_content_type`: content_type 조회 최적화
4. `idx_terms_contents_is_active`: is_active 조회 최적화
5. `idx_terms_contents_content_type_is_active`: 활성 버전 조회 복합 인덱스

## 코드 중복 분석 결과

### 중복이 아닌 경우

- `lib/data/termsContents.ts`와 `app/(superadmin)/actions/termsContents.ts`의 함수 이름이 동일하지만:
  - **용도가 다름**: 공개 조회용 vs Super Admin 전용
  - **RLS 정책 적용**: 공개 조회용은 RLS 정책에 따라 활성 버전만 조회, Super Admin 전용은 모든 버전 조회 가능
  - **네이밍 유지**: 각각의 용도가 명확하므로 유지하는 것이 적절

### 개선 사항

- 주석을 통해 각 함수의 용도를 명확히 구분
- 에러 처리 일관성 개선

## 테스트 체크리스트

- [x] 마이그레이션 적용 확인
- [x] 초기 데이터 삽입 확인
- [x] RLS 정책 확인
- [x] 인덱스 확인
- [x] PGRST205 에러 처리 확인
- [ ] Super Admin에서 약관 목록 조회 테스트 (수동 테스트 필요)
- [ ] 공개 API에서 약관 조회 테스트 (수동 테스트 필요)
- [ ] 회원가입 페이지에서 약관 모달 표시 테스트 (수동 테스트 필요)

## 다음 단계

1. **애플리케이션 재시작**
   - 개발 서버를 재시작하여 스키마 캐시가 업데이트되도록 함

2. **수동 테스트**
   - Super Admin 로그인 후 `/superadmin/terms-management` 접근
   - 약관 목록이 정상적으로 표시되는지 확인
   - 회원가입 페이지에서 약관 링크 클릭 시 모달이 정상적으로 표시되는지 확인

3. **스키마 캐시 새로고침**
   - Supabase Dashboard에서 스키마 캐시가 자동으로 새로고침될 때까지 대기 (보통 몇 분 소요)
   - 또는 Supabase API를 통해 수동으로 새로고침 가능

## 참고 사항

### Supabase 스키마 캐시

- Supabase는 성능 최적화를 위해 스키마 정보를 캐시합니다
- 마이그레이션 적용 후 스키마 캐시가 자동으로 업데이트되지만, 즉시 반영되지 않을 수 있습니다
- PGRST205 에러가 발생하면 마이그레이션이 적용되었는지 확인하고, 몇 분 후 다시 시도하세요

### 트리거 함수 보안

- `update_terms_contents_updated_at()` 함수에 `SECURITY DEFINER` 및 `SET search_path` 추가
- Supabase 보안 권고사항 준수



