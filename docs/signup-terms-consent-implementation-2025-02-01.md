# 회원가입 약관 동의 기능 구현

## 작업 개요

회원가입 시 이용약관, 개인정보취급방침(필수), 마케팅 활용 동의(선택) 체크박스를 추가하고, 동의 정보를 데이터베이스에 저장하는 기능을 구현했습니다.

## 구현 내용

### 1. 데이터베이스 마이그레이션

**파일**: `supabase/migrations/20250201000000_create_user_consents.sql`

- `user_consents` 테이블 생성
- 컬럼: `id`, `user_id`, `consent_type`, `consented`, `consented_at`, `ip_address`, `user_agent`, `created_at`
- RLS 정책 설정 (사용자는 자신의 동의 정보만 조회 가능)
- 인덱스 추가 (`user_id`, `consent_type`, 복합 인덱스)

### 2. 타입 정의

**파일**: `lib/types/auth.ts`

추가된 타입:
- `ConsentType`: 'terms' | 'privacy' | 'marketing'
- `UserConsent`: 약관 동의 정보 타입
- `ConsentData`: 약관 동의 저장을 위한 데이터 타입
- `ConsentMetadata`: 약관 동의 저장 시 메타데이터 타입

### 3. 약관 동의 저장 유틸리티

**파일**: `lib/data/userConsents.ts`

구현된 함수:
- `saveUserConsents(userId, consents, metadata)`: 약관 동의 정보 저장
- `getUserConsents(userId)`: 사용자의 약관 동의 정보 조회

### 4. 회원가입 페이지 UI

**파일**: `app/signup/page.tsx`

추가된 내용:
- 이용약관 체크박스 (필수)
- 개인정보취급방침 체크박스 (필수)
- 마케팅 활용 동의 체크박스 (선택)
- 각 약관에 대한 링크 (새 창 열기)
- 약관 동의 섹션 스타일링 (Spacing-First 정책 준수)

### 5. 회원가입 액션 수정

**파일**: `app/actions/auth.ts`

수정된 내용:
- 약관 동의 정보 추출 (`consent_terms`, `consent_privacy`, `consent_marketing`)
- 필수 약관 미체크 시 에러 반환
- 약관 동의 정보를 `user_consents` 테이블에 저장

### 6. 체크박스 컴포넌트

**파일**: `components/ui/FormCheckbox.tsx`

새로 생성된 컴포넌트:
- `FormCheckbox`: 약관 동의용 체크박스 컴포넌트
- FormInput과 일관된 스타일
- 에러 메시지 표시 지원

## 데이터베이스 스키마

```sql
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'marketing')),
  consented BOOLEAN NOT NULL DEFAULT true,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_type)
);
```

## 사용 방법

### 회원가입 시 약관 동의

1. 회원가입 페이지에서 필수 약관(이용약관, 개인정보취급방침)에 동의
2. 선택 약관(마케팅 활용 동의)은 선택적으로 동의
3. 필수 약관 미체크 시 회원가입 불가
4. 약관 동의 정보는 자동으로 데이터베이스에 저장

### 약관 동의 정보 조회

```typescript
import { getUserConsents } from "@/lib/data/userConsents";

const consents = await getUserConsents(userId);
// { terms: true, privacy: true, marketing: false }
```

## 주의사항

1. **약관 링크**: 현재 `/terms`, `/privacy` 링크로 설정되어 있으나, 실제 약관 페이지가 없으면 임시로 `#` 사용
2. **RLS 정책**: 약관 동의는 서버 액션에서만 생성 가능하도록 설정
3. **IP 주소 및 User Agent**: 개인정보이므로 선택적으로 저장 (현재는 저장하지 않음)
4. **기존 사용자**: 기존 사용자에 대한 약관 동의 정보는 없음 (필요 시 별도 처리)

## 향후 개선 사항

1. 약관 페이지 생성 (`/terms`, `/privacy`)
2. 약관 동의 정보 수정 기능 (마이페이지)
3. 약관 동의 이력 관리
4. 약관 버전 관리

## 검증 방법

1. 회원가입 페이지에서 약관 동의 체크박스 표시 확인
2. 필수 약관 미체크 시 제출 방지 확인
3. 약관 동의 정보가 데이터베이스에 저장되는지 확인
4. RLS 정책이 올바르게 작동하는지 확인

## 관련 파일

- `supabase/migrations/20250201000000_create_user_consents.sql`
- `lib/types/auth.ts`
- `lib/data/userConsents.ts`
- `app/signup/page.tsx`
- `app/actions/auth.ts`
- `components/ui/FormCheckbox.tsx`

---

**작성일**: 2025-02-01  
**작업자**: AI Assistant

