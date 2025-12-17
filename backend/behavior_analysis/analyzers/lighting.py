import cv2
import numpy as np


class AnalizadorIluminacion:
    def __init__(self):
        # Parámetros ajustados para detectar cambios de luz en el rostro
        self.MIN_INTENSITY_CHANGE = 40  # Reducido para captar cambios en rostro
        self.MIN_BRIGHT_INTENSITY = (
            180  # Reducido - luz sobre rostro no siempre es 200+
        )
        self.MIN_AREA_RATIO = 0.002  # Más sensible - área de rostro afectada
        self.MAX_AREA_RATIO = (
            0.6  # Más permisivo para iluminación sobre rostro completo
        )
        self.MIN_MEAN_INCREASE = 15  # Reducido - luz indirecta causa menos incremento
        self.MIN_FACE_MEAN_INCREASE = 20  # Incremento mínimo en región facial
        self.SUSPICIOUS_MIN_DURATION = 0.1  # Flash puede ser muy breve
        self.SUSPICIOUS_MAX_DURATION = 5.0  # Permitir eventos más largos
        self.MERGE_GAP_SECONDS = (
            2.0  # Gap más amplio - une eventos cercanos (ej. 29.23 a 31.17)
        )

        # Validación temporal - detectar cambios súbitos
        self.FRAME_SKIP = 1  # Procesar todos los frames para mayor precisión

        # Historial para análisis temporal
        self.prev_gray = None
        self.prev_face_roi = None
        self.brightness_history = []  # Últimos N valores de brillo promedio
        self.face_brightness_history = []  # Historial específico del rostro
        self.HISTORY_SIZE = 5
        self.frame_counter = 0

        # Detección de rostro para enfoque en región relevante
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        # Guardar última posición de rostro conocida
        self.last_face_coords = None

        self.anomaly_intervals = []
        self.current_start = None
        self.consecutive_anomalies = 0
        self.MIN_CONSECUTIVE_FRAMES = 2  # Requiere detección en múltiples frames

    def _detect_face_region(self, gray):
        """Detecta la región del rostro para enfocar el análisis"""
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )

        if len(faces) > 0:
            # Tomar el rostro más grande (probablemente el más cercano)
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            # Guardar coordenadas para uso futuro
            self.last_face_coords = (x, y, w, h)
            # Expandir la región un 30% para capturar reflejos cerca del rostro
            margin = int(max(w, h) * 0.3)
            x_start = max(0, x - margin)
            y_start = max(0, y - margin)
            x_end = min(gray.shape[1], x + w + margin)
            y_end = min(gray.shape[0], y + h + margin)

            # Retornar ROI completa y ROI solo del rostro (sin margen)
            roi_full = gray[y_start:y_end, x_start:x_end]
            roi_face = gray[y : y + h, x : x + w]
            return roi_full, roi_face, True

        # Si no se detecta pero tenemos última posición, usarla
        elif self.last_face_coords is not None:
            x, y, w, h = self.last_face_coords
            margin = int(max(w, h) * 0.3)
            x_start = max(0, x - margin)
            y_start = max(0, y - margin)
            x_end = min(gray.shape[1], x + w + margin)
            y_end = min(gray.shape[0], y + h + margin)

            roi_full = gray[y_start:y_end, x_start:x_end]
            roi_face = gray[y : y + h, x : x + w]
            return roi_full, roi_face, True

        # Si no se detecta rostro, usar región central (70% de la imagen)
        h, w = gray.shape
        margin_h = int(h * 0.15)
        margin_w = int(w * 0.15)
        roi = gray[margin_h : h - margin_h, margin_w : w - margin_w]
        return roi, roi, False

    def _is_sudden_brightness_spike(self, current_mean, face_mean=None):
        """Detecta picos súbitos de brillo comparando con historial"""
        if len(self.brightness_history) < 3:
            return False

        # Calcular promedio de brillo histórico general
        historical_mean = np.mean(self.brightness_history)
        general_spike = current_mean - historical_mean > self.MIN_MEAN_INCREASE

        # Si tenemos datos de rostro, validar también el cambio facial
        if face_mean is not None and len(self.face_brightness_history) >= 3:
            face_historical_mean = np.mean(self.face_brightness_history)
            face_spike = face_mean - face_historical_mean > self.MIN_FACE_MEAN_INCREASE
            return general_spike or face_spike

        return general_spike

    def _analyze_histogram(self, gray):
        """Analiza el histograma para detectar sobreexposición característica de flashes"""
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])

        # Normalizar histograma
        hist = hist.flatten() / hist.sum()

        # Un flash típicamente concentra muchos píxeles en el rango alto
        # Reducido de 220 a 200 y de 15% a 10% para captar luz sobre rostro
        high_intensity_ratio = hist[200:].sum()

        # Flash verdadero: >10% de píxeles en rango brillante
        return high_intensity_ratio > 0.10

    def _detect_face_lighting_change(self, face_roi, prev_face_roi):
        """Detecta cambios de iluminación específicamente en la región facial"""
        if prev_face_roi is None or face_roi.shape != prev_face_roi.shape:
            return False, 0

        # Calcular cambio promedio en el rostro
        face_diff = cv2.absdiff(face_roi, prev_face_roi)
        face_mean_change = np.mean(face_diff)

        # Detectar si hay incremento de luz (no solo cambio)
        face_increase = cv2.subtract(face_roi, prev_face_roi)
        face_mean_increase = np.mean(face_increase)

        # Verificar si el cambio es significativo
        # Flash sobre rostro: cambio promedio > 15 y principalmente incremento
        is_significant = face_mean_change > 15 and face_mean_increase > 10

        return is_significant, face_mean_increase

    def procesar_frame(self, frame, timestamp):
        self.frame_counter += 1

        # Procesar según frame_skip
        if self.frame_counter % (self.FRAME_SKIP + 1) != 0:
            return

        # Convertir a escala de grises y aplicar desenfoque gaussiano
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (7, 7), 0)

        # Obtener región de interés (rostro completo y solo cara)
        roi, face_roi, face_detected = self._detect_face_region(gray)

        is_anomaly = False

        if self.prev_gray is not None and roi.size > 0:
            # Obtener ROI anterior con las mismas dimensiones
            prev_roi, prev_face_roi, _ = self._detect_face_region(self.prev_gray)

            # Solo comparar si las dimensiones coinciden
            if prev_roi.shape == roi.shape:
                # 1. VALIDACIÓN DE CAMBIO SÚBITO DE INTENSIDAD (ROI general)
                current_mean = np.mean(roi)
                prev_mean_val = np.mean(prev_roi)
                mean_increase = current_mean - prev_mean_val

                # 1b. VALIDACIÓN ESPECÍFICA DEL ROSTRO (nueva - clave para luz sobre cara)
                face_lighting_change = False
                face_mean = None
                if face_detected and face_roi.size > 0:
                    face_lighting_change, face_mean_increase = (
                        self._detect_face_lighting_change(face_roi, prev_face_roi)
                    )
                    face_mean = np.mean(face_roi)

                    # Actualizar historial de brillo facial
                    self.face_brightness_history.append(face_mean)
                    if len(self.face_brightness_history) > self.HISTORY_SIZE:
                        self.face_brightness_history.pop(0)

                # 2. VALIDACIÓN DE ÁREA AFECTADA
                mask_lighter = cv2.subtract(roi, prev_roi)
                _, thresh = cv2.threshold(
                    mask_lighter, self.MIN_INTENSITY_CHANGE, 255, cv2.THRESH_BINARY
                )

                non_zero_count = cv2.countNonZero(thresh)
                total_pixels = roi.shape[0] * roi.shape[1]
                change_ratio = non_zero_count / total_pixels

                # 3. VALIDACIÓN DE PÍXELES MUY BRILLANTES
                bright_pixels = cv2.countNonZero(
                    cv2.threshold(
                        roi, self.MIN_BRIGHT_INTENSITY, 255, cv2.THRESH_BINARY
                    )[1]
                )
                bright_ratio = bright_pixels / total_pixels

                # 4. VALIDACIÓN DE HISTOGRAMA
                histogram_flash = self._analyze_histogram(roi)

                # 5. VALIDACIÓN DE PICO SÚBITO EN HISTORIAL (general + facial)
                sudden_spike = self._is_sudden_brightness_spike(current_mean, face_mean)

                # CRITERIOS COMBINADOS (mejorados para detectar luz sobre rostro):
                is_valid_area = self.MIN_AREA_RATIO < change_ratio < self.MAX_AREA_RATIO
                is_significant_increase = mean_increase > self.MIN_MEAN_INCREASE
                is_very_bright = bright_ratio > 0.08  # Reducido de 0.1 a 0.08

                # Contar condiciones cumplidas
                conditions = [
                    is_valid_area,
                    is_significant_increase,
                    is_very_bright,
                    histogram_flash,
                    sudden_spike,
                    face_lighting_change,  # Nueva condición - muy importante
                ]

                conditions_met = sum(conditions)

                # Si hay cambio detectado en el rostro, reducir el umbral requerido
                if face_lighting_change and conditions_met >= 2:
                    is_anomaly = True
                elif conditions_met >= 3:
                    is_anomaly = True

                # Actualizar historial de brillo general
                self.brightness_history.append(current_mean)
                if len(self.brightness_history) > self.HISTORY_SIZE:
                    self.brightness_history.pop(0)

        # Gestión de intervalos con validación de frames consecutivos
        if is_anomaly:
            self.consecutive_anomalies += 1
            if self.consecutive_anomalies >= self.MIN_CONSECUTIVE_FRAMES:
                if self.current_start is None:
                    self.current_start = timestamp
        else:
            if self.current_start is not None:
                duration = timestamp - self.current_start
                # Solo registrar si la duración es razonable para un flash
                if duration <= self.SUSPICIOUS_MAX_DURATION:
                    self.anomaly_intervals.append((self.current_start, timestamp))
                self.current_start = None
            self.consecutive_anomalies = 0

        self.prev_gray = gray
        self.prev_face_roi = face_roi if face_detected else None

    def finalizar(self, final_timestamp):
        """Cierra cualquier intervalo de anomalía en progreso"""
        if self.current_start is not None:
            duration = final_timestamp - self.current_start
            if duration <= self.SUSPICIOUS_MAX_DURATION:
                self.anomaly_intervals.append((self.current_start, final_timestamp))
            self.current_start = None

    def obtener_resultados(self):
        """Fusiona intervalos cercanos y filtra por duración"""
        if not self.anomaly_intervals:
            return []

        # Ordenar intervalos
        intervals = sorted(self.anomaly_intervals, key=lambda x: x[0])

        # Fusionar intervalos cercanos (múltiples pasadas para asegurar unión completa)
        merged = []
        curr_start, curr_end = intervals[0]

        for next_start, next_end in intervals[1:]:
            # Si el gap es menor o igual al umbral, fusionar
            if next_start <= curr_end + self.MERGE_GAP_SECONDS:
                curr_end = max(curr_end, next_end)
            else:
                merged.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end
        merged.append((curr_start, curr_end))

        # Segunda pasada de fusión (por si hay casos complejos)
        if len(merged) > 1:
            final_merged = []
            curr_start, curr_end = merged[0]

            for next_start, next_end in merged[1:]:
                if next_start <= curr_end + self.MERGE_GAP_SECONDS:
                    curr_end = max(curr_end, next_end)
                else:
                    final_merged.append((curr_start, curr_end))
                    curr_start, curr_end = next_start, next_end
            final_merged.append((curr_start, curr_end))
            merged = final_merged

        # Filtrar por duración razonable
        resultados = []
        for start, end in merged:
            duration = end - start
            # Solo validar duración mínima, el máximo es más flexible después de fusionar
            if duration >= self.SUSPICIOUS_MIN_DURATION:
                resultados.append(
                    {
                        "tiempo_inicio": round(start, 2),
                        "tiempo_fin": round(end, 2),
                    }
                )

        return resultados
