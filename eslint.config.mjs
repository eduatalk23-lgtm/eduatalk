import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Spacing-First 정책: margin 클래스 사용 금지
      // 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리
      "no-restricted-syntax": [
        "warn", // error 대신 warn으로 설정하여 기존 코드와의 호환성 유지
        {
          // JSX className 속성의 문자열 리터럴에서 margin 클래스 감지
          selector:
            'JSXAttribute[name.name="className"] > Literal[value=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
        {
          // Template literal에서 margin 클래스 감지
          selector:
            'TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
        {
          // 일반 문자열 리터럴에서 margin 클래스 감지 (className 변수 등)
          selector:
            'Literal[value=/\\b(mt|mb|ml|mr|mx|my)-\\d+/]',
          message:
            "Spacing-First 정책: margin 클래스를 사용하지 마세요. 형제 요소 간격은 부모의 gap으로, 외곽 여백은 최상단 래퍼의 padding으로 관리하세요.",
        },
      ],
    },
  },
]);

export default eslintConfig;
