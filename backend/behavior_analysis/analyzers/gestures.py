import cv2
import numpy as np


class AnalizadorGestos:
    def __init__(self, consulta_min_duration=3.0):
        self.consulta_min_duration = consulta_min_duration
        self.current_gesture = "Forward"
        self.gesture_start_time = 0.0
        self.gesture_intervals = []

        # Modelo 3D genérico (constante)
        self.face_3d = np.array(
            [
                (0.0, 0.0, 0.0),  # Nose tip
                (0.0, 330.0, -65.0),  # Chin
                (-225.0, -170.0, -135.0),  # Left eye left corner
                (225.0, -170.0, -135.0),  # Right eye right corner
                (-150.0, 150.0, -125.0),  # Left mouth corner
                (150.0, 150.0, -125.0),  # Right mouth corner
            ],
            dtype=np.float64,
        )

        self.points_idx = [1, 152, 33, 263, 61, 291]

    def procesar_frame(self, landmarks, img_w, img_h, timestamp):
        frame_gesture = "Forward"

        if landmarks:
            # Puntos 2D
            face_2d = []
            for idx in self.points_idx:
                lm = landmarks.landmark[idx]
                x, y = int(lm.x * img_w), int(lm.y * img_h)
                face_2d.append([x, y])
            face_2d = np.array(face_2d, dtype=np.float64)

            focal_length = img_w
            cam_matrix = np.array(
                [
                    [focal_length, 0, img_w / 2],
                    [0, focal_length, img_h / 2],
                    [0, 0, 1],
                ],
                dtype=np.float64,
            )

            dist_matrix = np.zeros((4, 1), dtype=np.float64)

            success_pnp, rot_vec, trans_vec = cv2.solvePnP(
                self.face_3d, face_2d, cam_matrix, dist_matrix
            )

            if success_pnp:
                rmat, _ = cv2.Rodrigues(rot_vec)
                angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

                x = angles[0]  # pitch
                y = angles[1]  # yaw

                threshold_x_down = 25
                threshold_x_up = 15
                threshold_y = 25
                strong_pitch = 30

                gesture_candidate = "Forward"

                if abs(x) > strong_pitch:
                    if x < -threshold_x_down:
                        gesture_candidate = "Looking Down"
                    elif x > threshold_x_up:
                        gesture_candidate = "Looking Up"
                elif abs(y) > threshold_y or abs(x) > min(
                    threshold_x_down, threshold_x_up
                ):
                    if abs(y) > abs(x):
                        if y < -threshold_y:
                            gesture_candidate = "Looking Right"
                        elif y > threshold_y:
                            gesture_candidate = "Looking Left"
                    else:
                        if x < -threshold_x_down:
                            gesture_candidate = "Looking Down"
                        elif x > threshold_x_up:
                            gesture_candidate = "Looking Up"

                frame_gesture = gesture_candidate

        # Gestión de cambio de gesto
        if frame_gesture != self.current_gesture:
            if self.current_gesture != "Forward":
                self.gesture_intervals.append(
                    {
                        "gesture": self.current_gesture,
                        "start": self.gesture_start_time,
                        "end": timestamp,
                    }
                )
            self.current_gesture = frame_gesture
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

    def obtener_resultados(self):
        # Agrupar y filtrar
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
        for gesture, ranges in grouped_gestures.items():
            for start, end in ranges:
                resultados.append(
                    {
                        "tipo_gesto": gesture,
                        "tiempo_inicio": start,
                        "tiempo_fin": end,
                        "duracion": end - start,
                    }
                )
        return resultados
