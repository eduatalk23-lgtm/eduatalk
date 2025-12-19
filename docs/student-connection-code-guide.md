# 학생 연결 코드 시스템 사용 가이드

## 개요

학생 연결 코드 시스템은 관리자가 학생을 등록한 후, 학생이 회원가입 시 기존 학생 레코드와 계정을 연결할 수 있도록 하는 시스템입니다.

## 주요 기능

1. **연결 코드 생성**: 관리자가 학생 등록 시 자동으로 생성
2. **연결 코드 검증**: 회원가입 시 코드 유효성 검증
3. **학생 계정 연결**: 기존 학생 레코드를 새 사용자 ID로 연결
4. **트랜잭션 보장**: PostgreSQL 함수를 사용하여 데이터 무결성 보장

## 관리자용 사용 가이드

### 1. 학생 등록 및 연결 코드 생성

관리자가 학생을 등록하면 자동으로 연결 코드가 생성됩니다.

**위치**: `/admin/students/new`

**절차**:
1. 학생 기본 정보 입력 (이름, 학년, 반 등)
2. 선택적으로 프로필 정보 입력 (연락처, 주소 등)
3. 선택적으로 진로 정보 입력 (희망 대학, 전공 등)
4. "등록" 버튼 클릭
5. 생성된 연결 코드 확인 (예: `STU-ABCD-1234`)

**연결 코드 형식**: `STU-XXXX-XXXX` (대문자 영문자 및 숫자)

**만료 기간**: 생성일로부터 30일

### 2. 연결 코드 조회

**위치**: `/admin/students/[studentId]`

**절차**:
1. 학생 상세 페이지에서 "연결 코드" 섹션 확인
2. 활성화된 연결 코드 확인
3. 필요 시 "재발급" 버튼 클릭하여 새 코드 생성

### 3. 연결 코드 재발급

기존 코드가 만료되었거나 분실된 경우 재발급할 수 있습니다.

**절차**:
1. 학생 상세 페이지에서 "연결 코드 재발급" 버튼 클릭
2. 새 연결 코드 생성 (기존 코드는 자동으로 비활성화됨)
3. 새 코드를 학생에게 전달

## 학생용 사용 가이드

### 1. 회원가입 시 연결 코드 사용

**위치**: `/signup`

**절차**:
1. 회원가입 페이지 접속
2. 역할 선택: "학생" 선택
3. 기본 정보 입력 (이메일, 비밀번호, 이름 등)
4. **연결 코드 입력** (관리자로부터 받은 코드)
5. 약관 동의 및 회원가입 완료

**연결 코드 입력 예시**: `STU-ABCD-1234`

### 2. 연결 코드 없이 회원가입

연결 코드가 없는 경우에도 회원가입이 가능합니다. 다만 기존 학생 레코드와 연결되지 않으므로, 관리자에게 문의하여 연결 코드를 받아야 합니다.

## 기술적 세부사항

### 데이터베이스 구조

#### 테이블

1. **students**: 학생 기본 정보
2. **student_profiles**: 학생 프로필 정보
3. **student_career_goals**: 학생 진로 목표 정보
4. **student_connection_codes**: 연결 코드 정보

#### PostgreSQL 함수

**함수명**: `link_student_with_connection_code`

**파라미터**:
- `p_user_id` (uuid): 새 사용자 ID
- `p_connection_code` (text): 연결 코드

**반환값**: `jsonb`
```json
{
  "success": true,
  "student_id": "uuid",
  "old_student_id": "uuid"
}
```

**에러 반환**:
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

**특징**:
- 트랜잭션 보장: 모든 작업이 하나의 트랜잭션으로 처리됨
- SECURITY DEFINER: RLS 정책 우회 (Admin 클라이언트 대신)
- 자동 롤백: 중간에 실패 시 모든 변경사항 롤백

### 에러 처리

#### 에러 코드

- `STUDENT_NOT_FOUND`: 학생 정보를 찾을 수 없음
- `CONNECTION_CODE_INVALID`: 유효하지 않은 연결 코드
- `CONNECTION_CODE_EXPIRED`: 만료된 연결 코드
- `CONNECTION_CODE_ALREADY_USED`: 이미 사용된 연결 코드
- `RLS_POLICY_VIOLATION`: 데이터 접근 권한 없음

#### 에러 처리 모듈

**파일**: `lib/errors/studentErrors.ts`

