# 템플릿 블록 세트 조회 통합 함수 사용 가이드

**작성일**: 2026-01-15  
**목적**: 템플릿 블록 세트 조회 로직 통합 및 사용법 안내

---

## 📋 목차

1. [개요](#1-개요)
2. [통합 함수 소개](#2-통합-함수-소개)
3. [사용법](#3-사용법)
4. [마이그레이션 가이드](#4-마이그레이션-가이드)
5. [예제 코드](#5-예제-코드)
6. [FAQ](#6-faq)

---

## 1. 개요

### 1.1 문제점

이전에는 템플릿 블록 세트 조회 로직이 4개 함수에 중복 구현되어 있었습니다:

1. `lib/plan/blocks.ts::getTemplateBlockSet` - 블록 정보 배열 반환
2. `lib/plan/blocks.ts::getTemplateBlockSetId` - ID만 반환
3. `lib/camp/campAdapter.ts::resolveCampBlockSetId` - ID만 반환, 다른 시그니처
4. `lib/domains/camp/actions/blockSets.ts::_getTemplateBlockSet` - Action용, 블록 세트 이름 포함

### 1.2 해결 방법

모든 템플릿 블록 세트 조회 로직을 2개의 통합 함수로 통합했습니다:

- `resolveTemplateBlockSetId`: 블록 세트 ID만 조회
- `getTemplateBlockSetInfo`: 블록 세트 정보 조회 (ID, 이름, 블록 정보 포함)

### 1.3 조회 순서

통합 함수는 다음 순서로 블록 세트를 조회합니다:

1. **`camp_template_block_sets` 연결 테이블** (우선순위 최상)
2. **`scheduler_options.template_block_set_id`** (Fallback)
3. **`template_data.block_set_id`** (하위 호환성, 마이그레이션 전 데이터용)

---

## 2. 통합 함수 소개

### 2.1 `resolveTemplateBlockSetId`

**목적**: 템플릿 블록 세트 ID만 조회

**파일**: `lib/domains/camp/utils/templateBlockSetResolver.ts`

**시그니처**:
```typescript
export async function resolveTemplateBlockSetId(
  supabase: SupabaseServerClient | undefined,
  options: ResolveTemplateBlockSetIdOptions
): Promise<string | null>
```

**옵션 타입**:
```typescript
interface ResolveTemplateBlockSetIdOptions {
  templateId: string;                    // 캠프 템플릿 ID (필수)
  schedulerOptions?: SchedulerOptions | null;  // Fallback용 (선택)
  tenantId?: string | null;               // 테넌트 ID (선택)
}
```

### 2.2 `getTemplateBlockSetInfo`

**목적**: 템플릿 블록 세트 정보 조회 (ID, 이름, 블록 정보 포함)

**파일**: `lib/domains/camp/utils/templateBlockSetResolver.ts`

**시그니처**:
```typescript
export async function getTemplateBlockSetInfo(
  supabase: SupabaseServerClient | undefined,
  options: GetTemplateBlockSetInfoOptions
): Promise<TemplateBlockSetInfo | null>
```

**옵션 타입**:
```typescript
interface GetTemplateBlockSetInfoOptions extends ResolveTemplateBlockSetIdOptions {
  includeBlocks?: boolean;  // 블록 정보 포함 여부 (기본값: false)
  includeName?: boolean;     // 블록 세트 이름 포함 여부 (기본값: false)
}
```

**반환 타입**:
```typescript
interface TemplateBlockSetInfo {
  id: string;                    // 블록 세트 ID (항상 포함)
  name?: string;                  // 블록 세트 이름 (includeName이 true일 때만)
  blocks?: BlockInfo[];           // 블록 정보 배열 (includeBlocks가 true일 때만)
}
```

---

## 3. 사용법

### 3.1 블록 세트 ID만 조회

```typescript
import { resolveTemplateBlockSetId } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Supabase 클라이언트 생성
const supabase = await createSupabaseServerClient();

// 블록 세트 ID 조회
const blockSetId = await resolveTemplateBlockSetId(supabase, {
  templateId: "template-123",
  schedulerOptions: { template_block_set_id: "fallback-id" }, // 선택사항
  tenantId: "tenant-id", // 선택사항
});

if (!blockSetId) {
  console.log("블록 세트를 찾을 수 없습니다.");
  return;
}

console.log("블록 세트 ID:", blockSetId);
```

### 3.2 블록 세트 정보 조회 (이름 포함)

```typescript
import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();

const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
  templateId: "template-123",
  includeName: true,  // 이름 포함
  includeBlocks: false, // 블록 정보는 제외
  tenantId: "tenant-id",
});

if (!blockSetInfo) {
  console.log("블록 세트를 찾을 수 없습니다.");
  return;
}

console.log("블록 세트 ID:", blockSetInfo.id);
console.log("블록 세트 이름:", blockSetInfo.name);
```

### 3.3 블록 세트 정보 조회 (블록 정보 포함)

```typescript
import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();

const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
  templateId: "template-123",
  includeBlocks: true,  // 블록 정보 포함
  includeName: false,   // 이름은 제외
  tenantId: "tenant-id",
});

if (!blockSetInfo) {
  console.log("블록 세트를 찾을 수 없습니다.");
  return;
}

console.log("블록 세트 ID:", blockSetInfo.id);
console.log("블록 개수:", blockSetInfo.blocks?.length ?? 0);
blockSetInfo.blocks?.forEach((block) => {
  console.log(`요일: ${block.day_of_week}, 시간: ${block.start_time} - ${block.end_time}`);
});
```

### 3.4 전체 정보 조회

```typescript
import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();

const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
  templateId: "template-123",
  includeBlocks: true,  // 블록 정보 포함
  includeName: true,     // 이름 포함
  tenantId: "tenant-id",
});

if (!blockSetInfo) {
  console.log("블록 세트를 찾을 수 없습니다.");
  return;
}

console.log("블록 세트 ID:", blockSetInfo.id);
console.log("블록 세트 이름:", blockSetInfo.name);
console.log("블록 개수:", blockSetInfo.blocks?.length ?? 0);
```

---

## 4. 마이그레이션 가이드

### 4.1 기존 함수 사용 중인 경우

기존 함수들은 내부적으로 통합 함수를 사용하도록 변경되었으므로, 기존 코드는 그대로 동작합니다. 하지만 새로운 코드에서는 통합 함수를 직접 사용하는 것을 권장합니다.

### 4.2 마이그레이션 예시

#### Before: `getTemplateBlockSetId` 사용

```typescript
// ❌ 기존 방식 (deprecated)
import { getTemplateBlockSetId } from "@/lib/plan/blocks";

const blockSetId = await getTemplateBlockSetId(
  "template-123",
  { template_block_set_id: "fallback-id" },
  "tenant-id"
);
```

#### After: `resolveTemplateBlockSetId` 사용

```typescript
// ✅ 새로운 방식
import { resolveTemplateBlockSetId } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();
const blockSetId = await resolveTemplateBlockSetId(supabase, {
  templateId: "template-123",
  schedulerOptions: { template_block_set_id: "fallback-id" },
  tenantId: "tenant-id",
});
```

#### Before: `getTemplateBlockSet` 사용

```typescript
// ❌ 기존 방식 (deprecated)
import { getTemplateBlockSet } from "@/lib/plan/blocks";

const blocks = await getTemplateBlockSet("template-123", "tenant-id");
```

#### After: `getTemplateBlockSetInfo` 사용

```typescript
// ✅ 새로운 방식
import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();
const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
  templateId: "template-123",
  includeBlocks: true,
  tenantId: "tenant-id",
});

const blocks = blockSetInfo?.blocks ?? null;
```

---

## 5. 예제 코드

### 5.1 Server Action에서 사용

```typescript
"use server";

import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getTemplateBlocks(templateId: string) {
  const supabase = await createSupabaseServerClient();
  
  const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
    templateId,
    includeBlocks: true,
    includeName: true,
  });

  if (!blockSetInfo) {
    return {
      success: false,
      error: "블록 세트를 찾을 수 없습니다.",
    };
  }

  return {
    success: true,
    data: {
      id: blockSetInfo.id,
      name: blockSetInfo.name,
      blocks: blockSetInfo.blocks,
    },
  };
}
```

### 5.2 컴포넌트에서 사용

```typescript
import { getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TemplateBlocksViewer({
  templateId,
}: {
  templateId: string;
}) {
  const supabase = await createSupabaseServerClient();
  
  const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
    templateId,
    includeBlocks: true,
    includeName: true,
  });

  if (!blockSetInfo) {
    return <div>블록 세트를 찾을 수 없습니다.</div>;
  }

  return (
    <div>
      <h2>{blockSetInfo.name}</h2>
      <ul>
        {blockSetInfo.blocks?.map((block, index) => (
          <li key={index}>
            요일 {block.day_of_week}: {block.start_time} - {block.end_time}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 6. FAQ

### Q1. 기존 함수를 계속 사용해도 되나요?

**A**: 네, 기존 함수들은 내부적으로 통합 함수를 사용하도록 변경되었으므로 계속 사용할 수 있습니다. 하지만 새로운 코드에서는 통합 함수를 직접 사용하는 것을 권장합니다.

### Q2. Supabase 클라이언트를 매번 생성해야 하나요?

**A**: 네, 각 함수 호출 시 Supabase 클라이언트를 전달해야 합니다. 하지만 `undefined`를 전달하면 내부에서 자동으로 생성됩니다:

```typescript
// ✅ 내부에서 자동 생성
const blockSetId = await resolveTemplateBlockSetId(undefined, {
  templateId: "template-123",
});
```

### Q3. 에러 처리는 어떻게 하나요?

**A**: 통합 함수는 에러 발생 시 `logError`를 통해 로깅하고, DB 에러는 throw합니다. 호출자는 try-catch로 처리할 수 있습니다:

```typescript
try {
  const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
    templateId: "template-123",
    includeBlocks: true,
  });
} catch (error) {
  // DB 에러 처리
  console.error("블록 세트 조회 실패:", error);
}
```

### Q4. 조회 순서를 변경할 수 있나요?

**A**: 아니요, 조회 순서는 고정되어 있습니다. 이는 데이터 일관성과 하위 호환성을 보장하기 위함입니다.

### Q5. 성능에 영향을 주나요?

**A**: 통합 함수는 기존 함수들과 동일한 쿼리를 수행하므로 성능 차이는 없습니다. 오히려 코드 중복이 제거되어 유지보수성이 향상되었습니다.

---

## 7. 참고 자료

- [비즈니스 로직 문제점 분석](./2026-01-15-business-logic-issues-and-improvements.md)
- [템플릿 블록 세트 분리 리팩토링](./block-set-template-separation-refactoring.md)
- 통합 함수 소스 코드: `lib/domains/camp/utils/templateBlockSetResolver.ts`

---

**마지막 업데이트**: 2026-01-15

