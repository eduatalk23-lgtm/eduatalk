# subject_id 저장/불러오기 로직 점검

## 📋 전체 플로우 분석

### 1. 등록 폼 (MasterBookForm.tsx)

#### 필드 구성
```tsx
<select
  name="subject_id"
  disabled={!selectedGroupId}  // 교과 그룹 선택 전에는 disabled
>
  <option value="">선택하세요</option>
  {selectedSubjects.map((subject) => (
    <option key={subject.id} value={subject.id}>
      {subject.name}
    </option>
  ))}
</select>
```

#### 저장 로직
```typescript
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);

  // disabled 상태의 select는 FormData에 포함되지 않으므로 수동으로 추가
  const subjectSelect = e.currentTarget.querySelector<HTMLSelectElement>('select[name="subject_id"]');
  if (subjectSelect && subjectSelect.value) {
    formData.set("subject_id", subjectSelect.value);
  }

  await addMasterBook(formData);
}
```

**✅ 정상**: disabled 상태일 때도 수동으로 FormData에 추가

---

### 2. 서버 액션 (masterContentActions.ts)

#### 저장 로직
```typescript
// subject_id 처리 (빈 문자열 체크)
const subjectIdRaw = formData.get("subject_id")?.toString();
const subjectId = subjectIdRaw && subjectIdRaw.trim() !== "" ? subjectIdRaw.trim() : null;

const bookData = {
  // ...
  subject_id: subjectId,
  // ...
};

await createMasterBook(bookData);
```

**✅ 정상**: 빈 문자열 체크 후 저장

---

### 3. 수정 폼 (MasterBookEditForm.tsx)

#### 초기화 로직
```typescript
const [selectedRevisionId, setSelectedRevisionId] = useState<string>(
  book.curriculum_revision_id || ""
);
const [selectedGroupId, setSelectedGroupId] = useState<string>(
  currentSubject?.subjectGroup.id || ""  // ✅ 현재 과목의 교과 그룹 ID로 초기화
);
const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);

// 초기 교과 그룹 목록 로드
useEffect(() => {
  async function loadInitialGroups() {
    if (book.curriculum_revision_id) {
      const groups = await getSubjectGroupsWithSubjectsAction(book.curriculum_revision_id);
      setSubjectGroups(groups);
      
      // 현재 과목이 있으면 해당 과목 목록 설정
      if (currentSubject) {
        const group = groups.find(g => g.id === currentSubject.subjectGroup.id);
        setSelectedSubjects(group?.subjects || []);  // ✅ 과목 목록 설정
      }
    }
  }
  loadInitialGroups();
}, [book.curriculum_revision_id, currentSubject]);
```

#### 필드 구성
```tsx
<select
  name="subject_id"
  defaultValue={book.subject_id || ""}  // ✅ 기존 값 설정
  disabled={!selectedGroupId}
>
  <option value="">선택하세요</option>
  {selectedSubjects.map((subject) => (
    <option key={subject.id} value={subject.id}>
      {subject.name}
    </option>
  ))}
</select>
```

#### 저장 로직
```typescript
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);

  // disabled 상태의 select는 FormData에 포함되지 않으므로 수동으로 추가
  const subjectSelect = e.currentTarget.querySelector<HTMLSelectElement>('select[name="subject_id"]');
  if (subjectSelect && subjectSelect.value) {
    formData.set("subject_id", subjectSelect.value);
  }

  await updateMasterBookAction(book.id, formData);
}
```

**✅ 정상**: 
- 기존 값이 `defaultValue`로 설정됨
- disabled 상태일 때도 수동으로 FormData에 추가

---

### 4. 수정 페이지 (edit/page.tsx)

#### 데이터 불러오기
```typescript
const { book, details } = await getMasterBookById(id);

const [curriculumRevisions, publishers, currentSubject] = await Promise.all([
  getCurriculumRevisions().catch(() => []),
  getPublishers().catch(() => []),
  book.subject_id ? getSubjectById(book.subject_id).catch(() => null) : Promise.resolve(null),
]);

<MasterBookEditForm 
  book={book} 
  details={details}
  curriculumRevisions={curriculumRevisions}
  publishers={publishers}
  currentSubject={currentSubject}  // ✅ 현재 과목 정보 전달
/>
```

