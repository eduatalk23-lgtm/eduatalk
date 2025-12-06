import { useEffect, useRef } from "react";

/**
 * React에서 setInterval을 안정적으로 사용하기 위한 훅
 * 
 * @param callback 실행할 콜백 함수
 * @param delay 지연 시간 (밀리초), null이면 interval이 정지됨
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // 콜백이 변경될 때마다 ref 업데이트
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // interval 설정
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}

