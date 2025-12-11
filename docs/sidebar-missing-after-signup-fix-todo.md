# 사이드바 미표시 문제 해결 TODO

## 📋 문제 개요

**문제**: 첫 회원가입 후 대시보드 진입 시 사이드 메뉴가 보이지 않다가 새로고침하면 그제서야 보이는 현상

**원인**:

- 회원가입 시 `students`/`parent_users` 테이블에 레코드가 생성되지 않음
- `getCurrentUserRole()`이 테이블만 조회하므로 `role: null` 반환
- 레이아웃에서 `role !== "student"` 체크로 사이드바 미표시

**영향 범위**:

- ✅ Student: 문제 발생
- ✅ Parent: 동일한 문제 발생 가능
- ❌ Admin/Consultant: 회원가입 플로우와 무관 (문제 없음)

---

## 🎯 구현 계획

### Phase 1: 단기 해결 (즉시 적용)

**목표**: `getCurrentUserRole()`에서 `user_metadata.signup_role`을 fallback으로 사용하여 즉시 문제 해결

**예상 소요 시간**: 1-2시간

### Phase 2: 중기 개선 (1-2주)

**목표**: 스키마 검토 및 마이그레이션 준비, 코드 리팩토링

**예상 소요 시간**: 1-2일

### Phase 3: 장기 개선 (1개월)

**목표**: 회원가입 시 기본 레코드 자동 생성으로 근본 해결

**예상 소요 시간**: 2-3일

---

## 📝 Phase 1: 단기 해결 (즉시 적용)

### 1.1 `getCurrentUserRole()` 함수 개선

#### 작업 내용

- [x] `lib/auth/getCurrentUserRole.ts` 파일 수정
- [x] `user_metadata.signup_role` 확인 로직 추가
- [x] 테이블 조회 실패 시 fallback으로 `signup_role` 사용

#### 세부 구현 사항

- [x] `user_metadata`에서 `signup_role`과 `tenant_id` 미리 추출 (재사용)
- [x] `admin_users`, `parent_users`, `students` 테이블 조회 후 모두 null인 경우
- [x] `signup_role`이 "student" 또는 "parent"인 경우 임시 역할 반환
- [x] `tenant_id`는 `user_metadata.tenant_id` 사용

#### 검증 항목

- [ ] 회원가입 직후 학생 대시보드 접근 시 사이드바 표시 확인 (수동 테스트 필요)
- [ ] 회원가입 직후 학부모 대시보드 접근 시 사이드바 표시 확인 (수동 테스트 필요)
- [x] 기존 로그인 사용자에게 영향 없음 확인 (코드 검증 완료)
- [ ] `/settings`에서 정보 입력 후 정상 동작 확인 (수동 테스트 필요)

#### 테스트 시나리오

1. **신규 학생 회원가입**

   - 회원가입 → 이메일 인증 → 로그인 → `/dashboard` 접근
   - 사이드바가 즉시 표시되는지 확인

2. **신규 학부모 회원가입**

   - 회원가입 → 이메일 인증 → 로그인 → `/parent/dashboard` 접근
   - 사이드바가 즉시 표시되는지 확인

3. **기존 사용자 영향 확인**
   - 기존 학생/학부모 로그인 후 대시보드 접근
   - 정상 동작 확인

---

## 📝 Phase 2: 중기 개선 (1-2주)

### 2.1 스키마 검토 및 분석

#### 작업 내용

- [x] `students` 테이블 스키마 확인
  - [x] `tenant_id` 필수 여부 확인
  - [x] 필수 필드 목록 정리
  - [x] 기본값 설정 가능한 필드 확인
- [x] `parent_users` 테이블 스키마 확인
  - [x] 필수 필드 목록 정리
  - [x] 기본값 설정 가능한 필드 확인
- [x] 마이그레이션 파일 검토
  - [x] 기존 마이그레이션에서 제약조건 확인
  - [x] 변경 이력 확인

#### 산출물

- [x] `docs/students-table-schema-analysis.md` 작성
- [x] `docs/parent-users-table-schema-analysis.md` 작성
- [x] `docs/migration-review-summary.md` 작성

