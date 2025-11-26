# 캠프 템플릿 블록 세트 자동 선택 수정

## 🔍 문제 상황

캠프 템플릿을 생성할 때 입력한 시간 블록 정보가 학생 입력 진행 시 전달되지 않는 문제:

1. **템플릿 블록 세트가 목록에 없음**
   - 템플릿의 `block_set_id`는 `template_block_sets` 테이블의 ID
   - `initialBlockSets`는 학생의 `student_block_sets`만 포함
   - 따라서 템플릿 블록 세트가 선택 목록에 표시되지 않음

2. **블록 세트가 선택되지 않은 상태**
   - `data.block_set_id`는 초기값으로 설정되어 있지만
   - `blockSets.find((set) => set.id === data.block_set_id)`가 항상 `undefined`를 반환
   - 결과적으로 블록 세트가 선택되지 않은 상태로 표시됨

## 🛠 해결 방법

### 수정 내용

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

1. **템플릿 블록 세트 조회 및 블록 정보 포함**
   ```typescript
   // 템플릿 블록 세트 조회
   const { data: templateBlockSetData } = await supabase
     .from("template_block_sets")
     .select("id, name")
     .eq("id", templateData.block_set_id)
     .eq("template_id", template.id)
     .single();

   // 템플릿 블록 조회
   const { data: templateBlocks } = await supabase
     .from("template_blocks")
     .select("id, day_of_week, start_time, end_time")
     .eq("template_block_set_id", templateData.block_set_id)
     .order("day_of_week", { ascending: true })
     .order("start_time", { ascending: true });

   // 템플릿 블록 세트 객체 생성
   templateBlockSet = {
     id: templateBlockSetData.id,
     name: `${templateBlockSetData.name} (템플릿)`,
     blocks: templateBlocks.map((b) => ({
       id: b.id,
       day_of_week: b.day_of_week,
       start_time: b.start_time,
       end_time: b.end_time,
     })),
   };
   ```

2. **학생 블록 세트와 템플릿 블록 세트 병합**
   ```typescript
   // 템플릿 블록 세트를 맨 앞에 추가하여 우선 표시
   const blockSets = templateBlockSet
     ? [templateBlockSet, ...studentBlockSets]
     : studentBlockSets;
   ```

3. **디버깅 로그 추가**
   ```typescript
   if (process.env.NODE_ENV === "development") {
     console.log("[CampParticipationPage] 블록 세트 목록:", {
       templateBlockSet: templateBlockSet ? { ... } : null,
       studentBlockSetsCount: studentBlockSets.length,
       totalBlockSetsCount: blockSets.length,
       templateBlockSetId: templateData.block_set_id,
       willBeSelected: blockSets.some(
         (bs) => bs.id === templateData.block_set_id
       ),
     });
   }
   ```

## ✅ 결과

이제 캠프 템플릿의 블록 세트가:

1. **자동으로 선택됨**
   - `initialData.block_set_id`에 템플릿 블록 세트 ID가 포함
   - `blockSets` 목록에 템플릿 블록 세트가 포함
   - `data.block_set_id === set.id` 비교가 성공하여 자동 선택

2. **목록에 표시됨**
   - 템플릿 블록 세트가 목록의 맨 앞에 표시
   - 이름에 "(템플릿)" 접미사 추가로 구분 가능

3. **블록 정보 표시됨**
   - 템플릿 블록 세트의 블록 정보가 정상적으로 표시됨
   - Step1BasicInfo에서 선택된 블록 세트의 시간 블록 정보 표시

4. **읽기 전용 처리**
   - `canStudentInputBlockSetId`가 `false`이면 블록 세트 선택 비활성화
   - 템플릿 블록 세트는 수정 불가 (템플릿에서 관리)

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/page.tsx` - 캠프 참여 페이지
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx` - Step1 컴포넌트
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - 위저드 컴포넌트

## 📝 테스트 시나리오

### 시나리오 1: 템플릿 블록 세트 자동 선택
1. 관리자가 캠프 템플릿 생성 시 블록 세트 선택
2. 학생이 캠프 참여 페이지 접속
3. **예상 결과**: 템플릿 블록 세트가 자동으로 선택되어 표시됨

### 시나리오 2: 템플릿 블록 정보 표시
1. 템플릿 블록 세트에 블록이 있는 경우
2. Step1에서 블록 세트 선택 영역 확인
3. **예상 결과**: 선택된 블록 세트의 시간 블록 정보가 요일별로 표시됨

### 시나리오 3: 블록 세트 선택 비활성화
1. 템플릿에서 `allow_student_block_set_id: false` 설정
2. 학생이 캠프 참여 페이지 접속
3. **예상 결과**: 블록 세트 선택이 비활성화되어 변경 불가









