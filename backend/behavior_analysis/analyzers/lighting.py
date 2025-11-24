import cv2
import numpy as np


def run_lighting_test(video_path):
    print(f"Testing Lighting Change Detection on {video_path}...")

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    prev_brightness = 0
    frame_count = 0
    anomalies = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)

        diff = abs(brightness - prev_brightness)

        if diff > 10 and prev_brightness != 0:  # Threshold for sudden change
            current_time = frame_count / fps
            anomalies.append(
                f"Sudden lighting change at {current_time:.2f}s (Diff: {diff:.2f})"
            )

        prev_brightness = brightness
        frame_count += 1

    cap.release()

    if anomalies:
        print("WARNING: Lighting anomalies detected:")
        for anomaly in anomalies[:10]:
            print(f"  - {anomaly}")
        if len(anomalies) > 10:
            print(f"  ... and {len(anomalies) - 10} more.")
    else:
        print("SUCCESS: Lighting appears stable.")
