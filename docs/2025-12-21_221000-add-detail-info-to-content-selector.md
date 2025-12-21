# ContentSelector에 상세 정보 표시 추가

## 문제 상황

ContentSelector에서 선택 전 콘텐츠를 표시할 때 기본 정보만 표시하고, ContentCard에서는 선택된 콘텐츠에 대해 상세 정보를 표시하여 일관성이 없었습니다.

사용자 요구사항:
- 선택 전에도 상세 정보를 표시하여 일관성 유지
- 교재와 강의 모두 동일한 방식으로 상세 정보 표시

## 수정 내용

### 1. ContentItem 타입 확장

`lib/data/planContents.ts`의 `ContentItem` 타입에 추가 필드를 포함:

```typescript
export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
  subject?: string | null;
  subject_group_name?: string | null;
  curriculum_revision_name?: string | null;
  semester?: string | null;           // 추가
  revision?: string | null;            // 추가
  difficulty_level?: string | null;   // 추가
  publisher?: string | null;          // 추가 (교재만)
  platform?: string | null;           // 추가 (강의만)
};
```

### 2. 데이터 조회 함수 수정

#### fetchStudentBooks
- 추가 필드 조회: `semester, revision, difficulty_level, publisher`
- 반환 데이터에 추가 필드 포함

#### fetchStudentLectures
- 추가 필드 조회: `semester, revision, difficulty_level, platform`
- 반환 데이터에 추가 필드 포함

### 3. ContentSelector 컴포넌트 수정

#### 타입 업데이트
ContentSelector의 `ContentItem` 타입도 동일하게 확장

#### 메타데이터 표시 확장
ContentCard와 동일한 상세 정보 표시:

1. **콘텐츠 타입 배지** (항상 표시)
   - 📚 교재 (교재 탭)
   - 🎧 강의 (강의 탭)
   - 📄 커스텀 (커스텀 탭)

2. **교과 그룹명** (있는 경우)
   - 예: "국어", "수학"

3. **세부 과목** (있는 경우)
   - 예: "고전시가", "현대시"

4. **학기** (있는 경우)
   - 예: "1학기", "2학기"

5. **개정교육과정** (있는 경우)
   - `revision` 우선, 없으면 `curriculum_revision_name` 사용
   - 예: "2015 개정"

6. **난이도** (있는 경우)
   - 예: "기본", "심화"

7. **출판사** (교재만, 있는 경우)
   - 예: "비상교육", "천재교육"

8. **플랫폼** (강의만, 있는 경우)
   - 예: "EBSi", "메가스터디"

## 표시 순서

ContentSelector와 ContentCard 모두 동일한 순서로 메타데이터를 표시합니다:

1. 콘텐츠 타입 배지
2. 교과 그룹명
3. 세부 과목
4. 학기
5. 개정교육과정
6. 난이도
7. 출판사 (교재) / 플랫폼 (강의)

## 수정된 파일

1. `lib/data/planContents.ts`
   - `ContentItem` 타입 확장
   - `fetchStudentBooks` 함수 수정
   - `fetchStudentLectures` 함수 수정

2. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentSelector.tsx`
   - `ContentItem` 타입 확장
   - 메타데이터 표시 로직 확장

## 일관성 개선

이제 ContentSelector와 ContentCard에서 동일한 정보를 표시하므로:
- 선택 전과 선택 후의 정보 표시가 일관됨
- 사용자가 선택 전에도 상세 정보를 확인 가능
- 교재와 강의 모두 동일한 방식으로 처리

## 테스트 방법

1. ContentSelector에서 교재 목록 확인
   - 학기, 개정교육과정, 난이도, 출판사가 표시되는지 확인

2. ContentSelector에서 강의 목록 확인
   - 학기, 개정교육과정, 난이도, 플랫폼이 표시되는지 확인

3. 콘텐츠 선택 후 ContentCard에서 확인
   - 선택 전과 동일한 정보가 표시되는지 확인

4. 메타데이터가 없는 콘텐츠도 정상적으로 표시되는지 확인

