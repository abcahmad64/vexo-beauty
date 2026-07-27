from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import json
import logging
import os
from pathlib import Path
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
LOGGER = logging.getLogger("vexo-reranker")

MODEL_PATH = Path(
    os.getenv(
        "RERANKER_MODEL_PATH",
        "/models/Qwen3-Reranker-0.6B",
    )
)
MODEL_NAME = os.getenv("RERANKER_MODEL_NAME", "Qwen3-Reranker-0.6B")
MAX_LENGTH = int(os.getenv("RERANKER_MAX_LENGTH", "2048"))
BATCH_SIZE = int(os.getenv("RERANKER_BATCH_SIZE", "4"))
TORCH_THREADS = int(os.getenv("RERANKER_TORCH_THREADS", "16"))
MAX_DOCUMENTS = int(os.getenv("RERANKER_MAX_DOCUMENTS", "64"))

DEFAULT_INSTRUCTION = (
    "Given a Persian ecommerce query, judge whether the document is directly "
    "relevant to the user's exact product need. Prefer exact model identity, "
    "approved facts, and intent fit over superficial keyword overlap."
)

PREFIX = (
    "<|im_start|>system\n"
    "Judge whether the Document meets the requirements based on the Query and "
    "the Instruct provided. Note that the answer can only be yes or no."
    "<|im_end|>\n<|im_start|>user\n"
)
SUFFIX = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"


class RerankDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=240)
    text: str = Field(min_length=1, max_length=16_000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RerankRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=4_000)
    documents: list[RerankDocument] = Field(min_length=1, max_length=64)
    top_n: int = Field(default=10, ge=1, le=64)
    instruction: str | None = Field(default=None, max_length=2_000)


class RerankerEngine:
    def __init__(self) -> None:
        self.tokenizer: Any | None = None
        self.model: Any | None = None
        self.true_token_id: int | None = None
        self.false_token_id: int | None = None
        self.loaded_at: float | None = None

    @property
    def loaded(self) -> bool:
        return (
            self.tokenizer is not None
            and self.model is not None
            and self.true_token_id is not None
            and self.false_token_id is not None
        )

    def load(self) -> None:
        if not MODEL_PATH.is_dir():
            raise RuntimeError(f"Reranker model directory is missing: {MODEL_PATH}")

        score_config_path = MODEL_PATH / "1_LogitScore" / "config.json"

        if not score_config_path.is_file():
            raise RuntimeError(
                f"Reranker score config is missing: {score_config_path}"
            )

        score_config = json.loads(score_config_path.read_text(encoding="utf-8"))
        self.true_token_id = int(score_config["true_token_id"])
        self.false_token_id = int(score_config["false_token_id"])

        torch.set_num_threads(max(1, TORCH_THREADS))
        torch.set_num_interop_threads(1)

        LOGGER.info("Loading reranker model from %s", MODEL_PATH)

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_PATH,
            local_files_only=True,
            padding_side="left",
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            local_files_only=True,
            torch_dtype=torch.float32,
        )
        self.model.to("cpu")
        self.model.eval()
        self.loaded_at = time.time()

        LOGGER.info("Reranker model loaded successfully")

    def rerank(self, request: RerankRequest) -> list[dict[str, Any]]:
        if not self.loaded:
            raise RuntimeError("Reranker model is not loaded")

        assert self.tokenizer is not None
        assert self.model is not None
        assert self.true_token_id is not None
        assert self.false_token_id is not None

        instruction = (request.instruction or DEFAULT_INSTRUCTION).strip()
        documents = request.documents[:MAX_DOCUMENTS]
        scores: list[float] = []

        for start in range(0, len(documents), max(1, BATCH_SIZE)):
            batch = documents[start : start + max(1, BATCH_SIZE)]
            prompts = [
                self._format_prompt(
                    instruction=instruction,
                    query=request.query,
                    document=document.text,
                )
                for document in batch
            ]

            encoded = self.tokenizer(
                prompts,
                padding=True,
                truncation=True,
                max_length=MAX_LENGTH,
                return_tensors="pt",
            )

            with torch.inference_mode():
                logits = self.model(**encoded, use_cache=False).logits[:, -1, :]
                binary_logits = torch.stack(
                    [
                        logits[:, self.false_token_id],
                        logits[:, self.true_token_id],
                    ],
                    dim=1,
                )
                probabilities = torch.softmax(binary_logits, dim=1)[:, 1]

            scores.extend(float(value) for value in probabilities.cpu().tolist())

        ranked = [
            {
                "id": document.id,
                "index": index,
                "score": scores[index],
                "metadata": document.metadata,
            }
            for index, document in enumerate(documents)
        ]
        ranked.sort(key=lambda item: item["score"], reverse=True)

        return ranked[: min(request.top_n, len(ranked))]

    @staticmethod
    def _format_prompt(
        *,
        instruction: str,
        query: str,
        document: str,
    ) -> str:
        user_content = (
            f"<Instruct>: {instruction}\n"
            f"<Query>: {query.strip()}\n"
            f"<Document>: {document.strip()}"
        )

        return f"{PREFIX}{user_content}{SUFFIX}"


ENGINE = RerankerEngine()
INFERENCE_SEMAPHORE = asyncio.Semaphore(1)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(ENGINE.load)
    yield


app = FastAPI(
    title="VEXO Qwen3 Reranker",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/health/liveness")
def liveness() -> dict[str, Any]:
    return {
        "status": "alive",
        "model_loaded": ENGINE.loaded,
    }


@app.get("/health/readiness")
def readiness() -> dict[str, Any]:
    if not ENGINE.loaded:
        raise HTTPException(status_code=503, detail="model_not_loaded")

    return {
        "status": "ready",
        "model_loaded": True,
        "model_name": MODEL_NAME,
        "model_path": str(MODEL_PATH),
        "max_length": MAX_LENGTH,
        "batch_size": BATCH_SIZE,
        "device": "cpu",
    }


@app.post("/v1/rerank")
async def rerank(request: RerankRequest) -> dict[str, Any]:
    if not ENGINE.loaded:
        raise HTTPException(status_code=503, detail="model_not_loaded")

    started_at = time.perf_counter()

    async with INFERENCE_SEMAPHORE:
        try:
            results = await asyncio.to_thread(ENGINE.rerank, request)
        except Exception as error:
            LOGGER.exception("Rerank inference failed")
            raise HTTPException(status_code=500, detail="inference_failed") from error

    return {
        "model": MODEL_NAME,
        "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
        "results": results,
    }
