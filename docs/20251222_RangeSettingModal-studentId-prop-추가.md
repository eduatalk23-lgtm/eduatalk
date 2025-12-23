# RangeSettingModal studentId prop 추가

## 📋 작업 개요

관리자/컨설턴트가 학생 페이지에 접근하여 콘텐츠 범위를 설정할 때 발생하는 400 에러를 해결하기 위해 `RangeSettingModal`에 `studentId` prop을 추가했습니다.

## 🐛 문제 상황

### 에러 메시지

```
errorMessage: "관리자/컨설턴트의 경우 student_id가 필요합니다."
status: 400 (Bad Request)
```

### 원인 분석

1. **API 요구사항**: `/api/student-content-details` API는 관리자/컨설턴트가 호출할 때 `student_id` 파라미터를 필수로 요구
2. **현재 구현**: `RangeSettingModal`에서 API 호출 시 `student_id`를 전달하지 않음
3. **사용 시나리오**: 관리자가 학생 대신 플랜을 생성하거나 특정 학생의 콘텐츠를 조회할 때 발생

### API 라우트 코드

```typescript
// app/api/student-content-details/route.ts
if ((role === "admin" || role === "consultant") && !studentId) {
  return apiBadRequest("관리자/컨설턴트의 경우 student_id가 필요합니다.");
}
```

## ✅ 해결 방법

### 1. RangeSettingModal에 studentId prop 추가

**타입 정의** (`lib/types/content-selection.ts`):

```typescript
export type RangeSettingModalProps = {
  // ... 기존 props
  // 학생 ID (관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 필요)
  studentId?: string | null;
};
```

**컴포넌트 수정** (`RangeSettingModal.tsx`):

```typescript
export function RangeSettingModal({
  // ... 기존 props
  studentId = null,
}: RangeSettingModalProps) {
  // ...
  
  // API 호출 시 studentId 전달
  const params = new URLSearchParams({
    contentType: content.type,
    contentId: content.id,
  });
  
  // 관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 student_id 전달
  if (studentId) {
    params.append("student_id", studentId);
  }
  
  const url = `${apiPath}?${params.toString()}`;
  // ...
}
```

### 2. StudentContentsPanel에 studentId prop 추가

**타입 정의** (`lib/types/content-selection.ts`):

```typescript
export type StudentContentsPanelProps = {
  // ... 기존 props
  // 학생 ID (관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 필요)
  studentId?: string | null;
};
```

**컴포넌트 수정** (`StudentContentsPanel.tsx`):

```typescript
export function StudentContentsPanel({
  // ... 기존 props
  studentId = null,
}: StudentContentsPanelProps) {
  // ...
  
  <RangeSettingModal
    // ... 기존 props
    studentId={studentId}
  />
}
```

### 3. Step3ContentSelection에서 studentId 전달

**수정** (`Step3ContentSelection.tsx`):

```typescript
<StudentContentsPanel
  contents={contents}
  selectedContents={data.student_contents}
  maxContents={maxContents}
  currentTotal={currentTotal}
  onUpdate={handleStudentContentsUpdate}
  editable={editable}
  isCampMode={isCampMode}
  studentId={studentId}  // 추가
/>
```

### 4. useEffect 의존성 배열 업데이트

**수정** (`RangeSettingModal.tsx`):

```typescript
useEffect(() => {
  // ...
  fetchDetails();
}, [open, content.id, content.type, isRecommendedContent, studentId]); // studentId 추가
```

## 📁 수정된 파일

- `lib/types/content-selection.ts` - 타입 정의 추가
- `app/(student)/plan/new-group/_components/_features/content-selection/components/RangeSettingModal.tsx` - studentId prop 추가 및 API 호출 시 전달
- `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx` - studentId prop 추가 및 RangeSettingModal에 전달
- `app/(student)/plan/new-group/_components/_features/content-selection/Step3ContentSelection.tsx` - StudentContentsPanel에 studentId 전달

## 🎯 기대 효과

1. **관리자/컨설턴트 접근 지원**: 관리자가 특정 학생의 콘텐츠 범위를 설정할 수 있음
2. **API 호출 오류 해결**: 400 Bad Request 에러 해결
3. **유연한 사용**: 학생이 직접 사용할 때는 studentId가 없어도 자동으로 현재 사용자 ID 사용

## 🔍 동작 방식

### 학생이 직접 사용하는 경우

```typescript
<RangeSettingModal
  content={content}
  // studentId 없음 → API에서 자동으로 현재 로그인한 학생의 ID 사용
/>
```

### 관리자가 특정 학생의 콘텐츠를 조회하는 경우

```typescript
<RangeSettingModal
  content={content}
  studentId="student-uuid"  // 관리자가 조회할 학생의 ID
/>
```

## 📝 참고 사항

- `studentId`는 선택적 prop이므로 기존 코드와의 호환성 유지
- 학생이 직접 사용할 때는 `studentId`가 없어도 API에서 자동으로 현재 사용자 ID를 사용
- 관리자/컨설턴트가 사용할 때만 `studentId`를 명시적으로 전달해야 함

---

**작업 일시**: 2025-12-22  
**작업자**: AI Assistant


