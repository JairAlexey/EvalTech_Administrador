import tempfile
from types import SimpleNamespace
from unittest import mock

import numpy as np
from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from behavior_analysis.models import AnalisisComportamiento
from behavior_analysis.services import procesar_video_completo
from events.models import Event, Participant, ParticipantEvent


class BehaviorAnalysisServicesTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="service@example.com",
            first_name="Service",
            last_name="User",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Service Event",
            description="Service",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=15,
            evaluator=self.evaluator,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Service",
            last_name="Participant",
            name="Service Participant",
            email="servicep@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=participant
        )
        AnalisisComportamiento.objects.create(
            participant_event=self.participant_event,
            video_link="local",
            status="pendiente",
        )

    def test_procesar_video_completo_success(self):
        class StubCapture:
            def __init__(self):
                self.calls = 0

            def isOpened(self):
                return True

            def read(self):
                if self.calls < 2:
                    self.calls += 1
                    return True, np.zeros((10, 10, 3), dtype=np.uint8)
                return False, None

            def get(self, prop):
                import cv2

                if prop == cv2.CAP_PROP_FPS:
                    return 30
                if prop == cv2.CAP_PROP_POS_MSEC:
                    return self.calls * 1000
                return 0

            def getBackendName(self):
                return "stub"

            def release(self):
                return None

        class StubRostros:
            def procesar_frame(self, frame, timestamp):
                return None

            def obtener_resultados(self):
                return [{"persona_id": 1, "tiempo_inicio": 0.0, "tiempo_fin": 1.0}]

        class StubGestos:
            def procesar_frame(self, landmarks, w, h, timestamp):
                return None

            def finalizar(self, final_timestamp):
                return None

            def obtener_resultados(self):
                return [
                    {
                        "tipo_gesto": "Looking Left",
                        "tiempo_inicio": 0.0,
                        "tiempo_fin": 1.0,
                        "duracion": 1.0,
                    }
                ]

        class StubIluminacion:
            def procesar_frame(self, frame, timestamp):
                return None

            def finalizar(self, final_timestamp):
                return None

            def obtener_resultados(self):
                return [{"tiempo_inicio": 0.0, "tiempo_fin": 1.0}]

        class StubLipsync:
            def __init__(self, _path):
                return None

            def set_fps(self, fps):
                return None

            def procesar_frame(self, landmarks, timestamp):
                return None

            def obtener_resultados(self):
                return {
                    "anomalias": [
                        {
                            "tipo_anomalia": "Audio sin Boca",
                            "tiempo_inicio": 0.0,
                            "tiempo_fin": 1.0,
                        }
                    ]
                }

        class StubVoz:
            def __init__(self, _path):
                return None

            def procesar(self):
                return {
                    "susurros": [(0.0, 1.0)],
                    "hablantes": [
                        {
                            "etiqueta": "Voz 1",
                            "tiempo_inicio": 0.0,
                            "tiempo_fin": 1.0,
                        }
                    ],
                }

        class StubAusencia:
            def procesar_frame(self, frame, timestamp):
                return None

            def finalizar(self, final_timestamp):
                return [(0.0, 1.0, 1.0)]

        class StubFaceMesh:
            def process(self, _frame):
                return SimpleNamespace(multi_face_landmarks=None)

            def close(self):
                return None

        with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp:
            tmp.write(b"data")
            tmp.flush()

            with mock.patch(
                "behavior_analysis.services.cv2.VideoCapture",
                return_value=StubCapture(),
            ), mock.patch(
                "behavior_analysis.services.mp.solutions.face_mesh.FaceMesh",
                return_value=StubFaceMesh(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorRostros",
                return_value=StubRostros(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorGestos",
                return_value=StubGestos(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorIluminacion",
                return_value=StubIluminacion(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorLipsync",
                return_value=StubLipsync(""),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorVoz",
                return_value=StubVoz(""),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorAusencia",
                return_value=StubAusencia(),
            ):
                result = procesar_video_completo(tmp.name, self.participant_event.id)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "completado")

    def test_procesar_video_completo_missing_participant_event(self):
        result = procesar_video_completo("missing.mp4", 9999)
        self.assertIsNone(result)

    def test_procesar_video_completo_missing_analysis(self):
        participant = Participant.objects.create(
            first_name="No",
            last_name="Analysis",
            name="No Analysis",
            email="noanalysis@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=participant
        )
        result = procesar_video_completo("missing.mp4", participant_event.id)
        self.assertIsNone(result)

    def test_procesar_video_completo_download_failure(self):
        with mock.patch(
            "behavior_analysis.services.s3_service.download_file",
            return_value={"success": False, "error": "fail"},
        ):
            result = procesar_video_completo("missing_key", self.participant_event.id)
        self.participant_event.refresh_from_db()
        analysis = AnalisisComportamiento.objects.get(
            participant_event=self.participant_event
        )
        self.assertIsNone(result)
        self.assertEqual(analysis.status, "error")

    def test_procesar_video_completo_video_capture_failure(self):
        class StubCaptureFail:
            def isOpened(self):
                return False

        with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp:
            tmp.write(b"data")
            tmp.flush()

            with mock.patch(
                "behavior_analysis.services.cv2.VideoCapture",
                return_value=StubCaptureFail(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorRostros",
                return_value=mock.Mock(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorGestos",
                return_value=mock.Mock(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorIluminacion",
                return_value=mock.Mock(),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorLipsync",
                return_value=mock.Mock(set_fps=mock.Mock()),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorVoz",
                return_value=mock.Mock(procesar=mock.Mock(return_value={})),
            ), mock.patch(
                "behavior_analysis.services.AnalizadorAusencia",
                return_value=mock.Mock(),
            ), mock.patch(
                "behavior_analysis.services.mp.solutions.face_mesh.FaceMesh",
                return_value=mock.Mock(),
            ):
                result = procesar_video_completo(tmp.name, self.participant_event.id)

        analysis = AnalisisComportamiento.objects.get(
            participant_event=self.participant_event
        )
        self.assertIsNone(result)
        self.assertEqual(analysis.status, "error")
