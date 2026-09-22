from typing import Optional

from pydantic import BaseModel, EmailStr


class SellerMappingRequest(BaseModel):
    seller: str
    portal: str
    subType: Optional[str] = None
    verticalHead: str
    kam: str


class EmailToggleRequest(BaseModel):
    emailActive: bool


class EmailSettingsRequest(BaseModel):
    mode: str  # "auto" | "manual"
    toEmails: list[str] = []
    ccEmails: list[str] = []
    sendTime: str  # "HH:MM"
    enabled: bool


class SendBelowMopReportRequest(BaseModel):
    to: EmailStr