**주요 클래스**:
- `StudentError`: 학생 관련 에러 클래스
- `StudentErrorCodes`: 에러 코드 상수
- `STUDENT_ERROR_MESSAGES`: 사용자 친화적 메시지 매핑

**사용 예시**:
```typescript
import { StudentError, StudentErrorCodes, toStudentError } from "@/lib/errors/studentErrors";

try {
  // 작업 수행
} catch (error) {
  const studentError = toStudentError(
    error,
    StudentErrorCodes.UNKNOWN_ERROR,
    { studentId, connectionCode }
  );
  return {
    success: false,
    error: studentError.userMessage,
  };
}
```

## FAQ

### Q1. 연결 코드를 잃어버렸어요.

**A**: 관리자에게 문의하여 연결 코드를 재발급받을 수 있습니다. 학생 상세 페이지에서 "연결 코드 재발급" 버튼을 클릭하면 새 코드가 생성됩니다.

### Q2. 연결 코드가 만료되었어요.

**A**: 연결 코드는 생성일로부터 30일간 유효합니다. 만료된 경우 관리자에게 문의하여 새 코드를 받아야 합니다.

### Q3. 연결 코드를 여러 번 사용할 수 있나요?

**A**: 아니요. 연결 코드는 일회성입니다. 한 번 사용되면 더 이상 사용할 수 없습니다.

### Q4. 연결 코드 없이 회원가입했어요.

**A**: 연결 코드 없이 회원가입한 경우, 관리자에게 문의하여 연결 코드를 받은 후 계정을 연결할 수 있습니다. 다만 이 경우 수동으로 연결 작업이 필요할 수 있습니다.

### Q5. 연결 코드 형식이 맞지 않아요.

**A**: 연결 코드는 `STU-XXXX-XXXX` 형식이어야 합니다. 대문자 영문자와 숫자만 사용됩니다. 공백이나 하이픈이 잘못 입력되지 않았는지 확인해주세요.

## 트러블슈팅

### 문제: "유효하지 않은 연결 코드입니다" 에러

**원인**:
1. 연결 코드 형식이 올바르지 않음
2. 연결 코드가 데이터베이스에 존재하지 않음
3. 연결 코드가 만료됨
4. 연결 코드가 이미 사용됨

**해결 방법**:
1. 연결 코드 형식 확인 (`STU-XXXX-XXXX`)
2. 관리자에게 문의하여 코드 재발급
3. 코드 만료 여부 확인
4. 코드 사용 여부 확인

### 문제: "학생 정보를 찾을 수 없습니다" 에러

**원인**:
1. 연결 코드에 해당하는 학생 레코드가 삭제됨
2. 데이터베이스 오류

**해결 방법**:
1. 관리자에게 문의
2. 데이터베이스 로그 확인

### 문제: "데이터 접근 권한이 없습니다" 에러

**원인**:
1. RLS 정책 위반
2. Admin 클라이언트 생성 실패

**해결 방법**:
1. 서버 로그 확인
2. 환경 변수 확인 (`SUPABASE_SERVICE_ROLE_KEY`)

## 보안 고려사항

1. **연결 코드 보안**:
   - `crypto.getRandomValues`를 사용하여 안전한 난수 생성
   - 코드 형식 검증 (정규식)
   - 만료 시간 설정

2. **트랜잭션 보장**:
   - PostgreSQL 함수를 사용하여 모든 작업이 하나의 트랜잭션으로 처리
   - 중간 실패 시 자동 롤백

3. **RLS 정책**:
   - SECURITY DEFINER 함수로 RLS 정책 우회
   - Admin 클라이언트만 함수 호출 가능

4. **에러 처리**:
   - 민감한 정보 노출 방지
   - 사용자 친화적 에러 메시지 제공

## 관련 파일

- **마이그레이션**: `supabase/migrations/20251219114051_create_link_student_with_connection_code_function.sql`
- **에러 처리**: `lib/errors/studentErrors.ts`
- **연결 코드 유틸리티**: `lib/utils/connectionCodeUtils.ts`
- **인증 액션**: `app/actions/auth.ts`
- **학생 관리 액션**: `app/(admin)/actions/studentManagementActions.ts`

## 참고 문서

- [학생 등록 및 연결 코드 시스템 개선 계획](.cursor/plans/-6f9e6333.plan.md)
- [Supabase RPC 호출 문서](https://supabase.com/docs/reference/javascript/rpc)

---

**마지막 업데이트**: 2025-12-19