### 2.2 마이그레이션 계획 수립

#### 작업 내용

- [x] `tenant_id` nullable 변경 필요성 검토
  - [x] 현재 사용 패턴 분석
  - [x] 기본 tenant 할당 로직 확인
  - [x] nullable 변경 시 영향 범위 분석
- [x] 마이그레이션 SQL 작성
  - [x] `ALTER TABLE students ALTER COLUMN tenant_id DROP NOT NULL;` (필요 시)
  - [x] 롤백 마이그레이션 작성
- [x] 마이그레이션 테스트 계획 수립
  - [x] 개발 환경 테스트
  - [x] 스테이징 환경 테스트

#### 산출물

- [x] `docs/migration-planning.md` 작성
- [x] 마이그레이션 파일 초안 작성 (문서에 포함)

### 2.3 코드 리팩토링

#### 작업 내용

- [x] `getTenantInfo()` 헬퍼 함수 생성
  - [x] `lib/auth/getTenantInfo.ts` 파일 생성
  - [x] 중복 코드 제거
- [x] 레이아웃 파일 리팩토링
  - [x] `app/(student)/layout.tsx` 수정
  - [x] `app/(admin)/layout.tsx` 수정
  - [x] `app/(parent)/layout.tsx` 수정
- [x] 타입 안전성 개선
  - [x] `SignupRole` 타입 정의
  - [x] `CurrentUserRole` 타입에 `signupRole` 필드 추가 (옵셔널)

#### 검증 항목

- [x] 모든 레이아웃에서 `getTenantInfo()` 사용 확인
- [x] 타입 에러 없음 확인
- [ ] 기존 기능 정상 동작 확인 (수동 테스트 필요)

---

## 📝 Phase 3: 장기 개선 (1개월)

### 3.1 회원가입 시 기본 레코드 생성 함수 구현

#### 작업 내용

- [x] `getDefaultTenant()` 헬퍼 함수 생성
  - [x] `lib/data/tenants.ts`에 함수 추가
  - [x] "Default Tenant" 조회 로직 구현
  - [x] 에러 처리 및 로깅
- [x] `createStudentRecord()` 함수 구현
  - [x] `app/actions/auth.ts`에 함수 추가
  - [x] `tenant_id` 처리 로직 (기본 tenant 할당)
  - [x] 에러 처리 및 로깅
  - [x] UNIQUE constraint violation 처리
- [x] `createParentRecord()` 함수 구현
  - [x] `app/actions/auth.ts`에 함수 추가
  - [x] `tenant_id` 처리 로직
  - [x] 에러 처리 및 로깅
  - [x] UNIQUE constraint violation 처리

#### 세부 구현 사항

- [x] 기본 tenant 조회 로직
  - [x] "Default Tenant" 조회 (`getDefaultTenant()`)
  - [x] 없을 경우 처리 (학생은 에러, 학부모는 nullable 허용)
- [x] 에러 처리 전략
  - [x] 레코드 생성 실패 시 회원가입 성공 유지
  - [x] 에러 로깅 및 모니터링
  - [x] UNIQUE constraint violation 처리 (이미 존재하는 경우 성공으로 처리)

#### 검증 항목

- [ ] 학생 회원가입 시 `students` 테이블에 레코드 생성 확인 (수동 테스트 필요)
- [ ] 학부모 회원가입 시 `parent_users` 테이블에 레코드 생성 확인 (수동 테스트 필요)
- [ ] `tenant_id`가 없을 경우 기본 tenant 할당 확인 (수동 테스트 필요)
- [ ] 레코드 생성 실패 시에도 회원가입 성공 확인 (수동 테스트 필요)

### 3.2 signUp 함수 수정

#### 작업 내용

- [x] `app/actions/auth.ts`의 `signUp()` 함수 수정
- [x] 회원가입 성공 후 역할별 레코드 생성 호출
- [x] 에러 처리 및 로깅 추가

#### 세부 구현 사항

- [x] `authData.user` 존재 확인
- [x] `validation.data.role`에 따라 분기
  - [x] "student" → `createStudentRecord()` 호출
  - [x] "parent" → `createParentRecord()` 호출
