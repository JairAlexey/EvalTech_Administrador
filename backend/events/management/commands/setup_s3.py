from django.core.management.base import BaseCommand
from events.s3_service import s3_service
from events.models import ParticipantLog
from django.conf import settings
import os


class Command(BaseCommand):
    help = "Configura y verifica la conexión con Amazon S3"

    def add_arguments(self, parser):
        parser.add_argument(
            "--create-bucket",
            action="store_true",
            help="Crea el bucket de S3 si no existe",
        )
        parser.add_argument(
            "--test-upload",
            action="store_true",
            help="Realiza una prueba de upload/download",
        )
        parser.add_argument(
            "--migrate-local-files",
            action="store_true",
            help="Migra archivos locales existentes a S3 (CUIDADO: operación irreversible)",
        )
        parser.add_argument(
            "--check-config",
            action="store_true",
            help="Verifica la configuración de S3",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS("🚀 Configuración de Amazon S3 para EvalTech")
        )
        self.stdout.write("=" * 60)

        if options["check_config"]:
            self.check_s3_configuration()

        if options["create_bucket"]:
            self.create_s3_bucket()

        if options["test_upload"]:
            self.test_s3_operations()

        if options["migrate_local_files"]:
            self.migrate_local_files()

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("✅ Operación completada"))

    def check_s3_configuration(self):
        """Verifica la configuración de S3"""
        self.stdout.write("\n📋 Verificando configuración de S3...")

        # Verificar variables de entorno
        required_vars = [
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_STORAGE_BUCKET_NAME",
            "AWS_S3_REGION_NAME",
        ]

        missing_vars = []
        for var in required_vars:
            value = getattr(settings, var, None)
            if value:
                if var in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]:
                    self.stdout.write(
                        f'  ✅ {var}: {"*" * (len(str(value)) - 4)}{str(value)[-4:]}'
                    )
                else:
                    self.stdout.write(f"  ✅ {var}: {value}")
            else:
                missing_vars.append(var)
                self.stdout.write(self.style.ERROR(f"  ❌ {var}: No configurado"))

        if missing_vars:
            self.stdout.write(
                self.style.ERROR(f'\n❌ Variables faltantes: {", ".join(missing_vars)}')
            )
            self.stdout.write("   Por favor, configúralas en tu archivo .env")
            return False

        # Verificar conexión con S3
        if s3_service.is_configured():
            self.stdout.write("  ✅ Servicio S3 configurado correctamente")

            # Verificar acceso al bucket
            try:
                bucket_exists = s3_service.s3_client.head_bucket(
                    Bucket=s3_service.bucket_name
                )
                self.stdout.write(f'  ✅ Bucket "{s3_service.bucket_name}" accesible')
                return True
            except Exception as e:
                if "NoSuchBucket" in str(e):
                    self.stdout.write(
                        self.style.WARNING(
                            f'  ⚠️  Bucket "{s3_service.bucket_name}" no existe'
                        )
                    )
                    self.stdout.write("     Usa --create-bucket para crearlo")
                else:
                    self.stdout.write(
                        self.style.ERROR(f"  ❌ Error accediendo al bucket: {e}")
                    )
                return False
        else:
            self.stdout.write(self.style.ERROR("  ❌ Servicio S3 no configurado"))
            return False

    def create_s3_bucket(self):
        """Crea el bucket de S3"""
        self.stdout.write("\n🪣 Creando bucket de S3...")

        if not s3_service.is_configured():
            self.stdout.write(
                self.style.ERROR(
                    "❌ S3 no está configurado. Verifica las variables de entorno."
                )
            )
            return

        success = s3_service.create_bucket_if_not_exists()

        if success:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Bucket "{s3_service.bucket_name}" listo para usar'
                )
            )
            self.stdout.write(f"   Región: {s3_service.region}")
            self.stdout.write("   Características:")
            self.stdout.write("   • Versionado habilitado")
            self.stdout.write("   • Acceso privado por defecto")
            self.stdout.write("   • Encriptación AES256")
        else:
            self.stdout.write(self.style.ERROR("❌ Error creando el bucket"))
            self.stdout.write("   Verifica:")
            self.stdout.write("   • Credenciales AWS")
            self.stdout.write("   • Permisos IAM")
            self.stdout.write("   • Que el nombre del bucket esté disponible")

    def test_s3_operations(self):
        """Realiza pruebas de upload y download"""
        self.stdout.write("\n🧪 Realizando pruebas de S3...")

        if not s3_service.is_configured():
            self.stdout.write(self.style.ERROR("❌ S3 no está configurado"))
            return

        try:
            # Crear archivo de prueba
            test_content = b"Test file content for EvalTech S3 integration"
            test_filename = "test_file.txt"

            # Simular upload
            from io import BytesIO

            file_obj = BytesIO(test_content)

            self.stdout.write("  📤 Subiendo archivo de prueba...")
            upload_result = s3_service.upload_media_fragment(
                file_obj,
                participant_event_id=999999,  # ID de prueba
                media_type="test",
                timestamp=None,
            )

            if upload_result["success"]:
                self.stdout.write(f'  ✅ Upload exitoso: {upload_result["key"]}')

                # Verificar que el archivo existe
                self.stdout.write("  🔍 Verificando archivo en S3...")
                file_info = s3_service.get_media_fragment_info(upload_result["key"])

                if file_info:
                    self.stdout.write("  ✅ Archivo verificado en S3")
                    self.stdout.write(f'     Tamaño: {file_info["size"]} bytes')

                    # Generar URL pre-firmada
                    self.stdout.write("  🔗 Generando URL pre-firmada...")
                    presigned_url = s3_service.generate_presigned_url(
                        upload_result["key"]
                    )

                    if presigned_url:
                        self.stdout.write("  ✅ URL pre-firmada generada exitosamente")
                        # No mostrar la URL completa por seguridad
                        self.stdout.write(f"     URL: {presigned_url[:50]}...")
                    else:
                        self.stdout.write(
                            self.style.ERROR("  ❌ Error generando URL pre-firmada")
                        )

                    # Limpiar archivo de prueba
                    self.stdout.write("  🗑️  Eliminando archivo de prueba...")
                    delete_result = s3_service.delete_media_fragment(
                        upload_result["key"]
                    )

                    if delete_result["success"]:
                        self.stdout.write("  ✅ Archivo de prueba eliminado")
                    else:
                        self.stdout.write(
                            self.style.WARNING(
                                "  ⚠️  No se pudo eliminar el archivo de prueba"
                            )
                        )
                        self.stdout.write(f'     Key: {upload_result["key"]}')
                else:
                    self.stdout.write(
                        self.style.ERROR(
                            "  ❌ Archivo no encontrado después del upload"
                        )
                    )
            else:
                self.stdout.write(
                    self.style.ERROR(f'  ❌ Error en upload: {upload_result["error"]}')
                )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error durante las pruebas: {e}"))

    def migrate_local_files(self):
        """Migra archivos locales existentes a S3"""
        self.stdout.write("\n📦 Migrando archivos locales a S3...")

        if not s3_service.is_configured():
            self.stdout.write(self.style.ERROR("❌ S3 no está configurado"))
            return

        # Buscar logs con archivos locales
        local_logs = ParticipantLog.objects.filter(
            name__in=["audio/video", "screen"], url__isnull=False
        ).exclude(
            url__startswith="http"  # Excluir URLs que ya son de S3
        )

        if not local_logs.exists():
            self.stdout.write("  ℹ️  No se encontraron archivos locales para migrar")
            return

        total_logs = local_logs.count()
        self.stdout.write(f"  📊 Encontrados {total_logs} logs con archivos locales")

        # Confirmar migración
        confirm = input(
            "\n⚠️  ¿Estás seguro de que quieres migrar los archivos a S3? (y/N): "
        )
        if confirm.lower() != "y":
            self.stdout.write("  ❌ Migración cancelada")
            return

        migrated_count = 0
        error_count = 0

        for i, log in enumerate(local_logs, 1):
            self.stdout.write(
                f"  📤 Procesando {i}/{total_logs}: {log.name} (ID: {log.id})"
            )

            if not log.url:
                continue

            local_path = os.path.join(settings.MEDIA_ROOT, log.url)

            if not os.path.exists(local_path):
                self.stdout.write(
                    self.style.WARNING(f"     ⚠️  Archivo no encontrado: {local_path}")
                )
                error_count += 1
                continue

            try:
                with open(local_path, "rb") as f:
                    # Determinar tipo de media
                    media_type = "video" if "video" in log.name else "screen"

                    upload_result = s3_service.upload_media_fragment(
                        f,
                        log.participant_event.id,
                        media_type=media_type,
                        timestamp=log.timestamp,
                    )

                    if upload_result["success"]:
                        # Actualizar log con nueva key (campo url guarda la key)
                        old_url = log.url
                        log.url = upload_result["key"]
                        log.message += f' - Migrated from local: {old_url} to S3: {upload_result["key"]}'
                        log.save()

                        migrated_count += 1
                        self.stdout.write(f'     ✅ Migrado: {upload_result["key"]}')

                        # Opcional: Eliminar archivo local (descomentado por seguridad)
                        # os.remove(local_path)

                    else:
                        self.stdout.write(
                            self.style.ERROR(
                                f'     ❌ Error en upload: {upload_result["error"]}'
                            )
                        )
                        error_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"     ❌ Error procesando archivo: {e}")
                )
                error_count += 1

        self.stdout.write(f"\n📊 Resumen de migración:")
        self.stdout.write(f"  ✅ Archivos migrados: {migrated_count}")
        self.stdout.write(f"  ❌ Errores: {error_count}")

        if error_count == 0:
            self.stdout.write(
                self.style.SUCCESS("🎉 Migración completada exitosamente")
            )
        else:
            self.stdout.write(
                self.style.WARNING("⚠️  Migración completada con algunos errores")
            )
