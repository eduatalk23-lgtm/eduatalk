# 일별 스케줄 학습 내역 상세 정보 표시 개선

## 작업 일자
2025-02-02

## 작업 개요
일별 스케줄 캘린더에서 강의/교재 콘텐츠의 상세 정보를 표시하도록 개선했습니다. 기존에는 `sequence`만 표시되었지만, 이제는 강의의 경우 `episode_title`, 교재의 경우 `major_unit/minor_unit`을 표시합니다.

## 변경 사항

### 1. 유틸리티 함수 생성
**파일**: `lib/utils/planContentEnrichment.ts` (신규 생성)

**주요 기능**:
- 플랜에 콘텐츠 상세 정보를 추가하는 공통 로직 추출
- 강의 `episode_title` 조회 및 매핑
- 교재 `major_unit/minor_unit` 조회 및 매핑
- 배치 조회 함수 활용 (`getStudentBookDetailsBatch`, `getStudentLectureEpisodesBatch`)

**주요 함수**:
```typescript
export async function enrichPlansWithContentDetails(
  plans: Plan[],
  studentId: string
): Promise<PlanWithEpisode[]>
```

**로직**:
1. 플랜에서 book/lecture content_id 수집
2. 배치 조회로 episode/book_details 정보 가져오기 (병렬 처리)
3. 각 플랜의 `planned_start_page_or_time` ~ `planned_end_page_or_time` 범위에 해당하는 정보 찾기
4. `contentEpisode` 생성:
   - 강의: `episode_title` 조합 (단일/범위)
   - 교재: `major_unit/minor_unit` 조합 (단일/범위)
   - Fallback: `sequence` 사용

**강의 콘텐츠 처리**:
- `planned_start_page_or_time`에 해당하는 episode 찾기 (episode_number 기준)
- `planned_end_page_or_time`에 해당하는 episode 찾기
- 단일: `episode_title` (예: "8강: 함수의 개념")
- 범위: `startEpisode ~ endEpisode` (예: "8강: 함수의 개념 ~ 9강: 함수의 활용")
- Fallback: `episode_title`이 없으면 `episode_number` 사용

**교재 콘텐츠 처리**:
- `planned_start_page_or_time`에 해당하는 book_detail 찾기 (page_number <= start)
- `planned_end_page_or_time`에 해당하는 book_detail 찾기 (page_number <= end)
- 단일: `major_unit || minor_unit` (예: "1단원: 함수")
- 범위: `startUnit ~ endUnit` (예: "1단원: 함수 ~ 2단원: 방정식")
- Fallback: 단원 정보가 없으면 페이지 범위 표시

### 2. 중복 코드 제거
**파일들**:
- `app/(student)/plan/calendar/page.tsx`
- `app/(student)/camp/calendar/page.tsx`

**수정 사항**:
- `plansWithContent` 생성 로직을 `enrichPlansWithContentDetails` 함수 호출로 대체
- 교과 정보 조회 로직은 유지 (기존 로직과 통합)
- 두 파일에서 동일한 패턴으로 수정하여 중복 코드 제거

**수정 전**:
```typescript
const plansWithContent = filteredPlans.map((plan) => {
  let contentEpisode: string | null = null;
  if (plan.sequence !== null && plan.sequence !== undefined) {
    contentEpisode = `${plan.sequence}회차`;
  }
  // ...
});
```

**수정 후**:
```typescript
const plansWithBasicContent = filteredPlans.map((plan) => {
  // 교과 정보 추가
  // ...
});

const plansWithContentDetails = await enrichPlansWithContentDetails(
  plansWithBasicContent,
  user.id
);

const plansWithContent = plansWithContentDetails.map((plan) => ({
  ...plan,
  contentEpisode: plan.contentEpisode || null,
}));
```

### 3. 성능 최적화
- **병렬 처리**: `Promise.all`을 사용하여 book_details와 lecture_episodes를 동시에 조회
- **조건부 조회**: content_id가 있는 플랜만 조회 대상에 포함
- **Map 기반 조회**: O(1) 조회 성능을 위한 Map 구조 활용
- **배치 조회**: 기존 배치 조회 함수 활용으로 쿼리 횟수 감소

### 4. 타입 정의 개선
- `PlanWithEpisode` 타입 정의 (내부 타입)
- 기존 `PlanWithContent` 타입과 호환성 유지
- 타입 안전성 보장

## 예상 결과

1. **강의 콘텐츠**: "8강: 함수의 개념" 형태로 표시
2. **교재 콘텐츠**: "1단원: 함수" 형태로 표시
3. **중복 코드 제거**: 공통 로직이 한 곳에서 관리됨
4. **성능 향상**: 배치 조회 및 병렬 처리로 쿼리 횟수 감소

## 참고 사항

- Next.js 15 Server Component 모범 사례 준수
- 기존 코드 스타일 및 컨벤션 유지
- 하위 호환성 보장 (fallback 로직 포함)
- 타입 안전성 보장 (TypeScript strict mode)

## 관련 파일

- `lib/utils/planContentEnrichment.ts` (신규)
- `app/(student)/plan/calendar/page.tsx` (수정)
- `app/(student)/camp/calendar/page.tsx` (수정)
- `app/(student)/plan/calendar/_types/plan.ts` (참고)

