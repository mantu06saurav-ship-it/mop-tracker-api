import uuid
from pathlib import Path

import jwt
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user
from app.core.constants import ADMIN_ROLES, AVATAR_MAX_BYTES, AVATAR_MIME_EXT, USER_ROLES
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_conn
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])

AVATAR_DIR = Path(__file__).resolve().parents[3] / "uploads" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

_USER_COLUMNS = (
    "UserId, EmployeeCode, FirstName, LastName, Email, PhoneNumber, Role, Designation, "
    "Department, ReportingManagerId, ProfileImageUrl, IsEmailVerified, IsActive, IsDeleted, "
    "LastLogin, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy"
)


def _fetch_public_user(conn, user_id: int) -> dict | None:
    row = conn.execute(
        text(f"SELECT {_USER_COLUMNS} FROM dbo.Users WHERE UserId = :id"), {"id": user_id}
    ).fetchone()
    return dict(row._mapping) if row else None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, authorization: str | None = Header(default=None)):
    with get_conn() as conn:
        is_bootstrap = conn.execute(text("SELECT COUNT(*) AS c FROM dbo.Users")).fetchone().c == 0

    current = None
    if not is_bootstrap:
        # Every registration after the first user requires a Super Admin bearer token.
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
        try:
            payload = decode_access_token(authorization.split(" ", 1)[1])
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        if payload.get("role") not in ADMIN_ROLES:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin role required")
        current = {"email": payload.get("email")}

    return _register_impl(body, current)


def _register_impl(body: RegisterRequest, current: dict | None = None) -> dict:
    with get_conn() as conn:
        count = conn.execute(text("SELECT COUNT(*) AS c FROM dbo.Users")).fetchone().c
        is_bootstrap = count == 0
        role = "Super Admin" if is_bootstrap else body.role
        if not is_bootstrap and role not in USER_ROLES:
            raise HTTPException(status_code=400, detail=f"role must be one of {USER_ROLES}")

        try:
            result = conn.execute(
                text(
                    """
                    INSERT INTO dbo.Users
                        (EmployeeCode, FirstName, LastName, Email, PhoneNumber, PasswordHash,
                         Role, Designation, Department, ReportingManagerId, CreatedBy)
                    OUTPUT INSERTED.UserId
                    VALUES
                        (:employee_code, :first_name, :last_name, :email, :phone, :password_hash,
                         :role, :designation, :department, :reporting_manager_id, :created_by)
                    """
                ),
                {
                    "employee_code": body.employeeCode,
                    "first_name": body.firstName,
                    "last_name": body.lastName,
                    "email": str(body.email),
                    "phone": body.phoneNumber,
                    "password_hash": hash_password(body.password),
                    "role": role,
                    "designation": body.designation,
                    "department": body.department,
                    "reporting_manager_id": body.reportingManagerId,
                    "created_by": current["email"] if current else None,
                },
            )
            new_id = result.fetchone().UserId
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Employee code or email already exists")

        return {"user": _fetch_public_user(conn, new_id)}


@router.post("/login")
def login(body: LoginRequest):
    with get_conn() as conn:
        row = conn.execute(
            text("SELECT * FROM dbo.Users WHERE Email = :email AND IsDeleted = 0"),
            {"email": str(body.email)},
        ).fetchone()
        if row is None or not verify_password(body.password, row.PasswordHash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not row.IsActive:
            raise HTTPException(status_code=403, detail="Account is deactivated")

        conn.execute(text("UPDATE dbo.Users SET LastLogin = GETDATE() WHERE UserId = :id"), {"id": row.UserId})
        token = create_access_token(row.UserId, row.Email, row.Role)
        return {"token": token, "user": _fetch_public_user(conn, row.UserId)}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        public_user = _fetch_public_user(conn, user["userId"])
    if public_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": public_user}


@router.put("/password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute(text("SELECT PasswordHash FROM dbo.Users WHERE UserId = :id"), {"id": user["userId"]}).fetchone()
        if row is None or not verify_password(body.currentPassword, row.PasswordHash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        conn.execute(
            text("UPDATE dbo.Users SET PasswordHash = :hash, UpdatedAt = GETDATE() WHERE UserId = :id"),
            {"hash": hash_password(body.newPassword), "id": user["userId"]},
        )
    return {"ok": True}


@router.post("/avatar")
def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if file.content_type not in AVATAR_MIME_EXT:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    content = file.file.read()
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Avatar must be 3MB or smaller")

    ext = AVATAR_MIME_EXT[file.content_type]
    filename = f"user-{user['userId']}-{uuid.uuid4().hex}.{ext}"
    dest = AVATAR_DIR / filename
    with open(dest, "wb") as f:
        f.write(content)

    with get_conn() as conn:
        old = conn.execute(text("SELECT ProfileImageUrl FROM dbo.Users WHERE UserId = :id"), {"id": user["userId"]}).fetchone()
        conn.execute(
            text("UPDATE dbo.Users SET ProfileImageUrl = :url, UpdatedAt = GETDATE() WHERE UserId = :id"),
            {"url": f"/uploads/avatars/{filename}", "id": user["userId"]},
        )
        public_user = _fetch_public_user(conn, user["userId"])

    if old and old.ProfileImageUrl and "/uploads/avatars/" in old.ProfileImageUrl:
        old_path = AVATAR_DIR / Path(old.ProfileImageUrl).name
        old_path.unlink(missing_ok=True)

    return {"user": public_user}
