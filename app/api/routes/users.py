from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.api.deps import require_admin
from app.core.constants import USER_ROLES
from app.db.session import get_conn
from app.schemas.auth import UpdateUserRequest

router = APIRouter(prefix="/api/users", tags=["users"])

_LIST_COLUMNS = (
    "UserId, EmployeeCode, FirstName, LastName, Email, PhoneNumber, Role, Designation, "
    "Department, ReportingManagerId, ProfileImageUrl, IsActive, LastLogin, CreatedAt"
)


@router.get("")
def list_users(_: dict = Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            text(f"SELECT {_LIST_COLUMNS} FROM dbo.Users WHERE IsDeleted = 0 ORDER BY CreatedAt ASC")
        ).fetchall()
    return {"users": [dict(r._mapping) for r in rows]}


@router.put("/{user_id}")
def update_user(user_id: int, body: UpdateUserRequest, admin: dict = Depends(require_admin)):
    if body.role not in USER_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {USER_ROLES}")
    if body.reportingManagerId is not None and body.reportingManagerId == user_id:
        raise HTTPException(status_code=400, detail="A user cannot report to themselves")

    with get_conn() as conn:
        if body.role != "Super Admin":
            current_role = conn.execute(text("SELECT Role FROM dbo.Users WHERE UserId = :id"), {"id": user_id}).fetchone()
            if current_role and current_role.Role == "Super Admin":
                remaining = conn.execute(
                    text("SELECT COUNT(*) AS c FROM dbo.Users WHERE Role = 'Super Admin' AND IsDeleted = 0")
                ).fetchone().c
                if remaining <= 1:
                    raise HTTPException(status_code=400, detail="Cannot demote the last remaining Super Admin")

        result = conn.execute(
            text(
                """
                UPDATE dbo.Users SET
                    FirstName = :first_name, LastName = :last_name, PhoneNumber = :phone,
                    Role = :role, Designation = :designation, Department = :department,
                    ReportingManagerId = :reporting_manager_id, IsActive = :is_active,
                    UpdatedAt = GETDATE(), UpdatedBy = :updated_by
                WHERE UserId = :id AND IsDeleted = 0
                """
            ),
            {
                "first_name": body.firstName,
                "last_name": body.lastName,
                "phone": body.phoneNumber,
                "role": body.role,
                "designation": body.designation,
                "department": body.department,
                "reporting_manager_id": body.reportingManagerId,
                "is_active": body.isActive,
                "updated_by": admin["email"],
                "id": user_id,
            },
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")

        row = conn.execute(text(f"SELECT {_LIST_COLUMNS} FROM dbo.Users WHERE UserId = :id"), {"id": user_id}).fetchone()

    return {"user": dict(row._mapping)}
