import cv2
import mediapipe as mp
import numpy as np


def run_gestures_test(video_path):
    print(f"Testing Gesture Identification on {video_path}...")

    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        min_detection_confidence=0.5, min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30

    frame_count = 0
    current_gesture = "Forward"
    gesture_start_time = 0.0
    gesture_intervals = []
    current_time = 0.0

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            break

        timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        if timestamp_ms < 0 or (timestamp_ms == 0 and frame_count > 0):
            current_time = frame_count / fps
        else:
            current_time = timestamp_ms / 1000.0

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(image_rgb)

        img_h, img_w, img_c = image.shape

        frame_gesture = "Forward"

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # Define 3D model points (Generic Face)
                # Order: Nose, Chin, Left Eye, Right Eye, Left Mouth, Right Mouth
                # Indices: 1, 199, 33, 263, 61, 291
                # Using Y-Down coordinate system (matches OpenCV image coords)
                face_3d = np.array(
                    [
                        (0.0, 0.0, 0.0),  # Nose tip
                        (0.0, 330.0, -65.0),  # Chin
                        (-225.0, -170.0, -135.0),  # Left eye left corner
                        (225.0, -170.0, -135.0),  # Right eye right corner
                        (-150.0, 150.0, -125.0),  # Left Mouth corner
                        (150.0, 150.0, -125.0),  # Right mouth corner
                    ],
                    dtype=np.float64,
                )

                # Map the 2D points to match the 3D model order
                face_2d = []
                landmarks = face_landmarks.landmark
                # Indices must match the face_3d array order
                points_idx = [1, 199, 33, 263, 61, 291]

                for idx in points_idx:
                    lm = landmarks[idx]
                    x, y = int(lm.x * img_w), int(lm.y * img_h)
                    face_2d.append([x, y])

                face_2d = np.array(face_2d, dtype=np.float64)

                focal_length = 1 * img_w
                cam_matrix = np.array(
                    [
                        [focal_length, 0, img_h / 2],
                        [0, focal_length, img_w / 2],
                        [0, 0, 1],
                    ]
                )

                dist_matrix = np.zeros((4, 1), dtype=np.float64)

                success, rot_vec, trans_vec = cv2.solvePnP(
                    face_3d, face_2d, cam_matrix, dist_matrix
                )
                rmat, jac = cv2.Rodrigues(rot_vec)
                angles, mtxR, mtxQ, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)

                x = angles[0]
                y = angles[1]

                # Determine gesture
                # y is Yaw (Left/Right). x is Pitch (Up/Down).
                # Thresholds (degrees)
                threshold_x_down = 25
                threshold_x_up = 15
                threshold_y = 25

                if abs(y) > threshold_y or abs(x) > min(
                    threshold_x_down, threshold_x_up
                ):
                    # Prioritize the axis with the larger deviation
                    if abs(y) > abs(x):
                        # Invert left/right for mirror mode
                        if y < -threshold_y:
                            frame_gesture = "Looking Right"
                        elif y > threshold_y:
                            frame_gesture = "Looking Left"
                    else:
                        if x < -threshold_x_down:
                            frame_gesture = "Looking Down"
                        elif x > threshold_x_up:
                            frame_gesture = "Looking Up"

        if frame_gesture != current_gesture:
            if current_gesture != "Forward":
                # End of a suspicious gesture
                gesture_intervals.append(
                    {
                        "gesture": current_gesture,
                        "start": gesture_start_time,
                        "end": current_time,
                    }
                )

            current_gesture = frame_gesture
            gesture_start_time = current_time

        frame_count += 1

    # Handle last segment if it was suspicious
    if current_gesture != "Forward":
        gesture_intervals.append(
            {
                "gesture": current_gesture,
                "start": gesture_start_time,
                "end": current_time,
            }
        )

    cap.release()

    if gesture_intervals:
        print("WARNING: Suspicious gestures detected:")

        # Group by gesture
        grouped_gestures = {}
        for interval in gesture_intervals:
            duration = interval["end"] - interval["start"]
            if duration > 0.2:  # Filter short blips
                g_type = interval["gesture"]
                if g_type not in grouped_gestures:
                    grouped_gestures[g_type] = []

                # Merge with last if close (within 0.5 seconds)
                if grouped_gestures[g_type] and (
                    interval["start"] - grouped_gestures[g_type][-1][1] < 0.5
                ):
                    prev_start, prev_end = grouped_gestures[g_type].pop()
                    grouped_gestures[g_type].append((prev_start, interval["end"]))
                else:
                    grouped_gestures[g_type].append(
                        (interval["start"], interval["end"])
                    )

        def format_time(seconds):
            seconds = int(round(seconds))
            m = seconds // 60
            s = seconds % 60
            return f"{m}:{s:02d}"

        for gesture, ranges in grouped_gestures.items():
            range_strs = [
                f"{format_time(start)} - {format_time(end)}" for start, end in ranges
            ]
            print(f"  {gesture}: [{', '.join(range_strs)}]")

    else:
        print("SUCCESS: No suspicious gestures detected.")
