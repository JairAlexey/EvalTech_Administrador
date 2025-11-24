import numpy as np
from moviepy import VideoFileClip


def run_voice_test(video_path):
    print(f"Testing External Voice Detection on {video_path}...")

    try:
        clip = VideoFileClip(video_path)
        if clip.audio is None:
            print("Error: Video has no audio track.")
            return

        # Extract audio as numpy array
        # audio.to_soundarray() returns (N, 2) for stereo, we need mono
        audio_array = clip.audio.to_soundarray(fps=44100)
        if audio_array.ndim == 2:
            audio_array = audio_array.mean(axis=1)  # Convert to mono

        # Analyze energy in chunks
        CHUNK_SIZE = 44100  # 1 second chunks

        anomalies = []

        for i in range(0, len(audio_array), CHUNK_SIZE):
            chunk = audio_array[i : i + CHUNK_SIZE]
            if len(chunk) == 0:
                continue

            energy = np.sum(chunk**2) / len(chunk)

            # Threshold needs to be calibrated for normalized audio from moviepy (-1.0 to 1.0)
            # 0.01 is a reasonable starting point for "loud"
            if energy > 0.01:
                timestamp = i / 44100
                anomalies.append(
                    f"High energy at {timestamp:.2f}s (Energy: {energy:.4f})"
                )

        if anomalies:
            print("WARNING: Potential external voices or noise detected:")
            for anomaly in anomalies:
                print(f"  - {anomaly}")
        else:
            print("SUCCESS: Audio levels normal.")

        clip.close()

    except Exception as e:
        print(f"Error processing audio: {e}")
