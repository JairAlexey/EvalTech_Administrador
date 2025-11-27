import cv2
import mediapipe as mp
import os
from urllib.request import urlretrieve
import time
from datetime import datetime

# --- CONFIGURACIÓN DE RENDIMIENTO ---
# Ajusta esto según tu prisa vs precisión.
# 640px es suficiente para ver caras claras. Si están muy lejos, sube a 800.
PROCESS_WIDTH = 640

# Procesar 1 de cada X frames.
# Si el video es de 30fps, STRIDE=5 significa que analizas 6 veces por segundo.
# Para videos de 1h de entrevistas/reuniones, puedes subirlo a 10 o 15 sin problemas.
FRAME_STRIDE = 5
# ------------------------------------


def format_time(seconds: float) -> str:
    """Convierte segundos a formato M:SS (ej. 0:02, 1:15)."""
    total_seconds = int(seconds)
    m = total_seconds // 60
    s = total_seconds % 60
    return f"{m}:{s:02d}"


def ensure_models_exist():
    """
    Descarga los modelos YuNet (Detección) y SFace (Reconocimiento) si no existen.
    Son modelos ligeros y oficiales de OpenCV Zoo.
    """
    models = {
        "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
    }

    base_path = "behavior_analysis/models"  # Carpeta donde se guardarán
    if not os.path.exists(base_path):
        os.makedirs(base_path)

    paths = {}
    for name, url in models.items():
        path = os.path.join(base_path, name)
        paths[name] = path
        if not os.path.exists(path):
            print(f"Descargando modelo {name}...")
            try:
                urlretrieve(url, path)
            except Exception as e:
                raise RuntimeError(
                    f"Error descargando {name}: {e}. Descárgalo manualmente."
                )

    return (
        paths["face_detection_yunet_2023mar.onnx"],
        paths["face_recognition_sface_2021dec.onnx"],
    )


