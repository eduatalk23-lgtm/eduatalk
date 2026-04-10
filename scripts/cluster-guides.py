#!/usr/bin/env python3
"""
Phase A Step 3-b: 가이드 주제 클러스터링

입력: /tmp/guide-embeddings.jsonl (export-guide-embeddings.ts 산출물)
출력: /tmp/guide-clusters.json

guide_type 별 분리 클러스터링:
  - reading (4432건): PCA(768→50) + KMeans, k 자동탐색 (silhouette score)
  - subject_performance (280건): 동일 파이프라인, 별도 k
  - 기타 (54+19+23+5건): 클러스터링 생략, guide_type 자체를 cluster 로

사용법:
  python3 scripts/cluster-guides.py [--max-k=150] [--min-k=30]
"""

import json
import sys
import numpy as np
from pathlib import Path

INPUT_PATH = Path("/tmp/guide-embeddings.jsonl")
OUTPUT_PATH = Path("/tmp/guide-clusters.json")

# ── CLI 인자 ──
args = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if "=" in a}
MAX_K = int(args.get("--max-k", 150))
MIN_K = int(args.get("--min-k", 30))

# ── 데이터 로드 ──
print(f"📂 {INPUT_PATH} 로딩...")
records = []
with open(INPUT_PATH) as f:
    for line in f:
        if not line.strip():
            continue
        rec = json.loads(line)
        # embedding: pgvector 문자열 "[0.1,0.2,...]" → float list
        emb_str = rec["embedding"]
        if isinstance(emb_str, str):
            emb_str = emb_str.strip("[]")
            emb = [float(x) for x in emb_str.split(",")]
        else:
            emb = emb_str
        rec["_emb"] = emb
        records.append(rec)

print(f"   총 {len(records)}건")

# ── guide_type 별 분리 ──
by_type: dict[str, list] = {}
for r in records:
    gt = r["guide_type"]
    by_type.setdefault(gt, []).append(r)

for gt, recs in sorted(by_type.items(), key=lambda x: -len(x[1])):
    print(f"   {gt}: {len(recs)}건")

# ── 클러스터링 함수 ──
def cluster_group(recs: list, label: str, min_k: int = 5, max_k: int = 100) -> list[dict]:
    """KMeans + silhouette score 로 최적 k 탐색 후 클러스터 할당."""
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import normalize

    n = len(recs)
    if n < 10:
        # 너무 적으면 전부 같은 cluster
        print(f"   [{label}] {n}건 — 클러스터링 생략 (단일 그룹)")
        return [{"id": r["id"], "cluster_label": f"{label}__all", "confidence": 1.0} for r in recs]

    X = np.array([r["_emb"] for r in recs], dtype=np.float32)
    X = normalize(X)  # L2 정규화

    # PCA 차원 축소 (768 → min(50, n-1))
    n_components = min(50, n - 1, X.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    X_reduced = pca.fit_transform(X)
    explained = sum(pca.explained_variance_ratio_) * 100
    print(f"   [{label}] PCA {X.shape[1]}→{n_components} (분산 {explained:.1f}% 설명)")

    # k 탐색 범위
    actual_min_k = max(2, min_k)
    actual_max_k = min(max_k, n // 3)  # cluster 당 최소 3건
    if actual_max_k <= actual_min_k:
        actual_max_k = actual_min_k + 1

    # Silhouette score 로 최적 k
    best_k, best_score = actual_min_k, -1
    step = max(1, (actual_max_k - actual_min_k) // 20)  # 최대 20회 탐색
    candidates = list(range(actual_min_k, actual_max_k + 1, step))
    if actual_max_k not in candidates:
        candidates.append(actual_max_k)

    print(f"   [{label}] k 탐색: {actual_min_k}~{actual_max_k} (step={step}, {len(candidates)}회)")

    for k in candidates:
        km = KMeans(n_clusters=k, random_state=42, n_init=5, max_iter=200)
        labels = km.fit_predict(X_reduced)
        score = silhouette_score(X_reduced, labels, sample_size=min(3000, n))
        if score > best_score:
            best_k, best_score = k, score

    print(f"   [{label}] 최적 k={best_k} (silhouette={best_score:.3f})")

    # 최종 클러스터링
    km = KMeans(n_clusters=best_k, random_state=42, n_init=10, max_iter=300)
    labels = km.fit_predict(X_reduced)

    # 각 포인트의 cluster center 와의 거리 → confidence (가까울수록 높음)
    distances = km.transform(X_reduced)  # (n, k) 각 center 까지 거리
    results = []
    for i, r in enumerate(recs):
        cl = int(labels[i])
        d = distances[i][cl]
        # 거리 → confidence 변환 (max distance 기준 정규화)
        max_d = distances[:, cl].max()
        conf = max(0.0, 1.0 - (d / max_d)) if max_d > 0 else 1.0
        results.append({
            "id": r["id"],
            "cluster_label": f"{label}__{cl}",
            "confidence": round(float(conf), 3),
        })

    # cluster 크기 분포
    from collections import Counter
    sizes = Counter(labels)
    print(f"   [{label}] cluster 크기: min={min(sizes.values())} / median={sorted(sizes.values())[len(sizes)//2]} / max={max(sizes.values())}")

    return results


# ── 실행 ──
all_results: list[dict] = []

# reading: 주력 클러스터링
if "reading" in by_type:
    res = cluster_group(by_type["reading"], "reading", min_k=MIN_K, max_k=MAX_K)
    all_results.extend(res)

# subject_performance: 보조 클러스터링
if "subject_performance" in by_type:
    res = cluster_group(by_type["subject_performance"], "subject_performance", min_k=5, max_k=40)
    all_results.extend(res)

# 나머지: 단일 그룹 (클러스터링 생략)
for gt, recs in by_type.items():
    if gt in ("reading", "subject_performance"):
        continue
    for r in recs:
        all_results.append({
            "id": r["id"],
            "cluster_label": f"{gt}__all",
            "confidence": 1.0,
        })

# ── 결과 저장 ──
with open(OUTPUT_PATH, "w") as f:
    json.dump(all_results, f, indent=2)

print(f"\n✅ {OUTPUT_PATH} 에 {len(all_results)}건 저장")

# 요약
from collections import Counter
label_counts = Counter(r["cluster_label"] for r in all_results)
print(f"   고유 cluster: {len(label_counts)}개")
print(f"   타입별: ", {gt: sum(1 for l in label_counts if l.startswith(gt)) for gt in by_type})
