import os
import time
import numpy as np
import librosa
from moviepy import VideoFileClip
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import warnings

warnings.filterwarnings("ignore")


def format_seconds(seconds):
    """Convierte segundos a formato m:ss"""
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02d}"


def merge_intervals(times, gap_threshold=1.0):
    """
    Agrupa marcas de tiempo individuales en rangos de inicio-fin.
    Si la diferencia entre dos tiempos es menor a gap_threshold, se consideran el mismo bloque.
    """
    if not times:
        return []

    ranges = []
    start = times[0]
    prev = times[0]

    for t in times[1:]:
        if t - prev > gap_threshold:
            ranges.append(
                (start, prev + 0.5)
            )  # +0.5 para compensar la duración del segmento
            start = t
        prev = t
    ranges.append((start, prev + 0.5))
    return ranges


def run_voice_test(video_path):
    print(f"--> [PROCESANDO] Extracción y análisis de: {video_path}")
    temp_audio = "temp_analysis_audio.wav"

    try:
        # 1. Extracción de Audio
        clip = VideoFileClip(video_path)
        clip.audio.write_audiofile(
            temp_audio, logger=None, fps=16000, nbytes=2, codec="pcm_s16le"
        )
        clip.close()

        # 2. Carga y Preprocesamiento
        y, sr = librosa.load(temp_audio, sr=16000)

        # Limpieza archivo temporal
        if os.path.exists(temp_audio):
            os.remove(temp_audio)

        segment_duration = 0.5
        samples_per_segment = int(segment_duration * sr)
        total_segments = int(len(y) / samples_per_segment)

        # Estructuras de datos
        features_list = []
        valid_indices = []  # Para saber a qué segundo corresponde cada feature
        whisper_timestamps = []

        # Recorremos el audio
        for i in range(total_segments):
            start = i * samples_per_segment
            end = start + samples_per_segment
            segment = y[start:end]

            # RMS (Energía)
            rms = np.sqrt(np.mean(segment**2))

            # Filtro de silencio (HARD)
            if rms < 0.005:
                continue

            # --- DETECCIÓN SUSURROS ---
            zcr = np.mean(librosa.feature.zero_crossing_rate(segment))
            spectral_flatness = np.mean(librosa.feature.spectral_flatness(y=segment))

            # Lógica Susurro: ZCR alto, Flatness alto, Energía baja/media
            if zcr > 0.045 and spectral_flatness > 0.04 and 0.005 < rms < 0.08:
                whisper_timestamps.append(i * segment_duration)

            # --- CARACTERÍSTICAS PARA VOCES (Speaker Diarization) ---
            # MFCCs capturan el timbre de la voz
            mfcc = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=20)

            # Usamos media y desviación estándar para caracterizar el segmento
            # Esto crea un vector de 40 dimensiones por segmento
            feat_vector = np.hstack((np.mean(mfcc, axis=1), np.std(mfcc, axis=1)))

            features_list.append(feat_vector)
            valid_indices.append(i * segment_duration)

        # ==============================================================================
        # 3. Lógica de Clasificación de Voces (Auto-Detección de K)
        # ==============================================================================

        speaker_intervals = {}  # Diccionario para guardar resultados
        best_n_speakers = 1

        if len(features_list) > 10:  # Necesitamos datos mínimos para clustering
            X = np.array(features_list)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            best_score = -1
            best_labels = []

            # Probamos separar en 2 y 3 hablantes (asumimos max 3 para seguridad básica)
            # Si el score es muy bajo en ambos, asumimos 1 solo hablante.
            possible_clusters = [2, 3]

            scores = {}

            for k in possible_clusters:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                lbls = kmeans.fit_predict(X_scaled)
                score = silhouette_score(X_scaled, lbls)
                scores[k] = score

                if score > best_score:
                    best_score = score
                    best_n_speakers = k
                    best_labels = lbls

            # UMBRAL DE DECISIÓN:
            # Si el mejor score es < 0.13, los grupos están muy mezclados -> Es una sola persona
            if best_score < 0.13:
                best_n_speakers = 1
                # Asignamos todo a la voz 0
                speaker_intervals[0] = valid_indices
            else:
                # Organizamos los tiempos por etiqueta de cluster
                for idx, label in enumerate(best_labels):
                    time_point = valid_indices[idx]
                    if label not in speaker_intervals:
                        speaker_intervals[label] = []
                    speaker_intervals[label].append(time_point)

        else:
            # Muy poco audio para clasificar
            if valid_indices:
                speaker_intervals[0] = valid_indices

        # ==============================================================================
        # 4. Generación de Reporte Estructurado
        # ==============================================================================
        print("\n" + "=" * 60)
        print(" RESULTADO DEL ANÁLISIS DE AUDIO")
        print("=" * 60)

        # A. SUSURROS
        if whisper_timestamps:
            print(f"[!] ALERTA: Se detectaron susurros o siseos.")
            w_ranges = merge_intervals(whisper_timestamps)
            for start, end in w_ranges:
                print(
                    f"    -> Intervalo: {format_seconds(start)} - {format_seconds(end)}"
                )
        else:
            print("[OK] No se detectaron susurros sospechosos.")

        print("-" * 60)

        # B. HABLANTES IDENTIFICADOS
        print(
            f"ANÁLISIS DE FUENTES DE VOZ: Se detectaron {best_n_speakers} perfil(es) distinto(s)."
        )
        if best_n_speakers > 1:
            print(
                f"(Confianza de separación: {best_score:.2f} - Mientras más alto, más distintas son las voces)"
            )

        # Ordenamos las voces por orden de aparición (para que Voz 1 sea la primera que habla)
        # Esto es puramente estético pero ayuda a la lectura
        sorted_speakers = sorted(
            speaker_intervals.items(), key=lambda item: item[1][0] if item[1] else 0
        )

        for idx, (label_original, times) in enumerate(sorted_speakers):
            voice_name = f"Voz {idx + 1}"
            ranges = merge_intervals(
                times, gap_threshold=1.5
            )  # Gap un poco más amplio para unir frases

            print(f"\n> {voice_name}:")
            for start, end in ranges:
                # Filtramos ruidos muy cortos (< 1 seg) para limpiar el reporte
                if (end - start) >= 1.0:
                    print(f"   [{format_seconds(start)} - {format_seconds(end)}]")
                else:
                    # Opcional: mostrar intervenciones muy cortas marcadas
                    print(
                        f"   [{format_seconds(start)} - {format_seconds(end)}] (Intervención corta/Ruido)"
                    )

        print("=" * 60)

        return {
            "num_speakers": best_n_speakers,
            "whispers": len(whisper_timestamps) > 0,
        }

    except Exception as e:
        print(f"Error crítico: {e}")
        if os.path.exists(temp_audio):
            os.remove(temp_audio)
        return None
