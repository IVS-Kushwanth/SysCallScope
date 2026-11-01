"""Pydantic request/response models."""
from typing import Optional
from pydantic import BaseModel, Field


class TraceRequest(BaseModel):
    program_id: Optional[str] = Field(None, description="ID of an approved sample program")
    executable: Optional[str] = Field(None, description="Executable name/path inside an approved location")
    args: list[str] = Field(default_factory=list)
    follow_forks: bool = True
    timeout: int = Field(15, ge=1, le=60)


class DemoRequest(BaseModel):
    scenario: str = "parent_child"
    replay: bool = False
    speed: float = Field(1.0, ge=0.25, le=5.0)
