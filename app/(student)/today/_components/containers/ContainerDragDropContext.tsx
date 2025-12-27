'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useContainerDragDrop,
  type ContainerDragItem,
} from '@/lib/hooks/useContainerDragDrop';
import type { ContainerType } from '@/lib/domains/plan/actions/move';

type ContainerDragDropContextValue = {
  // 상태
  draggedItem: ContainerDragItem | null;
  dropTargetContainer: ContainerType | null;
  isProcessing: boolean;
  isDragging: boolean;

  // 헬퍼 함수
  getDraggableProps: (item: ContainerDragItem) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  };
  getDropZoneProps: (container: ContainerType) => {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  };
  canDropOnContainer: (container: ContainerType) => boolean;
  isDropTarget: (container: ContainerType) => boolean;
};

const ContainerDragDropContext = createContext<ContainerDragDropContextValue | null>(null);

export function useContainerDragDropContext() {
  const context = useContext(ContainerDragDropContext);
  if (!context) {
    throw new Error('useContainerDragDropContext must be used within ContainerDragDropProvider');
  }
  return context;
}

interface ContainerDragDropProviderProps {
  children: ReactNode;
  onMoveSuccess?: () => void;
  onMoveError?: (error: string) => void;
}

export function ContainerDragDropProvider({
  children,
  onMoveSuccess,
  onMoveError,
}: ContainerDragDropProviderProps) {
  const dragDropState = useContainerDragDrop({
    onMoveSuccess,
    onMoveError,
  });

  return (
    <ContainerDragDropContext.Provider value={dragDropState}>
      {children}
    </ContainerDragDropContext.Provider>
  );
}