- [x] 레코드 생성 실패 시에도 회원가입 성공 처리
- [x] 상세한 에러 로깅

#### 검증 항목

- [ ] 회원가입 플로우 정상 동작 확인 (수동 테스트 필요)
- [ ] 레코드 생성 성공 시 즉시 `getCurrentUserRole()` 정상 동작 확인 (수동 테스트 필요)
- [ ] 레코드 생성 실패 시에도 회원가입 성공 확인 (수동 테스트 필요)
- [ ] 에러 로그 정상 기록 확인 (수동 테스트 필요)

### 3.3 RLS 정책 추가 (필수)

#### 작업 내용

- [x] `students` 테이블 INSERT 정책 추가
  - [x] 정책명: `students_insert_own`
  - [x] 조건: `auth.uid() = id`
  - [x] 마이그레이션 파일 작성 (`supabase/migrations/20251213000000_add_students_parents_insert_policy.sql`)
- [x] `parent_users` 테이블 INSERT 정책 추가
  - [x] 정책명: `parent_users_insert_own`
  - [x] 조건: `auth.uid() = id`
  - [x] 마이그레이션 파일 작성
- [x] 개발 환경 마이그레이션 적용 완료
- [ ] 개발 환경 테스트 (수동 테스트 필요)
  - [ ] 첫 로그인 시 레코드 생성 성공 확인
  - [ ] RLS 정책 위반 에러 없음 확인

#### 검증 항목

- [x] 마이그레이션 성공 확인
- [ ] 첫 로그인 시 학생 레코드 생성 성공 확인 (수동 테스트 필요)
- [ ] 첫 로그인 시 학부모 레코드 생성 성공 확인 (수동 테스트 필요)
- [ ] RLS 정책 위반 에러 없음 확인 (수동 테스트 필요)
- [ ] 보안 검증 (다른 사용자 레코드 생성 시도 시 차단 확인)

**참고**: 상세 작업 내용은 [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) 참조

### 3.4 첫 로그인 시 레코드 생성 로직 구현 (신규)

#### 작업 내용

- [x] `ensureUserRecord()` 헬퍼 함수 구현
  - [x] 역할별 레코드 확인 및 생성 로직
  - [x] 에러 처리 및 로깅
- [x] `signIn()` 함수 수정
  - [x] 로그인 성공 후 `ensureUserRecord()` 호출 추가
  - [x] 에러 처리 (실패해도 로그인 계속 진행)

#### 세부 구현 사항

- [x] `user_metadata.signup_role` 확인
- [x] 역할별 테이블에서 레코드 존재 여부 확인
- [x] 레코드가 없으면 생성 시도 (완전한 인증 상태이므로 RLS 정책 정상 작동)
- [x] 레코드 생성 실패해도 로그인 성공 처리
- [x] 상세한 에러 로깅

#### 검증 항목

- [ ] 첫 로그인 시 레코드 생성 성공 확인 (수동 테스트 필요)
- [ ] RLS 정책 위반 에러 없음 확인 (수동 테스트 필요)
- [ ] 기존 사용자에게 영향 없음 확인 (수동 테스트 필요)
- [ ] 레코드 생성 실패 시에도 로그인 성공 확인 (수동 테스트 필요)

### 3.4 마이그레이션 실행 (선택사항)

#### 작업 내용

- [ ] 개발 환경 마이그레이션 실행
  - [ ] 마이그레이션 파일 적용
  - [ ] 데이터 정합성 확인
  - [ ] 롤백 테스트
- [ ] 스테이징 환경 마이그레이션 실행
  - [ ] 마이그레이션 파일 적용
  - [ ] 통합 테스트
  - [ ] 성능 테스트
- [ ] 프로덕션 환경 마이그레이션 계획
  - [ ] 마이그레이션 일정 수립
  - [ ] 롤백 계획 수립
  - [ ] 모니터링 계획 수립

#### 검증 항목

- [ ] 마이그레이션 성공 확인
- [ ] 기존 데이터 정합성 확인
- [ ] 신규 회원가입 플로우 정상 동작 확인
- [ ] 성능 저하 없음 확인

