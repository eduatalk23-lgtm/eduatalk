# 콘텐츠 마스터 개선 작업

## 작업 일시
2025-02-02

## 문제점

### 1. 교재 정보 조회 문제
- **문제**: 학생 페이지의 콘텐츠 관리에서 서비스 마스터 강의에서 가져온 콘텐츠의 강의에 연결된 교재 정보가 조회되지 않음
- **원인**: 
  - 마스터 강의를 학생 강의로 복사할 때 `linked_book_id`가 복사되지 않음
  - 강의 상세 페이지에서 마스터 강의의 `linked_book_id`를 참조하지 않음

### 2. 데이터 복사 방식 개선 필요
- **문제**: 마스터 서비스에서 가져오는 콘텐츠 정보를 학생의 테이블에 복사하는 불필요한 방식
- **현재 방식**: 마스터 콘텐츠를 학생 테이블에 복사 (`copyMasterBookToStudent`, `copyMasterLectureToStudent`)
- **개선 방향**: 마스터 콘텐츠를 참조하는 방식으로 변경 (복사 대신 `master_content_id`/`master_lecture_id` 참조)

## 해결 내용

### 1. 교재 정보 조회 문제 해결 ✅

#### 1.1 `copyMasterLectureToStudent` 함수 개선
**파일**: `lib/data/contentMasters.ts`

마스터 강의를 학생 강의로 복사할 때, 연결된 마스터 교재도 함께 복사하고 학생 강의의 `linked_book_id`를 설정하도록 수정:

```typescript
// 마스터 강의에 연결된 교재가 있으면 복사하고 연결
if (lecture.linked_book_id) {
  try {
    // 마스터 교재를 학생 교재로 복사
    const { bookId: studentBookId } = await copyMasterBookToStudent(
      lecture.linked_book_id,
      studentId,
      tenantId
    );

    // 학생 강의의 linked_book_id 업데이트
    const { error: updateError } = await supabase
      .from("lectures")
      .update({ linked_book_id: studentBookId })
      .eq("id", studentLecture.id);
    // ...
  } catch (error) {
    // ...
  }
}
```

#### 1.2 강의 상세 페이지 개선
**파일**: `app/(student)/contents/lectures/[id]/page.tsx`

학생 강의에 연결된 교재가 없고, 마스터 강의에 연결된 교재가 있는 경우 마스터 교재 정보를 참조하여 표시:

```typescript
// 1. 학생 강의에 직접 연결된 교재 조회
let linkedBook: { id: string; title: string; isMaster?: boolean } | null = null;
if (lecture.linked_book_id) {
  // ...
}

// 2. 학생 강의에 연결된 교재가 없고, 마스터 강의에 연결된 교재가 있는 경우
if (!linkedBook && masterLecture?.linked_book_id) {
  try {
    const { book: masterBook } = await getMasterBookById(masterLecture.linked_book_id);
    if (masterBook) {
      linkedBook = {
        id: masterBook.id,
        title: masterBook.title,
        isMaster: true, // 마스터 교재임을 표시
      };
    }
  } catch (err) {
    // ...
  }
}
```

#### 1.3 UI 컴포넌트 개선
**파일**: `app/(student)/contents/lectures/[id]/_components/LectureLinkedBookSection.tsx`

마스터 교재인 경우:
- "마스터 교재" 배지 표시
- 마스터 교재 상세 페이지로 링크 (`/contents/master-books/${id}`)
- 연결 해제 버튼 숨김 (마스터 교재는 연결 해제 불가)
- 안내 메시지 표시

### 2. 데이터 복사 방식 개선 제안 ⚠️

현재 시스템은 마스터 콘텐츠를 학생 테이블에 복사하는 방식을 사용하고 있습니다. 이는 다음과 같은 이유로 유지되고 있습니다:

#### 현재 복사 방식을 유지하는 이유
1. **학생별 커스터마이징**: 학생별로 notes, progress 등 개인화된 정보 저장 필요
2. **RLS 정책**: Row Level Security로 인한 직접 참조 제약
3. **성능**: JOIN 대신 직접 데이터 접근으로 성능 향상
4. **데이터 독립성**: 마스터 콘텐츠 변경 시 학생 데이터에 영향 없음

#### 개선 방안 제안

**옵션 1: 하이브리드 방식 (권장)**
- 기본 정보는 마스터 콘텐츠 참조 (`master_content_id`/`master_lecture_id`)
- 학생별 커스터마이징 정보만 별도 테이블에 저장
- 예: `student_content_customizations` 테이블 생성

```sql
CREATE TABLE student_content_customizations (
  id uuid PRIMARY KEY,
  student_id uuid REFERENCES students(id),
  content_type text, -- 'book' | 'lecture'
  content_id uuid, -- books.id 또는 lectures.id
  master_content_id uuid, -- master_books.id 또는 master_lectures.id
  notes text,
  progress jsonb,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**옵션 2: 뷰(View) 활용**
- 마스터 콘텐츠와 학생 커스터마이징을 JOIN하는 뷰 생성
- 애플리케이션 레벨에서 마스터 콘텐츠 정보 병합

**옵션 3: 현재 방식 유지 + 최적화**
- 복사는 유지하되, 마스터 콘텐츠 업데이트 시 동기화 메커니즘 추가
- 불필요한 복사 방지 (이미 복사된 경우 재사용)

## 수정된 파일

1. `lib/data/contentMasters.ts`
   - `copyMasterLectureToStudent`: 마스터 강의의 `linked_book_id` 처리 추가

2. `app/(student)/contents/lectures/[id]/page.tsx`
   - 마스터 교재 정보 조회 로직 추가
   - `getMasterBookById` import 추가

3. `app/(student)/contents/lectures/[id]/_components/LectureLinkedBookSection.tsx`
   - 마스터 교재 표시 로직 추가
   - 타입 정의 수정 (`isMaster` 속성 추가)

4. `app/(student)/contents/lectures/[id]/_components/LectureDetailTabs.tsx`
   - 타입 정의 수정 (`isMaster` 속성 추가)

## 향후 작업

1. **데이터 복사 방식 개선 검토**
   - 옵션 1, 2, 3 중 선택하여 구현
   - 마이그레이션 계획 수립
   - 기존 데이터 호환성 고려

2. **마스터 콘텐츠 동기화 메커니즘**
   - 마스터 콘텐츠 업데이트 시 학생 콘텐츠 동기화
   - 선택적 동기화 (제목, 설명 등만 업데이트)

3. **성능 최적화**
   - 불필요한 복사 방지
   - 캐싱 전략 수립

## 참고

- 현재 시스템은 이미 `master_content_id`와 `master_lecture_id`를 사용하여 마스터 콘텐츠를 참조하고 있습니다.
- 복사는 주로 학생별 커스터마이징과 RLS 정책 때문에 필요합니다.
- 데이터 복사 방식 개선은 큰 구조 변경이 필요하므로, 팀과 논의 후 진행하는 것을 권장합니다.

