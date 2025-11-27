import cv2
import os
import numpy as np
from urllib.request import urlretrieve


class AnalizadorRostros:
    def __init__(self):
        self.process_width = 640
        self.frame_stride = 5
        self.frame_count = 0

        self.det_path, self.rec_path = self._ensure_models_exist()
        # Inicializar con tamaño dummy, se ajusta en procesar_frame
        self.detector = cv2.FaceDetectorYN.create(
            self.det_path, "", (0, 0), 0.9, 0.3, 5000
        )
        self.recognizer = cv2.FaceRecognizerSF.create(self.rec_path, "")

        self.known_people = {}  # { id: { embedding, intervals, last_seen } }
        self.next_person_id = 1
        self.match_threshold = 0.4
        self.max_gap_tolerance = 2.0

    def _ensure_models_exist(self):
        """
        Descarga los modelos YuNet (Detección) y SFace (Reconocimiento) si no existen.
        """
        models = {
            "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
            "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        }

        # Ajustado a la nueva carpeta
        base_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "ai_models"
        )
        if not os.path.exists(base_path):
            os.makedirs(base_path)

        paths = {}
        for name, url in models.items():
            path = os.path.join(base_path, name)
            paths[name] = path
            if not os.path.exists(path):
                print(f"Descargando modelo {name}...")
                try:
                    urlretrieve(url, path)
                except Exception as e:
                    raise RuntimeError(f"Error descargando {name}: {e}")

        return (
            paths["face_detection_yunet_2023mar.onnx"],
            paths["face_recognition_sface_2021dec.onnx"],
        )

    def procesar_frame(self, frame, timestamp):
        self.frame_count += 1
        if self.frame_count % self.frame_stride != 0:
            return

        h, w = frame.shape[:2]
        scale = self.process_width / w
        new_h = int(h * scale)

        small_frame = cv2.resize(frame, (self.process_width, new_h))
        self.detector.setInputSize((self.process_width, new_h))

        # Detección
        _, faces = self.detector.detect(small_frame)

        if faces is not None:
            for face in faces:
                aligned_face = self.recognizer.alignCrop(small_frame, face)
                if aligned_face is None:
                    continue

                face_feature = self.recognizer.feature(aligned_face)

                best_score = 0.0
                best_id = None

                for pid, data in self.known_people.items():
                    score = self.recognizer.match(
                        face_feature, data["embedding"], cv2.FaceRecognizerSF_FR_COSINE
                    )
                    if score > best_score:
                        best_score = score
                        best_id = pid

                if best_score > self.match_threshold:
                    # Actualizar persona existente
                    person = self.known_people[best_id]
                    last_interval = person["intervals"][-1]

                    if timestamp - person["last_seen"] <= self.max_gap_tolerance:
                        last_interval[1] = timestamp
                    else:
                        person["intervals"].append([timestamp, timestamp])

                    person["embedding"] = (person["embedding"] + face_feature) / 2
                    person["last_seen"] = timestamp
                else:
                    # Nueva persona
                    self.known_people[self.next_person_id] = {
                        "embedding": face_feature,
                        "intervals": [[timestamp, timestamp]],
                        "last_seen": timestamp,
                    }
                    self.next_person_id += 1

    def obtener_resultados(self):
        """
        Retorna una lista de diccionarios con los intervalos detectados.
        """
        resultados = []
        # Renumerar IDs para que sean secuenciales (1, 2, 3...) en el output final
        # Ordenamos por tiempo de aparición
        sorted_people = sorted(
            self.known_people.items(), key=lambda x: x[1]["intervals"][0][0]
        )

        for idx, (pid, data) in enumerate(sorted_people, start=1):
            total_time = sum([end - start for start, end in data["intervals"]])
            if total_time < 1.0:
                continue

            for start, end in data["intervals"]:
                resultados.append(
                    {"persona_id": idx, "tiempo_inicio": start, "tiempo_fin": end}
                )
        return resultados
