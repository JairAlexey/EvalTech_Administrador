import cv2
import mediapipe as mp
import time


def run_multiple_faces_test(video_path):
    print(f"Testing Multiple Faces Detection on {video_path}...")

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
    anomalies = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_detection.process(image_rgb)

        count = 0
        if results.detections:
            count = len(results.detections)

        if count > 1:
            current_time = frame_count / fps
            anomalies.append(
                f"Multiple faces ({count}) detected at {current_time:.2f}s"
            )

        frame_count += 1

    cap.release()

    if anomalies:
        print("WARNING: Multiple faces detected:")
        for anomaly in anomalies[:10]:
            print(f"  - {anomaly}")
        if len(anomalies) > 10:
            print(f"  ... and {len(anomalies) - 10} more.")
    else:
        print("SUCCESS: No multiple faces detected.")


def run_absence_test(video_path):
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
    anomalies = []

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_detection.process(image_rgb)

        present = False
        if results.detections:
            present = True
            if absence_start_frame is not None:
                # End of absence
                duration = (frame_count - absence_start_frame) / fps
                if duration > 1.0:  # Only report absences longer than 1s
                    start_time = absence_start_frame / fps
                    anomalies.append(
                        f"Absent for {duration:.1f}s starting at {start_time:.2f}s"
                    )
                absence_start_frame = None
        else:
            if absence_start_frame is None:
                absence_start_frame = frame_count

        frame_count += 1

    # Check if absent at the end
    if absence_start_frame is not None:
        duration = (frame_count - absence_start_frame) / fps
        if duration > 1.0:
            start_time = absence_start_frame / fps
            anomalies.append(
                f"Absent for {duration:.1f}s starting at {start_time:.2f}s (until end)"
            )

    cap.release()

    if anomalies:
        print("WARNING: Candidate absence detected:")
        for anomaly in anomalies[:10]:
            print(f"  - {anomaly}")
        if len(anomalies) > 10:
            print(f"  ... and {len(anomalies) - 10} more.")
    else:
        print("SUCCESS: Candidate was present throughout.")
