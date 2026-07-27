FROM docker.arvancloud.ir/python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN python -m pip install --upgrade pip setuptools wheel \
    && python -m pip install \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.7.1 \
    && rm -rf /root/.cache/pip

COPY requirements.txt ./
RUN python -m pip install -r requirements.txt \
    && rm -rf /root/.cache/pip

COPY app.py ./app.py

RUN useradd --system --uid 1001 --create-home reranker \
    && chown -R reranker:reranker /app

USER reranker

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