def run_multiple_faces_test(video_path):
    """
    Detecta múltiples rostros, los identifica y reporta intervalos de tiempo.
    Usa OpenCV DNN (YuNet + SFace).
    """

    # --- INICIO MEDICIÓN TIEMPO DE EJECUCIÓN ---
    start_wall_time = time.time()

    # 1. Configuración de Modelos
    try:
        det_path, rec_path = ensure_models_exist()
    except RuntimeError as e:
        print(f"Error crítico: {e}")
        return

    # Inicializar Detector (YuNet)
    detector = cv2.FaceDetectorYN.create(
        det_path,
        "",
        (320, 320),  # Se ajustará dinámicamente con el frame
        0.9,  # Score threshold (filtrar falsos positivos)
        0.3,  # NMS threshold
        5000,  # Top K
    )

    # Inicializar Reconocedor (SFace)
    recognizer = cv2.FaceRecognizerSF.create(rec_path, "")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: No se pudo abrir el video {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Ajustar tamaño de entrada del detector al video
    detector.setInputSize((width, height))

    # Base de datos de personas encontradas en este video
    # Estructura: { person_id: { 'embedding': array, 'intervals': [[start, end], ...], 'last_seen': float } }
    known_people = {}
    next_person_id = 1

    # Umbral de coincidencia (Cosine Similarity). Para SFace, 0.363 es el estándar recomendado.
    # Lo subimos a 0.4 para ser más estrictos y evitar mezclar personas.
    MATCH_THRESHOLD = 0.4

    # Tiempo máximo (segundos) para considerar que es el mismo intervalo si se pierde detección
    MAX_GAP_TOLERANCE = 1.5

    frame_count = 0

    print("Procesando video para reconocimiento facial multi-persona...")

    last_video_time = 0.0  # Para guardar el último tiempo del video procesado

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_time = frame_count / fps
        last_video_time = current_time
        frame_count += 1

        # Detección
        # faces devuelve [x1, y1, w, h, ... landmarks ...]
        _, faces = detector.detect(frame)

        if faces is not None:
            for face in faces:
                # Alinear y extraer características (Embedding de 128 floats)
                aligned_face = recognizer.alignCrop(frame, face)
                face_feature = recognizer.feature(aligned_face)

                # Intentar hacer match con personas conocidas
                best_score = 0.0
                best_id = None

                for pid, data in known_people.items():
                    # Match devuelve cosine similarity
                    score = recognizer.match(
                        face_feature, data["embedding"], cv2.FaceRecognizerSF_FR_COSINE
                    )
                    if score > best_score:
                        best_score = score
                        best_id = pid

                if best_score > MATCH_THRESHOLD:
                    # ES LA MISMA PERSONA
                    person = known_people[best_id]
                    last_interval = person["intervals"][-1]

                    # Verificar si unimos al último intervalo o creamos uno nuevo
                    if current_time - person["last_seen"] <= MAX_GAP_TOLERANCE:
                        last_interval[1] = current_time  # Extender final
                    else:
                        person["intervals"].append(
                            [current_time, current_time]
                        )  # Nuevo intervalo

                    # Actualizamos el embedding (promedio móvil) para adaptarse a cambios de luz/ángulo
                    # Esto mejora el tracking si la persona gira la cabeza
                    person["embedding"] = (person["embedding"] + face_feature) / 2
                    person["last_seen"] = current_time

                else:
                    # NUEVA PERSONA DETECTADA
                    known_people[next_person_id] = {
                        "embedding": face_feature,
                        "intervals": [[current_time, current_time]],
                        "last_seen": current_time,
                    }
                    next_person_id += 1

    cap.release()

    # --- FIN MEDICIÓN TIEMPO DE EJECUCIÓN ---
    end_wall_time = time.time()
    elapsed_seconds = end_wall_time - start_wall_time

    # Hora exacta en la que terminó (del sistema)
    end_time_str = datetime.fromtimestamp(end_wall_time).strftime("%Y-%m-%d %H:%M:%S")

    # --- REPORTE FINAL ---
    print(f"\n{'='*40}")
    print(
        f"REPORTE DE IDENTIFICACIÓN ({next_person_id - 1} Personas únicas detectadas)"
    )
    print(f"{'='*40}")

    # Filtrar ruido: Personas que aparecieron menos de 0.5 segundos en total
    final_results = []
    for pid, data in known_people.items():
        total_duration = sum([end - start for start, end in data["intervals"]])
        if total_duration < 0.5:
            continue  # Ruido / Falso positivo
        final_results.append((pid, data["intervals"]))

    if not final_results:
        print("No se detectaron rostros consistentes.")
        return

    for pid, intervals in final_results:
        # Formatear intervalos
        time_strs = []
        for start, end in intervals:
            # Redondear y formatear
            time_strs.append(f"[{format_time(start)} - {format_time(end)}]")

        print(f"Persona {pid}: {', '.join(time_strs)}")

    print(f"{'-'*40}")
    print(f"Tiempo total de procesamiento: {elapsed_seconds:.2f} s")
    print(f"Reporte finalizado a las: {end_time_str}")
    print(f"Último tiempo de video procesado: {format_time(last_video_time)}")
    print(f"{'='*40}")


def run_fast_face_analysis(video_path):
    print(f"Iniciando procesamiento optimizado para: {video_path}")

    # --- INICIO DE MEDICIÓN DEL TIEMPO ---
    start_wall_time = time.time()
    last_video_time = 0.0

    det_path, rec_path = ensure_models_exist()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: No se abre el video.")
        return

    original_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Detector inicializado a 0,0, se ajustará en el bucle
    detector = cv2.FaceDetectorYN.create(det_path, "", (0, 0), 0.9, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(rec_path, "")

    known_people = {}  # { id: { embedding, intervals, last_seen } }
    next_person_id = 1

    MATCH_THRESHOLD = 0.4
    MAX_GAP_TOLERANCE = 2.0

    frame_idx = 0
    processed_count = 0

    print(
        f"Video: {total_frames} frames totales. Procesando 1 de cada {FRAME_STRIDE} frames."
    )
    print(f"Resolución de análisis reducida a ancho: {PROCESS_WIDTH}px")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # --- OPTIMIZACIÓN 1: Frame Skipping ---
        if frame_idx % FRAME_STRIDE != 0:
            frame_idx += 1
            continue

        current_time = frame_idx / original_fps
        last_video_time = current_time

        # --- OPTIMIZACIÓN 2: Resize ---
        h, w = frame.shape[:2]
        scale = PROCESS_WIDTH / w
        new_h = int(h * scale)

        small_frame = cv2.resize(frame, (PROCESS_WIDTH, new_h))
        detector.setInputSize((PROCESS_WIDTH, new_h))

        # Detección
        _, faces = detector.detect(small_frame)

        if faces is not None:
            for face in faces:
                aligned_face = recognizer.alignCrop(small_frame, face)
                if aligned_face is None:
                    continue

                face_feature = recognizer.feature(aligned_face)

                best_score = 0.0
                best_id = None

                for pid, data in known_people.items():
                    score = recognizer.match(
                        face_feature, data["embedding"], cv2.FaceRecognizerSF_FR_COSINE
                    )
                    if score > best_score:
                        best_score = score
                        best_id = pid

                if best_score > MATCH_THRESHOLD:
                    # Actualizar persona existente
                    person = known_people[best_id]
                    last_interval = person["intervals"][-1]

                    if current_time - person["last_seen"] <= MAX_GAP_TOLERANCE:
                        last_interval[1] = current_time
                    else:
                        person["intervals"].append([current_time, current_time])

                    person["embedding"] = (person["embedding"] + face_feature) / 2
                    person["last_seen"] = current_time
                else:
                    # Nueva persona
                    known_people[next_person_id] = {
                        "embedding": face_feature,
                        "intervals": [[current_time, current_time]],
                        "last_seen": current_time,
                    }
                    next_person_id += 1

        frame_idx += 1
        processed_count += 1

        if processed_count % 100 == 0:
            print(f"Progreso: {format_time(current_time)} analizado...", end="\r")

    cap.release()

    # --- FIN DE MEDICIÓN DEL TIEMPO ---
    end_wall_time = time.time()
    elapsed_seconds = end_wall_time - start_wall_time
    end_time_str = datetime.fromtimestamp(end_wall_time).strftime("%Y-%m-%d %H:%M:%S")

    print("\nProcesamiento finalizado.")

    # --- REPORTE CON RENUMERACIÓN ---
    print(f"\n{'='*40}")

    final_data = []
    for pid, data in known_people.items():
        total_time = sum([end - start for start, end in data["intervals"]])
        # Filtrar ruido: si apareció menos de 1 segundo en total, SE BORRA.
        if total_time < 1.0:
            continue
        final_data.append(
            data["intervals"]
        )  # Solo guardamos los intervalos, el ID viejo no importa

    print(f"RESULTADOS ({len(final_data)} detectados)")

    if not final_data:
        print("No se encontraron rostros consistentes.")
    else:
        # Usamos enumerate(start=1) para generar IDs limpios: 1, 2, 3...
        for idx, intervals in enumerate(final_data, start=1):
            times = [f"[{format_time(s)} - {format_time(e)}]" for s, e in intervals]
            print(f"Persona {idx}: {', '.join(times)}")

    print(f"{'-'*40}")
    print(f"Tiempo total de procesamiento: {elapsed_seconds:.2f} segundos")
    print(f"Reporte finalizado a las: {end_time_str}")
    print(f"Último tiempo del video procesado: {format_time(last_video_time)}")
    print(f"{'='*40}")


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
