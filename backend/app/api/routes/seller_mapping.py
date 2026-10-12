from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.api.deps import require_admin
from app.db.session import get_conn
from app.schemas.misc import EmailToggleRequest, SellerMappingRequest

router = APIRouter(prefix="/api/seller-mapping", tags=["seller-mapping"])


@router.get("")
def list_seller_mapping():
    with get_conn() as conn:
        rows = conn.execute(
            text(
                "SELECT id, seller, portal, sub_type, vertical_head, kam, email_active, created_at, updated_at "
                "FROM dbo.seller_mapping ORDER BY vertical_head, kam, seller, portal"
            )
        ).fetchall()
    return {"rows": [dict(r._mapping) for r in rows]}


@router.post("", status_code=201)
def create_seller_mapping(body: SellerMappingRequest, _: dict = Depends(require_admin)):
    with get_conn() as conn:
        try:
            result = conn.execute(
                text(
                    """
                    INSERT INTO dbo.seller_mapping (seller, portal, sub_type, vertical_head, kam)
                    OUTPUT INSERTED.id
                    VALUES (:seller, :portal, :sub_type, :vertical_head, :kam)
                    """
                ),
                {
                    "seller": body.seller,
                    "portal": body.portal.lower(),
                    "sub_type": body.subType,
                    "vertical_head": body.verticalHead,
                    "kam": body.kam,
                },
            )
            new_id = result.fetchone().id
        except IntegrityError:
            raise HTTPException(status_code=409, detail="A mapping for this seller + portal already exists")
    return {"id": new_id}


@router.put("/{mapping_id}")
def update_seller_mapping(mapping_id: int, body: SellerMappingRequest, _: dict = Depends(require_admin)):
    with get_conn() as conn:
        result = conn.execute(
            text(
                """
                UPDATE dbo.seller_mapping SET
                    seller = :seller, portal = :portal, sub_type = :sub_type,
                    vertical_head = :vertical_head, kam = :kam, updated_at = GETDATE()
                WHERE id = :id
                """
            ),
            {
                "seller": body.seller,
                "portal": body.portal.lower(),
                "sub_type": body.subType,
                "vertical_head": body.verticalHead,
                "kam": body.kam,
                "id": mapping_id,
            },
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Mapping not found")
    return {"ok": True}


@router.delete("/{mapping_id}")
def delete_seller_mapping(mapping_id: int, _: dict = Depends(require_admin)):
    with get_conn() as conn:
        result = conn.execute(text("DELETE FROM dbo.seller_mapping WHERE id = :id"), {"id": mapping_id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Mapping not found")
    return {"ok": True}


@router.put("/{mapping_id}/email-toggle")
def toggle_email_active(mapping_id: int, body: EmailToggleRequest, _: dict = Depends(require_admin)):
    with get_conn() as conn:
        result = conn.execute(
            text("UPDATE dbo.seller_mapping SET email_active = :active, updated_at = GETDATE() WHERE id = :id"),
            {"active": body.emailActive, "id": mapping_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Mapping not found")
    return {"ok": True}
