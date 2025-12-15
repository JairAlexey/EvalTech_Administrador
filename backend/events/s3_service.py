import boto3
import uuid
import os
from datetime import datetime, timedelta
from django.conf import settings
from botocore.exceptions import ClientError, NoCredentialsError
import logging

logger = logging.getLogger(__name__)


class S3Service:
    """
    Servicio para manejar operaciones de Amazon S3 para almacenamiento de archivos multimedia.
    Maneja fragmentos de audio/video de 5 minutos con organización por participante y evento.
    """

    def __init__(self):
        """Inicializa el cliente S3 y verifica las configuraciones."""
        self.bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
        self.region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")

        try:
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
                region_name=self.region,
            )
            self._is_configured = True
        except (NoCredentialsError, Exception) as e:
            logger.error(f"Error initializing S3 client: {e}")
            self.s3_client = None
            self._is_configured = False

    def is_configured(self):
        """Verifica si S3 está configurado correctamente."""
        return self._is_configured and self.bucket_name

    def create_bucket_if_not_exists(self):
        """
        Crea el bucket de S3 si no existe.
        Returns:
            bool: True si el bucket existe o se creó exitosamente, False en caso contrario.
        """
        if not self.is_configured():
            logger.error("S3 not configured properly")
            return False

        try:
            # Verificar si el bucket existe
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Bucket '{self.bucket_name}' already exists")
            return True
        except ClientError as e:
            error_code = int(e.response["Error"]["Code"])
            if error_code == 404:
                # El bucket no existe, intentar crearlo
                try:
                    if self.region == "us-east-1":
                        # Para us-east-1 no se especifica LocationConstraint
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={
                                "LocationConstraint": self.region
                            },
                        )

                    # Aplicar configuración de versionado y lifecycle si es necesario
                    self._configure_bucket_policies()

                    logger.info(f"Bucket '{self.bucket_name}' created successfully")
                    return True
                except ClientError as create_error:
                    logger.error(f"Error creating bucket: {create_error}")
                    return False
            else:
                logger.error(f"Error accessing bucket: {e}")
                return False

    def _configure_bucket_policies(self):
        """Configura políticas básicas del bucket (versionado, lifecycle, etc.)."""
        try:
            # Mantener bloqueo de acceso público para que el bucket quede privado
            try:
                self.s3_client.put_public_access_block(
                    Bucket=self.bucket_name,
                    PublicAccessBlockConfiguration={
                        "BlockPublicAcls": True,
                        "IgnorePublicAcls": True,
                        "BlockPublicPolicy": True,
                        "RestrictPublicBuckets": True,
                    },
                )
                logger.info(
                    f"Public access block configured for bucket '{self.bucket_name}'"
                )
            except ClientError as e:
                logger.warning(f"Could not configure public access block: {e}")

            # Habilitar versionado
            self.s3_client.put_bucket_versioning(
                Bucket=self.bucket_name, VersioningConfiguration={"Status": "Enabled"}
            )

            # Configurar política de ciclo de vida para eliminar versiones antiguas
            lifecycle_config = {
                "Rules": [
                    {
                        "ID": "DeleteOldVersions",
                        "Status": "Enabled",
                        "Filter": {"Prefix": ""},
                        "NoncurrentVersionExpiration": {"NoncurrentDays": 30},
                    }
                ]
            }

            self.s3_client.put_bucket_lifecycle_configuration(
                Bucket=self.bucket_name, LifecycleConfiguration=lifecycle_config
            )

            logger.info("Bucket policies configured successfully")
        except ClientError as e:
            logger.warning(f"Could not configure bucket policies: {e}")

    def generate_media_key(
        self, participant_event_id, media_type="video", timestamp=None
    ):
        """
        Genera una clave única para el archivo multimedia en S3.

        Args:
            participant_event_id (int): ID del ParticipantEvent
            media_type (str): Tipo de media ('video', 'audio', 'screen')
            timestamp (datetime): Timestamp del fragmento, usa actual si no se especifica

        Returns:
            str: Clave del archivo en formato: media/participant_events/{id}/{year}/{month}/{day}/{type}_{timestamp}_{uuid}.{ext}
            Donde ext = webm para video/audio, jpg para screen
        """
        if timestamp is None:
            timestamp = datetime.now()

        date_path = timestamp.strftime("%Y/%m/%d")
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]

        # Usar extensión correcta según el tipo de media
        extension = self._get_file_extension(media_type)
        filename = f"{media_type}_{timestamp_str}_{unique_id}.{extension}"

        return f"media/participant_events/{participant_event_id}/{date_path}/{filename}"

    def upload_media_fragment(
        self, file_obj, participant_event_id, media_type="video", timestamp=None
    ):
        """
        Sube un fragmento de media (5 minutos) a S3.

        Args:
            file_obj: Objeto de archivo (Django UploadedFile o similar)
            participant_event_id (int): ID del ParticipantEvent
            media_type (str): Tipo de media ('video', 'audio', 'screen')
            timestamp (datetime): Timestamp del fragmento

        Returns:
            dict: {'success': bool, 'key': str, 'url': str, 'presigned_url': str, 'error': str}
        """
        if not self.is_configured():
            return {"success": False, "error": "S3 not configured properly"}

        try:
            # Generar clave única
            key = self.generate_media_key(participant_event_id, media_type, timestamp)

            # Preparar metadata
            metadata = {
                "participant_event_id": str(participant_event_id),
                "media_type": media_type,
                "upload_timestamp": datetime.now().isoformat(),
                "fragment_timestamp": (timestamp or datetime.now()).isoformat(),
            }

            # Subir archivo sin ACL (compatible con Object Ownership: Bucket owner enforced)
            self.s3_client.upload_fileobj(
                file_obj,
                self.bucket_name,
                key,
                ExtraArgs={
                    "ContentType": self._get_content_type(media_type),
                    "Metadata": metadata,
                    "ServerSideEncryption": "AES256",
                },
            )

            # Generar URL prefirmada de conveniencia (bucket permanece privado)
            presigned_url = self.generate_presigned_url(key)

            logger.info(f"Successfully uploaded media fragment: {key}")

            return {
                "success": True,
                "key": key,
                "url": key,  # almacenar solo la key aunque el campo se llame url
                "presigned_url": presigned_url,
                "metadata": metadata,
            }

        except ClientError as e:
            logger.error(f"Error uploading media fragment: {e}")
            return {"success": False, "error": f"Upload failed: {str(e)}"}

    def generate_public_url(self, key):
        """
        Genera una URL pública permanente para acceder a un archivo en S3.
        Esta URL no expira y funciona siempre que el archivo sea público.

        Args:
            key (str): Clave del archivo en S3

        Returns:
            str: URL pública o None si hay error
        """
        if not self.is_configured():
            return None

        try:
            # Generar URL pública sin firma
            url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
            return url
        except Exception as e:
            logger.error(f"Error generating public URL for {key}: {e}")
            return None

    def generate_presigned_url(self, key, expiration=3600):
        """
        Genera una URL pre-firmada para acceder a un archivo privado en S3.
        NOTA: Para URLs permanentes, usar generate_public_url() en su lugar.

        Args:
            key (str): Clave del archivo en S3
            expiration (int): Tiempo de expiración en segundos (default: 1 hora)

        Returns:
            str: URL pre-firmada o None si hay error
        """
        if not self.is_configured():
            return None

        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL for {key}: {e}")
            return None

    def delete_media_fragment(self, key):
        """
        Elimina un fragmento de media de S3.

        Args:
            key (str): Clave del archivo en S3

        Returns:
            dict: {'success': bool, 'error': str}
        """
        if not self.is_configured():
            return {"success": False, "error": "S3 not configured properly"}

        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Successfully deleted media fragment: {key}")
            return {"success": True}
        except ClientError as e:
            logger.error(f"Error deleting media fragment {key}: {e}")
            return {"success": False, "error": f"Delete failed: {str(e)}"}

    def list_participant_media(
        self, participant_event_id, media_type=None, start_date=None, end_date=None
    ):
        """
        Lista los archivos multimedia de un participante en un evento.

        Args:
            participant_event_id (int): ID del ParticipantEvent
            media_type (str, optional): Filtrar por tipo de media
            start_date (datetime, optional): Fecha de inicio para filtrar
            end_date (datetime, optional): Fecha de fin para filtrar

        Returns:
            list: Lista de diccionarios con información de los archivos
        """
        if not self.is_configured():
            return []

        try:
            prefix = f"media/participant_events/{participant_event_id}/"

            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, Prefix=prefix
            )

            files = []
            if "Contents" in response:
                for obj in response["Contents"]:
                    key = obj["Key"]
                    presigned_url = self.generate_presigned_url(key)

                    # Filtrar por tipo de media si se especifica
                    if media_type and f"/{media_type}_" not in key:
                        continue

                    # Obtener metadata
                    try:
                        metadata_response = self.s3_client.head_object(
                            Bucket=self.bucket_name, Key=key
                        )
                        metadata = metadata_response.get("Metadata", {})
                    except ClientError:
                        metadata = {}

                    file_info = {
                        "key": key,
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"],
                        "media_type": metadata.get("media_type", "unknown"),
                        "fragment_timestamp": metadata.get("fragment_timestamp"),
                        "s3_key": key,
                        "url": presigned_url,
                        "presigned_url": presigned_url,
                    }

                    files.append(file_info)

            return files

        except ClientError as e:
            logger.error(
                f"Error listing media for participant {participant_event_id}: {e}"
            )
            return []

    def get_media_fragment_info(self, key):
        """
        Obtiene información de un fragmento de media específico.

        Args:
            key (str): Clave del archivo en S3

        Returns:
            dict: Información del archivo o None si no existe
        """
        if not self.is_configured():
            return None

        try:
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            presigned_url = self.generate_presigned_url(key)

            return {
                "key": key,
                "size": response["ContentLength"],
                "last_modified": response["LastModified"],
                "content_type": response.get("ContentType"),
                "metadata": response.get("Metadata", {}),
                "s3_key": key,
                "url": presigned_url,
                "presigned_url": presigned_url,
            }

        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return None
            logger.error(f"Error getting media fragment info for {key}: {e}")
            return None

    def _get_content_type(self, media_type):
        """Determina el content type basado en el tipo de media."""
        content_types = {
            "video": "video/webm",
            "audio": "audio/webm",
            "screen": "image/jpeg",  # Screenshots como imágenes JPEG
            "merged_video": "video/webm",
        }
        return content_types.get(media_type, "application/octet-stream")

    def _get_file_extension(self, media_type):
        """Determina la extensión de archivo basada en el tipo de media."""
        extensions = {
            "video": "webm",
            "audio": "webm",
            "screen": "jpg",  # Screenshots como JPEG para menor costo
            "merged_video": "webm",
        }
        return extensions.get(media_type, "bin")

    def cleanup_old_fragments(self, days_old=30):
        """
        Limpia fragmentos de media antiguos (opcional, para mantenimiento).

        Args:
            days_old (int): Días de antigüedad para considerar como "antiguo"

        Returns:
            dict: {'deleted_count': int, 'errors': list}
        """
        if not self.is_configured():
            return {"deleted_count": 0, "errors": ["S3 not configured"]}

        try:
            cutoff_date = datetime.now() - timedelta(days=days_old)

            # Listar todos los objetos
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, Prefix="media/participant_events/"
            )

            deleted_count = 0
            errors = []

            if "Contents" in response:
                for obj in response["Contents"]:
                    if obj["LastModified"].replace(tzinfo=None) < cutoff_date:
                        try:
                            self.s3_client.delete_object(
                                Bucket=self.bucket_name, Key=obj["Key"]
                            )
                            deleted_count += 1
                        except ClientError as e:
                            errors.append(f"Error deleting {obj['Key']}: {str(e)}")

            return {"deleted_count": deleted_count, "errors": errors}

        except ClientError as e:
            logger.error(f"Error during cleanup: {e}")
            return {"deleted_count": 0, "errors": [str(e)]}

    def download_file(self, s3_key, local_file_path):
        """
        Descarga un archivo desde S3 a una ubicación local.

        Args:
            s3_key (str): Key del archivo en S3
            local_file_path (str): Ruta local donde guardar el archivo

        Returns:
            dict: {'success': bool, 'error': str}
        """
        if not self.is_configured():
            return {"success": False, "error": "S3 not configured properly"}

        try:
            self.s3_client.download_file(
                Bucket=self.bucket_name, Key=s3_key, Filename=local_file_path
            )

            logger.info(f"Successfully downloaded {s3_key} to {local_file_path}")
            return {"success": True}

        except ClientError as e:
            error_msg = f"Error downloading file from S3: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
        except Exception as e:
            error_msg = f"Unexpected error downloading file: {str(e)}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}


# Instancia global del servicio
s3_service = S3Service()
