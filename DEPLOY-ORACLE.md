# Deploy de GeoChallenge en un VPS (Oracle Cloud Always Free)

Esta guía levanta **todo el juego en una sola máquina**: backend, Postgres,
Redis y un reverse proxy con HTTPS automático. Sin free tiers que se duermen,
sin cuotas, sin cold start. Gratis para siempre con el "Always Free" de Oracle.

Sirve igual para cualquier VPS (Hetzner, etc.): salta a la sección 5.

```
Internet ──HTTPS──► Caddy ──► /            frontend (Vite estático)
                          └─► /api, /socket.io ──► backend (Node) ──► Postgres
                                                                  └─► Redis
```

---

## 1. Crear la cuenta y la máquina en Oracle Cloud

1. Crea la cuenta en <https://www.oracle.com/cloud/free/>. Pide una tarjeta
   **solo para verificar identidad**: mientras te quedes en recursos "Always
   Free" no se cobra nada.
2. En la consola: **Compute → Instances → Create Instance**.
3. Configura:
   - **Image:** Canonical Ubuntu 24.04 (o 22.04).
   - **Shape:** cambia a **Ampere / VM.Standard.A1.Flex** (ARM, Always Free).
     Asigna 2 OCPU y 12 GB de RAM (o hasta 4/24 si te deja).
   - Si sale "Out of capacity", prueba otra Availability Domain o región, o
     reintenta más tarde. Es el único punto frágil del free tier de Oracle.
   - **SSH keys:** sube tu llave pública (o deja que genere una y descárgala).
4. Crea la instancia y anota su **IP pública**.

> El stack corre en imágenes multi-arch, así que la VM ARM funciona sin cambios.

---

## 2. Abrir los puertos 80 y 443 (el paso que todos olvidan)

Oracle bloquea el tráfico en **dos capas**. Hay que abrir ambas o el HTTPS nunca
funcionará.

**Capa 1 — Security List de la red (consola web):**
1. **Networking → Virtual Cloud Networks →** tu VCN **→ Security Lists →**
   la default.
2. **Add Ingress Rules**, una por puerto:
   - Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80`
   - Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `443`

**Capa 2 — firewall del sistema operativo (por SSH dentro de la VM):**
```bash
ssh ubuntu@TU_IP_PUBLICA

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 3. Subdominio gratis con HTTPS (DuckDNS)

Caddy saca el certificado HTTPS solo, pero necesita un dominio que apunte a la VM.

1. Entra a <https://www.duckdns.org> con tu cuenta de Google/GitHub.
2. Crea un subdominio, por ejemplo `geochallenge`.
3. En el campo **current ip** pon la **IP pública de la VM** y guarda.
4. Tu dominio queda: `geochallenge.duckdns.org`.

(Si ya tienes un dominio propio, solo crea un registro `A` apuntando a la IP.)

---

## 4. Instalar Docker en la VM

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Cierra la sesión SSH y vuelve a entrar para que tome el grupo `docker`.
Verifica: `docker compose version`.

---

## 5. Clonar el repo y configurar

```bash
git clone https://github.com/felipeaurelio13/geochallenge.git
cd geochallenge

cp .env.example .env
nano .env
```

Rellena el `.env`:
- `DOMAIN` → tu dominio, sin `https://` (ej. `geochallenge.duckdns.org`).
- `POSTGRES_PASSWORD` → genera una: `openssl rand -hex 24`
- `JWT_SECRET` → genera uno: `openssl rand -hex 32`

---

## 6. Levantar el stack

```bash
docker compose up -d --build
```

La primera vez compila el backend y el frontend (unos minutos en ARM). Al
arrancar, el backend aplica las migraciones de Prisma solo. Caddy pide el
certificado HTTPS a Let's Encrypt automáticamente.

Comprueba que todo está arriba:
```bash
docker compose ps
docker compose logs -f caddy     # Ctrl+C para salir
```

---

## 7. Cargar los datos del juego (seed)

La base arranca vacía. Cárgala una vez:
```bash
docker compose exec backend node dist/seed.js
```

---

## 8. Verificar

```bash
curl https://TU_DOMINIO/health
```

Debe responder `{"status":"ok",...}`. Abre `https://TU_DOMINIO` en el navegador,
regístrate y comparte el link con tus amigos.

---

## 9. Actualizar a una versión nueva

Cuando hagas cambios y los subas a git:
```bash
cd geochallenge
git pull
docker compose up -d --build
```

Las migraciones de Prisma se aplican solas al rearrancar el backend.

---

## 10. Backups de la base de datos

Los datos viven en el volumen `postgres_data`. Un dump manual:
```bash
docker compose exec postgres pg_dump -U geochallenge geochallenge > backup-$(date +%F).sql
```

Para automatizarlo, agrega esa línea a un `crontab -e` diario.

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El sitio no carga por HTTPS | Puertos 80/443 cerrados | Revisa **ambas** capas de la sección 2 |
| Caddy no saca certificado | DNS no apunta a la VM aún | `dig TU_DOMINIO` debe devolver la IP; espera la propagación |
| `docker compose` permiso denegado | Falta el grupo `docker` | Re-loguea el SSH tras el `usermod` de la sección 4 |
| Backend reinicia en bucle | `.env` incompleto | `docker compose logs backend`; revisa `DOMAIN`/`JWT_SECRET`/`POSTGRES_PASSWORD` |
| "Out of capacity" al crear la VM | Demanda de ARM en la región | Otra Availability Domain/región, o reintentar |

Logs de cualquier servicio: `docker compose logs -f <postgres|redis|backend|caddy>`.
