from __future__ import annotations

from typing import Iterable

import numpy as np


def denormalize_polygon(norm_poly: Iterable[Iterable[float]], width: int, height: int) -> np.ndarray:
    points = []
    for point in norm_poly:
        x, y = point
        points.append([int(x * width), int(y * height)])
    return np.array(points, dtype=np.int32)


def polygon_mask(shape: tuple[int, int], polygon: np.ndarray) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    if polygon.size == 0:
        return mask
    import cv2

    cv2.fillPoly(mask, [polygon], 255)
    return mask


def polygon_centroid(polygon: np.ndarray) -> tuple[float, float]:
    if polygon.size == 0:
        return 0.0, 0.0
    x = polygon[:, 0]
    y = polygon[:, 1]
    return float(np.mean(x)), float(np.mean(y))
