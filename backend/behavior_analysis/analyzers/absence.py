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
        self.last_timestamp = 0

    def procesar_frame(self, frame, timestamp):
        self.last_timestamp = timestamp
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(image_rgb)

        present = bool(results.detections)

        if present:
            if self.absence_start_time is not None:
                end_time = timestamp
                duration = end_time - self.absence_start_time
                if duration >= self.min_absence_duration:
                    self.absence_intervals.append(
                        (
                            round(self.absence_start_time, 2),
                            round(end_time, 2),
                            round(duration, 2),
                        )
                    )
                self.absence_start_time = None
        else:
            if self.absence_start_time is None:
                self.absence_start_time = timestamp

    def finalizar(self, final_timestamp=None):
        if final_timestamp is None:
            final_timestamp = self.last_timestamp

        # Check if absence was ongoing at the end
        if self.absence_start_time is not None:
            duration = final_timestamp - self.absence_start_time
            if duration >= self.min_absence_duration:
                self.absence_intervals.append(
                    (
                        round(self.absence_start_time, 2),
                        round(final_timestamp, 2),
                        round(duration, 2),
                    )
                )
        return self.absence_intervals
