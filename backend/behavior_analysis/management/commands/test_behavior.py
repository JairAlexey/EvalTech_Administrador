import importlib

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Test behavior analysis features using local camera and microphone"

    def add_arguments(self, parser):
        parser.add_argument(
            "--feature",
            type=str,
            help="Feature to test: voice, lipsync, gestures, lighting, multiple_faces, absence",
            required=True,
        )
        parser.add_argument(
            "--video",
            type=str,
            help="Path to the video file to analyze",
            required=True,
        )

    def handle(self, *args, **options):
        feature = options["feature"]
        video_path = options["video"]

        try:
            runner = self._load_runner(feature)
        except CommandError as exc:
            self.stdout.write(self.style.ERROR(str(exc)))
            return

        runner(video_path)

    def _load_runner(self, feature):
        feature_map = {
            "voice": ("behavior_analysis.analyzers.voice", "run_voice_test"),
            "lipsync": ("behavior_analysis.analyzers.lipsync", "run_lipsync_test"),
            "gestures": ("behavior_analysis.analyzers.gestures", "run_gestures_test"),
            "lighting": ("behavior_analysis.analyzers.lighting", "run_lighting_test"),
            "multiple_faces": ("behavior_analysis.analyzers.faces", "run_fast_face_analysis"),
            "absence": ("behavior_analysis.analyzers.faces", "run_absence_test"),
        }

        if feature not in feature_map:
            raise CommandError(f"Unknown feature: {feature}")

        module_path, func_name = feature_map[feature]
        try:
            module = importlib.import_module(module_path)
        except Exception as exc:
            raise CommandError(f"Failed to import {module_path}: {exc}")

        runner = getattr(module, func_name, None)
        if not callable(runner):
            raise CommandError(
                f"Test runner '{func_name}' is not available in {module_path}"
            )
        return runner
