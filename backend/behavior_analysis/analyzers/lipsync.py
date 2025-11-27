import cv2
import mediapipe as mp
import numpy as np
from moviepy import VideoFileClip
from scipy import signal
from itertools import groupby

# --- Funciones Auxiliares ---


def calculate_mar_fast(landmarks, indices):
    p13 = landmarks[indices[0]]
    p14 = landmarks[indices[1]]
    p61 = landmarks[indices[2]]
    p291 = landmarks[indices[3]]
    A = np.sqrt((p13.x - p14.x) ** 2 + (p13.y - p14.y) ** 2)
    C = np.sqrt((p61.x - p291.x) ** 2 + (p61.y - p291.y) ** 2)
    if C < 1e-6:
        return 0
    return A / C


def get_audio_energy_per_frame(audio_array, sample_rate, total_frames, fps):
    samples_per_frame = int(sample_rate / fps)
    energies = np.zeros(total_frames)
    max_samples = len(audio_array)

    # Vectorización simple para velocidad
    # Si el video es muy largo, lo hacemos iterativo para no explotar memoria,
    # pero para 5 min esto es seguro.
    for i in range(total_frames):
        start = i * samples_per_frame
        end = start + samples_per_frame

        if start >= max_samples:
            break
        if end > max_samples:
            end = max_samples

        chunk = audio_array[start:end]
        if len(chunk) > 0:
            energies[i] = np.sqrt(np.mean(chunk**2))

    max_e = np.max(energies)
    if max_e > 1e-5:
        energies /= max_e
    return energies


def smooth_signal(signal_data, window_size):
    if len(signal_data) < window_size:
        return signal_data
    window = np.ones(window_size) / window_size
    return np.convolve(signal_data, window, mode="same")


def calculate_global_synchrony(audio_sig, visual_sig, fps):
    if len(audio_sig) == 0 or len(visual_sig) == 0:
        return 0.0, 0.0

    a_centered = audio_sig - np.mean(audio_sig)
    v_centered = visual_sig - np.mean(visual_sig)

    if np.std(a_centered) > 0:
        a_centered /= np.std(a_centered)
    if np.std(v_centered) > 0:
        v_centered /= np.std(v_centered)

    correlation = signal.correlate(a_centered, v_centered, mode="full")
    lags = signal.correlation_lags(len(a_centered), len(v_centered), mode="full")

    best_idx = np.argmax(correlation)
    max_corr = correlation[best_idx] / len(a_centered)
    best_lag_frames = lags[best_idx]
    best_lag_seconds = best_lag_frames / fps

    return best_lag_seconds, max_corr


def detect_anomaly_intervals(audio_sig, visual_sig, fps, min_duration=0.5):
    window_size = int(fps * 0.5)
    audio_smooth = smooth_signal(audio_sig, window_size)
    visual_smooth = smooth_signal(visual_sig, window_size)

    anomalies = []

    AUDIO_ON_THRESH = 0.15
    AUDIO_OFF_THRESH = 0.05
    MOUTH_OPEN_THRESH = 0.20
    MOUTH_CLOSED_THRESH = 0.05

    for i in range(len(audio_smooth)):
        cond1 = (
            audio_smooth[i] > AUDIO_ON_THRESH and visual_smooth[i] < MOUTH_CLOSED_THRESH
        )
        cond2 = (
            visual_smooth[i] > MOUTH_OPEN_THRESH and audio_smooth[i] < AUDIO_OFF_THRESH
        )

        if cond1:
            anomalies.append((i, "Audio sin Boca"))
        elif cond2:
            anomalies.append((i, "Boca sin Audio"))

    intervals = []
    for k, g in groupby(enumerate(anomalies), lambda x: x[0] - x[1][0]):
        group = list(map(lambda x: x[1], g))
        start_frame = group[0][0]
        end_frame = group[-1][0]
        error_type = group[0][1]

        duration = (end_frame - start_frame) / fps

        if duration >= min_duration:
            start_time = start_frame / fps
            end_time = end_frame / fps
            intervals.append(
                {
                    "start": round(start_time, 2),
                    "end": round(end_time, 2),
                    "type": error_type,
                    "duration": round(duration, 2),
                }
            )

    return intervals


# --- Función Principal ---


