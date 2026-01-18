# 약관 관리 기능 구현 문서

## 개요

회원가입 시 약관 동의 내용을 표시하고, Super Admin에서 약관 내용을 관리할 수 있는 기능을 구현했습니다.

## 구현 일자

2025년 12월 14일

## 수정 이력

### 2025년 12월 14일 (에러 수정 및 최적화)
- 마이그레이션 적용 완료
- PGRST205 에러 처리 추가
- 함수 네이밍 및 주석 개선
- 타입 안전성 개선

## 주요 기능

1. **약관 내용 저장 및 버전 관리**
   - 이용약관, 개인정보취급방침, 마케팅 활용 동의 내용을 데이터베이스에 저장
   - 버전 관리 기능으로 약관 변경 이력 추적
   - 활성 버전 관리 (같은 유형 내에서 하나만 활성화)

2. **Super Admin 관리 페이지**
   - 약관 유형별 탭으로 구분 (이용약관, 개인정보취급방침, 마케팅 활용 동의)
   - 버전 목록 조회 및 관리
   - 새 버전 생성 및 기존 버전 수정
   - 버전별 활성화/비활성화
   - 마크다운 형식의 약관 내용 편집 및 미리보기

3. **회원가입 페이지 통합**
   - 약관 링크 클릭 시 모달로 약관 내용 표시
   - 활성화된 약관 내용을 실시간으로 조회하여 표시
   - 마크다운 렌더링 지원

4. **공개 API**
   - 인증 없이 활성화된 약관 내용 조회 가능
   - 캐싱 헤더 설정 (5분)

## 데이터베이스 스키마

### terms_contents 테이블

```sql
CREATE TABLE terms_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('terms', 'privacy', 'marketing')),
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_type, version)
);
```

**인덱스:**
- `idx_terms_contents_content_type`: content_type 조회 최적화
- `idx_terms_contents_is_active`: 활성 버전 조회 최적화
- `idx_terms_contents_content_type_is_active`: 활성 버전 조회 복합 인덱스

**RLS 정책:**
- Super Admin만 CRUD 가능
- 모든 사용자는 활성 버전만 조회 가능

## 파일 구조

### 데이터베이스 마이그레이션

- `supabase/migrations/20251214133504_create_terms_contents.sql`: 테이블 생성
- `supabase/migrations/20251214133942_seed_terms_contents.sql`: 초기 데이터 삽입

### 타입 정의

- `lib/types/terms.ts`: 약관 관련 TypeScript 타입 정의
- `lib/constants/terms.ts`: 약관 유형 상수 및 라벨

### 데이터 조회 유틸리티

- `lib/data/termsContents.ts`: 약관 내용 조회 함수 (공개 조회용)
  - `getActiveTermsContent()`: 활성화된 약관 조회 (RLS 정책에 따라 활성 버전만 조회 가능)
  - `getTermsContentHistory()`: 약관 버전 히스토리 조회 (RLS 정책에 따라 활성 버전만 조회 가능)
  - `getTermsContentById()`: ID로 약관 조회 (RLS 정책에 따라 활성 버전만 조회 가능)

### Server Actions

- `app/(superadmin)/actions/termsContents.ts`: Super Admin용 약관 관리 액션 (모든 버전 조회 가능)
  - `createTermsContent()`: 새 약관 버전 생성
  - `updateTermsContent()`: 약관 내용 수정
  - `activateTermsContent()`: 특정 버전 활성화 (이전 버전 자동 비활성화)
  - `getTermsContents()`: 약관 목록 조회 (모든 버전)
  - `getActiveTermsContent()`: 활성 약관 조회 (Super Admin 전용)
  - `getTermsContentById()`: ID로 약관 조회 (Super Admin 전용)

### Super Admin 관리 페이지

- `app/(superadmin)/superadmin/terms-management/page.tsx`: 메인 페이지
- `app/(superadmin)/superadmin/terms-management/_components/TermsManagementContent.tsx`: 탭 네비게이션 및 레이아웃
- `app/(superadmin)/superadmin/terms-management/_components/TermsContentList.tsx`: 버전 목록 컴포넌트
- `app/(superadmin)/superadmin/terms-management/_components/TermsContentForm.tsx`: 약관 편집 폼
- `app/(superadmin)/superadmin/terms-management/_components/TermsPreview.tsx`: 마크다운 미리보기

### 회원가입 페이지

