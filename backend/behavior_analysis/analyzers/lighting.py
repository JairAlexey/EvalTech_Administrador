import cv2
import numpy as np

# ==== CONSTANTES DE CONFIGURACIÓN ====
GLOBAL_DIFF_THRESH = 15.0  # Umbral de cambio brusco del brillo medio
BRIGHT_PIXEL_VALUE = 220  # Píxel considerado "muy brillante"
BRIGHT_RATIO_DIFF_THRESH = 0.03  # Aumento mínimo en proporción de píxeles brillantes
NEW_HIGHLIGHT_RATIO_THRESH = (
    0.002  # Proporción mínima de nuevos píxeles brillantes (~0.2%)
)

SUSPICIOUS_MIN_DURATION = 3.0  # Duración mínima (segundos) para considerarlo sospechoso
MERGE_GAP_SECONDS = 0.5  # Une intervalos separados por menos de este gap


def _format_time(seconds: float) -> str:
    """Convierte segundos en formato m:ss (ej. 0:42, 19:03)."""
    if seconds < 0:
        seconds = 0.0
    total_seconds = int(seconds)  # truncar en vez de redondear
    minutes = total_seconds // 60
    secs = total_seconds % 60
    return f"{minutes}:{secs:02d}"


def _merge_intervals(intervals, gap=MERGE_GAP_SECONDS):
    """
    Fusiona intervalos [start, end] que estén solapados o separados por menos de `gap` segundos.
    """
    if not intervals:
        return []

    # Ordenar por inicio
    intervals = sorted(intervals, key=lambda x: x[0])
    merged = [list(intervals[0])]  # usamos listas para poder modificar

    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]
        # Si el nuevo intervalo empieza antes o justo después de last_end + gap,
        # los consideramos parte del mismo evento.
        if start <= last_end + gap:
            merged[-1][1] = max(last_end, end)
        else:
            merged.append([start, end])

    # Convertir de vuelta a tuplas
    return [(s, e) for s, e in merged]


def run_lighting_test(video_path):
    """
    Detecta cambios bruscos de iluminación en un video, incluyendo:
    - Cambios globales de brillo (subida/bajada general de luz).
    - Aparición repentina de zonas muy brillantes (p.ej. reflejos de dispositivos móviles).

    Agrupa anomalías en intervalos continuos por tipo y solo reporta como
    "POSSIBLE EXTERNAL CONSULTATION LIGHTING EVENTS" aquellas de duración
    >= SUSPICIOUS_MIN_DURATION segundos.
    """
    print(f"Testing Lighting Change Detection on {video_path}...")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    prev_gray = None
    prev_mean_brightness = None
    prev_bright_ratio = None

    frame_idx = 0

    # Tipos de anomalía
    LABEL_GLOBAL = "Global Lighting Change"
    LABEL_LOCAL = "Local Highlight (Possible Device Reflection)"
    labels = [LABEL_GLOBAL, LABEL_LOCAL]

    # Intervalos detectados por tipo: { label: [(start_time, end_time), ...] }
    anomaly_intervals = {label: [] for label in labels}
    # Inicio actual de cada intervalo (o None si no hay uno abierto)
    current_start = {label: None for label in labels}

    while True:
        success, frame = cap.read()
        if not success:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Brillo medio global del frame
        mean_brightness = float(np.mean(gray))

        # Máscara de píxeles muy brillantes (posibles reflejos de pantallas)
        bright_mask = gray >= BRIGHT_PIXEL_VALUE
        bright_ratio = float(np.mean(bright_mask))  # [0, 1]

        if prev_gray is not None:
            current_time = frame_idx / fps

            # Nuevos píxeles muy brillantes que antes no lo eran
            new_highlights_mask = np.logical_and(
                bright_mask, prev_gray < BRIGHT_PIXEL_VALUE
            )
            new_highlights_ratio = float(np.mean(new_highlights_mask))

            # Cambio de brillo global
            global_diff = (
                abs(mean_brightness - prev_mean_brightness)
                if prev_mean_brightness is not None
                else 0.0
            )

            # Cambio en proporción de píxeles brillantes
            bright_ratio_diff = (
                bright_ratio - prev_bright_ratio
                if prev_bright_ratio is not None
                else 0.0
            )

            # Flags de anomalía
            is_global_anomaly = global_diff > GLOBAL_DIFF_THRESH
            is_local_anomaly = (
                bright_ratio_diff > BRIGHT_RATIO_DIFF_THRESH
                or new_highlights_ratio > NEW_HIGHLIGHT_RATIO_THRESH
            )

            # Actualizar intervalos por tipo
            for label, is_active in (
                (LABEL_GLOBAL, is_global_anomaly),
                (LABEL_LOCAL, is_local_anomaly),
            ):
                if is_active:
                    # Inicio de un nuevo intervalo
                    if current_start[label] is None:
                        current_start[label] = current_time
                else:
                    # Cierre de intervalo si estaba abierto
                    if current_start[label] is not None:
                        end_time = current_time
                        anomaly_intervals[label].append(
                            (current_start[label], end_time)
                        )
                        current_start[label] = None

        # Actualizar referencias para el siguiente frame
        prev_gray = gray
        prev_mean_brightness = mean_brightness
        prev_bright_ratio = bright_ratio
        frame_idx += 1

    # Cerrar intervalos que sigan abiertos al final del video
    final_time = frame_idx / fps
    for label in labels:
        if current_start[label] is not None:
            anomaly_intervals[label].append((current_start[label], final_time))
            current_start[label] = None

    cap.release()

    # === Fusionar intervalos cercanos por tipo ===
    for label in labels:
        anomaly_intervals[label] = _merge_intervals(
            anomaly_intervals[label],
            gap=MERGE_GAP_SECONDS,
        )

    # ¿Hubo alguna anomalía?
    has_any_anomaly = any(anomaly_intervals[label] for label in labels)
    if not has_any_anomaly:
        print("SUCCESS: Lighting appears stable.")
        return

    # ==== BLOQUE 1: Listado general de anomalías por tipo ====
    print("WARNING: Lighting anomalies detected:")
    for label in labels:
        intervals = anomaly_intervals[label]
        if not intervals:
            continue

        # Formato: [0:03 - 0:04, 7:02 - 7:03, ...]
        parts = []
        for start, end in intervals:
            parts.append(f"{_format_time(start)} - {_format_time(end)}")
        joined = ", ".join(parts)
        print(f"  {label}: [{joined}]")

    # ==== BLOQUE 2: Actividades sospechosas (>= SUSPICIOUS_MIN_DURATION) ====
    suspicious_lines = []

    for label in labels:
        for start, end in anomaly_intervals[label]:
            duration = end - start
            if duration >= SUSPICIOUS_MIN_DURATION:
                suspicious_lines.append(
                    f"  {label} from {_format_time(start)} to {_format_time(end)} (~{duration:.1f}s)"
                )

    if suspicious_lines:
        print("\nPOSSIBLE LIGHTING EVENTS:")
        for line in suspicious_lines:
            print(line)
