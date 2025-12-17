FROM python:3.10.9-slim
 
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
 
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
 
WORKDIR /app
 
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
 
COPY . /app/
 
EXPOSE 8000
 
CMD ["gunicorn", "administradormonitoreo.wsgi:application", "--bind", "0.0.0.0:8000"]