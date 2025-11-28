import numpy as np
from moviepy import VideoFileClip
from scipy import signal


class AnalizadorLipsync:

    AUDIO_WINDOW_SEC = 0.12
    AUDIO_HOP_RATIO = 0.5
    MIN_INTERVAL_SEC = 0.6
    VISUAL_SMOOTH_SEC = 0.18
    AUDIO_SMOOTH_SEC = 0.18
    MERGE_GAP_SEC = 0.8

    def __init__(self, video_path):
        self.video_path = video_path
        self.visual_envelope = []
        self.frame_timestamps = []
        self.fps = 30
        self.audio_array = None
        self.sample_rate = 44100

        try:
            clip = VideoFileClip(video_path)
            if clip.audio is not None:
                raw_audio = clip.audio.to_soundarray(fps=self.sample_rate)
                if raw_audio.ndim == 2:
                    raw_audio = raw_audio.mean(axis=1)

                sos = signal.butter(
                    4, [300, 3400], btype="band", fs=self.sample_rate, output="sos"
                )
                self.audio_array = np.asarray(
                    signal.sosfilt(sos, raw_audio), dtype=np.float32
                )
            else:
                self.audio_array = None
            clip.close()
        except Exception as e:
            print(f"Error cargando audio para lipsync: {e}")
            self.audio_array = None

    def set_fps(self, fps):
        self.fps = max(1, fps)

    def procesar_frame(self, landmarks, timestamp):
        mar = 0.0
        if landmarks:
            mar = self._calculate_mar(landmarks)
        self.visual_envelope.append(mar)
        if timestamp is not None:
            self.frame_timestamps.append(float(timestamp))
        else:
            # Fallback to synthetic time if capture does not provide timestamps
            fallback_time = len(self.frame_timestamps) / self.fps if self.fps else 0.0
            self.frame_timestamps.append(fallback_time)

    def obtener_resultados(self):
        if (
            self.audio_array is None
            or not self.visual_envelope
            or not self.frame_timestamps
        ):
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        frame_times = np.asarray(self.frame_timestamps, dtype=float)
        if frame_times.size == 0:
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        # Ensure strictly non-decreasing timestamps for interpolation
        frame_times = np.maximum.accumulate(frame_times)
        visual_sig = np.asarray(self.visual_envelope, dtype=float)

        audio_times, audio_profile = self._build_audio_profile()
        if audio_profile.size == 0:
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        audio_sig = self._resample_audio_to_frames(
            audio_times, audio_profile, frame_times
        )
        if audio_sig.size == 0:
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        visual_smooth, visual_states = self._extract_visual_activity(visual_sig)
        audio_smooth, audio_states = self._extract_audio_activity(audio_sig)

        min_len = min(len(audio_smooth), len(visual_smooth))
        if min_len == 0:
            return {"score": 0.0, "lag": 0.0, "anomalias": []}

        audio_smooth = audio_smooth[:min_len]
        visual_smooth = visual_smooth[:min_len]
        audio_states = audio_states[:min_len]
        visual_states = visual_states[:min_len]
        frame_times = frame_times[:min_len]

        lag_seconds, correlation_score = self._calculate_global_synchrony(
            audio_smooth, visual_smooth, self.fps
        )
        raw_intervals = self._detect_anomaly_intervals(
            audio_states, visual_states, frame_times, self.MIN_INTERVAL_SEC
        )
        intervals = self._merge_anomaly_intervals(raw_intervals, self.MERGE_GAP_SEC)

        return {"score": correlation_score, "lag": lag_seconds, "anomalias": intervals}

    def _calculate_mar(self, landmarks):
        p13 = landmarks.landmark[13]
        p14 = landmarks.landmark[14]
        p61 = landmarks.landmark[61]
        p291 = landmarks.landmark[291]
        A = np.sqrt((p13.x - p14.x) ** 2 + (p13.y - p14.y) ** 2)
        C = np.sqrt((p61.x - p291.x) ** 2 + (p61.y - p291.y) ** 2)
        if C < 1e-6:
            return 0.0
        return A / C

    def _build_audio_profile(self):
        if self.audio_array is None or len(self.audio_array) == 0:
            return np.array([]), np.array([])

        window_size = max(1, int(self.sample_rate * self.AUDIO_WINDOW_SEC))
        hop_size = max(1, int(window_size * self.AUDIO_HOP_RATIO))
        energies = []
        times = []

        for start in range(0, len(self.audio_array) - window_size + 1, hop_size):
            end = start + window_size
            chunk = self.audio_array[start:end]
            if len(chunk) == 0:
                continue
            rms = np.sqrt(np.mean(np.square(chunk)))
            center_time = (start + window_size / 2) / self.sample_rate
            energies.append(rms)
            times.append(center_time)

        if not energies:
            return np.array([]), np.array([])

        energies = np.asarray(energies)
        times = np.asarray(times)

        noise_floor = np.percentile(energies, 15)
        energies = np.maximum(0.0, energies - noise_floor * 1.1)
        peak = np.max(energies)
        if peak > 1e-6:
            energies /= peak
        else:
            energies[:] = 0.0

        hop_sec = hop_size / self.sample_rate
        smooth_window = max(1, int(self.AUDIO_SMOOTH_SEC / max(hop_sec, 1e-3)))
        energies = self._smooth_signal(energies, smooth_window)

        return times, energies

    def _resample_audio_to_frames(self, audio_times, audio_profile, frame_times):
        if audio_profile.size == 0 or audio_times.size == 0:
            return np.array([])
        return np.interp(frame_times, audio_times, audio_profile, left=0.0, right=0.0)

    def _extract_visual_activity(self, visual_sig):
        if visual_sig.size == 0:
            return visual_sig, np.array([], dtype=bool)

        window = max(3, int(self.fps * self.VISUAL_SMOOTH_SEC))
        smoothed = self._smooth_signal(visual_sig, window)

        base = np.percentile(smoothed, 15)
        max_val = np.percentile(smoothed, 90)
        dynamic_range = max_val - base

        # Prevent noise-only clips from being classified as mouth open
        floor_offset = 0.02
        mouth_open_thresh = base + max(dynamic_range * 0.55, floor_offset)
        mouth_closed_thresh = base + max(dynamic_range * 0.25, floor_offset / 2)

        if dynamic_range < 0.01:
            mouth_open_thresh = 1.0
            mouth_closed_thresh = 1.0

        states = self._apply_hysteresis(
            smoothed, mouth_open_thresh, mouth_closed_thresh
        )
        return smoothed, states

    def _extract_audio_activity(self, audio_sig):
        if audio_sig.size == 0:
            return audio_sig, np.array([], dtype=bool)

        window = max(3, int(self.fps * self.AUDIO_SMOOTH_SEC))
        smoothed = self._smooth_signal(audio_sig, window)

        noise_floor = np.percentile(smoothed, 20)
        peak = np.max(smoothed)
        usable_range = max(peak - noise_floor, 1e-3)
        on_thresh = noise_floor + usable_range * 0.35
        on_thresh = min(1.0, max(on_thresh, noise_floor + 0.1))
        off_thresh = noise_floor + usable_range * 0.2

        states = self._apply_hysteresis(smoothed, on_thresh, off_thresh)
        return smoothed, states

    def _apply_hysteresis(self, signal_data, high_threshold, low_threshold):
        if signal_data.size == 0:
            return np.array([], dtype=bool)
        state = False
        states = []
        for value in signal_data:
            if not state and value >= high_threshold:
                state = True
            elif state and value <= low_threshold:
                state = False
            states.append(state)
        return np.asarray(states, dtype=bool)

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
        best_lag_seconds = best_lag_frames / fps if fps else 0.0
        return best_lag_seconds, max_corr

    def _smooth_signal(self, signal_data, window_size):
        window_size = max(1, int(window_size))
        if window_size == 1 or len(signal_data) <= 2:
            return signal_data
        if len(signal_data) < window_size:
            window = np.ones(len(signal_data)) / max(len(signal_data), 1)
            return np.convolve(signal_data, window, mode="same")
        window = np.ones(window_size) / window_size
        return np.convolve(signal_data, window, mode="same")

    def _detect_anomaly_intervals(
        self, audio_states, visual_states, frame_times, min_duration
    ):
        if len(audio_states) == 0 or len(visual_states) == 0:
            return []

        anomalies = []
        current_label = None
        start_idx = None

        for idx, (audio_on, mouth_open) in enumerate(zip(audio_states, visual_states)):
            label = None
            if audio_on and not mouth_open:
                label = "Audio sin Boca"
            elif mouth_open and not audio_on:
                label = "Boca sin Audio"

            if label == current_label:
                continue

            # Close previous segment
            if current_label is not None and start_idx is not None:
                end_idx = idx - 1
                start_time = frame_times[start_idx]
                end_time = frame_times[end_idx]
                duration = end_time - start_time
                if duration >= min_duration:
                    anomalies.append((start_time, end_time, current_label))
            current_label = label
            start_idx = idx if label is not None else None

        if current_label is not None and start_idx is not None:
            end_idx = len(frame_times) - 1
            start_time = frame_times[start_idx]
            end_time = frame_times[end_idx]
            duration = end_time - start_time
            if duration >= min_duration:
                anomalies.append((start_time, end_time, current_label))

        return anomalies

    def _merge_anomaly_intervals(self, intervals, gap_threshold):
        if not intervals:
            return []

        merged = []
        labels = set(label for _, _, label in intervals)
        for label in labels:
            label_intervals = sorted(
                [
                    (start, end)
                    for start, end, current_label in intervals
                    if current_label == label
                ],
                key=lambda item: item[0],
            )
            if not label_intervals:
                continue

            current_start, current_end = label_intervals[0]
            for start, end in label_intervals[1:]:
                if start - current_end <= gap_threshold:
                    current_end = max(current_end, end)
                else:
                    merged.append(
                        {
                            "tiempo_inicio": round(current_start, 2),
                            "tiempo_fin": round(current_end, 2),
                            "tipo_anomalia": label,
                        }
                    )
                    current_start, current_end = start, end

            merged.append(
                {
                    "tiempo_inicio": round(current_start, 2),
                    "tiempo_fin": round(current_end, 2),
                    "tipo_anomalia": label,
                }
            )

        merged.sort(key=lambda item: item["tiempo_inicio"])
        return merged
