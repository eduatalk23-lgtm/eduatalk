/**
 * MinHeap (최소 힙) 구현
 *
 * Best Fit 알고리즘에서 가용 시간이 가장 적은 슬롯을 O(log n)에 찾기 위해 사용합니다.
 *
 * @module lib/scheduler/utils/MinHeap
 */

/**
 * 힙 노드 타입
 */
export interface HeapNode<T> {
  /** 비교에 사용되는 우선순위 값 (낮을수록 우선) */
  priority: number;
  /** 실제 데이터 */
  data: T;
  /** 원본 인덱스 (슬롯 배열에서의 위치) */
  index: number;
}

/**
 * MinHeap 클래스
 *
 * 우선순위가 낮은 요소가 루트에 위치합니다.
 * Best Fit에서는 가용 시간이 가장 적은 슬롯을 빠르게 찾는 데 사용됩니다.
 */
export class MinHeap<T> {
  private heap: HeapNode<T>[] = [];

  /**
   * 힙이 비어있는지 확인
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * 힙의 크기 반환
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * 루트 노드 반환 (제거하지 않음)
   */
  peek(): HeapNode<T> | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  /**
   * 새 노드 삽입
   *
   * @param priority - 우선순위 (낮을수록 우선)
   * @param data - 저장할 데이터
   * @param index - 원본 배열에서의 인덱스
   */
  insert(priority: number, data: T, index: number): void {
    const node: HeapNode<T> = { priority, data, index };
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * 루트 노드 제거 및 반환
   */
  extractMin(): HeapNode<T> | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);

    return min;
  }

  /**
   * 특정 인덱스의 우선순위 업데이트
   *
   * 슬롯의 가용 시간이 변경될 때 사용합니다.
   *
   * @param nodeIndex - 힙 내 노드 인덱스
   * @param newPriority - 새로운 우선순위
   */
  updatePriority(nodeIndex: number, newPriority: number): void {
    if (nodeIndex < 0 || nodeIndex >= this.heap.length) return;

    const oldPriority = this.heap[nodeIndex].priority;
    this.heap[nodeIndex].priority = newPriority;

    if (newPriority < oldPriority) {
      this.bubbleUp(nodeIndex);
    } else {
      this.bubbleDown(nodeIndex);
    }
  }

  /**
   * 원본 인덱스로 힙 내 노드 찾기
   */
  findByIndex(originalIndex: number): { heapIndex: number; node: HeapNode<T> } | null {
    for (let i = 0; i < this.heap.length; i++) {
      if (this.heap[i].index === originalIndex) {
        return { heapIndex: i, node: this.heap[i] };
      }
    }
    return null;
  }

  /**
   * 힙에서 노드 제거 (인덱스 기반)
   */
  removeByHeapIndex(heapIndex: number): void {
    if (heapIndex < 0 || heapIndex >= this.heap.length) return;

    // 마지막 요소와 교체 후 제거
    const lastIndex = this.heap.length - 1;
    if (heapIndex !== lastIndex) {
      this.heap[heapIndex] = this.heap[lastIndex];
      this.heap.pop();

      // 힙 속성 복구
      const parentIndex = Math.floor((heapIndex - 1) / 2);
      if (heapIndex > 0 && this.heap[heapIndex].priority < this.heap[parentIndex].priority) {
        this.bubbleUp(heapIndex);
      } else {
        this.bubbleDown(heapIndex);
      }
    } else {
      this.heap.pop();
    }
  }

  /**
   * 배열을 힙으로 변환 (O(n) heapify)
   */
  static fromArray<T>(items: Array<{ priority: number; data: T; index: number }>): MinHeap<T> {
    const heap = new MinHeap<T>();
    heap.heap = items.map((item) => ({
      priority: item.priority,
      data: item.data,
      index: item.index,
    }));

    // Bottom-up heapify
    for (let i = Math.floor(heap.heap.length / 2) - 1; i >= 0; i--) {
      heap.bubbleDown(i);
    }

    return heap;
  }

  /**
   * 상향 재정렬 (삽입 시)
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIndex].priority) break;

      // Swap
      [this.heap[index], this.heap[parentIndex]] = [
        this.heap[parentIndex],
        this.heap[index],
      ];
      index = parentIndex;
    }
  }

  /**
   * 하향 재정렬 (추출 시)
   */
  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (
        leftChild < length &&
        this.heap[leftChild].priority < this.heap[smallest].priority
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < length &&
        this.heap[rightChild].priority < this.heap[smallest].priority
      ) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      // Swap
      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[index],
      ];
      index = smallest;
    }
  }
}
