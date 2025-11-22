"""
Pydantic models for structured drug interaction output.
"""

from typing import List, Optional
from pydantic import BaseModel


class DrugReference(BaseModel):
    name: str
    link: Optional[str]  # URL to PubChem, DrugBank, etc.


class DrugConversion(BaseModel):
    original: str
    converted: str
    reference: Optional[DrugReference]


class DrugInteraction(BaseModel):
    drug1: str
    drug2: str
    status: str  # "An Toàn", "Có Tương Tác"
    details: str
    reference1: Optional[DrugReference]
    reference2: Optional[DrugReference]


class Summary(BaseModel):
    overall_risk: str
    major_interactions: List[str]
    recommendations: List[str]


class DrugInteractionResult(BaseModel):
    step: int
    title: str
    drug_conversion: List[DrugConversion]
    interactions: List[DrugInteraction]
    summary: Summary
