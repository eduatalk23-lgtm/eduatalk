/**
 * ChatInput 컴포넌트 테스트
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput } from "@/components/chat/molecules/ChatInput";

describe("ChatInput", () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("기본 렌더링", () => {
    it("placeholder가 표시됨", () => {
      render(<ChatInput onSend={mockOnSend} />);

      expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toBeInTheDocument();
    });

    it("custom placeholder 지원", () => {
      render(<ChatInput onSend={mockOnSend} placeholder="Type here..." />);

      expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
    });

    it("전송 버튼이 존재함", () => {
      render(<ChatInput onSend={mockOnSend} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("메시지 전송", () => {
    it("Enter로 전송", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "Hello{enter}");

      expect(mockOnSend).toHaveBeenCalledWith("Hello");
    });

    it("전송 버튼 클릭으로 전송", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "Hello");

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockOnSend).toHaveBeenCalledWith("Hello");
    });

    it("전송 후 입력창 초기화", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...") as HTMLTextAreaElement;
      await user.type(textarea, "Hello{enter}");

      expect(textarea.value).toBe("");
    });

    it("Shift+Enter는 줄바꿈", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...") as HTMLTextAreaElement;
      await user.type(textarea, "Line1{shift>}{enter}{/shift}Line2");

      expect(mockOnSend).not.toHaveBeenCalled();
      expect(textarea.value).toContain("Line1");
      expect(textarea.value).toContain("Line2");
    });
  });

  describe("빈 메시지 검증", () => {
    it("빈 문자열은 전송 불가", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "{enter}");

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it("공백만 있는 메시지는 전송 불가", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "   {enter}");

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it("빈 입력창일 때 전송 버튼 비활성화", () => {
      render(<ChatInput onSend={mockOnSend} />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("한글 IME 처리", () => {
    it("한글 조합 중에는 Enter로 전송 방지", () => {
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");

      // IME 조합 시작
      fireEvent.compositionStart(textarea);
      fireEvent.change(textarea, { target: { value: "안녕" } });

      // 조합 중 Enter
      fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it("한글 조합 완료 후에는 Enter로 전송 가능", () => {
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");

      // IME 조합 시작 → 완료
      fireEvent.compositionStart(textarea);
      fireEvent.change(textarea, { target: { value: "안녕" } });
      fireEvent.compositionEnd(textarea);

      // 조합 완료 후 Enter
      fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

      expect(mockOnSend).toHaveBeenCalledWith("안녕");
    });
  });

  describe("글자 수 제한", () => {
    it("maxLength 초과 입력 방지", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} maxLength={10} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...") as HTMLTextAreaElement;
      await user.type(textarea, "12345678901234567890"); // 20자 입력 시도

      expect(textarea.value.length).toBeLessThanOrEqual(10);
    });

    it("80% 초과 입력 시 글자 수 표시", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} maxLength={10} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "123456789"); // 90% (9/10) - 80% 초과

      expect(screen.getByText("9/10")).toBeInTheDocument();
    });

    it("80% 미만일 때는 글자 수 미표시", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} maxLength={10} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "1234567"); // 70% (7/10)

      expect(screen.queryByText(/\/10/)).not.toBeInTheDocument();
    });
  });

  describe("상태 관리", () => {
    it("isSending 중에는 전송 불가", async () => {
      const user = userEvent.setup();
      render(<ChatInput onSend={mockOnSend} isSending={true} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      await user.type(textarea, "Hello");

      const button = screen.getByRole("button");
      await user.click(button);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it("disabled 상태에서는 입력 불가", () => {
      render(<ChatInput onSend={mockOnSend} disabled={true} />);

      const textarea = screen.getByPlaceholderText("메시지를 입력하세요...");
      expect(textarea).toBeDisabled();
    });
  });
});
