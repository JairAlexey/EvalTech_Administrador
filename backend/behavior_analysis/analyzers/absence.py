import mediapipe as mp
import cv2


class AnalizadorAusencia:
    def __init__(self, min_absence_duration=1.0):
        self.min_absence_duration = min_absence_duration
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            min_detection_confidence=0.5
        )

        self.absence_start_time = None
        self.absence_intervals = []  # (start, end, duration)
        self._interval_keys = set()
        self.last_timestamp = 0

    def _append_interval(self, start_time, end_time):
        duration = end_time - start_time
        if duration < self.min_absence_duration:
            return
        start_rounded = round(start_time, 2)
        end_rounded = round(end_time, 2)
        duration_rounded = round(duration, 2)
        key = (start_rounded, end_rounded)
        if key in self._interval_keys:
            return
        self._interval_keys.add(key)
        self.absence_intervals.append(
            (start_rounded, end_rounded, duration_rounded)
        )

    def procesar_frame(self, frame, timestamp):
        self.last_timestamp = timestamp
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(image_rgb)

        present = bool(results.detections)

        if present:
            if self.absence_start_time is not None:
                self._append_interval(self.absence_start_time, timestamp)
                self.absence_start_time = None
        else:
            if self.absence_start_time is None:
                self.absence_start_time = timestamp

    def finalizar(self, final_timestamp=None):
        if final_timestamp is None:
            final_timestamp = self.last_timestamp

        # Check if absence was ongoing at the end
        if self.absence_start_time is not None:
            self._append_interval(self.absence_start_time, final_timestamp)
            self.absence_start_time = None
        return self.absence_intervals
