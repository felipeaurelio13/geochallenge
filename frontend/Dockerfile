# Frontend GeoChallenge — build estático con Vite.
# Build context = raíz del repo: frontend/src/data/monuments.ts importa
# ../../../data/monuments.json, así que el build necesita ./data del repo.
# El resultado (/app/dist) lo copia docker-compose a un volumen que sirve Caddy.
# Imagen multi-arch: funciona en x86 y en ARM (Oracle Cloud Ampere).
FROM node:22-slim

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

# Código del frontend + datos. data/ vive en la raíz del repo; el import
# ../../../data/monuments.json resuelve a /data cuando el frontend está en /app.
COPY frontend/ ./
COPY data /data

# Inyectadas en build-time por docker-compose (ver docker-compose.yml + .env).
# VITE_API_URL relativo => mismo origen vía Caddy, sin CORS.
# VITE_SOCKET_URL debe ser absoluto: el cliente Socket.IO no acepta cadena vacía.
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build
