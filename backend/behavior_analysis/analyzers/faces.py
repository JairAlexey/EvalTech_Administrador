import cv2
import mediapipe as mp
import math


def format_time(seconds: float) -> str:
    """Convierte segundos a formato M:SS (ej. 0:02, 1:15)."""
    total_seconds = int(seconds)
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{m}:{s:02d}"


def run_multiple_faces_test(
    video_path,
    min_face_duration=1.0,  # duración mínima (segundos) para considerar un rostro válido
    max_missed_frames=30,  # frames que se puede “perder” un rostro antes de perder su ID (aprox 1s)
    distance_threshold=150.0,  # umbral de distancia (px) para asociar detecciones al mismo ID
    merge_time_threshold=2.0,  # tiempo máximo (s) para unir tracks fragmentados
    merge_distance_threshold=150.0,  # distancia máxima (px) para unir tracks fragmentados
):
    """
    Detecta la presencia de múltiples rostros en el video.
    Reconoce automáticamente la aparición de otras personas y reporta
    los intervalos de tiempo en los que apareció cada rostro identificado.
    Intenta unir fragmentos de un mismo rostro si la detección falla brevemente.
    """
    print(f"Testing Multiple Faces Detection on {video_path}...")

    mp_face_detection = mp.solutions.face_detection
    face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    frame_count = 0

    # Tracking de rostros
    next_face_id = 0
    # tracks: id -> {"last_center": (x, y), "last_frame": int, "start_frame": int, "start_center": (x, y)}
    tracks = {}

    # Historial de rostros detectados: lista de dicts con info del rostro
    faces_history = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_detection.process(image_rgb)

        current_detections = []

        if results.detections:
            h, w, _ = image.shape
            for det in results.detections:
                bbox = det.location_data.relative_bounding_box
                x_min = bbox.xmin * w
                y_min = bbox.ymin * h
                bw = bbox.width * w
                bh = bbox.height * h
                cx = x_min + bw / 2.0
                cy = y_min + bh / 2.0
                current_detections.append((cx, cy))

        # Asociación de detecciones a tracks existentes
        # Creamos lista de posibles matches (track_id, detection_index, distance)
        matches = []
        for t_id, track in tracks.items():
            # Si el track está muy viejo, lo ignoramos aquí (se limpiará después)
            if frame_count - track["last_frame"] > max_missed_frames:
                continue

            px, py = track["last_center"]
            for i, (cx, cy) in enumerate(current_detections):
                dist = math.hypot(cx - px, cy - py)
                if dist < distance_threshold:
                    matches.append((t_id, i, dist))

        # Ordenar matches por distancia (greedy assignment)
        matches.sort(key=lambda x: x[2])

        assigned_tracks = set()
        assigned_detections = set()

        for t_id, det_idx, dist in matches:
            if t_id in assigned_tracks or det_idx in assigned_detections:
                continue

            # Actualizar track
            tracks[t_id]["last_center"] = current_detections[det_idx]
            tracks[t_id]["last_frame"] = frame_count

            assigned_tracks.add(t_id)
            assigned_detections.add(det_idx)

        # Crear nuevos tracks para detecciones no asignadas
        for i, (cx, cy) in enumerate(current_detections):
            if i not in assigned_detections:
                tracks[next_face_id] = {
                    "last_center": (cx, cy),
                    "last_frame": frame_count,
                    "start_frame": frame_count,
                    "start_center": (cx, cy),
                }
                next_face_id += 1

        # Limpieza de tracks perdidos y guardado en historial
        active_tracks = {}
        for t_id, track in tracks.items():
            if frame_count - track["last_frame"] > max_missed_frames:
                # El rostro se perdió, lo guardamos en el historial
                start_time = track["start_frame"] / fps
                end_time = track["last_frame"] / fps
                duration = end_time - start_time

                if duration >= min_face_duration:
                    faces_history.append(
                        {
                            "id": t_id,
                            "start": start_time,
                            "end": end_time,
                            "duration": duration,
                            "start_center": track["start_center"],
                            "end_center": track["last_center"],
                        }
                    )
            else:
                active_tracks[t_id] = track
        tracks = active_tracks

        frame_count += 1

    # Procesar tracks que quedaron activos al final del video
    for t_id, track in tracks.items():
        start_time = track["start_frame"] / fps
        end_time = track["last_frame"] / fps
        duration = end_time - start_time
        if duration >= min_face_duration:
            faces_history.append(
                {
                    "id": t_id,
                    "start": start_time,
                    "end": end_time,
                    "duration": duration,
                    "start_center": track["start_center"],
                    "end_center": track["last_center"],
                }
            )

    cap.release()

    # Ordenar historial por tiempo de aparición
    faces_history.sort(key=lambda x: x["start"])

    # --- Post-procesamiento: Unir tracks fragmentados ---
    merged_history = []
    # Usamos una lista para ir construyendo los tracks consolidados

    for face in faces_history:
        # Intentar unir 'face' con algún track existente en 'merged_history'
        best_match_idx = -1
        best_dist = float("inf")

        for i, candidate in enumerate(merged_history):
            # Calcular gap temporal: inicio del nuevo - fin del anterior
            gap = face["start"] - candidate["end"]

            # Solo consideramos unir si el gap es positivo (no solapamiento significativo)
            # y menor al umbral. Permitimos un pequeño solapamiento negativo (-0.5s) por si acaso.
            if -0.5 <= gap <= merge_time_threshold:
                # Calcular distancia espacial entre donde terminó el candidato y donde empieza el nuevo
                px, py = candidate["end_center"]
                cx, cy = face["start_center"]
                dist = math.hypot(cx - px, cy - py)

                if dist < merge_distance_threshold and dist < best_dist:
                    best_dist = dist
                    best_match_idx = i

        if best_match_idx != -1:
            # Unir al candidato encontrado
            candidate = merged_history[best_match_idx]
            # Extendemos el tiempo final
            if face["end"] > candidate["end"]:
                candidate["end"] = face["end"]
                candidate["end_center"] = face["end_center"]
                candidate["duration"] = candidate["end"] - candidate["start"]
            # Nota: No cambiamos el ID, mantenemos el del candidato original
        else:
            # No se pudo unir, agregar como nuevo track
            merged_history.append(face)

    faces_history = merged_history

    # Generar reporte
    if len(faces_history) > 0:
        # Si hay más de 1 rostro en total, o si hay solapamientos, es relevante.
        # El usuario pide mostrar "en que segundos aparecieron".

        # Verificamos si hubo "múltiples rostros" (más de 1 ID único válido)
        unique_ids = set(f["id"] for f in faces_history)

        if len(unique_ids) > 1:
            print(f"WARNING: Multiple faces detected ({len(unique_ids)} unique faces):")
            for face in faces_history:
                print(
                    f"  Face ID {face['id']} appeared from {format_time(face['start'])} "
                    f"to {format_time(face['end'])} (~{face['duration']:.1f}s)"
                )
        else:
            # Solo 1 rostro detectado en toda la sesión
            print("SUCCESS: Only one face detected throughout the session.")
    else:
        print("WARNING: No faces detected.")


