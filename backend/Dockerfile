FROM python:3.10.9-slim

ENV PYTHONDONTWRITEBYTECODE='1'
ENV PYTHONUNBUFFERED='1'

ENV GUNICORN_CMD_ARGS="--timeout 10800 \
    --bind 0.0.0.0:8000 \
    --worker-connections 512 \
    --limit-request-line 0 \
    --limit-request-field_size 0 \
    --worker-class gthread \
    --threads 16 \
    --access-logfile - \
    --error-logfile -"

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . /app/

RUN apt-get update && apt-get install -y supervisor

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]