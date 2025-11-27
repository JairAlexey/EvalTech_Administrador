import cv2
import numpy as np


class AnalizadorIluminacion:
    def __init__(self):
        self.GLOBAL_DIFF_THRESH = 15.0
        self.BRIGHT_PIXEL_VALUE = 220
        self.BRIGHT_RATIO_DIFF_THRESH = 0.03
        self.NEW_HIGHLIGHT_RATIO_THRESH = 0.002
        self.SUSPICIOUS_MIN_DURATION = 3.0
        self.MERGE_GAP_SECONDS = 0.5

        self.prev_gray = None
        self.prev_mean_brightness = None
        self.prev_bright_ratio = None

        self.LABEL_GLOBAL = "Global Lighting Change"
        self.LABEL_LOCAL = "Local Highlight (Possible Device Reflection)"
        self.labels = [self.LABEL_GLOBAL, self.LABEL_LOCAL]

        self.anomaly_intervals = {label: [] for label in self.labels}
        self.current_start = {label: None for label in self.labels}

    def procesar_frame(self, frame, timestamp):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = float(np.mean(gray))
        bright_mask = gray >= self.BRIGHT_PIXEL_VALUE
        bright_ratio = float(np.mean(bright_mask))

        if self.prev_gray is not None:
            new_highlights_mask = np.logical_and(
                bright_mask, self.prev_gray < self.BRIGHT_PIXEL_VALUE
            )
            new_highlights_ratio = float(np.mean(new_highlights_mask))

            global_diff = (
                abs(mean_brightness - self.prev_mean_brightness)
                if self.prev_mean_brightness is not None
                else 0.0
            )
            bright_ratio_diff = (
                bright_ratio - self.prev_bright_ratio
                if self.prev_bright_ratio is not None
                else 0.0
            )

            is_global_anomaly = global_diff > self.GLOBAL_DIFF_THRESH
            is_local_anomaly = (
                bright_ratio_diff > self.BRIGHT_RATIO_DIFF_THRESH
                or new_highlights_ratio > self.NEW_HIGHLIGHT_RATIO_THRESH
            )

            for label, is_active in (
                (self.LABEL_GLOBAL, is_global_anomaly),
                (self.LABEL_LOCAL, is_local_anomaly),
            ):
                if is_active:
                    if self.current_start[label] is None:
                        self.current_start[label] = timestamp
                else:
                    if self.current_start[label] is not None:
                        self.anomaly_intervals[label].append(
                            (self.current_start[label], timestamp)
                        )
                        self.current_start[label] = None

        self.prev_gray = gray
        self.prev_mean_brightness = mean_brightness
        self.prev_bright_ratio = bright_ratio

    def finalizar(self, final_timestamp):
        for label in self.labels:
            if self.current_start[label] is not None:
                self.anomaly_intervals[label].append(
                    (self.current_start[label], final_timestamp)
                )
                self.current_start[label] = None

    def _merge_intervals(self, intervals, gap):
        if not intervals:
            return []
        intervals = sorted(intervals, key=lambda x: x[0])
        merged = [list(intervals[0])]
        for start, end in intervals[1:]:
            last_start, last_end = merged[-1]
            if start <= last_end + gap:
                merged[-1][1] = max(last_end, end)
            else:
                merged.append([start, end])
        return [(s, e) for s, e in merged]

    def obtener_resultados(self):
        resultados = []
        for label in self.labels:
            merged = self._merge_intervals(
                self.anomaly_intervals[label], self.MERGE_GAP_SECONDS
            )
            for start, end in merged:
                duration = end - start
                if duration >= self.SUSPICIOUS_MIN_DURATION:
                    resultados.append(
                        {
                            "tipo_anomalia": label,
                            "tiempo_inicio": start,
                            "tiempo_fin": end,
                        }
                    )
        return resultados
