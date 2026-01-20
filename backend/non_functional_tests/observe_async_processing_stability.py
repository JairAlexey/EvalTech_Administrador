#!/usr/bin/env python3
import argparse
import os
import sys
import time
from pathlib import Path
from typing import List, Optional, Union

from dotenv import load_dotenv

VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".mkv", ".avi")
DEFAULT_EVALUATOR_EMAIL = "nf_async_evaluator@example.com"
DEFAULT_EVALUATOR_PASSWORD = "nf_async_test"
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


VideoReference = Union[Path, str]


def select_video(video_arg: str, load_dir: Path) -> Optional[VideoReference]:
    if video_arg:
        candidate = Path(video_arg).expanduser()
        if not candidate.is_absolute():
            candidate = (Path.cwd() / candidate)
        if candidate.exists():
            return candidate.resolve()
        # Treat as remote reference (S3 key or URL).
        return video_arg

    candidates = []
    for ext in VIDEO_EXTENSIONS:
        candidates.extend(load_dir.glob(f"*{ext}"))
    if not candidates:
        return None
    return sorted(candidates)[0].resolve()


def ensure_evaluator(email: str, password: str):
    from authentication.models import CustomUser, UserRole

    user, created = CustomUser.objects.get_or_create(
        email=email,
        defaults={
            "first_name": "NF",
            "last_name": "Async",
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
        name=f"NF Async {suffix}",
        description="Non functional async stability test",
        start_date=now,
        close_date=now,
        end_date=now,
        duration=15,
        evaluator=evaluator,
        status="en_progreso",
    )


def create_job(event, video_reference: VideoReference, index: int, suffix: str):
    from behavior_analysis.models import AnalisisComportamiento
    from behavior_analysis.tasks import analyze_behavior_task
    from events.models import Participant, ParticipantEvent

    video_value = str(video_reference)
    participant = Participant.objects.create(
        first_name="NF",
        last_name=f"Async{index}",
        name=f"NF Async {index}",
        email=f"nf_async_{suffix}_{index}@example.com",
    )
    participant_event = ParticipantEvent.objects.create(
        event=event,
        participant=participant,
    )
    analysis = AnalisisComportamiento.objects.create(
        participant_event=participant_event,
        video_link=video_value,
        status="pendiente",
    )
    task = analyze_behavior_task.delay(video_value, participant_event.id)

    return {
        "index": index,
        "participant_id": participant.id,
        "participant_event_id": participant_event.id,
        "analysis_id": analysis.id,
        "task_id": task.id,
        "status": "pendiente",
        "start_time": time.monotonic(),
        "end_time": None,
    }


def poll_jobs(jobs, poll_seconds: float, timeout_seconds: float):
    from behavior_analysis.models import AnalisisComportamiento

    deadline = time.monotonic() + timeout_seconds
    while True:
        pending = 0
        completed = 0
        errors = 0
        for job in jobs:
            if job["end_time"] is not None:
                if job["status"] == "completado":
                    completed += 1
                elif job["status"] == "error":
                    errors += 1
                continue

            analysis = AnalisisComportamiento.objects.filter(
                id=job["analysis_id"]
            ).first()
            status = analysis.status if analysis else "missing"
            if status != job["status"]:
                job["status"] = status
                print(
                    f"[NF] task={job['task_id']} analysis={job['analysis_id']} status={status}"
                )

            if status in ("completado", "error", "missing"):
                job["end_time"] = time.monotonic()
                if status == "completado":
                    completed += 1
                else:
                    errors += 1
            else:
                pending += 1

        if completed + errors == len(jobs):
            break
        if time.monotonic() >= deadline:
            break

        print(
            f"[NF] progress completed={completed} error={errors} pending={pending}"
        )
        time.sleep(poll_seconds)


def cleanup_records(event_id: int, participant_ids: List[int], analysis_ids: List[int]):
    from behavior_analysis.models import AnalisisComportamiento
    from events.models import Event, Participant

    AnalisisComportamiento.objects.filter(id__in=analysis_ids).delete()
    Event.objects.filter(id=event_id).delete()
    Participant.objects.filter(id__in=participant_ids).delete()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Async processing stability check (Celery + Redis)."
    )
    parser.add_argument("--video", default=os.getenv("NF_VIDEO_PATH", ""))
    parser.add_argument("--count", type=int, default=2)
    parser.add_argument("--poll-seconds", type=float, default=10.0)
    parser.add_argument("--timeout-seconds", type=float, default=1800.0)
    parser.add_argument("--stagger-seconds", type=float, default=0.0)
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

    if args.count <= 0:
        print("[NF] count must be greater than zero")
        return 2

    base_dir = Path(__file__).resolve().parents[1]
    load_dir = Path(__file__).resolve().parent / "load"
    video_reference = select_video(args.video, load_dir)

    if not video_reference:
        print("[NF] No video file found for the async stability test.")
        print(f"[NF] Place a video in: {load_dir}")
        print("[NF] Or pass --video with a valid path or S3 key.")
        return 2
    if isinstance(video_reference, Path) and not video_reference.exists():
        print("[NF] Video path not found.")
        print(f"[NF] path={video_reference}")
        return 2

    apply_env_file(args.env_file)
    ensure_django(base_dir)
    apply_base_url(args.base_url)

    evaluator, created = ensure_evaluator(args.evaluator_email, args.evaluator_password)
    suffix = f"{int(time.time())}-{os.getpid()}"
    event = create_event(evaluator, suffix)

    print("[NF] Async stability test (Celery + Redis)")
    print(f"[NF] event_id={event.id} evaluator={evaluator.email}")
    print(f"[NF] video={video_reference}")
    print(
        f"[NF] count={args.count} timeout={args.timeout_seconds}s poll={args.poll_seconds}s"
    )
    if created:
        print("[NF] evaluator created for this run")

    jobs = []
    participant_ids = []
    analysis_ids = []

    for idx in range(args.count):
        try:
            job = create_job(event, video_reference, idx + 1, suffix)
        except Exception as exc:
            print(f"[NF] failed to dispatch task {idx + 1}: {exc}")
            return 2

        jobs.append(job)
        participant_ids.append(job["participant_id"])
        analysis_ids.append(job["analysis_id"])

        print(
            f"[NF] dispatched {idx + 1}/{args.count} task_id={job['task_id']} participant_event={job['participant_event_id']}"
        )
        if args.stagger_seconds > 0 and idx + 1 < args.count:
            time.sleep(args.stagger_seconds)

    poll_jobs(jobs, args.poll_seconds, args.timeout_seconds)

    completed = []
    errors = []
    pending = []
    for job in jobs:
        if job["end_time"] is None:
            pending.append(job)
        elif job["status"] == "completado":
            completed.append(job)
        else:
            errors.append(job)

    durations = [
        (job["end_time"] - job["start_time"])
        for job in completed + errors
        if job["end_time"] is not None
    ]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    max_duration = max(durations) if durations else 0.0

    print(
        f"[NF] summary completed={len(completed)} error={len(errors)} pending={len(pending)}"
    )
    print(f"[NF] durations avg={avg_duration:.2f}s max={max_duration:.2f}s")

    for job in jobs:
        if job["end_time"] is None:
            status = "timeout"
            duration = time.monotonic() - job["start_time"]
        else:
            status = job["status"]
            duration = job["end_time"] - job["start_time"]
        print(
            f"[NF] task_id={job['task_id']} analysis={job['analysis_id']} status={status} duration={duration:.2f}s"
        )

    if args.cleanup:
        if pending:
            print("[NF] cleanup skipped because tasks are still running")
        else:
            cleanup_records(event.id, participant_ids, analysis_ids)
            print("[NF] cleanup completed")

    if errors or pending:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
