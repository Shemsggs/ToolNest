FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
RUN adduser --disabled-password --gecos '' worker
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .
USER worker
CMD ["python","-m","app.worker"]
