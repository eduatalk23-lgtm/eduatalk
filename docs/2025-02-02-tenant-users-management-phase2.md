# 회원가입 시 기관 선택 기능 구현 (Phase 2)

**작업 일시**: 2025-02-02  
**목적**: 회원가입 시 사용자가 소속 기관을 선택할 수 있도록 기능 구현

---

## 구현 개요

### Phase 2: 회원가입 시 기관 선택 기능

신규 사용자가 회원가입 시 소속 기관을 선택할 수 있도록 구현했습니다. 선택한 기관은 user_metadata에 저장되고, 학생 정보 저장 시 자동으로 할당됩니다.

---

## 구현된 기능

### 1. 기관 목록 조회 Server Action

**파일**: `app/actions/tenants.ts`

```typescript
export async function getTenantOptionsForSignup(): Promise<TenantOption[]>
```

- 활성화된 기관 목록 조회
- 이름 순으로 정렬
- 회원가입 페이지에서 사용

**반환 타입**:
```typescript
type TenantOption = {
  id: string;
  name: string;
  type: string | null;
};
```

### 2. 회원가입 폼에 기관 선택 필드 추가

**파일**: `app/signup/page.tsx`

**주요 기능**:

1. **기관 목록 로드**
   - 페이지 로드 시 기관 목록 자동 조회
   - 로딩 상태 표시

2. **검색 기능**
   - 기관명으로 실시간 검색
   - 검색어 입력 시 select 옵션 필터링

3. **기관 선택**
   - 필수 필드로 설정
   - 기관명과 유형 표시 (예: "서울학원 (academy)")
   - 검색 결과가 없을 때 안내 메시지

4. **UI 개선**
   - 검색창과 select 분리
   - 총 기관 수 표시
   - 기관이 없을 때 안내 메시지

### 3. 회원가입 액션 수정

**파일**: `app/actions/auth.ts`

**변경 사항**:
- `signUpSchema`에 `tenantId` 필드 추가 (선택사항)
- `signUp` 함수에서 `tenant_id` 폼 데이터 읽기
- `user_metadata`에 `tenant_id` 저장

```typescript
options: {
  data: {
    display_name: validation.data.displayName,
    tenant_id: validation.data.tenantId || null,
  },
}
```

### 4. 학생 정보 저장 시 tenant_id 사용

**파일**: `app/(student)/actions/studentActions.ts`

**변경 사항**:
- `saveStudentInfo`: user_metadata에서 tenant_id 가져오기
- `updateStudentProfile`: user_metadata에서 tenant_id 가져오기
- 회원가입 시 선택한 기관이 있으면 사용, 없으면 기본 tenant 자동 할당

```typescript
const tenantIdFromMetadata = user.user_metadata?.tenant_id as string | null | undefined;

const result = await upsertStudent({
  id: user.id,
  tenant_id: tenantIdFromMetadata || null,
  // ...
});
```

---

## 데이터 흐름

### 1. 회원가입 플로우

```
사용자 회원가입
  ↓
기관 선택 (선택사항)
  ↓
user_metadata에 tenant_id 저장
  ↓
이메일 인증 완료
  ↓
학생 정보 입력 (/settings)
  ↓
user_metadata에서 tenant_id 가져오기
  ↓
students 테이블에 tenant_id와 함께 저장
```

### 2. 기관 할당 우선순위

1. **회원가입 시 선택한 기관** (user_metadata.tenant_id)
2. **기본 tenant** (Default Tenant, upsertStudent에서 자동 할당)

---

## 사용 방법

### 1. 회원가입 시

1. 회원가입 페이지 접속
2. 기본 정보 입력 (이름, 이메일, 비밀번호)
3. 기관 검색 (선택사항)
4. 기관 선택 (필수)
5. 회원가입 완료

### 2. 학생 정보 입력 시

1. 이메일 인증 완료 후 로그인
2. `/settings` 페이지에서 학생 정보 입력
3. 회원가입 시 선택한 기관에 자동 할당됨

---

## UI 개선 사항

### 검색 기능
- 실시간 필터링
- 검색어 입력 시 select 옵션 자동 필터링
- 검색 결과가 없을 때 안내 메시지

### 사용자 경험
- 기관 목록 로딩 상태 표시
- 총 기관 수 표시
- 기관이 없을 때 안내 메시지
- 필수 필드 표시 (빨간 별표)

---

## 향후 개선 사항

### Phase 3: 권한 선택 기능
- 회원가입 시 학생/학부모 선택
- 가입 후 권한 변경 기능

### 추가 개선 사항
- 기관 검색 자동완성
- 최근 선택한 기관 표시
- 기관별 가입 코드 시스템
- 기관 승인 프로세스 (관리자 승인 후 활성화)

---

## 파일 변경 목록

### 신규 파일
- `app/actions/tenants.ts`

### 수정 파일
- `app/signup/page.tsx`
  - 기관 선택 UI 추가
  - 검색 기능 구현
- `app/actions/auth.ts`
  - tenant_id 처리 추가
- `app/(student)/actions/studentActions.ts`
  - user_metadata에서 tenant_id 사용

---

## 테스트 체크리스트

- [ ] 회원가입 페이지에서 기관 목록 로드 확인
- [ ] 기관 검색 기능 확인
- [ ] 기관 선택 후 회원가입 확인
- [ ] user_metadata에 tenant_id 저장 확인
- [ ] 학생 정보 저장 시 tenant_id 자동 할당 확인
- [ ] 기관을 선택하지 않고 회원가입 시 기본 tenant 할당 확인
- [ ] 기관이 없을 때 안내 메시지 표시 확인

---

## 주의사항

1. **기관 선택은 필수**
   - 현재는 필수 필드로 설정되어 있지만, 선택사항으로 변경 가능
   - 선택하지 않으면 기본 tenant에 할당

2. **user_metadata 저장**
   - Supabase Auth의 user_metadata에 저장
   - 데이터 크기 제한 고려 필요

3. **기존 사용자 호환성**
   - 기존 사용자는 user_metadata에 tenant_id가 없음
   - 학생 정보 저장 시 null이면 기본 tenant 할당 (기존 로직 유지)

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 회원가입 시 기관 선택 기능 구현 (Phase 2)`

