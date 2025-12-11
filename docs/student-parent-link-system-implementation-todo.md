# 학생-학부모 연결 시스템 구현 TODO

**작성 일자**: 2025-01-31  
**구현 방식**: 하이브리드 방식 (관리자 연결 + 자체 연결 요청)  
**우선순위**: High

---

## 📋 목차

1. [현재 상태 분석](#현재-상태-분석)
2. [구현 계획](#구현-계획)
3. [Phase 1: 관리자 영역 연결 기능](#phase-1-관리자-영역-연결-기능)
4. [Phase 2: 자체 연결 요청 기능](#phase-2-자체-연결-요청-기능)
5. [Phase 3: 승인 프로세스 및 자동 연결](#phase-3-승인-프로세스-및-자동-연결)
6. [데이터베이스 스키마 확인](#데이터베이스-스키마-확인)
7. [테스트 계획](#테스트-계획)

---

## 현재 상태 분석

### ✅ 이미 구현된 기능

1. **학부모 대시보드**

   - 연결된 학생 목록 조회 (`getLinkedStudents`)
   - 학생 접근 권한 확인 (`canAccessStudent`)
   - 위치: `app/(parent)/parent/dashboard/page.tsx`

2. **학부모 설정 페이지**

   - 연결된 자녀 목록 표시
   - 위치: `app/(parent)/parent/settings/page.tsx`

3. **데이터베이스 테이블**

   - `parent_student_links` 테이블 존재
   - 필드: `id`, `student_id`, `parent_id`, `relation`, `created_at`
   - 미사용 필드: `is_approved`, `is_primary`, `approved_at`, `tenant_id`

4. **관리자 영역 - Phase 1 완료 (2025-01-31)** ✅

   - 학생 상세 페이지에 학부모 연결 섹션 구현 완료
   - 학부모 검색 및 연결 기능 구현 완료
   - 연결 해제 기능 구현 완료
   - 관계 수정 기능 구현 완료
   - 로컬 상태 업데이트로 성능 최적화 완료

### ❌ 미구현 기능

1. **학부모 자체 연결**

   - 학생 검색 및 연결 요청 기능 없음
   - 연결 요청 상태 확인 기능 없음

2. **승인 프로세스**
   - `is_approved` 필드 미사용
   - 승인/거부 기능 없음

---

## 구현 계획

### 전체 구조

```
Phase 1: 관리자 영역 연결 기능 (우선순위: High)
├── 1.1 Server Actions 작성
├── 1.2 ParentLinksSection 컴포넌트 작성
├── 1.3 학생 상세 페이지에 통합
└── 1.4 학부모 검색 기능

Phase 2: 자체 연결 요청 기능 (우선순위: Medium)
├── 2.1 연결 요청 Server Actions
├── 2.2 학생 검색 컴포넌트
├── 2.3 학부모 설정 페이지에 통합
└── 2.4 요청 상태 표시

Phase 3: 승인 프로세스 및 자동 연결 (우선순위: Low)
├── 3.1 승인 프로세스 구현
├── 3.2 관리자 승인 UI
└── 3.3 자동 승인 옵션
```

---

## Phase 1: 관리자 영역 연결 기능

### 1.1 Server Actions 작성

**파일**: `app/(admin)/actions/parentStudentLinkActions.ts` (신규) ✅ 완료

#### 구현할 함수들

- [x] `getStudentParents(studentId: string)` ✅

  - 학생에 연결된 학부모 목록 조회
  - 반환 타입: `{ id: string; name: string | null; email: string | null; relation: string; is_approved: boolean | null }[]`
  - 조인: `parent_student_links` + `parent_users` + `users`

- [x] `searchParents(query: string, tenantId?: string)` ✅

  - 학부모 검색 (이름, 이메일)
  - 반환 타입: `{ id: string; name: string | null; email: string | null }[]`
  - 조인: `parent_users` + `users`

- [x] `createParentStudentLink(studentId: string, parentId: string, relation: string)` ✅

  - 학생-학부모 연결 생성
  - 중복 체크 (UNIQUE 제약조건)
  - 반환: `{ success: boolean; error?: string; linkId?: string }`

- [x] `deleteParentStudentLink(linkId: string)` ✅

  - 연결 삭제
  - 반환: `{ success: boolean; error?: string }`

- [x] `updateLinkRelation(linkId: string, relation: string)` ✅
  - 관계 수정 (아버지/어머니/보호자)
  - 반환: `{ success: boolean; error?: string }`

#### 권한 체크

- 모든 함수에서 `getCurrentUserRole()`로 관리자 권한 확인
- `role !== "admin" && role !== "consultant"`인 경우 에러 반환

#### 에러 처리

- Supabase 에러 처리
- 중복 연결 시도 시 적절한 메시지
- 존재하지 않는 ID 처리

---

### 1.2 ParentLinksSection 컴포넌트 작성 ✅

**파일**: `app/(admin)/admin/students/[id]/_components/ParentLinksSection.tsx` ✅ 완료

#### 컴포넌트 구조

```typescript
export function ParentLinksSection({ studentId }: { studentId: string }) {
  // 상태 관리
  // - 연결된 학부모 목록
  // - 검색 모달 열림/닫힘
  // - 로딩 상태
  // 기능
  // - 연결된 학부모 목록 표시
  // - 학부모 추가 버튼
  // - 학부모 검색 모달
  // - 연결 해제 기능
  // - 관계 수정 기능
}
```

#### UI 구성

1. **연결된 학부모 목록** ✅

   - 카드 형태로 표시
   - 학부모 이름, 이메일, 관계 표시
   - 관계 수정 버튼 (드롭다운)
   - 연결 해제 버튼

2. **학부모 추가 버튼** ✅

   - "학부모 추가" 버튼
   - 클릭 시 검색 모달 열림

3. **학부모 검색 모달** ✅
   - 검색 입력 필드
   - 검색 결과 목록
   - 관계 선택 (아버지/어머니/보호자)
   - 연결 버튼

#### 스타일링

- Tailwind CSS 사용 ✅
- 기존 컴포넌트 스타일과 일관성 유지 ✅
- 반응형 디자인 ✅

#### 개선 사항 (2025-01-31)

- `handleRefresh` 콜백을 `ParentSearchModal`과 `ParentCard`에 전달하여 로컬 상태 업데이트로 최적화
- `router.refresh()` 대신 콜백 패턴 사용으로 성능 개선

---

### 1.3 학생 상세 페이지에 통합 ✅

**파일**: `app/(admin)/admin/students/[id]/page.tsx` ✅ 완료

#### 변경 사항

- [x] `ParentLinksSection` import ✅
- [x] BasicInfoSection 아래에 `ParentLinksSection` 추가 ✅
- [x] Suspense로 감싸기 (로딩 상태 처리) ✅

#### 위치

```tsx
<TabContent tab="basic">
  <BasicInfoSection student={student} isAdmin={role === "admin"} />
  <Suspense fallback={<ParentLinksSectionSkeleton />}>
    <ParentLinksSection studentId={studentId} />
  </Suspense>
</TabContent>
```

---

### 1.4 학부모 검색 기능 ✅

**파일**: `app/(admin)/admin/students/[id]/_components/ParentSearchModal.tsx` ✅ 완료

#### 기능

- [x] 검색 입력 필드 (이름 또는 이메일) ✅
- [x] 실시간 검색 (debounce 적용) ✅
- [x] 검색 결과 목록 표시 ✅
- [x] 관계 선택 드롭다운 ✅
- [x] 연결 버튼 ✅
- [x] 이미 연결된 학부모 필터링 ✅

#### 검색 로직

- 최소 2글자 이상 입력 시 검색 실행 ✅
- debounce: 300ms ✅
- 검색 결과 최대 10개 표시 ✅

#### 개선 사항 (2025-01-31)

- `onSuccess` 콜백 prop 추가
- 연결 성공 시 `router.refresh()` 대신 `onSuccess()` 호출로 로컬 상태 업데이트

---

## Phase 2: 자체 연결 요청 기능

### 2.1 연결 요청 Server Actions

**파일**: `app/(parent)/actions/parentStudentLinkRequestActions.ts` (신규)

#### 구현할 함수들

- [x] `searchStudentsForLink(query: string, parentId: string)` ✅

  - 학생 검색 (이름, 학년, 반)
  - 이미 연결된 학생 제외
  - 반환 타입: `{ id: string; name: string | null; grade: string | null; class: string | null }[]`

- [x] `createLinkRequest(studentId: string, parentId: string, relation: string)` ✅

  - 연결 요청 생성
  - `is_approved: false`로 설정
  - 중복 요청 체크
  - 반환: `{ success: boolean; error?: string; requestId?: string }`

- [x] `getLinkRequests(parentId: string)` ✅

  - 학부모의 연결 요청 목록 조회
  - 반환 타입: `{ id: string; studentId: string; studentName: string | null; relation: string; is_approved: boolean | null; created_at: string }[]`

- [x] `cancelLinkRequest(requestId: string, parentId: string)` ✅
  - 연결 요청 취소
  - 반환: `{ success: boolean; error?: string }`

#### 권한 체크

- `getCurrentUserRole()`로 학부모 권한 확인
- 본인의 요청만 조회/취소 가능

---

### 2.2 학생 검색 컴포넌트

**파일**: `app/(parent)/parent/settings/_components/StudentSearchModal.tsx` (신규)

#### 기능

- [x] 검색 입력 필드 (이름, 학년, 반) ✅
- [x] 실시간 검색 (debounce 적용) ✅
- [x] 검색 결과 목록 표시 ✅
- [x] 관계 선택 드롭다운 ✅
- [x] 연결 요청 버튼 ✅
- [x] 이미 연결된 학생 필터링 ✅

#### 검색 로직

- 최소 2글자 이상 입력 시 검색 실행
- debounce: 300ms
- 검색 결과 최대 10개 표시

---

### 2.3 학부모 설정 페이지에 통합

**파일**: `app/(parent)/parent/settings/page.tsx` 수정

#### 변경 사항

- [x] `StudentSearchModal` import ✅
- [x] "학생 연결 요청" 버튼 추가 ✅
- [x] 연결 요청 목록 표시 섹션 추가 ✅
- [x] 요청 상태 표시 (대기 중/승인됨/거부됨) ✅

#### 위치

```tsx
{
  /* 연결된 자녀 */
}
<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
  <div className="mb-4 flex items-center justify-between">
    <h2 className="text-lg font-semibold text-gray-900">연결된 자녀</h2>
    <button onClick={openSearchModal}>학생 연결 요청</button>
  </div>
  {/* 기존 연결된 자녀 목록 */}
  {/* 새로 추가: 연결 요청 목록 */}
</div>;
```

---

### 2.4 요청 상태 표시

**컴포넌트**: `app/(parent)/parent/settings/_components/LinkRequestList.tsx` (신규)

#### 기능

- [x] 연결 요청 목록 표시 ✅
- [x] 요청 상태 배지 (대기 중/승인됨/거부됨) ✅
- [x] 요청 취소 버튼 (대기 중인 경우만) ✅
- [x] 승인된 요청은 연결된 자녀 목록으로 이동 ✅

---

## Phase 3: 승인 프로세스 및 자동 연결

### 3.1 승인 프로세스 구현

**파일**: `app/(admin)/actions/parentStudentLinkActions.ts` 수정

#### 추가 함수

- [ ] `approveLinkRequest(linkId: string)`

  - 연결 요청 승인
  - `is_approved: true`, `approved_at: now()` 설정
  - 반환: `{ success: boolean; error?: string }`

- [ ] `rejectLinkRequest(linkId: string)`

  - 연결 요청 거부
  - 연결 삭제 또는 `is_approved: false` 설정
  - 반환: `{ success: boolean; error?: string }`

- [ ] `getPendingLinkRequests(tenantId?: string)`
  - 승인 대기 중인 연결 요청 목록 조회
  - 반환 타입: `{ id: string; studentId: string; studentName: string | null; parentId: string; parentName: string | null; relation: string; created_at: string }[]`

---

### 3.2 관리자 승인 UI

**파일**: `app/(admin)/admin/parent-links/page.tsx` (신규)

#### 기능

- [ ] 승인 대기 중인 연결 요청 목록 표시
- [ ] 학생 정보, 학부모 정보, 관계 표시
- [ ] 승인/거부 버튼
- [ ] 일괄 승인 기능 (선택사항)

#### UI 구성

- 테이블 형태로 요청 목록 표시
- 각 요청에 승인/거부 버튼
- 승인/거부 후 목록 자동 갱신

---

### 3.3 자동 승인 옵션

**설정**: 관리자 설정 페이지 또는 환경 변수

#### 옵션

- [ ] 자동 승인 활성화/비활성화
- [ ] 자동 승인 조건 설정
  - 같은 테넌트 내에서만
  - 특정 관계만 (예: 아버지/어머니만)

#### 구현

- `createLinkRequest`에서 자동 승인 옵션 확인
- 조건 만족 시 자동으로 `is_approved: true` 설정

---

## 데이터베이스 스키마 확인

### 확인 필요 사항

- [ ] `parent_student_links` 테이블 실제 필드 확인

  - `relation` vs `relationship` 필드명 확인
  - `is_approved`, `is_primary` 필드 존재 여부
  - `tenant_id` 필드 존재 여부

- [ ] RLS 정책 확인

  - 관리자가 연결 생성/삭제 가능한지
  - 학부모가 연결 요청 생성 가능한지

- [ ] 인덱스 확인
  - `student_id`, `parent_id` 인덱스 존재 여부
  - 검색 성능 최적화 필요 여부

### 마이그레이션 필요 시

- [ ] `is_approved` 필드가 없으면 추가
- [ ] `approved_at` 필드가 없으면 추가
- [ ] `relation` 필드가 없으면 추가 (또는 `relationship` 사용)
- [ ] 인덱스 추가 (필요 시)

---

## 테스트 계획

### Phase 1 테스트

- [ ] 관리자가 학생 상세 페이지에서 학부모 목록 조회
- [ ] 관리자가 학부모 검색 및 연결 생성
- [ ] 관리자가 연결 해제
- [ ] 관리자가 관계 수정
- [ ] 중복 연결 시도 시 에러 처리
- [ ] 권한 없는 사용자 접근 차단

### Phase 2 테스트

- [ ] 학부모가 학생 검색
- [ ] 학부모가 연결 요청 생성
- [ ] 학부모가 연결 요청 목록 조회
- [ ] 학부모가 연결 요청 취소
- [ ] 중복 요청 시도 시 에러 처리
- [ ] 권한 없는 사용자 접근 차단

### Phase 3 테스트

- [ ] 관리자가 연결 요청 승인
- [ ] 관리자가 연결 요청 거부
- [ ] 승인 후 학부모 대시보드에 학생 표시
- [ ] 자동 승인 기능 동작 확인

### 통합 테스트

- [ ] 전체 플로우 테스트
  1. 학부모가 연결 요청 생성
  2. 관리자가 요청 승인
  3. 학부모 대시보드에서 학생 확인
- [ ] 에러 케이스 테스트
- [ ] 성능 테스트 (대량 데이터)

---

## 구현 순서

### 1단계: 데이터베이스 스키마 확인 및 준비

1. [ ] `parent_student_links` 테이블 스키마 확인
2. [ ] 필요한 필드 추가 (마이그레이션)
3. [ ] RLS 정책 확인 및 수정
4. [ ] 인덱스 추가 (필요 시)

### 2단계: Phase 1 구현

1. [ ] Server Actions 작성 (`parentStudentLinkActions.ts`)
2. [ ] `ParentLinksSection` 컴포넌트 작성
3. [ ] `ParentSearchModal` 컴포넌트 작성
4. [ ] 학생 상세 페이지에 통합
5. [ ] 테스트

### 3단계: Phase 2 구현

1. [ ] Server Actions 작성 (`parentStudentLinkRequestActions.ts`)
2. [ ] `StudentSearchModal` 컴포넌트 작성
3. [ ] `LinkRequestList` 컴포넌트 작성
4. [ ] 학부모 설정 페이지에 통합
5. [ ] 테스트

### 4단계: Phase 3 구현

1. [ ] 승인 프로세스 Server Actions 추가
2. [ ] 관리자 승인 UI 작성
3. [ ] 자동 승인 옵션 구현
4. [ ] 테스트

### 5단계: 최종 검증

1. [ ] 전체 플로우 통합 테스트
2. [ ] 에러 처리 검증
3. [ ] 성능 검증
4. [ ] 문서화

---

## 참고 사항

### 기존 코드 참고

- `app/(parent)/_utils.ts`: `getLinkedStudents`, `canAccessStudent`
- `app/(parent)/parent/settings/page.tsx`: 학부모 설정 페이지 구조
- `app/(admin)/admin/students/[id]/_components/BasicInfoSection.tsx`: 컴포넌트 스타일 참고
- `app/(admin)/actions/studentManagementActions.ts`: Server Actions 패턴 참고

### 주의사항

1. **테이블명 불일치**

   - ERD: `student_parent_links`
   - 실제 코드: `parent_student_links`
   - 실제 사용 중인 테이블명 확인 필요

2. **필드명 불일치**

   - ERD: `relationship`
   - 실제 코드: `relation`
   - 실제 사용 중인 필드명 확인 필요

3. **RLS 정책**

   - 관리자 권한으로 연결 생성/삭제 가능한지 확인
   - 학부모가 연결 요청 생성 가능한지 확인

4. **타입 안전성**
   - `any` 타입 사용 금지
   - 명시적 타입 정의
   - null 체크 필수

---

## 문서화

### 구현 완료 후 작성할 문서

- [ ] API 문서 (Server Actions 함수 설명)
- [ ] 컴포넌트 사용 가이드
- [ ] 관리자 매뉴얼 (연결 관리 방법)
- [ ] 학부모 매뉴얼 (연결 요청 방법)

---

---

## Phase 1 완료 요약 (2025-01-31)

### 구현 완료 항목

1. ✅ **Server Actions** (`parentStudentLinkActions.ts`)

   - `getStudentParents` - 학생에 연결된 학부모 목록 조회
   - `searchParents` - 학부모 검색 (이름, 이메일)
   - `createParentStudentLink` - 학생-학부모 연결 생성
   - `deleteParentStudentLink` - 연결 삭제
   - `updateLinkRelation` - 관계 수정

2. ✅ **컴포넌트 구현**

   - `ParentLinksSection` - 연결된 학부모 목록 표시 및 관리
   - `ParentCard` - 개별 학부모 카드 (관계 수정, 연결 해제)
   - `ParentSearchModal` - 학부모 검색 및 연결 모달
   - `ParentLinksSectionSkeleton` - 로딩 스켈레톤

3. ✅ **학생 상세 페이지 통합**

   - BasicInfoSection 아래에 ParentLinksSection 추가
   - Suspense로 로딩 상태 처리

4. ✅ **성능 최적화 (2025-01-31)**
   - `router.refresh()` 대신 콜백 패턴으로 로컬 상태 업데이트
   - 불필요한 전체 페이지 새로고침 제거

### 개선 사항

- 컴포넌트 간 데이터 동기화를 콜백 패턴으로 개선
- 다른 관리자 컴포넌트들과 일관된 패턴 적용
- 타입 안전성 유지 (optional props)

---

---

## Phase 2 완료 요약 (2025-01-31)

### 구현 완료 항목

1. ✅ **Server Actions** (`parentStudentLinkRequestActions.ts`)

   - `searchStudentsForLink` - 학생 검색 (이름, 학년, 반)
   - `createLinkRequest` - 연결 요청 생성 (`is_approved: false`)
   - `getLinkRequests` - 학부모의 연결 요청 목록 조회
   - `cancelLinkRequest` - 대기 중인 연결 요청 취소

2. ✅ **컴포넌트 구현**

   - `StudentSearchModal` - 학생 검색 및 연결 요청 모달
   - `LinkRequestList` - 연결 요청 목록 표시 및 취소
   - `LinkedStudentsSection` - 연결된 자녀 및 요청 목록 통합 컴포넌트

3. ✅ **학부모 설정 페이지 통합**

   - LinkedStudentsSection 컴포넌트 추가
   - "학생 연결 요청" 버튼 추가
   - 연결 요청 목록 섹션 추가
   - 기존 플레이스홀더 제거

4. ✅ **RLS 정책 추가**

   - `parent_student_links_insert_own` - 학부모가 자신의 연결 요청 생성 가능
   - `parent_student_links_select_own` - 학부모가 자신의 연결 요청 조회 가능
   - `parent_student_links_delete_own` - 학부모가 자신의 대기 중인 요청 취소 가능
   - 마이그레이션 파일: `20250131000000_add_parent_student_links_insert_policy.sql`

5. ✅ **에러 처리 및 권한 검증**

   - 모든 Server Actions에서 학부모 권한 확인
   - 본인 요청만 조회/취소 가능하도록 검증
   - 중복 요청 체크
   - 적절한 에러 메시지 반환

### 개선 사항

- Phase 1과 동일한 패턴 적용 (콜백 기반 상태 업데이트)
- 로컬 상태 관리로 불필요한 페이지 새로고침 방지
- 타입 안전성 유지 (명시적 타입 정의)
- 검색 최적화 (debounce, 서버 사이드 필터링)

### 다음 단계

Phase 2 구현이 완료되었습니다. 다음 단계는:

1. **수동 테스트 수행**: 실제 환경에서 기능 검증
2. **Phase 3 준비**: 승인 프로세스 및 관리자 승인 UI 구현

---

**마지막 업데이트**: 2025-01-31
