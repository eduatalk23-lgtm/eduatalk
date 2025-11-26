# 캠프 제출 템플릿 기본값 시간블럭 조회 수정

## 🔍 문제 상황

학생이 제출한 템플릿 상세보기 페이지에서 템플릿에 `block_set_id`가 없거나 블록이 없을 때 기본값으로 설정되었던 시간블럭이 조회되지 않는 문제가 있었습니다.

### 원인 분석

1. **기본값 블록 처리 로직 부재**
   - `app/(student)/camp/[invitationId]/submitted/page.tsx`에서 템플릿 블록 조회 시
   - `block_set_id`가 없거나 블록이 없으면 `templateBlocks`가 빈 배열로 유지됨
   - `templateBlockSetName`도 `null`로 유지됨
   - 결과적으로 `Step2DetailView`에서 "등록된 시간 블록이 없습니다." 메시지만 표시됨

2. **기본값 블록 유틸리티 미활용**
   - `lib/utils/defaultBlockSet.ts`에 기본값 블록 유틸리티가 존재하지만
   - 제출 템플릿 상세보기에서는 사용되지 않음

## 🛠 해결 방법

### 수정 내용

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

#### 1. 기본값 블록 유틸리티 import 추가

```typescript
import {
  getDefaultBlocks,
  DEFAULT_BLOCK_SET_NAME,
} from "@/lib/utils/defaultBlockSet";
```

#### 2. 기본값 블록 설정 로직 추가

템플릿 블록 조회가 완료된 후, `templateBlocks`가 비어있고 `templateBlockSetName`이 `null`일 때 기본값 블록을 설정하도록 수정:

```typescript
// block_set_id가 없거나 블록이 없을 때 기본값 블록 사용
if (templateBlocks.length === 0 && !templateBlockSetName) {
  const defaultBlocks = getDefaultBlocks();
  templateBlocks = defaultBlocks.map((block) => ({
    id: `default-${block.day_of_week}`,
    day_of_week: block.day_of_week,
    start_time: block.start_time,
    end_time: block.end_time,
  }));
  templateBlockSetName = DEFAULT_BLOCK_SET_NAME;
  console.log("[CampSubmissionDetailPage] 기본값 블록 사용:", {
    count: templateBlocks.length,
    blocks: templateBlocks,
  });
}
```

#### 3. 에러 처리 시 기본값 블록 사용

에러 발생 시에도 기본값 블록을 사용하도록 catch 블록에 로직 추가:

```typescript
catch (error) {
  console.error("[CampSubmissionDetailPage] 템플릿 블록 조회 중 에러:", error);
  
  // 에러 발생 시에도 기본값 블록 사용
  if (templateBlocks.length === 0 && !templateBlockSetName) {
    const defaultBlocks = getDefaultBlocks();
    templateBlocks = defaultBlocks.map((block) => ({
      id: `default-${block.day_of_week}`,
      day_of_week: block.day_of_week,
      start_time: block.start_time,
      end_time: block.end_time,
    }));
    templateBlockSetName = DEFAULT_BLOCK_SET_NAME;
    console.log("[CampSubmissionDetailPage] 에러 발생 후 기본값 블록 사용:", {
      count: templateBlocks.length,
    });
  }
}
```

## 📋 변경 사항 요약

1. **기본값 블록 유틸리티 import 추가**
   - `getDefaultBlocks()`: 기본값 블록 정보 반환
   - `DEFAULT_BLOCK_SET_NAME`: 기본 블록 세트 이름 ("기본 블록 세트")

2. **기본값 블록 설정 로직 추가**
   - `block_set_id`가 없거나 블록이 없을 때 기본값 블록 사용
   - 각 블록에 임시 ID 부여 (`default-${day_of_week}`)
   - 기본값 블록 세트 이름 설정

3. **에러 처리 강화**
   - 에러 발생 시에도 기본값 블록 사용
   - 디버깅을 위한 로그 추가

## ✅ 테스트 시나리오

1. **정상 케이스**: `block_set_id`가 있고 블록이 있는 경우
   - 기존처럼 템플릿 블록이 표시됨

2. **기본값 케이스 1**: `block_set_id`가 없는 경우
   - 기본값 블록(월~일 10:00~19:00)이 표시됨
   - 블록 세트 이름: "기본 블록 세트"

3. **기본값 케이스 2**: `block_set_id`는 있지만 블록이 없는 경우
   - 기본값 블록이 표시됨

4. **에러 케이스**: 블록 조회 중 에러 발생
   - 기본값 블록이 표시됨

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 수정된 파일
- `lib/utils/defaultBlockSet.ts` - 기본값 블록 유틸리티
- `app/(student)/plan/group/[id]/_components/Step2DetailView.tsx` - 템플릿 블록 표시 컴포넌트

## 📝 참고 사항

- 기본값 블록: 월~일(1~0) 10:00~19:00
- 기본 블록 세트 이름: "기본 블록 세트"
- 기본값 블록의 ID는 `default-${day_of_week}` 형식으로 생성됨
- 템플릿에 블록 세트가 설정되어 있으면 기본값을 사용하지 않음

