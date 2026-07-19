from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


class VideoSamplingError(Exception):
    """Raised when a video cannot be sampled safely."""


@dataclass(frozen=True)
class VideoFrame:
    time_ms: int
    path: Path


def video_duration_ms(source: Path) -> int:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source),
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        return max(1, int(float(completed.stdout.strip()) * 1000))
    except (OSError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise VideoSamplingError("Video duration could not be read safely.") from error


def sample_video_frames(
    source: Path,
    directory: Path,
    *,
    duration_ms: int | None = None,
    coverage_seconds: int = 15,
    max_frames: int = 60,
    scene_threshold: float = 0.2,
) -> list[VideoFrame]:
    """Select a bounded union of scene transitions and full-timeline coverage.

    Periodic frames ensure long static stretches are represented; scene frames
    preserve UI changes that happen between those intervals.  The interval expands
    for long videos rather than silently dropping their tail.
    """
    if coverage_seconds <= 0 or max_frames < 2 or not 0 < scene_threshold < 1:
        raise VideoSamplingError("Video sampling configuration is invalid.")
    total_ms = duration_ms if duration_ms is not None else video_duration_ms(source)
    coverage_ms = max(coverage_seconds * 1000, (total_ms + max_frames - 1) // max_frames)
    coverage = list(range(0, total_ms, coverage_ms))
    if not coverage or coverage[-1] != max(0, total_ms - 1):
        coverage.append(max(0, total_ms - 1))
    coverage = _deduplicate(coverage)
    remaining = max(0, max_frames - len(coverage))
    scenes = [
        scene
        for scene in _scene_change_times(source, scene_threshold)
        if all(abs(scene - covered) >= 1_000 for covered in coverage)
    ]
    selected = _deduplicate([*coverage, *_spread(scenes, remaining)])[:max_frames]

    directory.mkdir(parents=True, exist_ok=True)
    frames: list[VideoFrame] = []
    for time_ms in selected:
        destination = directory / f"frame-{time_ms:010d}.jpg"
        _extract_frame(source, time_ms, destination)
        if destination.exists() and destination.stat().st_size:
            frames.append(VideoFrame(time_ms=time_ms, path=destination))
    if not frames:
        raise VideoSamplingError("No usable frames could be extracted from this video.")
    return frames


def _scene_change_times(source: Path, threshold: float) -> list[int]:
    try:
        completed = subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-i",
                str(source),
                "-an",
                "-vf",
                f"select='gt(scene,{threshold})',showinfo",
                "-vsync",
                "0",
                "-f",
                "null",
                "-",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=120,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        # Timeline coverage remains useful if a codec/filter does not expose scene scores.
        return []
    return _deduplicate(
        [int(float(value) * 1000) for value in re.findall(r"pts_time:([0-9.]+)", completed.stderr)]
    )


def _extract_frame(source: Path, time_ms: int, destination: Path) -> None:
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                f"{time_ms / 1000:.3f}",
                "-i",
                str(source),
                "-frames:v",
                "1",
                "-vf",
                "scale='min(1600,iw)':-2",
                "-q:v",
                "2",
                str(destination),
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        raise VideoSamplingError("A video frame could not be extracted safely.") from error


def _deduplicate(values: list[int]) -> list[int]:
    result: list[int] = []
    for value in sorted(max(0, value) for value in values):
        if not result or value - result[-1] >= 1_000:
            result.append(value)
    return result


def _spread(values: list[int], limit: int) -> list[int]:
    if limit <= 0 or not values:
        return []
    if len(values) <= limit:
        return values
    return [values[round(index * (len(values) - 1) / (limit - 1))] for index in range(limit)] if limit > 1 else [values[len(values) // 2]]