def run_lipsync_test(video_path):
    print(f"--- Iniciando Verificación de Coherencia Sistemática: {video_path} ---")

    # 1. Extracción de Audio (Solo carga, no procesa frames aun)
    try:
        clip = VideoFileClip(video_path)
        if clip.audio is None:
            print("ERROR: El video no tiene pista de audio.")
            clip.close()
            return
        audio_array = clip.audio.to_soundarray(fps=44100)
        if audio_array.ndim == 2:
            audio_array = audio_array.mean(axis=1)
        # Importante: No cerrar clip aquí si usamos duration, pero mejor cerramos para liberar memoria
        clip.close()
    except Exception as e:
        print(f"Error procesando audio: {e}")
        return

    # 2. Extracción de Video y Landmarks
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("ERROR: No se pudo abrir el archivo de video.")
        return

    # Obtener FPS de forma segura
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0 or np.isnan(fps):
        fps = 30  # Fallback estándar
        print("⚠️ Advertencia: No se detectaron FPS en metadatos, asumiendo 30 FPS.")

    # NO confiamos en CAP_PROP_FRAME_COUNT para WebM

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    visual_envelope = []
    mar_indices = [13, 14, 61, 291]
    TARGET_WIDTH = 480

    print("Procesando frames de video... (esto puede tardar)")
    frame_count = 0

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        frame_count += 1
        # Pequeño log de progreso cada 500 frames
        if frame_count % 500 == 0:
            print(f" -> Procesados {frame_count} frames...")

        h, w = image.shape[:2]
        if w > TARGET_WIDTH:
            scale = TARGET_WIDTH / w
            image = cv2.resize(image, (TARGET_WIDTH, int(h * scale)))

        results = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))

        mar = 0.0
        if results.multi_face_landmarks:
            mar = calculate_mar_fast(
                results.multi_face_landmarks[0].landmark, mar_indices
            )

        visual_envelope.append(mar)

    cap.release()
    print(f"Total frames reales procesados: {len(visual_envelope)}")

    # 3. Procesamiento de Audio AJUSTADO a los frames reales
    # Ahora que sabemos exactamente cuántos frames visuales hay, procesamos el audio para esa cantidad
    audio_energies = get_audio_energy_per_frame(
        audio_array, 44100, len(visual_envelope), fps
    )

    # --- Análisis Estadístico y Sincronía ---
    visual_sig = np.array(visual_envelope)
    audio_sig = (
        audio_energies  # Ya tienen la misma longitud forzada por lógica anterior
    )

    # Doble chequeo de longitudes por seguridad (si el audio era más corto que el video)
    min_len = min(len(visual_sig), len(audio_sig))
    visual_sig = visual_sig[:min_len]
    audio_sig = audio_sig[:min_len]

    # Normalización Visual Dinámica
    if np.max(visual_sig) > 0:
        max_val = np.percentile(visual_sig, 95)
        if max_val > 0:
            visual_sig = np.clip(visual_sig / max_val, 0, 1)

    # 1. Análisis de Coherencia Global (Lag/Desfase)
    lag_seconds, correlation_score = calculate_global_synchrony(
        audio_sig, visual_sig, fps
    )

    # 2. Detección de Intervalos Anómalos
    intervals = detect_anomaly_intervals(audio_sig, visual_sig, fps, min_duration=0.5)

    # --- Reporte de Resultados ---
    print(f"\n=== RESULTADOS DE COHERENCIA ===")

    # Umbrales de decisión
    IS_SYNCED = (
        abs(lag_seconds) < 0.2 and correlation_score > 0.15
    )  # Bajamos un poco exigencia correlación

    print(f"1. Sincronía Global:")
    print(f"   - Desfase Estimado (Lag): {lag_seconds:+.3f} segundos")
    print(f"   - Score de Correlación: {correlation_score:.3f} (Máx: 1.0)")

    if abs(lag_seconds) > 0.2:
        print(
            f"   ⚠️ ALERTA: Desfase significativo detectado. El audio va {'ADELANTADO' if lag_seconds < 0 else 'ATRASADO'}."
        )
    elif correlation_score < 0.15:
        print(
            f"   ⚠️ ALERTA: Baja correlación. El movimiento de labios no coincide con el ritmo del audio."
        )
    else:
        print(f"   ✅ Sincronía Global Aceptable.")

    print(f"\n2. Anomalías Específicas Detectadas: {len(intervals)}")
    if intervals:
        for err in intervals:
            print(
                f"   - [{err['start']}s - {err['end']}s] Tipo: {err['type']} (Duración: {err['duration']}s)"
            )
    else:
        print("   ✅ No se detectaron interrupciones en la coherencia.")

    # Veredicto Final Estricto
    # Permitimos hasta 3 segundos acumulados de error antes de fallar todo el test
    total_error_duration = sum([x["duration"] for x in intervals])

    if not IS_SYNCED or total_error_duration > 3.0:
        print(
            f"\n❌ VEREDICTO: PRUEBA FALLIDA. Duración total error: {total_error_duration:.2f}s"
        )
    else:
        print("\n✅ VEREDICTO: PRUEBA APROBADA. Sincronía consistente.")
