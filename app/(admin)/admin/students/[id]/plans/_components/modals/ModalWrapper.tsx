'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * 모달 테마 색상 정의
 * - blue: 기본 액션 (콘텐츠 추가, 플랜 그룹 등)
 * - amber: 빠른 액션 (빠른 추가)
 * - purple: 특별 액션 (단발성, AI 관련)
 * - green: 성공/완료 관련
 * - red: 삭제/위험 액션
 */
export type ModalTheme = 'blue' | 'amber' | 'purple' | 'green' | 'red';

interface ModalWrapperProps {
  /** 모달이 열려있는지 여부 */
  open: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 모달 제목 */
  title: string;
  /** 모달 부제목 (선택) */
  subtitle?: string;
  /** 헤더 아이콘 (선택) */
  icon?: ReactNode;
  /** 테마 색상 */
  theme?: ModalTheme;
  /** 모달 너비 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 로딩 상태 */
  loading?: boolean;
  /** 모달 내용 */
  children: ReactNode;
  /** 푸터 내용 (버튼 등) */
  footer?: ReactNode;
  /** ESC 키로 닫기 비활성화 */
  disableEscapeClose?: boolean;
  /** 배경 클릭으로 닫기 비활성화 */
  disableBackdropClose?: boolean;
}

const sizeClasses: Record<NonNullable<ModalWrapperProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const themeClasses: Record<ModalTheme, { iconBg: string; iconText: string }> = {
  blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
  amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
  purple: { iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  green: { iconBg: 'bg-green-100', iconText: 'text-green-600' },
  red: { iconBg: 'bg-red-100', iconText: 'text-red-600' },
};

export function ModalWrapper({
  open,
  onClose,
  title,
  subtitle,
  icon,
  theme = 'blue',
  size = 'md',
  loading = false,
  children,
  footer,
  disableEscapeClose = false,
  disableBackdropClose = false,
}: ModalWrapperProps) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscapeClose) {
        onClose();
      }
    },
    [onClose, disableEscapeClose]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // 배경 클릭으로 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !disableBackdropClose) {
        onClose();
      }
    },
    [onClose, disableBackdropClose]
  );

  if (!open) return null;

  const themeStyle = themeClasses[theme];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'bg-white rounded-xl w-full shadow-xl flex flex-col max-h-[90vh]',
          sizeClasses[size],
          loading && 'opacity-70 pointer-events-none'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn('p-2 rounded-lg', themeStyle.iconBg, themeStyle.iconText)}>
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* 푸터 */}
        {footer && (
          <div className="p-4 border-t flex justify-end gap-2 flex-shrink-0 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 모달 버튼 컴포넌트
 */
interface ModalButtonProps {
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  theme?: ModalTheme;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

const primaryButtonClasses: Record<ModalTheme, string> = {
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  amber: 'bg-amber-600 hover:bg-amber-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  green: 'bg-green-600 hover:bg-green-700 text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
};

export function ModalButton({
  type = 'button',
  variant = 'primary',
  theme = 'blue',
  disabled = false,
  loading = false,
  onClick,
  children,
}: ModalButtonProps) {
  const baseClasses = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50';

  const variantClasses = {
    primary: primaryButtonClasses[theme],
    secondary: 'text-gray-700 hover:bg-gray-100 bg-white border border-gray-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(baseClasses, variantClasses[variant])}
    >
      {loading ? '처리 중...' : children}
    </button>
  );
}
