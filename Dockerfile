# ---------------------------------------------------------------------------
# NNM - single image serving both the API and the web UI on one port.
#
#   docker build -t nnm .
#   docker run -p 8000:8000 -v nnm-data:/data nnm
#
# Stage 1 builds the React app; stage 2 runs FastAPI and serves that build,
# so there is one process, one port and no CORS to configure.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin: the browser calls /api on whatever host serves the page.
ENV VITE_API_BASE_URL=/api
RUN npm run build


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first so code changes do not invalidate the layer.
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "psycopg[binary]==3.2.3" gunicorn==23.0.0

COPY backend/ ./
COPY --from=frontend /build/dist ./frontend_dist

# /data is the only writable state: the SQLite file and uploaded artifacts.
# Mount a volume there, or point NNM_DATABASE_URL at PostgreSQL instead.
ENV NNM_FRONTEND_DIST_DIR=/app/frontend_dist \
    NNM_STORAGE_DIR=/data/activity_logs \
    NNM_DATABASE_URL=sqlite:////data/nnm.db \
    NNM_ENVIRONMENT=production \
    NNM_DEBUG=false

RUN mkdir -p /data/activity_logs \
    && useradd --create-home --uid 10001 nnm \
    && chown -R nnm:nnm /app /data
USER nnm

VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health').read()"

# A single worker keeps SQLite safe. Raise --workers once you move to
# PostgreSQL and shared storage.
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "1", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-"]
