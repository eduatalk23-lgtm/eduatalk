# /today와 /plan/calendar 일관성 수정

**작업 일시**: 2025-12-21  
**관련 이슈**: 
- 학습 관리 문제: 해당 날짜에 3개의 플랜이 있는데 1개의 플랜만 보임
- 강의 콘텐츠에 대한 부분이 고려되지 않는 것 같음
- 완료 확정 시 "콘텐츠를 찾을 수 없거나 총량 정보가 설정되지 않았습니다" 에러 발생

---

## 문제 분석

### 1. 강의 콘텐츠 총량 null 문제

**증상**:
- 완료 확정 시 `[todayActions] 콘텐츠 총량이 null` 에러 발생
- 에러 메시지: "콘텐츠를 찾을 수 없거나 총량 정보가 설정되지 않았습니다. (lecture: {contentId})"

**원인**:
- `fetchContentTotal` 함수가 `lectures` 테이블의 `duration` 필드만 조회
- 강의 스키마 리팩토링 후 `master_lecture_id`를 통해 `master_lectures` 테이블의 `total_duration`을 사용해야 함
- `lectures.duration`이 null이고 `master_lecture_id`가 있는 경우, `master_lectures.total_duration`을 조회하지 않음

**해결**:
- `fetchContentTotal` 함수 수정:
  1. `lectures` 테이블에서 `duration`과 `master_lecture_id` 함께 조회
  2. `duration`이 있으면 사용
  3. `duration`이 없고 `master_lecture_id`가 있으면 `master_lectures` 테이블에서 `total_duration` 조회
  4. 둘 다 없으면 null 반환

### 2. 플랜 필터링 일관성 문제

**증상**:
- `/today` 경로에서는 3개의 플랜이 보이지만, `/plan/calendar` 경로에서는 1개의 플랜만 보임

**원인**:
- 두 경로의 플랜 그룹 필터링 로직이 다름:
  - `/today`: `plan_type !== "camp" && camp_template_id === null && camp_invitation_id === null`
  - `/plan/calendar`: `!group.camp_template_id && !group.camp_invitation_id` (plan_type 체크 없음)

**해결**:
- `/plan/calendar`의 필터링 로직을 `/today`와 일치시킴
- `plan_type !== "camp"` 조건 추가

---

## 수정 내용

### 1. `lib/data/contentTotal.ts`

**변경 사항**:
- `LectureRow` 타입에 `master_lecture_id` 필드 추가
- `MasterLectureRow` 타입 추가
- 강의 총량 조회 로직 개선:
  - `lectures` 테이블에서 `duration`과 `master_lecture_id` 함께 조회
  - `duration`이 있으면 사용
  - `duration`이 없고 `master_lecture_id`가 있으면 `master_lectures` 테이블에서 `total_duration` 조회
  - 상세한 로깅 추가

```typescript
// 변경 전
if (contentType === "lecture") {
  const { data } = await supabase
    .from("lectures")
    .select("id,duration")
    .eq("id", contentId)
    .eq("student_id", studentId)
    .maybeSingle();
  return data?.duration ?? null;
}

// 변경 후
if (contentType === "lecture") {
  const { data } = await supabase
    .from("lectures")
    .select("id,duration,master_lecture_id")
    .eq("id", contentId)
    .eq("student_id", studentId)
    .maybeSingle();

  // duration이 있으면 사용
  if (data?.duration != null && data.duration > 0) {
    return data.duration;
  }

  // duration이 없고 master_lecture_id가 있으면 master_lectures에서 조회
  if (data?.master_lecture_id) {
    const { data: masterLecture } = await supabase
      .from("master_lectures")
      .select("id,total_duration")
      .eq("id", data.master_lecture_id)
      .maybeSingle();

    if (masterLecture?.total_duration != null && masterLecture.total_duration > 0) {
      return masterLecture.total_duration;
    }
  }

  return null;
}
```

### 2. `app/(student)/plan/calendar/page.tsx`

**변경 사항**:
- 플랜 그룹 필터링 로직을 `/today`와 일치시킴
- `plan_type !== "camp"` 조건 추가

```typescript
// 변경 전
const activePlanGroups = allActivePlanGroups.filter(
  (group) => !group.camp_template_id && !group.camp_invitation_id
);

// 변경 후
const activePlanGroups = allActivePlanGroups.filter(
  (group) =>
    group.plan_type !== "camp" &&
    group.camp_template_id === null &&
    group.camp_invitation_id === null
);
```

---

## 테스트 체크리스트

- [ ] 강의 콘텐츠 총량 조회 테스트
  - [ ] `lectures.duration`이 있는 경우 정상 조회
  - [ ] `lectures.duration`이 null이고 `master_lecture_id`가 있는 경우 `master_lectures.total_duration` 조회
  - [ ] 둘 다 없는 경우 null 반환
- [ ] 플랜 필터링 일관성 테스트
  - [ ] `/today`와 `/plan/calendar`에서 동일한 플랜 개수 표시
  - [ ] 캠프 플랜 그룹이 일반 모드에서 제외되는지 확인
- [ ] 완료 확정 기능 테스트
  - [ ] 강의 콘텐츠로 플랜 완료 확정 시 정상 동작
  - [ ] 에러 메시지가 발생하지 않는지 확인

---

## 관련 파일

- `lib/data/contentTotal.ts` - 콘텐츠 총량 조회 로직
- `app/(student)/plan/calendar/page.tsx` - 플랜 캘린더 페이지
- `app/(student)/today/actions/todayActions.ts` - 플랜 완료 액션
- `docs/lecture-schema-refactoring.md` - 강의 스키마 리팩토링 문서

---

## 참고 사항

- 강의 스키마 리팩토링 후 `master_lecture_id`를 통해 `master_lectures` 테이블의 `total_duration`을 사용해야 함
- `lectures.duration` 필드는 하위 호환성을 위해 유지되지만, 새로운 강의는 `master_lectures.total_duration`을 사용
- 두 경로의 필터링 로직을 일치시켜 사용자 경험 일관성 확보

