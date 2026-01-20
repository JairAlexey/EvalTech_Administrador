## Comandos para ejecutar test unitarios

python -m coverage run --source=authentication,events,proxy,behavior_analysis --omit="*/.venv/*,*/site-packages/*,*/migrations/*,*/tests/*,*/settings*.py,*/manage.py,*/__init__.py" manage.py test authentication events proxy behavior_analysis --settings=administradormonitoreo.settings_test --buffer

python -m coverage report -m