from django.core.management.base import BaseCommand
from behavior_analysis.analyzers.voice import run_voice_test
from behavior_analysis.analyzers.lipsync import run_lipsync_test
from behavior_analysis.analyzers.gestures import run_gestures_test
from behavior_analysis.analyzers.lighting import run_lighting_test
from behavior_analysis.analyzers.faces import run_multiple_faces_test, run_absence_test


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

        if feature == "voice":
            run_voice_test(video_path)
        elif feature == "lipsync":
            run_lipsync_test(video_path)
        elif feature == "gestures":
            run_gestures_test(video_path)
        elif feature == "lighting":
            run_lighting_test(video_path)
        elif feature == "multiple_faces":
            run_multiple_faces_test(video_path)
        elif feature == "absence":
            run_absence_test(video_path)
        else:
            self.stdout.write(self.style.ERROR(f"Unknown feature: {feature}"))
