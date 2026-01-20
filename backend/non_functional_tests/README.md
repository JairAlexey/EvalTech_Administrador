## Comandos para ejecutar test no funcionales

set REDIS_URL=xxx

Test estabilidad de procesamiento async
python non_functional_tests/observe_async_processing_stability.py --video RUTA_O_S3 --count 2 --poll-seconds 10 --timeout-seconds 1800 --evaluator-email pablobarrios@iqlatam.com --evaluator-password admin123 --base-url https://backend-production-b180.up.railway.app --env-file non_functional_tests/.env

Test reporte de tiempo de procesamiento
python non_functional_tests/observe_processing_time_report.py --video RUTA_O_S3 --poll-seconds 10 --timeout-seconds 3600 --evaluator-email pablobarrios@iqlatam.com --evaluator-password admin123 --base-url https://backend-production-b180.up.railway.app --env-file non_functional_tests/.env

Test control de acceso JWT
python non_functional_tests/observe_jwt_access_control.py --email superadmin@iqlatam.com --password admin123 --base-url https://backend-production-b180.up.railway.app

Test tiempo de respuesta backend
python non_functional_tests/observe_backend_response_time.py --base-url https://backend-production-b180.up.railway.app --path /events/api/events-status/pending-start/ --count 5 --timeout 30
