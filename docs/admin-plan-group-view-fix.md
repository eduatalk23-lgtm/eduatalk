# 관리자 페이지 '플랜 보기' 404 오류 수정

## 🔍 문제 상황

관리자 페이지(`/admin/camp-templates/[id]/participants`)에서 '플랜 보기' 액션을 클릭하면 404 오류가 발생했습니다.

### 원인 분석

1. **잘못된 경로 참조**
   - '플랜 보기' 링크가 학생 전용 경로 `/plan/group/[id]`로 설정되어 있었음
   - 관리자가 학생 전용 페이지에 접근할 수 없어 404 오류 발생

2. **관리자용 플랜 그룹 상세 페이지 부재**
   - 관리자 영역에 플랜 그룹 상세 페이지가 없었음
   - 학생용 페이지는 `user.id`로 권한 확인을 하므로 관리자가 접근 불가

## 🛠 해결 방법

### 수정 내용

#### 1. 관리자용 플랜 그룹 상세 페이지 생성

**파일**: `app/(admin)/admin/plan-groups/[id]/page.tsx`

- 관리자 권한 확인 (`admin`, `consultant`만 접근 가능)
- `getPlanGroupWithDetailsForAdmin` 함수 사용하여 관리자용 데이터 조회
- 학생 정보 표시 (이름, 학년, 반)
- 학생용 `PlanGroupDetailView` 컴포넌트 재사용
- 캠프 모드일 경우 템플릿 블록 정보 조회
- 플랜 진행 상황 표시

**주요 특징**:
- 관리자 권한으로 모든 플랜 그룹 조회 가능
- 학생 정보를 함께 표시하여 컨텍스트 제공
- 캠프 템플릿 참여자 목록으로 돌아가기 링크 제공

#### 2. '플랜 보기' 링크 수정

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`

**변경 전**:
```tsx
<Link
  href={`/plan/group/${participant.plan_group_id}`}
  className="text-indigo-600 hover:text-indigo-800 text-xs"
>
  플랜 보기
</Link>
```

**변경 후**:
```tsx
<Link
  href={`/admin/plan-groups/${participant.plan_group_id}`}
  className="text-indigo-600 hover:text-indigo-800 text-xs"
>
  플랜 보기
</Link>
```

## 📋 변경 사항 요약

1. **새 파일 생성**
   - `app/(admin)/admin/plan-groups/[id]/page.tsx`: 관리자용 플랜 그룹 상세 페이지

2. **파일 수정**
   - `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`: '플랜 보기' 링크 경로 수정

## ✅ 검증 사항

- [x] 관리자 권한으로 플랜 그룹 상세 페이지 접근 가능
- [x] 학생 정보가 올바르게 표시됨
- [x] 플랜 진행 상황이 올바르게 표시됨
- [x] 캠프 모드일 경우 템플릿 블록 정보가 표시됨
- [x] '플랜 보기' 링크 클릭 시 404 오류 없이 페이지 이동

## 🎯 향후 개선 사항

- 관리자용 플랜 그룹 목록 페이지 추가 고려
- 관리자용 플랜 편집 기능 추가 고려
- 플랜 그룹 통계 및 분석 기능 추가 고려

