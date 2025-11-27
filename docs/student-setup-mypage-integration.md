# student-setup 마이페이지 통합

## 작업 개요

회원가입 후 나오는 `student-setup` 페이지를 제거하고, 모든 초기 설정을 마이페이지(`/settings`)에서 처리하도록 통합했습니다.

## 변경 사항

### 1. 리다이렉트 경로 변경

**파일**: `app/page.tsx`

- role이 null일 때 `/student-setup` → `/settings`로 리다이렉트 변경
- 회원가입 후 자동으로 마이페이지로 이동하여 초기 설정 진행

### 2. student-setup 페이지 제거

**삭제된 파일**:
- `app/student-setup/page.tsx` - 학생 정보 초기 설정 페이지
- `app/actions/student.ts` - re-export 파일 (더 이상 필요 없음)

### 3. 마이페이지에 초기 설정 모드 추가

**파일**: `app/(student)/settings/page.tsx`

#### 초기 설정 모드 감지

- `isInitialSetup` 상태 추가: 학생 정보가 없을 때 (`student === null`) 자동 감지
- 초기 설정 모드와 일반 모드를 구분하여 다른 UI/UX 제공

#### 환영 메시지 및 단계별 가이드 UI

초기 설정 모드일 때 다음 UI가 표시됩니다:

1. **환영 메시지 섹션**
   - "환영합니다! 🎉" 제목
   - "먼저 기본 정보를 입력해주세요" 안내 메시지

2. **진행 단계 표시**
   - 현재 진행 단계 표시 (예: 1/3)
   - 완료된 단계 수 표시
   - 진행 바 (Progress Bar)로 시각적 표시

3. **단계별 체크리스트**
   - 기본 정보 (이름, 학년, 생년월일)
   - 시험 정보 (입시년도, 개정교육과정)
   - 진로 정보 (희망 대학교, 진로 계열)
   - 각 단계 완료 시 체크 아이콘 표시

#### 필수 필드 강조

초기 설정 모드에서 필수 필드(이름, 학년, 생년월일)에 대해:

- "필수" 배지 표시
- 필드가 비어있을 때 배경색 변경 (`bg-indigo-50`)
- 테두리 색상 강조 (`border-indigo-400`)

#### 초기 설정 완료 후 리다이렉트

**파일**: `app/(student)/settings/page.tsx`, `app/(student)/actions/studentActions.ts`

- 초기 설정 모드에서 저장 성공 시 자동으로 `/dashboard`로 리다이렉트
- 일반 모드에서는 현재 페이지 유지

#### 이름 필드 기본값 설정

- 학생 정보가 없을 때 `user_metadata.display_name`을 이름 필드 기본값으로 사용
- 회원가입 시 입력한 이름이 자동으로 표시됨

## 사용자 경험 개선

### Before (기존)
1. 회원가입 → `/student-setup` 페이지
2. 간단한 폼(이름, 학년, 반, 생년월일) 입력
3. 저장 후 대시보드로 이동
4. 추가 정보는 마이페이지에서 별도로 입력

### After (개선)
1. 회원가입 → `/settings` 마이페이지
2. 환영 메시지 및 단계별 가이드 확인
3. 단계별로 정보 입력 (기본 정보 → 시험 정보 → 진로 정보)
4. 진행 상황을 시각적으로 확인
5. 저장 후 대시보드로 자동 이동

## 기술적 세부사항

### 초기 설정 모드 감지 로직

```typescript
const isInitialSetup = useMemo(() => {
  return student === null;
}, [student]);
```

### 단계별 진행 상태 계산

```typescript
const setupProgress = useMemo(() => {
  if (!isInitialSetup) return null;
  
  const steps = [
    { key: "basic", label: "기본 정보", completed: !!(formData.name && formData.grade && formData.birth_date) },
    { key: "exam", label: "시험 정보", completed: !!(formData.exam_year && formData.curriculum_revision) },
    { key: "career", label: "진로 정보", completed: !!(formData.desired_university_ids.length > 0 || formData.desired_career_field) },
  ];
  
  // 진행 상태 계산 로직...
}, [isInitialSetup, formData]);
```

### 저장 후 리다이렉트 처리

```typescript
if (result.success) {
  // ... 저장 성공 처리 ...
  
  // 초기 설정 모드에서 저장 성공 시 대시보드로 리다이렉트
  if (isInitialSetup) {
    router.push("/dashboard");
    return;
  }
  
  // 일반 모드에서는 성공 메시지 표시
  setSuccess(true);
  // ...
}
```

## 참고사항

- 기존 `saveStudentInfo` 함수는 `updateStudentProfile`로 통합되어 사용됨
- 문서 파일들(`docs/student-setup-*.md`)은 참고용으로 유지
- 초기 설정 모드에서는 변경사항이 없어도 저장 버튼이 활성화됨 (일반 모드에서는 변경사항이 있을 때만 활성화)

## 테스트 체크리스트

- [ ] 회원가입 후 마이페이지로 리다이렉트되는지 확인
- [ ] 초기 설정 모드에서 환영 메시지가 표시되는지 확인
- [ ] 단계별 진행 상태가 올바르게 표시되는지 확인
- [ ] 필수 필드 강조가 올바르게 표시되는지 확인
- [ ] 초기 설정 완료 후 대시보드로 리다이렉트되는지 확인
- [ ] 일반 모드(학생 정보가 있을 때)에서는 초기 설정 UI가 표시되지 않는지 확인
- [ ] 이름 필드에 회원가입 시 입력한 이름이 기본값으로 표시되는지 확인

