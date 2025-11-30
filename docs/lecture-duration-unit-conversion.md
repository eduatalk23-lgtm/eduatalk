# 강의 시간 단위 변환 구현

## 작업 일시
2024-11-30

## 문제 상황
- DB에는 강의 시간이 초 단위로 저장됨
- UI에서는 분 단위로 입력/표시됨
- 변환 로직이 없어 불일치 발생

## 해결 방안
DB는 초 단위로 유지하고, UI에서 분 단위로 변환하여 처리

## 구현 내용

### 1. 유틸리티 함수 생성
**파일**: `lib/utils/duration.ts`
- `secondsToMinutes(seconds: number | null | undefined): number | null` - 초 → 분 변환 (반올림)
- `minutesToSeconds(minutes: number | null | undefined): number | null` - 분 → 초 변환

### 2. Server Actions 수정
**파일**: `app/(student)/actions/masterContentActions.ts`
- `addMasterLecture`: `total_duration` 분 → 초 변환 후 저장
- `updateMasterLectureAction`: `total_duration` 분 → 초 변환 후 저장
- episode `duration` 분 → 초 변환 후 저장

### 3. 폼 컴포넌트 수정
**파일**: `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`
- `total_duration` 표시 시 초 → 분 변환

**파일**: `app/(student)/contents/_components/LectureEpisodesManager.tsx`
- episode `duration` 초기값 설정 시 초 → 분 변환
- 입력값은 분 단위로 유지 (서버 액션에서 초로 변환)

### 4. 표시 컴포넌트 수정
다음 컴포넌트들에서 `duration`/`total_duration` 표시 시 초 → 분 변환 적용:

- `app/(student)/contents/lectures/[id]/_components/LectureInfoSection.tsx`
- `app/(student)/contents/master-lectures/[id]/page.tsx`
- `app/(admin)/admin/master-lectures/[id]/page.tsx`
- `app/(admin)/admin/master-lectures/page.tsx`
- `app/(student)/contents/master-lectures/page.tsx`
- `app/(student)/contents/_components/LectureEpisodesDisplay.tsx`
- `app/(student)/contents/_components/ContentsListClient.tsx`
- `app/(student)/contents/_components/ContentsList.tsx`
- `app/(admin)/admin/students/[id]/_components/ContentListSection.tsx`

## 변경 사항 요약

### 추가된 파일
- `lib/utils/duration.ts` - 시간 단위 변환 유틸리티

### 수정된 파일
1. `app/(student)/actions/masterContentActions.ts` - 저장 시 분→초 변환
2. `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx` - 표시 시 초→분 변환
3. `app/(student)/contents/_components/LectureEpisodesManager.tsx` - 회차 시간 변환
4. 모든 표시 컴포넌트 (9개 파일) - 표시 시 초→분 변환

## 주의사항
- 기존 데이터는 초 단위로 저장되어 있으므로, 변환 로직만 추가하면 됨
- null/undefined 값 처리 필수
- 반올림 처리 (초 → 분 변환 시)

## 테스트 필요 사항
1. 새 강의 생성 시 분 단위 입력이 초 단위로 저장되는지 확인
2. 기존 강의 수정 시 초 단위 데이터가 분 단위로 표시되는지 확인
3. 강의 목록/상세 페이지에서 시간이 분 단위로 올바르게 표시되는지 확인
4. 회차 정보에서 시간이 분 단위로 올바르게 표시되는지 확인

