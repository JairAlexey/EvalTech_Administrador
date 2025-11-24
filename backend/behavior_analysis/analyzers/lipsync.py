import cv2
import mediapipe as mp
import numpy as np
import math
from moviepy import VideoFileClip


def run_lipsync_test(video_path):
    print(f"Testing Lip Sync Analysis on {video_path}...")

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        min_detection_confidence=0.5, min_tracking_confidence=0.5
    )

    try:
        # Load audio first
        clip = VideoFileClip(video_path)
        if clip.audio is None:
            print("Error: Video has no audio track.")
            return

        audio_array = clip.audio.to_soundarray(fps=44100)
        if audio_array.ndim == 2:
            audio_array = audio_array.mean(axis=1)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video file {video_path}")
            return

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30  # Fallback

        frame_count = 0
        anomalies = []

        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break

            # Calculate current time in seconds
            current_time = frame_count / fps

            # Get corresponding audio chunk (approximate)
            # We want a small window around the current time
            audio_start_idx = int(current_time * 44100)
            audio_end_idx = int((current_time + 1 / fps) * 44100)

            if audio_start_idx < len(audio_array):
                audio_chunk = audio_array[audio_start_idx:audio_end_idx]
                if len(audio_chunk) > 0:
                    energy = np.sum(audio_chunk**2) / len(audio_chunk)
                else:
                    energy = 0
            else:
                energy = 0

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(image_rgb)

            mouth_open = 0
            if results.multi_face_landmarks:
                for face_landmarks in results.multi_face_landmarks:
                    # Upper lip: 13, Lower lip: 14
                    upper = face_landmarks.landmark[13]
                    lower = face_landmarks.landmark[14]

                    h, w, _ = image.shape
                    dist = math.sqrt(
                        (upper.x - lower.x) ** 2
                        + (upper.y - lower.y) ** 2
                        + (upper.z - lower.z) ** 2
                    )
                    mouth_open = dist * 100  # Scale up

            # Simple correlation check
            # Thresholds need tuning for normalized audio
            if energy > 0.005 and mouth_open < 1.0:  # Loud but mouth closed
                anomalies.append(
                    f"Mismatch at {current_time:.2f}s (Energy: {energy:.4f}, Mouth: {mouth_open:.2f})"
                )

            frame_count += 1

        cap.release()
        clip.close()

        if anomalies:
            print("WARNING: Lip sync anomalies detected:")
            # Print first 10 to avoid spam
            for anomaly in anomalies[:10]:
                print(f"  - {anomaly}")
            if len(anomalies) > 10:
                print(f"  ... and {len(anomalies) - 10} more.")
        else:
            print("SUCCESS: Lip sync appears normal.")

    except Exception as e:
        print(f"Error processing video: {e}")
