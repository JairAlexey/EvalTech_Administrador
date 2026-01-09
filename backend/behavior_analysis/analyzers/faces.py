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

        # Para debug y logging
        self.total_processed_frames = 0
        self.last_logged_time = 0

    def _ensure_models_exist(self):
        """
        Descarga los modelos YuNet (Detección) y SFace (Reconocimiento) si no existen.
        """
        models = {
            "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
            "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        }

        # Carpeta de modelos
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
        """
        Procesa un frame del video para detección y reconocimiento facial.
        Aplica stride interno para optimizar rendimiento.
        """
        self.frame_count += 1

        # Stride interno: procesar solo 1 de cada N frames
        if self.frame_count % self.frame_stride != 0:
            return

        self.total_processed_frames += 1

        # Logging de progreso cada cierto tiempo
        if int(timestamp) > self.last_logged_time and int(timestamp) % 30 == 0:
            minutes = int(timestamp // 60)
            seconds = int(timestamp % 60)
            self.last_logged_time = int(timestamp)

        h, w = frame.shape[:2]
        scale = self.process_width / w
        new_h = int(h * scale)

        # Resize del frame para optimizar velocidad
        small_frame = cv2.resize(frame, (self.process_width, new_h))
        self.detector.setInputSize((self.process_width, new_h))

        # Detección de rostros
        _, faces = self.detector.detect(small_frame)

        if faces is not None:
            for face in faces:
                # Alinear rostro para reconocimiento
                aligned_face = self.recognizer.alignCrop(small_frame, face)
                if aligned_face is None:
                    continue

                # Extraer embedding (características faciales)
                face_feature = self.recognizer.feature(aligned_face)

                # Comparar con personas conocidas
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
                        # Extender intervalo actual
                        last_interval[1] = timestamp
                    else:
                        # Crear nuevo intervalo (persona reapareció)
                        person["intervals"].append([timestamp, timestamp])

                    # Actualizar embedding (promedio móvil para adaptarse a cambios de luz/ángulo)
                    person["embedding"] = (person["embedding"] + face_feature) / 2
                    person["last_seen"] = timestamp
                else:
                    # Nueva persona detectada
                    self.known_people[self.next_person_id] = {
                        "embedding": face_feature,
                        "intervals": [[timestamp, timestamp]],
                        "last_seen": timestamp,
                    }
                    self.next_person_id += 1

    def obtener_resultados(self):
        """
        Retorna una lista de diccionarios con los intervalos detectados.
        Filtra ruido (apariciones menores a 1 segundo) y renumera IDs secuencialmente.
        """
        resultados = []
        seen = set()

        # Filtrar y ordenar personas por primera aparición
        valid_people = []
        for pid, data in self.known_people.items():
            total_time = sum([end - start for start, end in data["intervals"]])
            # Filtrar ruido: menos de 1 segundo total = probablemente falso positivo
            if total_time < 1.0:
                continue
            valid_people.append((data["intervals"][0][0], pid, data))

        # Ordenar por tiempo de primera aparición
        valid_people.sort(key=lambda x: x[0])

        # Renumerar con IDs limpios (1, 2, 3...)
        for idx, (_, old_pid, data) in enumerate(valid_people, start=1):
            for start, end in data["intervals"]:
                start_rounded = round(start, 2)
                end_rounded = round(end, 2)
                key = (idx, start_rounded, end_rounded)
                if key in seen:
                    continue
                seen.add(key)
                resultados.append(
                    {
                        "persona_id": idx,
                        "tiempo_inicio": start_rounded,
                        "tiempo_fin": end_rounded,
                    }
                )

        print(
            f"\n  [Rostros] Detectadas {len(valid_people)} personas únicas (filtrado ruido < 1s)"
        )
        return resultados
