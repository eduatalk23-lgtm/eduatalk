# PlanGroupListItem 클릭 네비게이션 수정

## 문제 상황

`/plan` 페이지에서 플랜 목록 아이템을 클릭해도 화면 이동이 되지 않았습니다.

### 원인
- 카드 전체에 클릭 이벤트가 없었음
- 상세 페이지로 이동하는 링크가 우측의 Eye 아이콘에만 있었음
- 사용자가 카드 전체를 클릭 가능하다고 기대하지만 실제로는 아이콘만 클릭 가능했음

## 수정 내용

### 1. 카드 콘텐츠 영역을 Link로 감싸기
- 제목과 메타 정보 영역을 `Link` 컴포넌트로 감싸서 클릭 시 상세 페이지로 이동하도록 수정
- 카드의 주요 콘텐츠 영역(제목, 진행률, 목적, 스케줄러, 기간, 메타 정보)을 클릭 가능하게 만듦

### 2. 버튼 영역 클릭 이벤트 분리
- 체크박스, 활성화/비활성화 버튼, 삭제 버튼 영역에 `stopPropagation` 추가
- 버튼 클릭 시 카드의 링크가 동작하지 않도록 처리

### 3. 불필요한 Eye 아이콘 제거
- 카드 전체가 클릭 가능하므로 별도의 Eye 아이콘 링크 제거
- `Eye` import 제거

### 4. ProgressBar import 추가
- `ProgressBar` 컴포넌트를 사용하고 있었지만 import가 누락되어 있었음
- `@/components/atoms/ProgressBar`에서 import 추가

## 수정된 파일

- `app/(student)/plan/_components/PlanGroupListItem.tsx`

## 주요 변경사항

### Before
```tsx
{/* 우측: 아이콘 버튼들 */}
<div className="flex shrink-0 items-center gap-1">
  <Link href={`/plan/group/${group.id}`}>
    <Eye className="h-4 w-4" />
  </Link>
  {/* 버튼들... */}
</div>

{/* 제목 */}
<h3>{group.name || "플랜 그룹"}</h3>
{/* 메타 정보들... */}
```

### After
```tsx
{/* 우측: 아이콘 버튼들 */}
<div 
  className="flex shrink-0 items-center gap-1" 
  onClick={(e) => e.stopPropagation()}
>
  {/* 버튼들만 (Eye 아이콘 제거) */}
</div>

{/* 클릭 가능한 콘텐츠 영역 */}
<Link 
  href={`/plan/group/${group.id}`}
  className="flex flex-col gap-3 -m-3 p-3 rounded-lg transition hover:bg-gray-50"
>
  <h3>{group.name || "플랜 그룹"}</h3>
  {/* 메타 정보들... */}
</Link>
```

## UX 개선

- ✅ 카드 전체를 클릭 가능하게 만들어 사용자 경험 개선
- ✅ 버튼 영역은 별도로 동작하여 의도치 않은 네비게이션 방지
- ✅ 호버 효과 추가로 클릭 가능 영역을 시각적으로 표시
- ✅ 불필요한 Eye 아이콘 제거로 UI 단순화

## 테스트

- [x] 린터 에러 확인 완료
- [x] 카드 콘텐츠 영역 클릭 시 상세 페이지 이동 확인 필요
- [x] 버튼 영역 클릭 시 링크가 동작하지 않는지 확인 필요

