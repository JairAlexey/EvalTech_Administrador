import cv2
import mediapipe as mp
import numpy as np


def run_gestures_test(
    video_path,
    consulta_min_duration=3.0,  # duración mínima en segundos para marcar "consulta externa"
):
    print(f"Testing Gesture Identification on {video_path}...")

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        min_detection_confidence=0.5, min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    frame_count = 0
    current_gesture = "Forward"
    gesture_start_time = 0.0
    gesture_intervals = []
    current_time = 0.0

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        if timestamp_ms < 0 or (timestamp_ms == 0 and frame_count > 0):
            current_time = frame_count / fps
        else:
            current_time = timestamp_ms / 1000.0

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(image_rgb)

        img_h, img_w, img_c = image.shape

        frame_gesture = "Forward"

        if results.multi_face_landmarks:
            # Tomamos solo la primera cara (para exámenes suele haber solo una)
            face_landmarks = results.multi_face_landmarks[0]

            # Modelo 3D genérico
            face_3d = np.array(
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

            # Puntos 2D (ajustados a los índices estándar)
            landmarks = face_landmarks.landmark
            # 1: nariz, 152: mentón, 33/263: ojos, 61/291: boca
            points_idx = [1, 152, 33, 263, 61, 291]

            face_2d = []
            for idx in points_idx:
                lm = landmarks[idx]
                x, y = int(lm.x * img_w), int(lm.y * img_h)
                face_2d.append([x, y])
            face_2d = np.array(face_2d, dtype=np.float64)

            focal_length = img_w  # proporcional al ancho
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
                face_3d, face_2d, cam_matrix, dist_matrix
            )

            if success_pnp:
                rmat, jac = cv2.Rodrigues(rot_vec)
                angles, mtxR, mtxQ, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)

                x = angles[0]  # pitch (up/down)
                y = angles[1]  # yaw (left/right)

                # Umbrales (grados)
                threshold_x_down = 25   # inclinación hacia abajo
                threshold_x_up   = 15   # inclinación hacia arriba
                threshold_y      = 25   # giro izquierda/derecha

                strong_pitch = 30  # umbral para considerar "cabeza bien agachada"

                gesture_candidate = "Forward"

                if abs(x) > strong_pitch:
                    # Si la cabeza está muy inclinada, priorizamos arriba/abajo
                    if x < -threshold_x_down:
                        gesture_candidate = "Looking Down"
                    elif x > threshold_x_up:
                        gesture_candidate = "Looking Up"
                elif abs(y) > threshold_y or abs(x) > min(threshold_x_down, threshold_x_up):
                    # Caso normal: decidimos basado en qué eje se desvió más
                    if abs(y) > abs(x):
                        # izquierda / derecha
                        if y < -threshold_y:
                            gesture_candidate = "Looking Right"
                        elif y > threshold_y:
                            gesture_candidate = "Looking Left"
                    else:
                        # arriba / abajo (inclinación más grande que giro lateral)
                        if x < -threshold_x_down:
                            gesture_candidate = "Looking Down"
                        elif x > threshold_x_up:
                            gesture_candidate = "Looking Up"

                frame_gesture = gesture_candidate

        # Gestión de cambio de gesto
        if frame_gesture != current_gesture:
            if current_gesture != "Forward":
                # Cerrar gesto anterior
                gesture_intervals.append(
                    {
                        "gesture": current_gesture,
                        "start": gesture_start_time,
                        "end": current_time,
                    }
                )

            current_gesture = frame_gesture
            gesture_start_time = current_time

        frame_count += 1

    # Último segmento
    if current_gesture != "Forward":
        gesture_intervals.append(
            {
                "gesture": current_gesture,
                "start": gesture_start_time,
                "end": current_time,
            }
        )

    cap.release()
    face_mesh.close()

    if not gesture_intervals:
        print("SUCCESS: No suspicious gestures detected.")
        return

    print("WARNING: Suspicious gestures detected:")

    # Agrupar por gesto y unir intervalos cercanos
    grouped_gestures = {}
    for interval in gesture_intervals:
        duration = interval["end"] - interval["start"]
        if duration <= 0.2:  # descartar micro-movimientos
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

    def format_time(seconds):
        seconds = int(round(seconds))
        m = seconds // 60
        s = seconds % 60
        return f"{m}:{s:02d}"

    # Imprimir todos los gestos detectados
    for gesture, ranges in grouped_gestures.items():
        range_strs = [
            f"{format_time(start)} - {format_time(end)}" for start, end in ranges
        ]
        print(f"  {gesture}: [{', '.join(range_strs)}]")

    # === Lógica específica de "consulta externa" ===
    consulta_intervals = []
    for gesture, ranges in grouped_gestures.items():
        # típicamente consulta = mira hacia los lados o hacia abajo (apuntes, otro dispositivo, etc.)
        if gesture in ("Looking Left", "Looking Right", "Looking Down"):
            for start, end in ranges:
                duration = end - start
                if duration >= consulta_min_duration:
                    consulta_intervals.append(
                        {
                            "gesture": gesture,
                            "start": start,
                            "end": end,
                            "duration": duration,
                        }
                    )

    if consulta_intervals:
        print("\nPOSSIBLE EXTERNAL CONSULTATION GESTURES:")
        for ci in consulta_intervals:
            print(
                f"  {ci['gesture']} from {format_time(ci['start'])} "
                f"to {format_time(ci['end'])} "
                f"(~{ci['duration']:.1f}s)"
            )
    else:
        print(
            "\nNo long-duration consultation-like gestures detected "
            f"(>{consulta_min_duration:.1f}s)."
        )
