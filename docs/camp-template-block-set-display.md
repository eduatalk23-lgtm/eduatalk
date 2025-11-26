# 캠프 템플릿 상세보기 블록 세트 정보 표시

## 🔍 요구사항

관리자가 캠프 템플릿을 생성한 후, 템플릿 상세보기 페이지의 "템플릿 설정 정보" 섹션에서 블록 세트 정보를 표시해야 합니다.

## 🛠 구현 내용

### 1. 템플릿 블록 세트 정보 조회

**파일**: `app/(admin)/admin/camp-templates/[id]/page.tsx`

템플릿 상세보기 페이지에서 템플릿 블록 세트 정보를 조회하도록 추가:

```typescript
// 템플릿 블록 세트 정보 조회
let templateBlockSet: {
  id: string;
  name: string;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
} | null = null;

const template = result.template;
const templateData = template.template_data as any;
const blockSetId = templateData?.block_set_id;

if (blockSetId) {
  const supabase = await createSupabaseServerClient();
  
  // 템플릿 블록 세트 조회
  const { data: blockSet } = await supabase
    .from("template_block_sets")
    .select("id, name, template_id")
    .eq("id", blockSetId)
    .eq("template_id", id)
    .maybeSingle();

  if (blockSet) {
    // 템플릿 블록 조회
    const { data: blocks } = await supabase
      .from("template_blocks")
      .select("id, day_of_week, start_time, end_time")
      .eq("template_block_set_id", blockSet.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (blocks && blocks.length > 0) {
      templateBlockSet = {
        id: blockSet.id,
        name: blockSet.name,
        blocks: blocks.map((b) => ({
          id: b.id,
          day_of_week: b.day_of_week,
          start_time: b.start_time,
          end_time: b.end_time,
        })),
      };
    }
  }
}
```

### 2. 컴포넌트 Props 추가

**파일**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

`CampTemplateDetail` 컴포넌트에 `templateBlockSet` props 추가:

```typescript
type CampTemplateDetailProps = {
  template: CampTemplate;
  templateBlockSet?: {
    id: string;
    name: string;
    blocks: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  } | null;
};
```

### 3. 블록 세트 정보 표시

템플릿 설정 정보 섹션에 블록 세트 정보를 표시:

```typescript
{/* 블록 세트 정보 */}
{templateBlockSet && (
  <div className="md:col-span-2">
    <label className="text-sm font-medium text-gray-700">블록 세트</label>
    <div className="mt-2 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{templateBlockSet.name}</p>
      </div>
      {templateBlockSet.blocks.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templateBlockSet.blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <div className="text-sm font-medium text-gray-900">
                {weekdayLabels[block.day_of_week]}
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

### `app/(admin)/admin/camp-templates/[id]/page.tsx`

1. **템플릿 블록 세트 정보 조회 로직 추가**
   - `template_data.block_set_id`에서 블록 세트 ID 확인
   - `template_block_sets` 테이블에서 블록 세트 정보 조회
   - `template_blocks` 테이블에서 블록 목록 조회
   - 블록 세트 정보를 `CampTemplateDetail` 컴포넌트에 전달

### `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

1. **Props 타입 확장**
   - `templateBlockSet` props 추가 (optional)

2. **블록 세트 정보 표시 UI 추가**
   - 템플릿 설정 정보 섹션에 블록 세트 이름 및 블록 목록 표시
   - 요일별 시간 블록을 그리드 형태로 표시
   - 블록이 없을 경우 안내 메시지 표시

## ✅ 검증 체크리스트

- [x] 템플릿 상세보기 페이지에서 블록 세트 정보 조회 확인
- [x] 블록 세트 이름 표시 확인
- [x] 블록 목록 표시 확인
- [x] 요일 및 시간 정보 표시 확인
- [x] 블록이 없을 경우 안내 메시지 표시 확인

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/[id]/page.tsx` - 템플릿 상세보기 페이지 (서버 컴포넌트)
- `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx` - 템플릿 상세보기 컴포넌트 (클라이언트 컴포넌트)

## 📝 참고 사항

- 템플릿 블록 세트는 `template_block_sets` 테이블에 저장되며, `template_id`로 템플릿과 연결됨
- 템플릿 블록은 `template_blocks` 테이블에 저장되며, `template_block_set_id`로 블록 세트와 연결됨
- 블록 세트 ID는 `template_data.block_set_id`에 저장됨
- 블록은 요일(`day_of_week`)과 시작/종료 시간(`start_time`, `end_time`)으로 구성됨

## 날짜

2024-11-24

