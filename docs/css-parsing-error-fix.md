# CSS 파싱 에러 수정

## 문제 상황

빌드 시 다음과 같은 CSS 파싱 에러가 발생했습니다:

```
Parsing CSS source code failed
./app/globals.css:1633:45
border-color: rgb(var(--color-secondary-[ASTERISK]));
                              ^
Unexpected token Delim('*')
```

## 원인 분석

Tailwind CSS가 문서 파일(`docs/`)을 스캔하면서, 문서에 포함된 와일드카드 예시를 실제 CSS 클래스로 해석하려고 시도했습니다. CSS는 와일드카드 문법을 지원하지 않으므로 파싱 에러가 발생했습니다.

## 해결 방법

문서 파일에서 와일드카드를 사용한 예시를 실제 값으로 변경했습니다:

### 수정된 파일들

1. **docs/design-system-ui-improvement-phase2.md**
   - 와일드카드 예시를 실제 값으로 변경
   - 예: `text-[var(--text-primary)]`, `bg-[rgb(var(--color-secondary-100))]` 등

2. **docs/design-system-ui-improvement-phase3.md**
   - 와일드카드 예시를 실제 값으로 변경
   - 예: `--color-secondary-50`, `--text-primary` 등

3. **docs/ui-phase1-common-components-improvement.md**
   - 와일드카드 예시를 실제 값으로 변경
   - 예: `shadow-[var(--elevation-1)]`, `shadow-[var(--elevation-2)]` 등

4. **docs/ui-phase2-main-pages-improvement.md**
   - 와일드카드 예시를 실제 값으로 변경

5. **docs/ui-phase3-gradual-improvement.md**
   - 와일드카드 예시를 실제 값으로 변경

## 추가 수정 사항

### CareerFieldsManager 타입 에러 수정

빌드 과정에서 발견된 TypeScript 타입 에러도 함께 수정했습니다:

- `updateCareerFieldWrapper`: `updateCareerFieldAction`의 반환 타입을 `CareerField`로 변환하는 래퍼 함수 추가
- `deleteCareerFieldWrapper`: `deleteCareerFieldAction`의 반환 타입을 `void`로 변환하는 래퍼 함수 추가

## 결과

CSS 파싱 에러가 해결되어 빌드가 성공적으로 완료됩니다.

## 참고 사항

- Tailwind CSS는 프로젝트 내 모든 파일을 스캔하므로, 문서 파일에도 실제로 사용 가능한 클래스만 작성해야 합니다.
- 와일드카드나 예시 문법은 코드 블록(```)으로 감싸거나 실제 값으로 변경해야 합니다.