def run_absence_test(video_path, min_absence_duration=1.0):
    """
    Detecta intervalos de ausencia del candidato (ningún rostro en pantalla)
    y los reporta en formato:

      Absence from 0:02 to 0:09 (~6.3s)
    """
    print(f"Testing Candidate Absence on {video_path}...")

    mp_face_detection = mp.solutions.face_detection
    face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.5)

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    frame_count = 0
    absence_start_frame = None
    absence_intervals = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_detection.process(image_rgb)

        present = bool(results.detections)

        if present:
            if absence_start_frame is not None:
                end_frame = frame_count
                duration = (end_frame - absence_start_frame) / fps
                if duration >= min_absence_duration:
                    absence_intervals.append((absence_start_frame, end_frame, duration))
                absence_start_frame = None
        else:
            if absence_start_frame is None:
                absence_start_frame = frame_count

        frame_count += 1

    # Ausencia al final del video
    if absence_start_frame is not None:
        end_frame = frame_count
        duration = (end_frame - absence_start_frame) / fps
        if duration >= min_absence_duration:
            absence_intervals.append((absence_start_frame, end_frame, duration))

    cap.release()

    if absence_intervals:
        print("WARNING: Candidate absence detected:")
        for start_frame, end_frame, duration in absence_intervals:
            start_time = start_frame / fps
            end_time = end_frame / fps
            print(
                f"  Absence from {format_time(start_time)} "
                f"to {format_time(end_time)} (~{duration:.1f}s)"
            )
    else:
        print("SUCCESS: Candidate was present throughout.")
