import cv2
import numpy as np


class AnalizadorIluminacion:
    def __init__(self):
        # Ajustes de sensibilidad
        self.MIN_INTENSITY_CHANGE = (
            50  # Cuánto debe cambiar un pixel para importar (0-255)
        )
        self.MIN_AREA_RATIO = 0.0005  # Área mínima del destello (0.05% de la pantalla)
        self.SUSPICIOUS_MIN_DURATION = 0.2
        self.MERGE_GAP_SECONDS = 1.0

        self.prev_gray = None
        self.anomaly_intervals = []
        self.current_start = None

    def procesar_frame(self, frame, timestamp):
        # 1. Escala de grises y desenfoque suave para reducir ruido de cámara
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        is_anomaly = False

        if self.prev_gray is not None:
            # 2. Calcular la diferencia absoluta entre frames
            diff = cv2.absdiff(self.prev_gray, gray)

            # 3. Solo nos interesa si la luz AUMENTA (posible pantalla encendiéndose)
            # La resta normal (gray - prev_gray) da negativos si oscurece, numpy hace wrap-around,
            # así que usamos cv2.subtract para saturar a 0 los valores negativos.
            mask_lighter = cv2.subtract(gray, self.prev_gray)

            # 4. Umbralizar solo cambios significativos de luz (evita ruido y movimientos suaves)
            _, thresh = cv2.threshold(
                mask_lighter, self.MIN_INTENSITY_CHANGE, 255, cv2.THRESH_BINARY
            )

            # 5. Contar píxeles que cambiaron drásticamente
            non_zero_count = cv2.countNonZero(thresh)
            total_pixels = frame.shape[0] * frame.shape[1]
            change_ratio = non_zero_count / total_pixels

            # Verificar si el cambio es sustancial (ej. reflejo de celular)
            if change_ratio > self.MIN_AREA_RATIO:
                is_anomaly = True

        # Lógica de intervalos (igual que antes, funciona bien)
        if is_anomaly:
            if self.current_start is None:
                self.current_start = timestamp
        else:
            if self.current_start is not None:
                self.anomaly_intervals.append((self.current_start, timestamp))
                self.current_start = None

        self.prev_gray = gray

    def finalizar(self, final_timestamp):
        """Cierra cualquier intervalo de anomalía en progreso"""
        if self.current_start is not None:
            self.anomaly_intervals.append((self.current_start, final_timestamp))
            self.current_start = None

    def obtener_resultados(self):
        # Misma lógica de fusión de intervalos que ya tenías (es correcta)
        merged = []
        if not self.anomaly_intervals:
            return []

        intervals = sorted(self.anomaly_intervals, key=lambda x: x[0])
        curr_start, curr_end = intervals[0]

        for next_start, next_end in intervals[1:]:
            if next_start <= curr_end + self.MERGE_GAP_SECONDS:
                curr_end = max(curr_end, next_end)
            else:
                merged.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end
        merged.append((curr_start, curr_end))

        resultados = []
        for start, end in merged:
            if (end - start) >= self.SUSPICIOUS_MIN_DURATION:
                resultados.append(
                    {
                        "tiempo_inicio": round(start, 2),
                        "tiempo_fin": round(end, 2),
                    }
                )
        return resultados
