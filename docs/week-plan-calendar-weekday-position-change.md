# 주별 플랜 캘린더 요일 위치 변경

## 작업 일자
2025-01-23

## 작업 내용
주별 플랜 캘린더에서 요일 표시를 카드 영역 밖 상단으로 이동했습니다.

## 변경 사항

### 파일
- `app/(student)/plan/calendar/_components/WeekView.tsx`

### 주요 변경 내용

1. **요일 헤더 분리**: 요일을 카드 영역 밖 상단에 별도로 표시하도록 변경
   - 기존: 각 카드 내부에 요일 표시
   - 변경: 카드 영역 위에 요일 헤더를 별도 그리드로 표시

2. **레이아웃 구조 변경**:
   ```tsx
   // 변경 전
   <div className="grid grid-cols-7 gap-2">
     {weekDays.map((date, index) => (
       <div>
         <div>{weekdays[index]}</div> {/* 카드 내부 */}
         <div>{date.getDate()}</div>
       </div>
     ))}
   </div>
   
   // 변경 후
   <div>
     {/* 요일 헤더 (카드 영역 밖 상단) */}
     <div className="grid grid-cols-7 gap-2 mb-2">
       {weekdays.map((day, index) => (
         <div key={index} className="text-center">
           <div className="text-sm font-semibold text-gray-700">
             {day}
           </div>
         </div>
       ))}
     </div>
     
     {/* 날짜 카드들 */}
     <div className="grid grid-cols-7 gap-2">
       {weekDays.map((date, index) => (
         <div>
           <div>{date.getDate()}</div> {/* 요일 제거 */}
         </div>
       ))}
     </div>
   </div>
   ```

3. **카드 내부 단순화**: 각 날짜 카드에서 요일 표시 부분을 제거하고 날짜와 날짜 형식만 표시

## UI 개선 효과

- **가독성 향상**: 요일을 상단에 고정하여 한눈에 확인 가능
- **레이아웃 정리**: 카드 내부가 더 깔끔해짐
- **일관성**: 월별 뷰와 유사한 레이아웃 구조로 일관성 향상

## 커밋 정보
- 커밋 해시: `e03561f`
- 커밋 메시지: "주별 플랜 캘린더에서 요일을 카드 영역 밖 상단으로 이동"

