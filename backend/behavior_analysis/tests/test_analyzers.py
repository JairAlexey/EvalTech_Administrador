from types import SimpleNamespace
from unittest import mock

import numpy as np
from django.test import TestCase

from behavior_analysis.analyzers.absence import AnalizadorAusencia
from behavior_analysis.analyzers.faces import AnalizadorRostros
from behavior_analysis.analyzers.gestures import AnalizadorGestos
from behavior_analysis.analyzers.lighting import AnalizadorIluminacion
from behavior_analysis.analyzers.lipsync import AnalizadorLipsync
from behavior_analysis.analyzers.voice import AnalizadorVoz


class BehaviorAnalyzersTests(TestCase):
    def test_gestures_results(self):
        analyzer = AnalizadorGestos()

        landmarks = [SimpleNamespace(x=0.0, y=0.0) for _ in range(500)]
        landmarks[analyzer.IDX_NOSE] = SimpleNamespace(x=0.9, y=0.5)
        landmarks[analyzer.IDX_LEFT_FACE_EDGE] = SimpleNamespace(x=0.0, y=0.5)
        landmarks[analyzer.IDX_RIGHT_FACE_EDGE] = SimpleNamespace(x=1.0, y=0.5)
        landmarks[analyzer.IDX_FOREHEAD] = SimpleNamespace(x=0.5, y=0.2)
        landmarks[analyzer.IDX_CHIN] = SimpleNamespace(x=0.5, y=0.8)
        analyzer.procesar_frame(SimpleNamespace(landmark=landmarks), 100, 100, 0.0)
        analyzer.finalizar(3.0)

        results = analyzer.obtener_resultados()
        self.assertTrue(results)

    def test_lipsync_helpers(self):
        analyzer = AnalizadorLipsync.__new__(AnalizadorLipsync)
        analyzer.fps = 30

        signal_data = np.array([0.0, 0.5, 1.0, 0.3, 0.0])
        smoothed = analyzer._smooth_signal(signal_data, 3)
        states = analyzer._apply_hysteresis(smoothed, 0.6, 0.2)
        intervals = analyzer._merge_anomaly_intervals(
            [(0.0, 1.0, "Audio sin Boca"), (1.2, 2.0, "Audio sin Boca")], 0.5
        )

        self.assertEqual(states.dtype, bool)
        self.assertTrue(intervals)

    def test_absence_merge_intervals(self):
        with mock.patch(
            "behavior_analysis.analyzers.absence.mp.solutions.face_detection.FaceDetection"
        ) as fd:
            fd.return_value.process.return_value = SimpleNamespace(detections=[])
            analyzer = AnalizadorAusencia(
                min_absence_duration=0.1,
                absence_confirm_seconds=0.0,
                presence_confirm_seconds=0.0,
                merge_gap_seconds=0.5,
            )

        frame = np.zeros((10, 10, 3), dtype=np.uint8)
        analyzer.procesar_frame(frame, 0.0)
        analyzer.procesar_frame(frame, 1.0)
        results = analyzer.finalizar(1.5)

        self.assertTrue(results)

    def test_lighting_results(self):
        analyzer = AnalizadorIluminacion()
        analyzer.anomaly_intervals = [(0.0, 0.2), (0.25, 0.4)]
        results = analyzer.obtener_resultados()
        self.assertTrue(results)

    def test_faces_detect_and_results(self):
        class StubDetector:
            def setInputSize(self, _size):
                return None

            def detect(self, _frame):
                return None, [object()]

        class StubRecognizer:
            def alignCrop(self, frame, face):
                return frame

            def feature(self, _aligned_face):
                return np.ones((1, 1))

            def match(self, _feature, _embedding, _method):
                return 0.5

        with mock.patch(
            "behavior_analysis.analyzers.faces.AnalizadorRostros._ensure_models_exist",
            return_value=("det.onnx", "rec.onnx"),
        ), mock.patch(
            "behavior_analysis.analyzers.faces.cv2.FaceDetectorYN.create",
            return_value=StubDetector(),
        ), mock.patch(
            "behavior_analysis.analyzers.faces.cv2.FaceRecognizerSF.create",
            return_value=StubRecognizer(),
        ):
            analyzer = AnalizadorRostros()
            analyzer.frame_stride = 1
            frame = np.zeros((20, 20, 3), dtype=np.uint8)
            analyzer.procesar_frame(frame, 0.0)
            analyzer.procesar_frame(frame, 1.0)
            results = analyzer.obtener_resultados()

        self.assertIsInstance(results, list)

    def test_voice_process_with_clustering(self):
        y = np.ones(96000, dtype=np.float32) * 0.02

        class StubScaler:
            def fit_transform(self, X):
                return X

        class StubKMeans:
            def __init__(self, n_clusters, random_state=None, n_init=None):
                self.n_clusters = n_clusters

            def fit_predict(self, X):
                if self.n_clusters == 2:
                    labels = [0, 1] * (len(X) // 2)
                    if len(X) % 2:
                        labels.append(0)
                    return np.array(labels)
                return np.zeros(len(X), dtype=int)

        analyzer = AnalizadorVoz("video.mp4")
        with mock.patch(
            "behavior_analysis.analyzers.voice.VideoFileClip"
        ) as video_cls, mock.patch(
            "behavior_analysis.analyzers.voice.librosa.load",
            return_value=(y, 16000),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.zero_crossing_rate",
            return_value=np.array([[0.1]]),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.spectral_flatness",
            return_value=np.array([[0.1]]),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.mfcc",
            return_value=np.ones((20, 2)),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.StandardScaler",
            return_value=StubScaler(),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.KMeans",
            StubKMeans,
        ), mock.patch(
            "behavior_analysis.analyzers.voice.silhouette_score",
            side_effect=[0.2, 0.1],
        ), mock.patch(
            "behavior_analysis.analyzers.voice.os.path.exists", return_value=True
        ), mock.patch(
            "behavior_analysis.analyzers.voice.os.remove"
        ) as remove_mock:
            clip = mock.Mock()
            clip.audio.write_audiofile.return_value = None
            video_cls.return_value = clip
            results = analyzer.procesar()

        self.assertIsNotNone(results)
        self.assertEqual(results["num_speakers"], 2)
        self.assertTrue(results["hablantes"])
        remove_mock.assert_called()

    def test_voice_process_small_segments(self):
        y = np.ones(16000, dtype=np.float32) * 0.02
        analyzer = AnalizadorVoz("video.mp4")
        with mock.patch(
            "behavior_analysis.analyzers.voice.VideoFileClip"
        ) as video_cls, mock.patch(
            "behavior_analysis.analyzers.voice.librosa.load",
            return_value=(y, 16000),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.zero_crossing_rate",
            return_value=np.array([[0.1]]),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.spectral_flatness",
            return_value=np.array([[0.1]]),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.librosa.feature.mfcc",
            return_value=np.ones((20, 2)),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.os.path.exists", return_value=False
        ):
            clip = mock.Mock()
            clip.audio.write_audiofile.return_value = None
            video_cls.return_value = clip
            results = analyzer.procesar()

        self.assertIsNotNone(results)
        self.assertEqual(results["num_speakers"], 1)

    def test_voice_process_error(self):
        analyzer = AnalizadorVoz("video.mp4")
        with mock.patch(
            "behavior_analysis.analyzers.voice.VideoFileClip",
            side_effect=RuntimeError("boom"),
        ), mock.patch(
            "behavior_analysis.analyzers.voice.os.path.exists", return_value=False
        ):
            result = analyzer.procesar()

        self.assertIsNone(result)

    def test_lipsync_init_with_audio(self):
        clip = mock.Mock()
        clip.audio.to_soundarray.return_value = np.ones((4, 2), dtype=np.float32)
        with mock.patch(
            "behavior_analysis.analyzers.lipsync.VideoFileClip", return_value=clip
        ), mock.patch(
            "behavior_analysis.analyzers.lipsync.signal.butter", return_value="sos"
        ), mock.patch(
            "behavior_analysis.analyzers.lipsync.signal.sosfilt",
            return_value=np.array([0.1, 0.2, 0.3, 0.4]),
        ):
            analyzer = AnalizadorLipsync("video.mp4")

        self.assertIsNotNone(analyzer.audio_array)

    def test_lipsync_obtener_resultados_detects_anomaly(self):
        analyzer = AnalizadorLipsync.__new__(AnalizadorLipsync)
        analyzer.fps = 5
        analyzer.sample_rate = 10
        analyzer.audio_array = np.array(
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], dtype=float
        )
        analyzer.visual_envelope = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        analyzer.frame_timestamps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
        analyzer.MIN_INTERVAL_SEC = 0.2

        results = analyzer.obtener_resultados()

        self.assertTrue(results["anomalias"])

    def test_lighting_detect_face_region_variants(self):
        analyzer = AnalizadorIluminacion()
        analyzer.face_cascade = mock.Mock()
        gray = np.zeros((100, 100), dtype=np.uint8)

        analyzer.face_cascade.detectMultiScale.return_value = np.array(
            [[10, 10, 20, 20]]
        )
        roi_full, roi_face, detected = analyzer._detect_face_region(gray)
        self.assertTrue(detected)
        self.assertEqual(roi_face.shape, (20, 20))

        analyzer.face_cascade.detectMultiScale.return_value = []
        roi_full, roi_face, detected = analyzer._detect_face_region(gray)
        self.assertTrue(detected)
        self.assertIsNotNone(analyzer.last_face_coords)

        analyzer.last_face_coords = None
        roi_full, roi_face, detected = analyzer._detect_face_region(gray)
        self.assertFalse(detected)

    def test_lighting_procesar_frame_tracks_anomaly(self):
        analyzer = AnalizadorIluminacion()
        analyzer.FRAME_SKIP = 0
        analyzer.MIN_CONSECUTIVE_FRAMES = 1
        frame = np.zeros((10, 10, 3), dtype=np.uint8)
        roi = np.ones((10, 10), dtype=np.uint8) * 200
        prev_roi = np.zeros((10, 10), dtype=np.uint8)

        with mock.patch.object(
            analyzer, "_detect_face_region", side_effect=[(roi, roi, True), (roi, roi, True)]
        ), mock.patch(
            "behavior_analysis.analyzers.lighting.cv2.subtract",
            return_value=roi,
        ), mock.patch(
            "behavior_analysis.analyzers.lighting.cv2.threshold",
            return_value=(None, roi),
        ), mock.patch(
            "behavior_analysis.analyzers.lighting.cv2.countNonZero",
            side_effect=[50, 10],
        ), mock.patch.object(
            analyzer, "_analyze_histogram", return_value=True
        ), mock.patch.object(
            analyzer, "_is_sudden_brightness_spike", return_value=True
        ), mock.patch.object(
            analyzer, "_detect_face_lighting_change", return_value=(True, 30)
        ):
            analyzer.prev_gray = prev_roi
            analyzer.procesar_frame(frame, 0.5)
            analyzer.finalizar(0.8)

        self.assertTrue(analyzer.anomaly_intervals)
