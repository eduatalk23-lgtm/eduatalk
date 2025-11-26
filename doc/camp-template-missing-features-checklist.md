# 캠프 템플릿 누락 기능 점검 및 개선 체크리스트

## 📋 발견된 누락 사항

### 1. 프로그램 유형(program_type) 입력 필드 누락 ⚠️
- **현재 상태**: 
  - 생성 시: 하드코딩된 "기타" 사용
  - 수정 시: 기존 값 사용 (변경 불가)
- **요구사항**: 윈터캠프, 썸머캠프, 파이널캠프, 기타 중 선택 가능
- **영향 파일**: 
  - `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
  - `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

### 2. 설명(description) 입력 필드 누락 ⚠️
- **현재 상태**: 빈 문자열로 하드코딩
- **요구사항**: 템플릿 설명을 입력할 수 있어야 함
- **영향 파일**: 
  - `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
  - `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

### 3. 상태(status) 입력 필드 누락 ⚠️
- **현재 상태**: 
  - 생성 시: 기본값 "draft" 사용
  - 수정 시: 기존 값 사용 (변경 불가)
- **요구사항**: draft, active, archived 중 선택 가능
- **영향 파일**: 
  - `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`
  - `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

### 4. 프로그램 유형 필터 누락
- **현재 상태**: 상태 필터만 있음
- **요구사항**: 프로그램 유형별 필터링 기능
- **영향 파일**: `app/(admin)/admin/camp-templates/page.tsx`

## ✅ 개선 체크리스트

### Phase 1: 템플릿 생성 폼 개선
- [ ] 프로그램 유형 선택 필드 추가 (윈터캠프, 썸머캠프, 파이널캠프, 기타)
- [ ] 설명 입력 필드 추가 (textarea)
- [ ] 상태 선택 필드 추가 (draft, active, archived) - 기본값: draft

### Phase 2: 템플릿 수정 폼 개선
- [ ] 프로그램 유형 선택 필드 추가 (기존 값 표시, 수정 가능)
- [ ] 설명 입력 필드 추가 (기존 값 표시, 수정 가능)
- [ ] 상태 선택 필드 추가 (기존 값 표시, 수정 가능)

### Phase 3: 템플릿 목록 페이지 개선
- [ ] 프로그램 유형 필터 추가
- [ ] 프로그램 유형별 검색 기능 개선

### Phase 4: UI/UX 개선
- [ ] 입력 필드 검증 추가
- [ ] 필수 필드 표시 (프로그램 유형은 필수)
- [ ] 폼 레이아웃 개선

## 🔧 구현 세부사항

### 1. 프로그램 유형 선택 필드
```typescript
// CampTemplateForm.tsx & CampTemplateEditForm.tsx
const programTypes = [
  { value: "윈터캠프", label: "윈터캠프" },
  { value: "썸머캠프", label: "썸머캠프" },
  { value: "파이널캠프", label: "파이널캠프" },
  { value: "기타", label: "기타" },
] as const;

<select
  name="program_type"
  value={programType}
  onChange={(e) => setProgramType(e.target.value)}
  required
>
  {programTypes.map((type) => (
    <option key={type.value} value={type.value}>
      {type.label}
    </option>
  ))}
</select>
```

### 2. 설명 입력 필드
```typescript
<textarea
  name="description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  placeholder="템플릿에 대한 설명을 입력하세요."
  rows={3}
  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
/>
```

### 3. 상태 선택 필드
```typescript
const statuses = [
  { value: "draft", label: "초안" },
  { value: "active", label: "활성" },
  { value: "archived", label: "보관" },
] as const;

<select
  name="status"
  value={status}
  onChange={(e) => setStatus(e.target.value)}
>
  {statuses.map((s) => (
    <option key={s.value} value={s.value}>
      {s.label}
    </option>
  ))}
</select>
```

### 4. 프로그램 유형 필터
```typescript
// page.tsx
const programTypeFilter = params.program_type || "";

<select
  name="program_type"
  defaultValue={programTypeFilter || ""}
>
  <option value="">전체</option>
  <option value="윈터캠프">윈터캠프</option>
  <option value="썸머캠프">썸머캠프</option>
  <option value="파이널캠프">파이널캠프</option>
  <option value="기타">기타</option>
</select>
```

## 📝 추가 점검 사항

### 데이터베이스
- [x] `program_type` 필드 존재 및 제약 조건 확인 완료
- [x] `description` 필드 존재 확인 완료
- [x] `status` 필드 존재 및 제약 조건 확인 완료

### 액션 함수
- [x] `createCampTemplateAction`에서 `program_type` 검증 확인 완료
- [x] `updateCampTemplateAction`에서 `program_type`, `status` 검증 확인 완료
- [ ] `description` 검증 확인 필요 (길이 제한 등)

### UI 컴포넌트
- [ ] 템플릿 생성 폼에 입력 필드 추가
- [ ] 템플릿 수정 폼에 입력 필드 추가
- [ ] 템플릿 목록에 프로그램 유형 필터 추가

## ✅ 완료된 작업

### Phase 1: 템플릿 생성 폼 개선
- [x] 프로그램 유형 선택 필드 추가 (윈터캠프, 썸머캠프, 파이널캠프, 기타)
- [x] 설명 입력 필드 추가 (textarea)
- [x] 상태 선택 필드 추가 (draft, active, archived) - 기본값: draft

### Phase 2: 템플릿 수정 폼 개선
- [x] 프로그램 유형 선택 필드 추가 (기존 값 표시, 수정 가능)
- [x] 설명 입력 필드 추가 (기존 값 표시, 수정 가능)
- [x] 상태 선택 필드 추가 (기존 값 표시, 수정 가능)

### Phase 3: 템플릿 목록 페이지 개선
- [x] 프로그램 유형 필터 추가

## 🎯 추가 점검 사항

### 학생 초대 거절 기능
- [ ] 학생이 초대를 거절할 수 있는 기능 (UI에 거절 버튼 없음)
- [ ] 거절 사유 입력 (선택사항)
- [ ] 거절 후 재참여 가능 여부 확인
- **참고**: `updateCampInvitationStatus` 함수는 존재하지만 UI에서 사용되지 않음

### 입력 필드 검증
- [ ] description 길이 제한 검증 (선택사항이지만 길이 제한 필요할 수 있음)
- [ ] 클라이언트 사이드 검증 추가

### 기타 개선 사항
- [ ] 템플릿 생성 성공 후 리다이렉트 (현재는 에러만 처리)
- [ ] 템플릿 수정 시 변경사항 저장 확인 다이얼로그
- [ ] 템플릿 복사 기능 (체크리스트에 있음)

## 🎯 우선순위

### 높은 우선순위 (즉시 구현)
1. ✅ 프로그램 유형 선택 필드 추가 (생성/수정 폼) - 완료
2. ✅ 설명 입력 필드 추가 (생성/수정 폼) - 완료
3. ✅ 상태 선택 필드 추가 (생성/수정 폼) - 완료
4. ✅ 프로그램 유형 필터 추가 (목록 페이지) - 완료

### 중간 우선순위
1. 학생 초대 거절 기능 추가
2. 입력 필드 검증 강화 (description 길이 제한 등)

### 낮은 우선순위
1. UI/UX 개선 (레이아웃, 스타일링)
2. 템플릿 복사 기능

