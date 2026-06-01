"""Shared response envelope and pagination models."""
from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class DataResponse(BaseModel, Generic[T]):
    data: T


class PaginatedMeta(BaseModel):
    total: int
    page: int
    perPage: int
    pages: int


class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: PaginatedMeta
