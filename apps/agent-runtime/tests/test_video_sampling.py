from pathlib import Path

from app import video_sampling


def test_sampling_combines_timeline_coverage_and_scene_changes(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "walkthrough.mp4"
    source.write_bytes(b"video")
    written: list[int] = []

    monkeypatch.setattr(video_sampling, "_scene_change_times", lambda *_: [8_000, 22_000, 37_000])

    def write_frame(_source: Path, time_ms: int, destination: Path) -> None:
        written.append(time_ms)
        destination.write_bytes(b"frame")

    monkeypatch.setattr(video_sampling, "_extract_frame", write_frame)
    frames = video_sampling.sample_video_frames(
        source,
        tmp_path / "frames",
        duration_ms=60_000,
        coverage_seconds=15,
        max_frames=6,
        scene_threshold=0.2,
    )

    times = [frame.time_ms for frame in frames]
    assert times[0] == 0
    assert times[-1] == 59_999
    assert {15_000, 30_000, 45_000}.issubset(times)
    assert len(times) <= 6
    assert written == times


def test_sampling_spreads_excess_scene_changes_without_losing_timeline(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "long.mp4"
    source.write_bytes(b"video")
    monkeypatch.setattr(video_sampling, "_scene_change_times", lambda *_: list(range(1_000, 59_000, 1_000)))
    monkeypatch.setattr(video_sampling, "_extract_frame", lambda _source, _time, destination: destination.write_bytes(b"frame"))

    frames = video_sampling.sample_video_frames(source, tmp_path / "frames", duration_ms=60_000, coverage_seconds=15, max_frames=8)

    times = [frame.time_ms for frame in frames]
    assert len(times) == 8
    assert times[0] == 0 and times[-1] == 59_999
    assert any(time not in {0, 15_000, 30_000, 45_000, 59_999} for time in times)
