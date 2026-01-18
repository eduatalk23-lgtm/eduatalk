# 권한 선택 및 변경 기능 구현 (Phase 3)

**작업 일시**: 2025-02-02  
**목적**: 회원가입 시 권한 선택 및 가입 후 권한 변경 기능 구현

---

## 구현 개요

### Phase 3: 권한 선택 및 변경 기능

사용자가 회원가입 시 학생/학부모를 선택할 수 있고, 가입 후에도 설정 페이지에서 권한을 변경할 수 있도록 구현했습니다.

---

## 구현된 기능

### 1. 회원가입 폼에 권한 선택 필드 추가

**파일**: `app/signup/page.tsx`

**주요 기능**:

- 학생/학부모 선택 필드 추가
- 필수 필드로 설정
- 각 권한에 대한 설명 표시
- UI 개선 (명확한 안내 문구)

```tsx
<select
  id="role"
  name="role"
  required
  value={selectedRole}
  onChange={(e) => setSelectedRole(e.target.value as "student" | "parent")}
>
  <option value="">회원 유형을 선택하세요</option>
  <option value="student">학생</option>
  <option value="parent">학부모</option>
</select>
```

### 2. 회원가입 시 권한 저장

**파일**: `app/actions/auth.ts`

**변경 사항**:
- `signUpSchema`에 `role` 필드 추가
- `user_metadata`에 `signup_role` 저장

```typescript
options: {
  data: {
    display_name: validation.data.displayName,
    tenant_id: validation.data.tenantId || null,
    signup_role: validation.data.role || null,
  },
}
```

### 3. 초기 설정 페이지 권한별 분기

**파일**: `app/page.tsx`

**변경 사항**:
- `role`이 `null`일 때 `user_metadata.signup_role` 확인
- 학부모: `/parent/settings`로 리다이렉트
- 학생: `/settings`로 리다이렉트 (기본값)

```typescript
if (user?.user_metadata?.signup_role === "parent") {
  redirect("/parent/settings");
} else {
  redirect("/settings");
}
```

### 4. 권한 변경 Server Action

**파일**: `app/actions/userRole.ts`

**주요 기능**:

#### `changeUserRole(newRole: "student" | "parent")`

**학부모 → 학생 전환**:
1. `parent_users` 테이블에서 레코드 삭제
2. `students` 테이블에 레코드 생성 (기본 정보만)
3. `user_metadata.signup_role` 업데이트

**학생 → 학부모 전환**:
1. `students` 테이블에서 레코드 삭제
2. `parent_users` 테이블에 레코드 생성
3. `user_metadata.signup_role` 업데이트

**특징**:
- `tenant_id`가 없으면 기본 tenant 자동 조회
- 기존 레코드가 없어도 에러 없이 처리
- 권한 변경 후 적절한 설정 페이지로 리다이렉트

### 5. 학생 설정 페이지에 권한 변경 UI

**파일**: `app/(student)/settings/page.tsx`

**주요 기능**:
- "회원 유형 변경" 섹션 추가
- 학부모로 전환 버튼
- 주의사항 안내 (학생 정보 삭제 경고)
- 전환 후 `/parent/settings`로 리다이렉트

### 6. 학부모 설정 페이지에 권한 변경 UI

**파일**: `app/(parent)/parent/settings/_components/RoleChangeSection.tsx`

**주요 기능**:
- "회원 유형 변경" 섹션 컴포넌트
- 학생으로 전환 버튼
- 주의사항 안내 (학부모 정보 삭제 경고)
- 전환 후 `/settings`로 리다이렉트

---

## 데이터 흐름

### 1. 회원가입 플로우

```
사용자 회원가입
  ↓
기관 선택
  ↓
권한 선택 (학생/학부모)
  ↓
user_metadata에 tenant_id, signup_role 저장
  ↓
이메일 인증 완료
  ↓
role이 null이면 signup_role 확인
  ↓
학생: /settings → students 테이블에 레코드 생성
학부모: /parent/settings → parent_users 테이블에 레코드 생성
```

### 2. 권한 변경 플로우

```
설정 페이지에서 권한 변경 요청
  ↓
확인 다이얼로그 표시
  ↓
changeUserRole 호출
  ↓
기존 권한 테이블에서 레코드 삭제
  ↓
새 권한 테이블에 레코드 생성
  ↓
user_metadata.signup_role 업데이트
  ↓
새 권한의 설정 페이지로 리다이렉트
```

---

## 사용 방법

### 1. 회원가입 시

1. 회원가입 페이지 접속
2. 기본 정보 입력 (이름, 이메일, 비밀번호)
3. 기관 선택
4. **회원 유형 선택** (학생/학부모)
5. 회원가입 완료

### 2. 권한 변경

#### 학생 → 학부모
1. `/settings` 페이지 접속
2. "회원 유형 변경" 섹션에서 "학부모 계정으로 전환" 클릭
3. 확인 다이얼로그에서 확인
4. 자동으로 `/parent/settings`로 이동

#### 학부모 → 학생
1. `/parent/settings` 페이지 접속
2. "회원 유형 변경" 섹션에서 "학생 계정으로 전환" 클릭
3. 확인 다이얼로그에서 확인
4. 자동으로 `/settings`로 이동
5. 학생 정보 입력 필요

---

## 주의사항

### 1. 데이터 삭제
- 권한 변경 시 기존 권한의 테이블 레코드가 삭제됨
- 학생 → 학부모: 학생 정보 삭제
- 학부모 → 학생: 학부모 정보 삭제
- 다시 전환 시 정보를 다시 입력해야 함

### 2. 초기 설정
- 학생으로 전환 시 기본 정보만 생성됨
- `/settings`에서 학생 정보를 입력해야 함
- 학부모로 전환 시 기본 정보만 생성됨

### 3. 연결 정보
- 학생-학부모 연결 정보는 `student_parent_links` 테이블에 저장
- 권한 변경 시 연결 정보는 유지됨 (별도 처리 필요 시 추가)

---

## 향후 개선 사항

### 1. 데이터 백업
- 권한 변경 전 기존 데이터 백업
- 권한 변경 이력 관리

### 2. 연결 정보 관리
- 권한 변경 시 연결 정보 자동 처리
- 학생-학부모 연결 유지

### 3. 초기 설정 개선
- 학부모 초기 설정 페이지 개선
- 권한별 맞춤형 초기 설정 가이드

### 4. 관리자 기능
- 관리자가 사용자 권한 변경
- 권한 변경 이력 조회

---

## 파일 변경 목록

### 신규 파일
- `app/actions/userRole.ts`
- `app/(parent)/parent/settings/_components/RoleChangeSection.tsx`

### 수정 파일
- `app/signup/page.tsx`
  - 권한 선택 UI 추가
- `app/actions/auth.ts`
  - signup_role 처리
- `app/page.tsx`
  - 권한별 초기 설정 분기
- `app/(student)/settings/page.tsx`
  - 학부모로 전환 기능
- `app/(parent)/parent/settings/page.tsx`
  - 학생으로 전환 기능

---

## 테스트 체크리스트

- [ ] 회원가입 시 권한 선택 확인
- [ ] user_metadata에 signup_role 저장 확인
- [ ] role이 null일 때 signup_role 기반 분기 확인
- [ ] 학생 → 학부모 전환 확인
- [ ] 학부모 → 학생 전환 확인
- [ ] 권한 변경 시 데이터 삭제 확인
- [ ] 권한 변경 후 적절한 페이지로 리다이렉트 확인
- [ ] 권한 변경 시 tenant_id 유지 확인

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 권한 선택 및 변경 기능 구현 (Phase 3)`

