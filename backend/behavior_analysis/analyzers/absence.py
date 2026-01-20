import mediapipe as mp
import cv2


class AnalizadorAusencia:
    def __init__(
        self,
        min_absence_duration=1.0,
        absence_confirm_seconds=0.6,
        presence_confirm_seconds=1.0,
        merge_gap_seconds=3.0,
    ):
        self.min_absence_duration = min_absence_duration
        self.absence_confirm_seconds = absence_confirm_seconds
        self.presence_confirm_seconds = presence_confirm_seconds
        self.merge_gap_seconds = merge_gap_seconds
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            min_detection_confidence=0.5
        )

        self.absence_start_time = None
        self.absent_since = None
        self.present_since = None
        self.absence_intervals = []  # (start, end)
        self._interval_keys = set()
        self.last_timestamp = 0

    def _append_interval(self, start_time, end_time):
        if end_time <= start_time:
            return
        start_rounded = round(start_time, 2)
        end_rounded = round(end_time, 2)
        key = (start_rounded, end_rounded)
        if key in self._interval_keys:
            return
        self._interval_keys.add(key)
        self.absence_intervals.append((start_time, end_time))

    def _merge_intervals(self, intervals):
        if not intervals:
            return []
        intervals = sorted(intervals, key=lambda item: item[0])
        merged = []
        current_start, current_end = intervals[0]
        for start, end in intervals[1:]:
            if start <= current_end + self.merge_gap_seconds:
                current_end = max(current_end, end)
            else:
                merged.append((current_start, current_end))
                current_start, current_end = start, end
        merged.append((current_start, current_end))
        return merged

    def procesar_frame(self, frame, timestamp):
        self.last_timestamp = timestamp
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_detection.process(image_rgb)

        present = bool(results.detections)

        if present:
            self.absent_since = None
            if self.absence_start_time is not None:
                if self.present_since is None:
                    self.present_since = timestamp
                elif timestamp - self.present_since >= self.presence_confirm_seconds:
                    self._append_interval(self.absence_start_time, self.present_since)
                    self.absence_start_time = None
                    self.present_since = None
            else:
                self.present_since = None
        else:
            self.present_since = None
            if self.absence_start_time is None:
                if self.absent_since is None:
                    self.absent_since = timestamp
                elif timestamp - self.absent_since >= self.absence_confirm_seconds:
                    self.absence_start_time = self.absent_since
                    self.absent_since = None
            else:
                self.absent_since = None

    def finalizar(self, final_timestamp=None):
        if final_timestamp is None:
            final_timestamp = self.last_timestamp

        # Check if absence was ongoing at the end
        if self.absence_start_time is None and self.absent_since is not None:
            if final_timestamp - self.absent_since >= self.absence_confirm_seconds:
                self.absence_start_time = self.absent_since
            self.absent_since = None
        if self.absence_start_time is not None:
            self._append_interval(self.absence_start_time, final_timestamp)
            self.absence_start_time = None
        merged = self._merge_intervals(self.absence_intervals)
        resultados = []
        for start, end in merged:
            duration = end - start
            if duration < self.min_absence_duration:
                continue
            resultados.append((round(start, 2), round(end, 2), round(duration, 2)))
        return resultados
