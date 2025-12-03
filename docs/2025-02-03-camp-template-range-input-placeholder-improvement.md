# 캠프 템플릿 범위 입력 placeholder 개선

## 작업 일자
2025-02-03

## 문제점
캠프 템플릿 작성 시 상세 정보가 없어 직접 범위를 입력하는 영역에서 placeholder가 "1", "150"처럼 숫자만 표시되어 예시처럼 보이지 않는 문제가 있었습니다.

## 해결 방법
다른 파일(`Step3Contents.tsx`)에서 사용하는 패턴과 일관성을 맞추기 위해 placeholder에 "예:" 접두사를 추가했습니다.

## 수정 파일

### `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`

**변경 사항:**

1. **시작 범위 입력 필드** (162번째 줄)
   - 변경 전: `placeholder="1"`
   - 변경 후: `placeholder="예: 1"`

2. **종료 범위 입력 필드** (183번째 줄)
   - 변경 전: `placeholder={maxValue ? String(maxValue) : "100"}`
   - 변경 후: `placeholder={maxValue ? \`예: ${maxValue}\` : "예: 100"}`

## 변경 내용 상세

```162:162:app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx
            placeholder="예: 1"
```

```183:183:app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx
            placeholder={maxValue ? `예: ${maxValue}` : "예: 100"}
```

## 효과
- 사용자가 placeholder를 보고 예시임을 명확히 인지할 수 있게 됨
- 다른 입력 필드들과 일관된 UI/UX 제공
- 색이 진해도 "예:" 접두사로 예시임을 명확히 구분 가능

## 테스트 확인 사항
- [x] 시작 범위 입력 필드에 "예: 1" placeholder 표시 확인
- [x] 종료 범위 입력 필드에 "예: {maxValue}" 또는 "예: 100" placeholder 표시 확인
- [x] 교재(페이지)와 강의(회차) 모두에서 정상 작동 확인
- [x] 린터 오류 없음 확인

