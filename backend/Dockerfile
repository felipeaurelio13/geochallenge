# Backend GeoChallenge — Node + Express + Prisma + Socket.IO
# Build context = raíz del repo (necesita ./data para el seed y los catálogos).
# Imagen multi-arch: funciona en x86 y en ARM (Oracle Cloud Ampere).
FROM node:22-slim

WORKDIR /app

# Prisma necesita openssl en la imagen slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Dependencias primero (capa cacheable). prisma/ se copia antes de `npm ci`
# porque el postinstall corre `prisma generate` y necesita el schema.
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci

# Código del backend + datos de seed.
# data/ vive en la raíz del repo; el seed y los catálogos lo leen vía rutas
# relativas que resuelven a /data cuando el backend está en /app.
COPY backend/ ./
COPY data /data

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

# start:prod = `prisma migrate deploy && node dist/index.js`.
CMD ["npm", "run", "start:prod"]
