import os
import numpy as np
import librosa
from moviepy import VideoFileClip
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import warnings

warnings.filterwarnings("ignore")


class AnalizadorVoz:
    def __init__(self, video_path):
        self.video_path = video_path
        self.temp_audio = f"temp_analysis_audio_{os.getpid()}.wav"

    def procesar(self):
        try:
            # 1. Extracción de Audio
            clip = VideoFileClip(self.video_path)
            clip.audio.write_audiofile(
                self.temp_audio, logger=None, fps=16000, nbytes=2, codec="pcm_s16le"
            )
            clip.close()

            # 2. Carga y Preprocesamiento
            y, sr = librosa.load(self.temp_audio, sr=16000)

            # Limpieza archivo temporal
            if os.path.exists(self.temp_audio):
                os.remove(self.temp_audio)

            segment_duration = 0.5
            samples_per_segment = int(segment_duration * sr)
            total_segments = int(len(y) / samples_per_segment)

            features_list = []
            valid_indices = []
            whisper_timestamps = []

            for i in range(total_segments):
                start = i * samples_per_segment
                end = start + samples_per_segment
                segment = y[start:end]

                rms = np.sqrt(np.mean(segment**2))
                if rms < 0.005:
                    continue

                zcr = np.mean(librosa.feature.zero_crossing_rate(segment))
                spectral_flatness = np.mean(
                    librosa.feature.spectral_flatness(y=segment)
                )

                if zcr > 0.045 and spectral_flatness > 0.04 and 0.005 < rms < 0.08:
                    whisper_timestamps.append(i * segment_duration)

                mfcc = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=20)
                feat_vector = np.hstack((np.mean(mfcc, axis=1), np.std(mfcc, axis=1)))
                features_list.append(feat_vector)
                valid_indices.append(i * segment_duration)

            speaker_intervals = {}
            best_n_speakers = 1

            if len(features_list) > 10:
                X = np.array(features_list)
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)

                best_score = -1
                best_labels = []
                possible_clusters = [2, 3]

                for k in possible_clusters:
                    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                    lbls = kmeans.fit_predict(X_scaled)
                    score = silhouette_score(X_scaled, lbls)
                    if score > best_score:
                        best_score = score
                        best_n_speakers = k
                        best_labels = lbls

                if best_score < 0.13:
                    best_n_speakers = 1
                    speaker_intervals[0] = valid_indices
                else:
                    for idx, label in enumerate(best_labels):
                        time_point = valid_indices[idx]
                        if label not in speaker_intervals:
                            speaker_intervals[label] = []
                        speaker_intervals[label].append(time_point)
            else:
                if valid_indices:
                    speaker_intervals[0] = valid_indices

            # Estructurar resultados
            resultados = {
                "num_speakers": best_n_speakers,
                "susurros": self._merge_intervals(whisper_timestamps),
                "hablantes": [],
            }

            sorted_speakers = sorted(
                speaker_intervals.items(), key=lambda item: item[1][0] if item[1] else 0
            )
            for idx, (label_original, times) in enumerate(sorted_speakers):
                ranges = self._merge_intervals(times, gap_threshold=1.5)
                for start, end in ranges:
                    if (end - start) >= 1.0:
                        resultados["hablantes"].append(
                            {
                                "etiqueta": f"Voz {idx + 1}",
                                "tiempo_inicio": start,
                                "tiempo_fin": end,
                            }
                        )

            return resultados

        except Exception as e:
            print(f"Error crítico en voz: {e}")
            if os.path.exists(self.temp_audio):
                os.remove(self.temp_audio)
            return None

    def _merge_intervals(self, times, gap_threshold=1.0):
        if not times:
            return []
        ranges = []
        start = times[0]
        prev = times[0]
        for t in times[1:]:
            if t - prev > gap_threshold:
                ranges.append((start, prev + 0.5))
                start = t
            prev = t
        ranges.append((start, prev + 0.5))
        return ranges
