FROM python:3.10.9-slim

# Configurar apt para reintentos automáticos
RUN echo 'Acquire::Retries "3";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "30";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::ftp::Timeout "30";' >> /etc/apt/apt.conf.d/80-retries

# Actualizar repositorios
RUN apt-get update

# Instalar dependencias básicas primero (se cachean separado)
RUN apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1

# Instalar ffmpeg por separado (puede fallar temporalmente por red)
RUN apt-get install -y --no-install-recommends ffmpeg || \
    (apt-get update && apt-get install -y --no-install-recommends ffmpeg)

# Limpiar archivos temporales
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
 
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
 
WORKDIR /app
 
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
 
COPY . /app/
 
EXPOSE 8000
 
CMD ["gunicorn", "administradormonitoreo.wsgi:application", "--bind", "0.0.0.0:8000"]