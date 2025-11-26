# 캠프 템플릿 블록 세트 기본값 로직 삭제 및 템플릿 저장 전 블록 세트 생성 가능하도록 개선

## 작업 개요

캠프 템플릿 생성 시 블록 세트 기본값 자동 생성 로직을 삭제하고, 템플릿 저장 전에도 블록 세트를 생성/등록할 수 있도록 개선했습니다.

## 작업 날짜

2024년 11월

## 주요 변경 사항

### 1. Step1BasicInfo.tsx - 템플릿 모드 블록 세트 생성 로직 개선

#### 변경 전
- 템플릿 ID가 없으면 블록 세트 생성 불가능
- 블록이 없으면 기본값(월~일 10:00~19:00) 자동 생성

#### 변경 후
- 템플릿 ID가 없어도 블록 세트 생성 가능 (템플릿에 연결되지 않은 블록 세트로 생성)
- 사용자가 명시적으로 추가한 블록만 생성 (기본값 자동 생성 제거)

#### 주요 수정 내용

1. **템플릿 ID 체크 제거** (483-488줄 삭제)
   ```typescript
   // 삭제: templateId 체크 및 alert
   if (!templateId) {
     alert("블록 세트를 생성하려면 먼저 템플릿을 저장해주세요...");
     return;
   }
   ```

2. **템플릿 ID 선택적 처리** (492줄 수정)
   ```typescript
   // templateId가 있으면 추가, 없으면 템플릿에 연결되지 않은 블록 세트로 생성
   if (templateId) {
     formData.append("template_id", templateId);
   }
   ```

3. **기본값 자동 생성 로직 삭제** (499-508줄 수정)
   ```typescript
   // 변경 전: 블록이 없으면 기본값 자동 생성
   const blocksToAdd = addedBlocks.length > 0
     ? addedBlocks
     : [1, 2, 3, 4, 5, 6, 0].map((day) => ({
         day,
         startTime: "10:00",
         endTime: "19:00",
       }));

   // 변경 후: 사용자가 명시적으로 추가한 블록만 생성
   if (addedBlocks.length > 0) {
     for (const block of addedBlocks) {
       // 블록 추가 로직
     }
   }
   ```

4. **getTemplateBlockSets 호출 시 null 처리** (모든 호출부 수정)
   ```typescript
   // templateId가 undefined일 수 있으므로 null로 변환
   const latestBlockSets = await getTemplateBlockSets(templateId || null);
   ```

5. **블록 추가/삭제/수정 시 템플릿 ID 체크 제거**
   - `handleAddBlocksToSet`: templateId 체크 제거
   - `handleDeleteBlock`: templateId 체크 제거
   - `handleUpdateBlockSetName`: templateId 체크 제거

### 2. campTemplateActions.ts - 디버깅 로그 및 주석 정리

#### 변경 내용

1. **템플릿 생성 전 디버깅 로그 제거** (376-380줄 삭제)
   ```typescript
   // 삭제: 기본값 생성 관련 디버깅 로그
   console.log("[createCampTemplateAction] 템플릿 생성 전 최종 확인:", {
     block_set_id: templateData.block_set_id,
     template_data_has_block_set_id: !!templateData.block_set_id,
     will_create_default_block_set: !templateData.block_set_id,
   });
   ```

2. **템플릿 생성 완료 디버깅 로그 제거** (394-397줄 삭제)
   ```typescript
   // 삭제: 블록 세트 ID 관련 디버깅 로그
   console.log("[createCampTemplateAction] 템플릿 생성 완료:", {
     templateId: result.templateId,
     block_set_id: templateData.block_set_id,
   });
   ```

3. **템플릿 데이터 파싱 디버깅 로그 제거** (329-335줄 삭제)
   ```typescript
   // 삭제: block_set_id 저장 확인 디버깅 로그
   console.log("[createCampTemplateAction] 템플릿 데이터 파싱 결과:", {
     has_block_set_id: !!templateData.block_set_id,
     block_set_id: templateData.block_set_id,
     templateDataKeys: Object.keys(templateData),
     original_block_set_id: JSON.parse(templateDataJson).block_set_id,
   });
   ```

4. **주석 정리** (408-409줄 삭제)
   ```typescript
   // 삭제: 불필요한 주석
   // 블록 세트는 템플릿 생성 후 시간 관리 페이지에서 생성하도록 변경
   // 기본값 자동 생성 로직 제거
   ```

## 영향 범위

### 영향받는 기능

1. **캠프 템플릿 생성 페이지**
   - 템플릿 저장 전에도 블록 세트 생성 가능
   - 블록 세트 기본값 자동 생성 제거

2. **캠프 템플릿 편집 페이지**
   - 동일한 로직 적용

3. **관리자 시간 관리 페이지**
   - 템플릿에 연결되지 않은 블록 세트 생성 지원 (이미 구현되어 있음)

### 영향받지 않는 기능

- 일반 학생 모드 블록 세트 생성 (변경 없음)
- 캠프 모드 학생 참여 페이지 (변경 없음)

## 사용자 경험 개선

### 변경 전
1. 템플릿을 먼저 저장해야만 블록 세트 생성 가능
2. 블록을 추가하지 않으면 기본값 블록이 자동 생성됨
3. 템플릿 저장 후 시간 관리 페이지로 이동해야 블록 세트 생성 가능

### 변경 후
1. 템플릿 저장 전에도 블록 세트 생성 가능
2. 사용자가 명시적으로 추가한 블록만 생성
3. 템플릿 생성 과정 중에 바로 블록 세트 생성 및 등록 가능
4. 템플릿 저장 후 나중에 템플릿에 연결 가능

## 테스트 체크리스트

- [ ] 템플릿 저장 전에 블록 세트 생성 가능한지 확인
- [ ] 템플릿 저장 전 생성한 블록 세트가 템플릿에 연결되지 않은 상태로 저장되는지 확인
- [ ] 블록을 추가하지 않고 블록 세트만 생성했을 때 기본값 블록이 자동 생성되지 않는지 확인
- [ ] 템플릿 저장 후 편집 모드에서 블록 세트 생성 및 연결이 정상 작동하는지 확인
- [ ] 템플릿 ID가 있는 상태에서 블록 세트 생성 시 정상적으로 연결되는지 확인
- [ ] 블록 추가/삭제/수정 기능이 템플릿 ID 없이도 작동하는지 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `app/(admin)/actions/campTemplateActions.ts`
- `app/(admin)/actions/templateBlockSets.ts` (변경 없음, 이미 템플릿 ID 선택적 처리 구현됨)

## 참고 문서

- `docs/admin-time-management-template-independent.md` - 템플릿 독립적 블록 세트 생성 기능
- `docs/블록-세트-기본값-로직-분석.md` - 기본값 로직 분석 문서

