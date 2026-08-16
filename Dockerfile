FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app
COPY . .
RUN useradd --system --create-home appuser
USER appuser
EXPOSE 8080

CMD ["sh", "-c", "exec python3 server/app.py --host 0.0.0.0 --port ${PORT:-8080}"]
