# 🧩 Administrador de Aplicación de Monitoreo

Este proyecto forma parte de un sistema de monitoreo virtual con detección automatizada de comportamientos en procesos de evaluación técnica.

El **Administrador** permite gestionar usuarios, registros, logs, reportes y configuraciones del sistema de monitoreo remoto.

## 🚀 Tecnologías principales

- **Backend:** Django (Python)
- **Frontend:** Electron + React (TypeScript)
- **Proxy:** Python (requests / sockets)
- **Base de datos:** PostgreSQL / SQLite (según entorno)
- **Contenedores:** Docker Compose
- **Infraestructura:** Raspberry Pi 5 + Ubuntu Server

## 🧱 Estructura del proyecto

```
AdministradorAplicacionDeMonitoreo/
├── backend/    # Aplicación Django (panel de administración)
├── frontend/   # Aplicación Electron/React (interfaz de escritorio) 
├── proxy/      # Servidor Python intermedio (recolector de datos)
├── docs/       # Documentación técnica y diagramas
├── .github/    # Workflows y guías de contribución
├── .gitignore
├── README.md
└── requirements.txt
```
