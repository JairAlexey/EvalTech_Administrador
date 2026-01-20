#!/usr/bin/env python3
import argparse
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

DEFAULT_EVALUATOR_EMAIL = "nf_processing_evaluator@example.com"
DEFAULT_EVALUATOR_PASSWORD = "nf_processing_test"
VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".mkv", ".avi")
DEFAULT_BASE_URL = os.getenv("BASE_URL", "")


def ensure_django(base_dir: Path) -> None:
    if str(base_dir) not in sys.path:
        sys.path.insert(0, str(base_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "administradormonitoreo.settings")
    import django

    django.setup()


def apply_env_file(env_file: str) -> None:
    if not env_file:
        return
    env_path = Path(env_file).expanduser()
    if not env_path.is_absolute():
        env_path = (Path.cwd() / env_path)
    if not env_path.exists():
        print(f"[NF] Env file not found: {env_path}")
        raise SystemExit(2)
    load_dotenv(env_path, override=True)


def apply_base_url(base_url: str) -> None:
    if not base_url:
        return
    from django.conf import settings

    settings.BASE_URL = base_url


def infer_suffix(reference: str) -> str:
    base = reference.split("?")[0]
    _, ext = os.path.splitext(base)
    return ext if ext else ".webm"


def extract_s3_key(reference: str) -> str:
    if "amazonaws.com" in reference:
        return reference.split(".amazonaws.com/")[-1].split("?")[0]
    return reference


def select_video_reference(video_arg: str, load_dir: Path) -> Optional[str]:
    if video_arg:
        candidate = Path(video_arg).expanduser()
        if not candidate.is_absolute():
            candidate = (Path.cwd() / candidate)
        if candidate.exists():
            return str(candidate.resolve())
        return video_arg

    candidates = []
    for ext in VIDEO_EXTENSIONS:
        candidates.extend(load_dir.glob(f"*{ext}"))
    if not candidates:
        return None
    return str(sorted(candidates)[0].resolve())


def ensure_evaluator(email: str, password: str):
    from authentication.models import CustomUser, UserRole

    user, created = CustomUser.objects.get_or_create(
        email=email,
        defaults={
            "first_name": "NF",
            "last_name": "Processing",
            "password": "temp",
        },
    )
    if created:
        user.set_password(password)
        user.save()
    UserRole.objects.get_or_create(user=user, defaults={"role": "evaluator"})
    return user, created


def create_event(evaluator, suffix: str):
    from django.utils import timezone
    from events.models import Event

    now = timezone.now()
    return Event.objects.create(
        name=f"NF Processing {suffix}",
        description="Non functional processing time test",
        start_date=now,
        close_date=now,
        end_date=now,
        duration=15,
        evaluator=evaluator,
        status="en_progreso",
    )


def create_job(event, video_reference: str, index: int, suffix: str) -> Dict[str, Any]:
    from behavior_analysis.models import AnalisisComportamiento
    from behavior_analysis.tasks import analyze_behavior_task
    from events.models import Participant, ParticipantEvent

    participant = Participant.objects.create(
        first_name="NF",
        last_name=f"Processing{index}",
        name=f"NF Processing {index}",
        email=f"nf_processing_{suffix}_{index}@example.com",
    )
    participant_event = ParticipantEvent.objects.create(
        event=event,
        participant=participant,
    )
    analysis = AnalisisComportamiento.objects.create(
        participant_event=participant_event,
        video_link=video_reference,
        status="pendiente",
    )
    task = analyze_behavior_task.delay(video_reference, participant_event.id)

    return {
        "participant_id": participant.id,
        "participant_event_id": participant_event.id,
        "analysis_id": analysis.id,
        "task_id": task.id,
        "status": "pendiente",
        "start_time": time.monotonic(),
        "end_time": None,
    }


def poll_job(job: Dict[str, Any], poll_seconds: float, timeout_seconds: float) -> None:
    from behavior_analysis.models import AnalisisComportamiento

    deadline = time.monotonic() + timeout_seconds
    while True:
        analysis = AnalisisComportamiento.objects.filter(id=job["analysis_id"]).first()
        status = analysis.status if analysis else "missing"
        if status != job["status"]:
            job["status"] = status
            print(
                f"[NF] task={job['task_id']} analysis={job['analysis_id']} status={status}"
            )
        if status in ("completado", "error", "missing"):
            job["end_time"] = time.monotonic()
            return
        if time.monotonic() >= deadline:
            return
        time.sleep(poll_seconds)


def cleanup_records(event_id: int, participant_ids: List[int], analysis_ids: List[int]):
    from behavior_analysis.models import AnalisisComportamiento
    from events.models import Event, Participant

    AnalisisComportamiento.objects.filter(id__in=analysis_ids).delete()
    Event.objects.filter(id=event_id).delete()
    Participant.objects.filter(id__in=participant_ids).delete()


def compute_duration_seconds(local_path: Path) -> float:
    import cv2

    cap = cv2.VideoCapture(str(local_path), cv2.CAP_FFMPEG)
    if not cap.isOpened():
        cap = cv2.VideoCapture(str(local_path))
    if not cap.isOpened():
        return 0.0

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()

    if fps and fps > 0 and frame_count and frame_count > 0:
        return float(frame_count) / float(fps)
    return 0.0


def download_for_duration(video_reference: str, temp_dir: Path) -> Optional[Path]:
    from events.s3_service import s3_service

    if not s3_service.is_configured():
        print("[NF] S3 not configured; cannot download video for duration.")
        return None

    key = extract_s3_key(video_reference)
    suffix = infer_suffix(key)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=temp_dir)
    temp_path = Path(temp_file.name)
    temp_file.close()

    result = s3_service.download_file(key, str(temp_path))
    if not result.get("success"):
        print(f"[NF] failed to download video for duration: {result.get('error')}")
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            pass
        return None
    return temp_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Processing time vs video duration (post session reports)."
    )
    parser.add_argument(
        "--video",
        default=os.getenv("NF_VIDEO_PATH") or os.getenv("NF_VIDEO_KEY", ""),
    )
    parser.add_argument("--poll-seconds", type=float, default=10.0)
    parser.add_argument("--timeout-seconds", type=float, default=3600.0)
    parser.add_argument(
        "--evaluator-email",
        default=os.getenv("NF_EVALUATOR_EMAIL", DEFAULT_EVALUATOR_EMAIL),
    )
    parser.add_argument(
        "--evaluator-password",
        default=os.getenv("NF_EVALUATOR_PASSWORD", DEFAULT_EVALUATOR_PASSWORD),
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--env-file", default=os.getenv("NF_ENV_FILE", ""))
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parents[1]
    load_dir = Path(__file__).resolve().parent / "load"
    video_reference = select_video_reference(args.video, load_dir)
    if not video_reference:
        print("[NF] No video reference found.")
        print(f"[NF] Place a video in: {load_dir}")
        print("[NF] Or pass --video with a valid path or S3 key.")
        return 2

    apply_env_file(args.env_file)
    ensure_django(base_dir)
    apply_base_url(args.base_url)

    temp_dir = Path(tempfile.gettempdir())
    temp_path = None
    duration_seconds = 0.0
    try:
        if Path(video_reference).exists():
            duration_seconds = compute_duration_seconds(Path(video_reference))
        else:
            temp_path = download_for_duration(video_reference, temp_dir)
            if temp_path:
                duration_seconds = compute_duration_seconds(temp_path)
    finally:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass

    evaluator, created = ensure_evaluator(args.evaluator_email, args.evaluator_password)
    suffix = f"{int(time.time())}-{os.getpid()}"
    event = create_event(evaluator, suffix)

    print("[NF] Processing time vs video duration")
    print(f"[NF] event_id={event.id} evaluator={evaluator.email}")
    print(f"[NF] video={video_reference}")
    if created:
        print("[NF] evaluator created for this run")

    if duration_seconds > 0:
        duration_minutes = duration_seconds / 60.0
        print(f"[NF] video_duration={duration_minutes:.2f} min")
    else:
        print("[NF] video_duration=unknown")

    job = create_job(event, video_reference, 1, suffix)
    print(
        f"[NF] dispatched task_id={job['task_id']} participant_event={job['participant_event_id']}"
    )

    poll_job(job, args.poll_seconds, args.timeout_seconds)

    if job["end_time"] is None:
        print("[NF] processing timed out")
        status = "timeout"
        processing_seconds = time.monotonic() - job["start_time"]
    else:
        status = job["status"]
        processing_seconds = job["end_time"] - job["start_time"]

    processing_minutes = processing_seconds / 60.0
    if duration_seconds > 0:
        duration_minutes = duration_seconds / 60.0
        ratio = processing_seconds / duration_seconds
        print(
            f"[NF] duracion={duration_minutes:.2f} min procesamiento={processing_minutes:.2f} min"
        )
        print(f"[NF] processing_ratio={ratio:.2f}x")
    else:
        print(f"[NF] duracion=unknown procesamiento={processing_minutes:.2f} min")

    print(f"[NF] status={status}")

    if args.cleanup:
        if job["end_time"] is None:
            print("[NF] cleanup skipped because task is still running")
        else:
            cleanup_records(event.id, [job["participant_id"]], [job["analysis_id"]])
            print("[NF] cleanup completed")

    return 0 if status == "completado" else 1


if __name__ == "__main__":
    raise SystemExit(main())
