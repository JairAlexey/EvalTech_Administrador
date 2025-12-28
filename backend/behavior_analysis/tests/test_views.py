import json
from datetime import timedelta
from unittest import mock

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser
from authentication.utils import generate_token
from behavior_analysis import views
from behavior_analysis.models import (
    AnalisisComportamiento,
    RegistroAusencia,
    RegistroGesto,
    RegistroIluminacion,
    RegistroRostro,
    RegistroVoz,
    AnomaliaLipsync,
)
from events.models import Event, Participant, ParticipantEvent, ParticipantLog


class BehaviorAnalysisViewsTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.factory = RequestFactory()
        self.evaluator = CustomUser.objects.create(
            email="eval4@example.com",
            first_name="Eva",
            last_name="Luador",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Event D",
            description="Behavior analysis",
            start_date=now - timedelta(hours=1),
            close_date=now + timedelta(hours=1),
            end_date=now + timedelta(hours=2),
            duration=15,
            evaluator=self.evaluator,
            status="en_progreso",
        )
        self.participant = Participant.objects.create(
            first_name="B",
            last_name="A",
            name="B A",
            email="ba@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )
        self.user = CustomUser.objects.create(
            email="viewer@example.com",
            first_name="Viewer",
            last_name="User",
            password="hashed",
        )
        self.token = generate_token(self.user)

    def test_extract_s3_key(self):
        url = (
            "https://bucket.s3.us-east-1.amazonaws.com/media/file.webm?sig=123"
        )
        self.assertEqual(views._extract_s3_key(url), "media/file.webm")
        self.assertEqual(views._extract_s3_key("media/file.webm"), "media/file.webm")
        self.assertIsNone(views._extract_s3_key(None))

    def test_process_event_completion_skips_participants_without_videos(self):
        request = self.factory.post(
            "/analysis/process-event-completion/",
            data=json.dumps({"event_id": self.event.id}),
            content_type="application/json",
        )

        response = views.process_event_completion(request)

        self.assertEqual(response.status_code, 202)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["total_participants"], 0)
        self.assertEqual(len(payload["skipped_participants"]), 1)

    def test_process_event_completion_enqueues_tasks(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )

        request = self.factory.post(
            "/analysis/process-event-completion/",
            data=json.dumps({"event_id": self.event.id}),
            content_type="application/json",
        )

        with mock.patch(
            "behavior_analysis.tasks.process_participant_completion_task.delay",
            return_value=mock.Mock(id="task-1"),
        ) as delay_mock:
            response = views.process_event_completion(request)

        self.assertEqual(response.status_code, 202)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["total_participants"], 1)
        self.assertEqual(payload["task_ids"], ["task-1"])
        delay_mock.assert_called_once()

    def test_register_analysis_success(self):
        request = self.factory.post(
            "/analysis/register/",
            data=json.dumps(
                {
                    "video_link": "media/video.webm",
                    "participant_event_id": self.participant_event.id,
                }
            ),
            content_type="application/json",
        )

        response = views.register_analysis(request)
        self.assertEqual(response.status_code, 201)

    def test_trigger_analysis_missing(self):
        request = self.factory.post(
            "/analysis/analyze/",
            data=json.dumps({"participant_event_id": self.participant_event.id}),
            content_type="application/json",
        )

        response = views.trigger_analysis(request)
        self.assertEqual(response.status_code, 404)

    def test_trigger_analysis_success(self):
        AnalisisComportamiento.objects.create(
            participant_event=self.participant_event,
            video_link="media/video.webm",
            status="pendiente",
        )
        request = self.factory.post(
            "/analysis/analyze/",
            data=json.dumps({"participant_event_id": self.participant_event.id}),
            content_type="application/json",
        )

        with mock.patch(
            "behavior_analysis.views.analyze_behavior_task.delay",
            return_value=mock.Mock(id="task-2"),
        ):
            response = views.trigger_analysis(request)

        self.assertEqual(response.status_code, 202)

    def test_merge_participant_video_success(self):
        request = self.factory.post(
            "/analysis/merge-video/",
            data=json.dumps({"participant_event_id": self.participant_event.id}),
            content_type="application/json",
        )

        with mock.patch(
            "behavior_analysis.views.video_merger_service.merge_participant_videos",
            return_value={"success": True, "s3_key": "merged.mp4", "merged_count": 1},
        ):
            response = views.merge_participant_video(request)

        self.assertEqual(response.status_code, 200)

    def test_analysis_status(self):
        AnalisisComportamiento.objects.create(
            participant_event=self.participant_event,
            video_link="media/video.webm",
            status="completado",
        )

        request = self.factory.get(
            f"/analysis/status/{self.event.id}/participants/{self.participant.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        with mock.patch(
            "behavior_analysis.views.s3_service.is_configured", return_value=False
        ):
            response = views.analysis_status(
                request, self.event.id, self.participant.id
            )

        self.assertEqual(response.status_code, 200)

    def test_analysis_report(self):
        analysis = AnalisisComportamiento.objects.create(
            participant_event=self.participant_event,
            video_link="media/video.webm",
            status="completado",
        )
        RegistroRostro.objects.create(
            analisis=analysis,
            persona_id=1,
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
        )
        RegistroGesto.objects.create(
            analisis=analysis,
            tipo_gesto="Looking Left",
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
            duracion=1.0,
        )
        RegistroIluminacion.objects.create(
            analisis=analysis,
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
        )
        RegistroVoz.objects.create(
            analisis=analysis,
            tipo_log="susurro",
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
        )
        AnomaliaLipsync.objects.create(
            analisis=analysis,
            tipo_anomalia="Audio sin Boca",
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
        )
        RegistroAusencia.objects.create(
            analisis=analysis,
            tiempo_inicio=0.0,
            tiempo_fin=1.0,
            duracion=1.0,
        )
        ParticipantLog.objects.create(
            name="screen",
            message="Screen",
            url="media/screen.jpg",
            participant_event=self.participant_event,
        )
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/video.webm",
            participant_event=self.participant_event,
        )

        request = self.factory.get(
            f"/analysis/report/{self.event.id}/participants/{self.participant.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        with mock.patch(
            "behavior_analysis.views.s3_service.is_configured", return_value=True
        ), mock.patch(
            "behavior_analysis.views.s3_service.generate_presigned_url",
            return_value="signed",
        ):
            response = views.analysis_report(
                request, self.event.id, self.participant.id
            )

        self.assertEqual(response.status_code, 200)