### 3.4 Phase 1 코드 제거 (선택사항)

#### 작업 내용

- [ ] `getCurrentUserRole()`에서 `signup_role` fallback 로직 제거 검토
  - [ ] 모든 사용자가 테이블에 레코드를 가지는지 확인
  - [ ] 제거 시 영향 범위 분석
  - [ ] 제거 여부 결정

#### 검증 항목

- [ ] fallback 로직 제거 후 정상 동작 확인
- [ ] 에지 케이스 처리 확인

---

## 🔍 검증 및 테스트

### 통합 테스트 시나리오

#### 시나리오 1: 신규 학생 회원가입

1. 회원가입 폼 작성 (학생 선택)
2. 회원가입 제출
3. 이메일 인증 완료
4. 로그인
5. `/dashboard` 접근
6. **검증**: 사이드바 즉시 표시 확인

#### 시나리오 2: 신규 학부모 회원가입

1. 회원가입 폼 작성 (학부모 선택)
2. 회원가입 제출
3. 이메일 인증 완료
4. 로그인
5. `/parent/dashboard` 접근
6. **검증**: 사이드바 즉시 표시 확인

#### 시나리오 3: 기존 사용자 영향 확인

1. 기존 학생/학부모 로그인
2. 대시보드 접근
3. **검증**: 정상 동작 확인

#### 시나리오 4: 레코드 생성 실패 케이스

1. 기본 tenant가 없는 환경에서 회원가입
2. **검증**: 회원가입은 성공, 레코드 생성 실패 로그 확인
3. `/settings`에서 정보 입력 후 정상 동작 확인

---

## 📊 진행 상황 추적

### Phase 1: 단기 해결

- [x] 작업 시작
- [x] 코드 구현 완료
- [ ] 테스트 완료 (수동 테스트 필요)
- [ ] 코드 리뷰 완료
- [ ] 배포 완료

### Phase 2: 중기 개선

- [x] 작업 시작
- [x] 스키마 분석 완료
- [x] 마이그레이션 계획 수립 완료
- [x] 코드 리팩토링 완료
- [x] 타입 에러 확인 완료
- [ ] 수동 테스트 완료 (기능 정상 동작 확인)
- [ ] 배포 완료

### Phase 3: 장기 개선

- [x] 작업 시작
- [x] 기본 레코드 생성 함수 구현 완료
- [x] signUp 함수 수정 완료 (회원가입 시점 레코드 생성 시도 - RLS 정책 위반으로 실패하지만 fallback으로 처리)
- [x] 타입 에러 확인 완료
- [x] RLS 정책 추가 완료 (Phase 2에서 완료)
- [x] 첫 로그인 시 레코드 생성 로직 구현 완료 (`ensureUserRecord()` 함수 추가)
- [x] signIn 함수 수정 완료 (첫 로그인 시 레코드 확인 및 생성)
- [ ] 수동 테스트 완료 (첫 로그인 시 레코드 생성 확인)
- [ ] 통합 테스트 완료
- [ ] 프로덕션 배포 완료

---

## 📚 참고 문서

- [사이드바 미표시 문제 분석](./sidebar-missing-after-signup-analysis.md) (작성 예정)
- [students 테이블 스키마 분석](./students-table-schema-analysis.md) (Phase 2에서 작성)
- [parent_users 테이블 스키마 분석](./parent-users-table-schema-analysis.md) (Phase 2에서 작성)
- [회원가입 플로우 개선 계획](./signup-flow-improvement-plan.md) (작성 예정)
- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) - Phase 3 RLS 정책 위반 문제 해결

---

## ⚠️ 주의사항

1. **Phase 1은 즉시 적용 가능**: 기존 코드에 최소한의 변경만 필요
2. **Phase 2는 신중한 검토 필요**: 스키마 변경은 영향 범위가 큼
3. **Phase 3는 충분한 테스트 필요**: 회원가입 플로우 변경은 사용자 경험에 직접 영향
4. **마이그레이션은 롤백 계획 필수**: 프로덕션 환경 적용 전 충분한 테스트 필요

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX  
**담당자**: [담당자명]
