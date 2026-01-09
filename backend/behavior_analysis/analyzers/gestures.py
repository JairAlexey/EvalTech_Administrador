import cv2
import numpy as np

class AnalizadorGestos:
    def __init__(self, consulta_min_duration=1.5):
        self.consulta_min_duration = consulta_min_duration
        self.current_gesture = "Forward"
        self.gesture_start_time = 0.0
        self.gesture_intervals = []

        # Índices clave de MediaPipe para el modelo relativo
        self.IDX_NOSE = 1
        self.IDX_LEFT_FACE_EDGE = 234  # Punto más externo izquierda (oreja/pómulo)
        self.IDX_RIGHT_FACE_EDGE = 454  # Punto más externo derecha (oreja/pómulo)
        self.IDX_CHIN = 152
        self.IDX_FOREHEAD = 10

    def procesar_frame(self, landmarks, img_w, img_h, timestamp):
        gesture_candidate = "Forward"

        if landmarks:
            lm = landmarks.landmark

            # --- 1. Extracción de Coordenadas ---
            nose = np.array([lm[self.IDX_NOSE].x, lm[self.IDX_NOSE].y])
            left_edge = np.array(
                [lm[self.IDX_LEFT_FACE_EDGE].x, lm[self.IDX_LEFT_FACE_EDGE].y]
            )
            right_edge = np.array(
                [lm[self.IDX_RIGHT_FACE_EDGE].x, lm[self.IDX_RIGHT_FACE_EDGE].y]
            )
            forehead = np.array([lm[self.IDX_FOREHEAD].x, lm[self.IDX_FOREHEAD].y])
            chin = np.array([lm[self.IDX_CHIN].x, lm[self.IDX_CHIN].y])

            # --- 2. Modelo Matemático Relativo (YAW - Lados) ---
            # Calculamos distancias de la nariz a los bordes de la cara
            dist_to_left = np.linalg.norm(nose - left_edge)
            dist_to_right = np.linalg.norm(nose - right_edge)
            total_width = dist_to_left + dist_to_right

            # Ratio Horizontal: 0.5 es centro. <0.5 mira izq, >0.5 mira der.
            # (Dependiendo del espejo de tu cámara, invierte < o >)
            yaw_ratio = dist_to_left / total_width

            # --- 3. Modelo Matemático Relativo (PITCH - Arriba/Abajo) ---
            # Distancia vertical nariz-mentón vs nariz-frente
            # Ojo: En imagen, Y crece hacia abajo.
            dist_nose_forehead = np.linalg.norm(nose - forehead)
            dist_nose_chin = np.linalg.norm(nose - chin)
            total_height = dist_nose_forehead + dist_nose_chin

            pitch_ratio = dist_nose_forehead / total_height

            # --- 4. Definición de Umbrales (Calibración) ---
            # Ajusta estos valores si es demasiado sensible
            # Ratios típicos: Centro ~0.50

            # Umbrales YAW (Lados)
            YAW_LIMIT_RIGHT = 0.35  # Si ratio < 0.35, nariz muy cerca del borde izq (mirando derecha real)
            YAW_LIMIT_LEFT = 0.65  # Si ratio > 0.65, nariz muy cerca del borde der (mirando izquierda real)

            # Umbrales PITCH (Vertical)
            PITCH_LIMIT_UP = 0.35  # Frente se "achica" visualmente o nariz sube
            PITCH_LIMIT_DOWN = 0.65  # Frente se "agranda" o nariz baja

            # --- 5. Clasificación ---

            # Prioridad al Pitch (Mirar abajo/arriba suele ser más obvio)
            if pitch_ratio > PITCH_LIMIT_DOWN:
                gesture_candidate = "Looking Down"
            elif pitch_ratio < PITCH_LIMIT_UP:
                gesture_candidate = "Looking Up"
            else:
                # Si no mira arriba/abajo, evaluamos lados
                if yaw_ratio < YAW_LIMIT_RIGHT:
                    gesture_candidate = "Looking Right"  # Ojo con el espejo
                elif yaw_ratio > YAW_LIMIT_LEFT:
                    gesture_candidate = "Looking Left"  # Ojo con el espejo
                else:
                    gesture_candidate = "Forward"

        # --- Lógica Temporal (Gestión de estados) ---
        # (Esta parte de tu código estaba bien, la mantengo igual)
        if gesture_candidate != self.current_gesture:
            if self.current_gesture != "Forward":
                self.gesture_intervals.append(
                    {
                        "gesture": self.current_gesture,
                        "start": self.gesture_start_time,
                        "end": timestamp,
                    }
                )
            self.current_gesture = gesture_candidate
            self.gesture_start_time = timestamp

    def finalizar(self, final_timestamp):
        if self.current_gesture != "Forward":
            self.gesture_intervals.append(
                {
                    "gesture": self.current_gesture,
                    "start": self.gesture_start_time,
                    "end": final_timestamp,
                }
            )
            self.current_gesture = "Forward"

    def obtener_resultados(self):
        # Tu misma lógica de filtrado, sin cambios
        grouped_gestures = {}
        for interval in self.gesture_intervals:
            duration = interval["end"] - interval["start"]
            if duration <= 0.2:
                continue

            g_type = interval["gesture"]
            if g_type not in grouped_gestures:
                grouped_gestures[g_type] = []

            if grouped_gestures[g_type] and (
                interval["start"] - grouped_gestures[g_type][-1][1] < 0.5
            ):
                prev_start, prev_end = grouped_gestures[g_type].pop()
                grouped_gestures[g_type].append((prev_start, interval["end"]))
            else:
                grouped_gestures[g_type].append((interval["start"], interval["end"]))

        resultados = []
        seen = set()
        for gesture, ranges in grouped_gestures.items():
            for start, end in ranges:
                duracion = end - start
                if duracion >= self.consulta_min_duration:
                    item = {
                        "tipo_gesto": gesture,
                        "tiempo_inicio": round(start, 2),
                        "tiempo_fin": round(end, 2),
                        "duracion": round(duracion, 2),
                    }
                    key = (item["tipo_gesto"], item["tiempo_inicio"], item["tiempo_fin"])
                    if key in seen:
                        continue
                    seen.add(key)
                    resultados.append(item)
        return resultados
