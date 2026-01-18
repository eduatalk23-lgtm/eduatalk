# 캠프 템플릿 목록 UI 개선

## 작업 일시
2025-02-02

## 작업 목표
캠프 템플릿 목록 페이지(`/admin/camp-templates`)의 UI를 개선하여 본문 영역을 넓히고 가독성을 향상시킵니다.

## 문제점
- 액션 버튼(상태 변경, 삭제)이 본문 영역을 차지하여 템플릿 정보(이름, 설명, 유형 등)를 보기 어려움
- 그리드 레이아웃으로 인해 카드가 작게 표시됨

## 해결 방안
1. 그리드 레이아웃을 단일 컬럼 flex 레이아웃으로 변경 (1줄에 1개 템플릿)
2. 템플릿 카드를 가로 긴 형태로 재구성
3. 본문 정보를 가로로 나열 (이름 | 유형 | 설명 | 날짜)
4. 액션 버튼을 드롭다운 메뉴로 통합하여 공간 효율성 향상

## 변경 사항

### 1. 페이지 레이아웃 변경
**파일**: `app/(admin)/admin/camp-templates/page.tsx`

- 그리드 레이아웃을 단일 컬럼으로 변경
- `grid gap-4 md:grid-cols-2 lg:grid-cols-3` → `flex flex-col gap-4`

```180:184:app/(admin)/admin/camp-templates/page.tsx
            <div className="flex flex-col gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
```

### 2. TemplateCard 컴포넌트 재구성
**파일**: `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

#### 주요 변경사항

1. **가로 긴 카드 형태로 재구성**
   - 본문 정보를 가로로 나열
   - 각 정보 항목 간 적절한 간격 유지

2. **드롭다운 메뉴 구현**
   - `MoreVertical` 아이콘 사용
   - 클릭 시 메뉴 표시 (상태 변경 옵션, 삭제 옵션)
   - 외부 클릭 시 자동으로 닫힘

3. **반응형 대응**
   - 모바일: 이름과 날짜만 표시
   - 태블릿 이상: 유형과 설명 추가 표시

#### 본문 정보 레이아웃

```128:164:app/(admin)/admin/camp-templates/_components/TemplateCard.tsx
      <div className="group relative rounded-lg border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md">
        <div className="flex items-center gap-4 md:gap-6">
          {/* 본문 정보 - 가로 배치 */}
          <Link
            href={`/admin/camp-templates/${template.id}`}
            className="flex flex-1 items-center gap-3 md:gap-6 min-w-0"
          >
            {/* 이름 */}
            <div className="flex-shrink-0 min-w-[120px] md:min-w-[150px]">
              <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">
                {template.name}
              </h3>
            </div>

            {/* 유형 */}
            <div className="flex-shrink-0 hidden sm:block">
              <p className="text-xs md:text-sm text-gray-700 whitespace-nowrap">
                {template.program_type}
              </p>
            </div>

            {/* 설명 */}
            {template.description && (
              <div className="flex-1 min-w-0 hidden md:block">
                <p className="text-sm text-gray-600 truncate">
                  {template.description}
                </p>
              </div>
            )}

            {/* 날짜 */}
            <div className="flex-shrink-0 ml-auto">
              <p className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(template.created_at).toLocaleDateString("ko-KR")}
              </p>
            </div>
          </Link>
```

#### 드롭다운 메뉴 구현

```166:260:app/(admin)/admin/camp-templates/_components/TemplateCard.tsx
          {/* 상태 배지 및 드롭다운 메뉴 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {getStatusBadge()}
            
            {/* 드롭다운 메뉴 */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDropdown(!showDropdown);
                }}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                title="더보기"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {/* 드롭다운 메뉴 */}
              {showDropdown && (
                <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="py-1">
                    {/* 상태 변경 옵션 */}
                    {currentStatus === "draft" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleStatusChange("active");
                        }}
                        disabled={isChangingStatus}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isChangingStatus ? "변경 중..." : "활성화"}
                      </button>
                    )}
                    {currentStatus === "active" && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleStatusChange("draft");
                          }}
                          disabled={isChangingStatus}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isChangingStatus ? "변경 중..." : "초안으로 변경"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleStatusChange("archived");
                          }}
                          disabled={isChangingStatus}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isChangingStatus ? "변경 중..." : "보관"}
                        </button>
                      </>
                    )}
                    {currentStatus === "archived" && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleStatusChange("draft");
                        }}
                        disabled={isChangingStatus}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isChangingStatus ? "변경 중..." : "초안으로 복원"}
                      </button>
                    )}

                    {/* 구분선 */}
                    <div className="my-1 border-t border-gray-200" />

                    {/* 삭제 옵션 */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClick();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
```

#### 외부 클릭 감지 로직

```49:64:app/(admin)/admin/camp-templates/_components/TemplateCard.tsx
  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);
```

## 개선 효과

1. **본문 영역 확대**: 액션 버튼을 드롭다운으로 통합하여 본문 영역이 넓어짐
2. **가독성 향상**: 가로 긴 카드 형태로 템플릿 정보를 한눈에 확인 가능
3. **공간 효율성**: 드롭다운 메뉴로 액션 버튼 공간 절약
4. **반응형 대응**: 모바일/태블릿/데스크톱에 맞게 정보 표시 최적화

## 기술적 세부사항

- **드롭다운 메뉴**: `useRef`와 `useEffect`를 사용한 외부 클릭 감지
- **상태 관리**: `useState`로 드롭다운 열림/닫힘 상태 관리
- **이벤트 처리**: `preventDefault`와 `stopPropagation`으로 Link 클릭과 충돌 방지
- **반응형 디자인**: Tailwind의 `hidden sm:block`, `md:block` 클래스 활용

## 테스트 항목

- [x] 템플릿 목록이 가로 긴 카드 형태로 표시되는지 확인
- [x] 드롭다운 메뉴가 정상적으로 열리고 닫히는지 확인
- [x] 외부 클릭 시 드롭다운이 닫히는지 확인
- [x] 상태 변경 기능이 정상 작동하는지 확인
- [x] 삭제 기능이 정상 작동하는지 확인
- [x] 반응형 레이아웃이 올바르게 작동하는지 확인

## 관련 파일

- `app/(admin)/admin/camp-templates/page.tsx`
- `app/(admin)/admin/camp-templates/_components/TemplateCard.tsx`