- `app/signup/_components/TermsModal.tsx`: 약관 모달 컴포넌트
- `app/signup/page.tsx`: 회원가입 페이지 (약관 링크 클릭 시 모달 열기)

### 공개 API

- `app/api/terms/[type]/route.ts`: 활성화된 약관 내용 조회 API

### 네비게이션

- `components/navigation/global/categoryConfig.ts`: Super Admin 메뉴에 "약관 관리" 항목 추가

## 사용 방법

### Super Admin에서 약관 관리

1. Super Admin 로그인 후 "설정" > "약관 관리" 메뉴 접근
2. 약관 유형 탭 선택 (이용약관, 개인정보취급방침, 마케팅 활용 동의)
3. 버전 목록에서:
   - "새 버전 생성" 버튼으로 새 버전 생성
   - "미리보기" 버튼으로 약관 내용 확인
   - "수정" 버튼으로 기존 버전 수정
4. 약관 편집 시:
   - 제목과 내용(마크다운) 입력
   - "저장 후 즉시 활성화" 체크박스로 활성화 여부 선택
   - 저장 시 이전 활성 버전은 자동으로 비활성화됨

### 회원가입 페이지에서 약관 확인

1. 회원가입 페이지에서 약관 동의 섹션 확인
2. "이용약관", "개인정보취급방침" 링크 클릭
3. 모달에서 활성화된 약관 내용 확인
4. 약관 내용 확인 후 동의 체크박스 선택

## 의존성

- `react-markdown`: 마크다운 렌더링
- `remark-gfm`: GitHub Flavored Markdown 지원

## 보안 고려사항

1. **RLS 정책**
   - Super Admin만 약관 내용을 생성/수정/활성화할 수 있음
   - 일반 사용자는 활성 버전만 조회 가능
   - 정책 확인:
     - `Super Admin can manage terms contents`: Super Admin의 모든 작업 허용
     - `Users can view active terms contents`: 모든 사용자의 활성 버전 조회 허용

2. **권한 검증**
   - 모든 Server Actions에서 Super Admin 권한 확인
   - `getCurrentUserRole()` 함수로 역할 검증

3. **공개 API**
   - 인증 없이 접근 가능하지만 활성 버전만 반환
   - 캐싱 헤더로 성능 최적화

4. **에러 처리**
   - PGRST205 에러 (테이블이 스키마 캐시에 없음) 처리 추가
   - 명확한 에러 메시지 제공

## 에러 처리 개선

### PGRST205 에러 처리

마이그레이션이 적용되지 않았거나 스키마 캐시가 업데이트되지 않은 경우 발생하는 에러를 처리합니다.

- **에러 코드**: `PGRST205` - "Could not find the table 'public.terms_contents' in the schema cache"
- **처리 방법**: 모든 Server Actions와 데이터 조회 함수에 PGRST205 에러 처리 추가
- **에러 메시지**: "약관 테이블을 찾을 수 없습니다. 데이터베이스 마이그레이션이 적용되었는지 확인해주세요."

### 코드 최적화

1. **함수 네이밍 및 주석**
   - `lib/data/termsContents.ts`: 공개 조회용 함수임을 명시
   - `app/(superadmin)/actions/termsContents.ts`: Super Admin 전용 함수임을 명시

2. **타입 안전성**
   - `TermsContentRow` 타입 정의 및 주석 추가
   - 타입 단언 최소화

3. **에러 처리 일관성**
   - 모든 데이터베이스 쿼리에 PGRST205 에러 처리 추가
   - 명확한 에러 메시지 제공

## 향후 개선 사항

1. **약관 변경 알림**
   - 약관 변경 시 기존 사용자에게 알림 기능

2. **약관 동의 이력 관리**
   - 사용자가 동의한 약관 버전 추적
   - 약관 변경 시 재동의 요청 기능

3. **약관 비교 기능**
   - 버전 간 변경 사항 비교 기능

4. **약관 템플릿**
   - 자주 사용되는 약관 템플릿 제공

5. **스키마 캐시 새로고침**
   - 마이그레이션 적용 후 자동 스키마 캐시 새로고침

## 참고 문서

- `docs/terms-of-service.md`: 이용약관 원본 문서
- `docs/privacy-policy.md`: 개인정보취급방침 원본 문서
- `docs/marketing-consent.md`: 마케팅 활용 동의 원본 문서

