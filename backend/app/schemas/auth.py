from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    employeeCode: str
    firstName: str
    lastName: Optional[str] = None
    email: EmailStr
    phoneNumber: Optional[str] = None
    password: str = Field(min_length=8)
    role: Optional[str] = None
    designation: str
    department: Optional[str] = None
    reportingManagerId: Optional[int] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8)


class UpdateUserRequest(BaseModel):
    firstName: str
    lastName: Optional[str] = None
    phoneNumber: Optional[str] = None
    role: str
    designation: str
    department: Optional[str] = None
    reportingManagerId: Optional[int] = None
    isActive: bool = True
