import cv2
import numpy as np
from moviepy import VideoFileClip
from scipy import signal
from itertools import groupby


class AnalizadorLipsync:
    def __init__(self, video_path):
        self.video_path = video_path
        self.visual_envelope = []
        self.mar_indices = [13, 14, 61, 291]
        self.fps = 30  # Default, will be updated

        # Cargar audio al inicio (o podría ser al final, pero mejor tenerlo listo)
        self.audio_array = None
        try:
            clip = VideoFileClip(video_path)
            if clip.audio is not None:
                self.audio_array = clip.audio.to_soundarray(fps=44100)
                if self.audio_array.ndim == 2:
                    self.audio_array = self.audio_array.mean(axis=1)
            clip.close()
        except Exception as e:
            print(f"Error cargando audio para lipsync: {e}")

    def set_fps(self, fps):
        self.fps = fps

    def procesar_frame(self, landmarks, timestamp):
        mar = 0.0
        if landmarks:
            # calculate_mar_fast logic inline or helper
            p13 = landmarks.landmark[13]
            p14 = landmarks.landmark[14]
            p61 = landmarks.landmark[61]
            p291 = landmarks.landmark[291]
            A = np.sqrt((p13.x - p14.x) ** 2 + (p13.y - p14.y) ** 2)
            C = np.sqrt((p61.x - p291.x) ** 2 + (p61.y - p291.y) ** 2)
            if C >= 1e-6:
                mar = A / C
        self.visual_envelope.append(mar)

    def obtener_resultados(self):
        if self.audio_array is None or not self.visual_envelope:
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        # Procesar audio ajustado a frames
        total_frames = len(self.visual_envelope)
        audio_energies = self._get_audio_energy_per_frame(
            self.audio_array, 44100, total_frames, self.fps
        )

        visual_sig = np.array(self.visual_envelope)
        audio_sig = audio_energies

        min_len = min(len(visual_sig), len(audio_sig))
        visual_sig = visual_sig[:min_len]
        audio_sig = audio_sig[:min_len]

        if np.max(visual_sig) > 0:
            max_val = np.percentile(visual_sig, 95)
            if max_val > 0:
                visual_sig = np.clip(visual_sig / max_val, 0, 1)

        lag_seconds, correlation_score = self._calculate_global_synchrony(
            audio_sig, visual_sig, self.fps
        )
        intervals = self._detect_anomaly_intervals(audio_sig, visual_sig, self.fps)

        return {"score": correlation_score, "lag": lag_seconds, "anomalias": intervals}

    def _get_audio_energy_per_frame(self, audio_array, sample_rate, total_frames, fps):
        samples_per_frame = int(sample_rate / fps)
        energies = np.zeros(total_frames)
        max_samples = len(audio_array)
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

    def _calculate_global_synchrony(self, audio_sig, visual_sig, fps):
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

    def _smooth_signal(self, signal_data, window_size):
        if len(signal_data) < window_size:
            return signal_data
        window = np.ones(window_size) / window_size
        return np.convolve(signal_data, window, mode="same")

    def _detect_anomaly_intervals(self, audio_sig, visual_sig, fps, min_duration=0.5):
        window_size = int(fps * 0.5)
        audio_smooth = self._smooth_signal(audio_sig, window_size)
        visual_smooth = self._smooth_signal(visual_sig, window_size)

        anomalies = []
        AUDIO_ON_THRESH = 0.15
        AUDIO_OFF_THRESH = 0.05
        MOUTH_OPEN_THRESH = 0.20
        MOUTH_CLOSED_THRESH = 0.05

        for i in range(len(audio_smooth)):
            cond1 = (
                audio_smooth[i] > AUDIO_ON_THRESH
                and visual_smooth[i] < MOUTH_CLOSED_THRESH
            )
            cond2 = (
                visual_smooth[i] > MOUTH_OPEN_THRESH
                and audio_smooth[i] < AUDIO_OFF_THRESH
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
                intervals.append(
                    {
                        "tiempo_inicio": start_frame / fps,
                        "tiempo_fin": end_frame / fps,
                        "tipo_anomalia": error_type,
                    }
                )
        return intervals
