## Comandos para ejecutar test no funcionales

Test preparacion de sistema
python system_tests/prepare_system_test.py --superadmin-email superadmin@iqlatam.com --superadmin-password admin123

Test obtener event keys
python system_tests/get_event_keys.py --superadmin-email superadmin@iqlatam.com --superadmin-password admin123 --event-id EVENT_ID

Test verificar sistema
python system_tests/verify_system_test.py --superadmin-email superadmin@iqlatam.com --superadmin-password admin123