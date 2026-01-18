# 학생 캠프 템플릿 제출 상세보기 블록 세트 정보 표시

## 🔍 요구사항

학생이 캠프 템플릿을 제출한 후, 제출 완료 상세보기 페이지의 "제출한 정보" 섹션에서 블록 세트 정보를 표시해야 합니다.

## 🛠 구현 내용

### 블록 세트 정보 표시 추가

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

"제출한 정보" 섹션에 블록 세트 정보를 표시하도록 추가:

```typescript
{/* 블록 세트 정보 */}
{templateBlockSetName && (
  <div className="mt-6 border-t border-gray-100 pt-4">
    <label className="text-xs font-medium text-gray-500">블록 세트</label>
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{templateBlockSetName}</p>
      </div>
      {templateBlocks.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templateBlocks.map((block) => (
            <div
              key={block.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="text-sm font-medium text-gray-900">
                {["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][block.day_of_week]}
              </div>
              <div className="text-xs text-gray-600">
                {block.start_time} ~ {block.end_time}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">등록된 시간 블록이 없습니다.</p>
      )}
    </div>
  </div>
)}
```

## 📋 변경 사항 요약

### `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **블록 세트 정보 표시 UI 추가**
   - "제출한 정보" 섹션 하단에 블록 세트 정보 추가
   - 블록 세트 이름 표시
   - 요일별 시간 블록을 그리드 형태로 표시
   - 각 블록에 요일과 시작/종료 시간 표시
   - 블록이 없을 경우 안내 메시지 표시

## ✅ 검증 체크리스트

- [x] 제출한 정보 섹션에 블록 세트 정보 표시 확인
- [x] 블록 세트 이름 표시 확인
- [x] 블록 목록 표시 확인
- [x] 요일 및 시간 정보 표시 확인
- [x] 블록이 없을 경우 안내 메시지 표시 확인
- [x] 기존 블록 조회 로직과의 통합 확인

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 학생 제출 템플릿 상세보기 페이지
- `app/(admin)/admin/camp-templates/[id]/page.tsx` - 관리자 템플릿 상세보기 페이지 (참고)

## 📝 참고 사항

- 템플릿 블록 정보는 이미 조회되고 있으며 (`templateBlocks`, `templateBlockSetName`), `PlanGroupDetailView`에도 전달되고 있음
- "제출한 정보" 섹션에 블록 세트 정보를 추가하여 학생이 제출한 정보를 한눈에 확인할 수 있도록 개선
- 관리자 템플릿 상세보기와 동일한 UI 패턴을 사용하여 일관성 유지

## 날짜

2024-11-24

