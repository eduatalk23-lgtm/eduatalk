# 캠프 템플릿 화면 개선

## 작업 일시
2025-02-02

## 작업 개요
캠프 템플릿 상세보기 및 수정 페이지의 UI를 개선하고, 플랜 상세보기에 템플릿 통계 정보를 추가했습니다.

## 변경 사항

### 1. 캠프 템플릿 상세보기 - 필수요소 점검 영역 제거
**파일**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

- 필수요소 점검 영역(`TemplateChecklist` 컴포넌트) 제거
- 관련 import 문 제거

**변경 전**:
```tsx
{/* 필수요소 점검 */}
<TemplateChecklist template={template} />
```

**변경 후**:
- 해당 섹션 완전 제거

### 2. 캠프 템플릿 수정 페이지 개선
**파일**: `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`

#### 2.1. 초대 현황/플랜 진행 구성 섹션 제거
- 템플릿 수정 페이지에서 "초대 현황"과 "플랜 진행 구성" 섹션 제거
- `impactSummary` prop은 유지 (향후 사용 가능)
- 사용하지 않는 변수(`hasLiveInvites`, `hasReviewInProgress`, `hasActivatedPlans`) 제거

**변경 전**:
```tsx
{impactSummary && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
    {/* 초대 현황 및 플랜 진행 구성 표시 */}
  </div>
)}
```

**변경 후**:
- 해당 섹션 완전 제거

#### 2.2. 뒤로가기/취소 버튼 경로 변경
- "템플릿 목록" 버튼을 "템플릿 상세보기"로 변경하고 경로를 `/admin/camp-templates/${template.id}`로 수정
- "취소" 버튼의 경로도 템플릿 상세보기로 변경

**변경 전**:
```tsx
<Link href="/admin/camp-templates">
  템플릿 목록
</Link>
// ...
router.push("/admin/camp-templates");
```

**변경 후**:
```tsx
<Link href={`/admin/camp-templates/${template.id}`}>
  템플릿 상세보기
</Link>
// ...
router.push(`/admin/camp-templates/${template.id}`);
```

### 3. 플랜 상세보기에 템플릿 통계 추가
**파일**: `app/(admin)/admin/plan-groups/[id]/page.tsx`

- `getCampTemplateImpactSummary` 함수 import 추가
- 캠프 모드이고 `camp_template_id`가 있을 때 템플릿 전체 통계 조회
- 헤더 정보 카드 아래에 "초대 현황"과 "플랜 진행 구성" 섹션 추가
- 스타일은 템플릿 수정 페이지와 동일하게 amber 배경 사용

**추가된 코드**:
```tsx
// 템플릿 통계 조회
let templateImpactSummary = null;
if (isCampMode && group.camp_template_id) {
  try {
    templateImpactSummary = await getCampTemplateImpactSummary(
      group.camp_template_id,
      tenantContext.tenantId
    );
  } catch (error) {
    console.error("[AdminPlanGroupDetailPage] 템플릿 통계 조회 실패:", error);
  }
}

// 렌더링 부분
{isCampMode && group.camp_template_id && templateImpactSummary && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
    <div className="flex flex-wrap items-center gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-700">
          초대 현황
        </p>
        <p className="text-base font-semibold">
          대기 {templateImpactSummary.invitationStats.pending} · 참여{" "}
          {templateImpactSummary.invitationStats.accepted} · 거절{" "}
          {templateImpactSummary.invitationStats.declined}
        </p>
      </div>
      <div className="h-6 w-px bg-amber-200" aria-hidden="true" />
      <div>
        <p className="text-xs uppercase tracking-wide text-amber-700">
          플랜 진행
        </p>
        <p className="text-base font-semibold">
          작성 중 {templateImpactSummary.planGroupStats.draft} · 검토 중{" "}
          {templateImpactSummary.planGroupStats.saved} · 활성{" "}
          {templateImpactSummary.planGroupStats.active}
        </p>
      </div>
    </div>
  </div>
)}
```

## 수정된 파일 목록
1. `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`
2. `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx`
3. `app/(admin)/admin/plan-groups/[id]/page.tsx`

## 테스트 확인 사항
- [x] 캠프 템플릿 상세보기에서 필수요소 점검 영역이 제거되었는지 확인
- [x] 템플릿 수정 페이지에서 초대 현황/플랜 진행 구성 섹션이 제거되었는지 확인
- [x] 템플릿 수정 페이지의 뒤로가기 버튼이 템플릿 상세보기로 이동하는지 확인
- [x] 템플릿 수정 페이지의 취소 버튼이 템플릿 상세보기로 이동하는지 확인
- [x] 플랜 상세보기에서 캠프 모드일 때 템플릿 통계가 표시되는지 확인
- [x] 플랜 상세보기에서 일반 모드일 때 템플릿 통계가 표시되지 않는지 확인

## 참고 사항
- `impactSummary` prop은 템플릿 수정 폼에서 제거하지 않고 유지 (향후 사용 가능)
- 템플릿 통계는 템플릿 전체의 통계를 표시 (해당 템플릿에 연결된 모든 플랜 그룹의 통계)
- 에러 발생 시에도 페이지가 정상적으로 렌더링되도록 try-catch 처리

