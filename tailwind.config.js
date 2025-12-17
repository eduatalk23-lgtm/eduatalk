/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    // docs 폴더는 제외하여 와일드카드 예시로 인한 파싱 에러 방지
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

