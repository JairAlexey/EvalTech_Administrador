import cv2
import mediapipe as mp
import threading
import os
from django.utils import timezone
from .models import (
    AnalisisComportamiento,
    RegistroRostro,
    RegistroGesto,
    RegistroIluminacion,
    RegistroVoz,
    AnomaliaLipsync,
    RegistroAusencia,
)
from events.models import ParticipantEvent
from .analyzers.faces import AnalizadorRostros
from .analyzers.gestures import AnalizadorGestos
from .analyzers.lighting import AnalizadorIluminacion
from .analyzers.lipsync import AnalizadorLipsync
from .analyzers.voice import AnalizadorVoz
from .analyzers.absence import AnalizadorAusencia


def procesar_video_completo(video_path, participant_event_id):
    print(f"Iniciando análisis unificado para: {video_path}")

    try:
        pe = ParticipantEvent.objects.get(id=participant_event_id)
    except ParticipantEvent.DoesNotExist:
        print(f"Error: ParticipantEvent {participant_event_id} no existe.")
        return None

    # Obtener registro existente y actualizar estado
    try:
        analisis = AnalisisComportamiento.objects.get(participant_event=pe)
        analisis.status = "PROCESSING"
        analisis.save()
    except AnalisisComportamiento.DoesNotExist:
        print(
            f"Error: No existe registro de análisis para el evento {participant_event_id}"
        )
        return None

    # Inicializar analizadores
    rostros = AnalizadorRostros()
    gestos = AnalizadorGestos()
    iluminacion = AnalizadorIluminacion()
    lipsync = AnalizadorLipsync(video_path)
    voz = AnalizadorVoz(video_path)
    ausencia = AnalizadorAusencia()

    # Ejecutar análisis de voz en hilo separado
    voz_resultado = {}

    def run_voice():
        nonlocal voz_resultado
        voz_resultado = voz.procesar()

    voice_thread = threading.Thread(target=run_voice)
    voice_thread.start()

    # Configurar MediaPipe FaceMesh (compartido)
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    # Verificar existencia de archivo
    if not os.path.exists(video_path):
        print(f"Error: archivo no existe: {video_path}")
        try:
            analisis = AnalisisComportamiento.objects.get(
                participant_event_id=participant_event_id
            )
            analisis.status = "ERROR"
            analisis.save()
        except AnalisisComportamiento.DoesNotExist:
            pass
        return None

    # Abrir video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error al abrir el video.")
        analisis.status = "ERROR"
        analisis.save()
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30
    lipsync.set_fps(fps)

    frame_count = 0
    last_timestamp = 0

    print("Procesando video frame a frame...")
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Usar el timestamp real del video en lugar de calcularlo manualmente
        # Esto funciona correctamente con WebM y otros formatos
        timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        timestamp = timestamp_ms / 1000.0  # Convertir de milisegundos a segundos

        # Guardar el último timestamp válido
        if timestamp > 0:
            last_timestamp = timestamp

        h, w = frame.shape[:2]

        # 1. Rostros (YuNet) - Tiene su propio stride interno
        rostros.procesar_frame(frame, timestamp)

        # 2. Iluminación (OpenCV puro)
        iluminacion.procesar_frame(frame, timestamp)

        # 3. Ausencia (MediaPipe Face Detection)
        ausencia.procesar_frame(frame, timestamp)

        # 4. MediaPipe (Gestos + Lipsync)
        # Convertir a RGB una vez
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(frame_rgb)

        landmarks = None
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0]  # Tomamos el primero

        # Gestos
        gestos.procesar_frame(landmarks, w, h, timestamp)

        # Lipsync
        lipsync.procesar_frame(landmarks, timestamp)

        frame_count += 1
        if frame_count % 100 == 0:
            # Convertir timestamp a formato mm:ss
            minutes = int(timestamp // 60)
            seconds = int(timestamp % 60)
            print(f"Procesado: {minutes:02d}:{seconds:02d}", end="\r")

    cap.release()
    face_mesh.close()

    # Finalizar analizadores que requieran cierre
    # Usar el último timestamp real en lugar de calcularlo
    final_timestamp = last_timestamp if last_timestamp > 0 else frame_count / fps
    gestos.finalizar(final_timestamp)
    iluminacion.finalizar(final_timestamp)
    ausencia.finalizar(final_timestamp)

    # Esperar a voz
    voice_thread.join()

    print("\nGuardando resultados en base de datos...")

    # --- GUARDAR RESULTADOS ---

    # 1. Rostros
    res_rostros = rostros.obtener_resultados()
    for r in res_rostros:
        RegistroRostro.objects.create(
            analisis=analisis,
            persona_id=r["persona_id"],
            tiempo_inicio=r["tiempo_inicio"],
            tiempo_fin=r["tiempo_fin"],
        )

    # 2. Gestos
    res_gestos = gestos.obtener_resultados()
    for g in res_gestos:
        RegistroGesto.objects.create(
            analisis=analisis,
            tipo_gesto=g["tipo_gesto"],
            tiempo_inicio=g["tiempo_inicio"],
            tiempo_fin=g["tiempo_fin"],
            duracion=g["duracion"],
        )

    # 3. Iluminación
    res_ilum = iluminacion.obtener_resultados()
    for i in res_ilum:
        RegistroIluminacion.objects.create(
            analisis=analisis,
            tiempo_inicio=i["tiempo_inicio"],
            tiempo_fin=i["tiempo_fin"],
        )

    # 4. Ausencia
    res_ausencia = ausencia.finalizar(final_timestamp)
    for start, end, duration in res_ausencia:
        RegistroAusencia.objects.create(
            analisis=analisis,
            tiempo_inicio=start,
            tiempo_fin=end,
            duracion=duration,
        )

    # 5. Lipsync
    res_lipsync = lipsync.obtener_resultados()
    for a in res_lipsync.get("anomalias", []):
        AnomaliaLipsync.objects.create(
            analisis=analisis,
            tipo_anomalia=a["tipo_anomalia"],
            tiempo_inicio=a["tiempo_inicio"],
            tiempo_fin=a["tiempo_fin"],
        )

    # 6. Voz
    if voz_resultado:
        for susurro in voz_resultado.get("susurros", []):
            RegistroVoz.objects.create(
                analisis=analisis,
                tipo_log="susurro",
                tiempo_inicio=susurro[0],
                tiempo_fin=susurro[1],
            )

        for hab in voz_resultado.get("hablantes", []):
            RegistroVoz.objects.create(
                analisis=analisis,
                tipo_log="hablante",
                etiqueta_hablante=hab["etiqueta"],
                tiempo_inicio=hab["tiempo_inicio"],
                tiempo_fin=hab["tiempo_fin"],
            )

    analisis.status = "COMPLETED"
    analisis.save()
    print("Análisis completado y guardado.")
    return {"id": analisis.id, "status": "COMPLETED"}