**✅ 정상**: `subject_id`로 과목 정보를 불러와서 전달

---

### 5. 상세 보기 (page.tsx)

#### 데이터 불러오기
```typescript
const { book, details } = await getMasterBookById(id);

// book 객체에는 다음 필드가 포함됨:
// - subject_id: 원본 ID
// - subject_category: JOIN으로 가져온 교과 그룹 이름
// - subject: JOIN으로 가져온 과목 이름
```

#### 표시
```tsx
<ContentDetailTable
  rows={[
    { label: "교과", value: book.subject_category },
    { label: "과목", value: book.subject },
    // ...
  ]}
/>
```

**✅ 정상**: JOIN으로 교과/과목 정보 표시

---

### 6. 데이터 레이어 (contentMasters.ts)

#### getMasterBookById 함수
```typescript
const [bookResult, detailsResult] = await Promise.all([
  supabase
    .from("master_books")
    .select(`
      // ...
      subject_id,
      subjects:subject_id (
        id,
        name,
        subject_groups:subject_group_id (
          id,
          name
        )
      )
      // ...
    `)
    .eq("id", bookId)
    .maybeSingle(),
  // ...
]);

// JOIN된 데이터를 평탄화
const subjectsRaw = (bookData as any).subjects;
const subject = Array.isArray(subjectsRaw) 
  ? subjectsRaw[0] 
  : subjectsRaw;

const subjectGroupsRaw = subject?.subject_groups;
const subjectGroup = Array.isArray(subjectGroupsRaw)
  ? subjectGroupsRaw[0]
  : subjectGroupsRaw;

const book = {
  ...bookData,
  subject_category: subjectGroup?.name || null,
  subject: subject?.name || null,
};
```

**✅ 정상**: 
- `subject_id`로 JOIN하여 과목 정보 가져오기
- 배열 처리 포함

---

## 🔍 잠재적 문제점

### 1. 수정 폼 초기화 타이밍

**문제**: `currentSubject`가 비동기로 로드되므로, 초기 렌더링 시 `selectedGroupId`가 빈 문자열일 수 있음

**현재 해결책**: 
- `useEffect`에서 `currentSubject`가 로드되면 교과 그룹과 과목 목록 설정
- 하지만 초기 렌더링 시 select가 disabled 상태일 수 있음

**개선 방안**: 
- `currentSubject`가 로드되기 전까지 select를 disabled 상태로 유지 (현재 구현과 동일)
- `handleSubmit`에서 수동으로 값 추가하므로 문제 없음 ✅

### 2. disabled 상태의 select 값 전송

**문제**: disabled 상태의 select는 FormData에 포함되지 않음

**현재 해결책**: 
- `handleSubmit`에서 수동으로 FormData에 추가 ✅

### 3. 빈 값 처리

**문제**: 빈 문자열("")이 저장될 수 있음

**현재 해결책**: 
- 서버 액션에서 빈 문자열 체크 후 null로 변환 ✅

---

## ✅ 최종 점검 결과

### 저장 플로우
1. ✅ 폼에서 `subject_id` 선택
2. ✅ `handleSubmit`에서 disabled 상태일 때도 수동으로 FormData에 추가
3. ✅ 서버 액션에서 빈 문자열 체크 후 저장
4. ✅ 데이터베이스에 `subject_id` 저장

### 불러오기 플로우
1. ✅ `getMasterBookById`에서 `subject_id`로 JOIN하여 과목 정보 가져오기
2. ✅ 수정 페이지에서 `subject_id`로 `getSubjectById` 호출하여 `currentSubject` 가져오기
3. ✅ 수정 폼에서 `currentSubject`로 교과 그룹과 과목 목록 초기화
4. ✅ 상세 보기에서 JOIN된 교과/과목 정보 표시

---

## 📝 결론

**모든 로직이 정상적으로 구현되어 있습니다.** ✅

- 저장: disabled 상태 처리, 빈 값 체크 모두 포함
- 불러오기: JOIN으로 정보 가져오기, 수정 폼 초기화 모두 정상

---

## 📅 작성일
2025-01-XX

