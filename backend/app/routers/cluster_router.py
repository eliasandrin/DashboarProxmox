"""
INFORMIX Spa — Cluster Router (Bonus — Lode)
Cluster awareness and live migration between nodes.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User, AuditLog
from app.main import get_proxmox
from app.schemas import ClusterResource, ClusterResourcesResponse, MigrateRequest, MigrateResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/resources", response_model=ClusterResourcesResponse)
async def get_cluster_resources(current_user: User = Depends(get_current_user)):
    """Get all cluster resources mapped across nodes."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        raw = pve.get_cluster_resources()
        resources = [ClusterResource(**{k: r.get(k) for k in ClusterResource.model_fields}) for r in raw]
        nodes = sum(1 for r in resources if r.type == "node")
        vms = sum(1 for r in resources if r.type == "qemu")
        cts = sum(1 for r in resources if r.type == "lxc")
        return ClusterResourcesResponse(resources=resources, node_count=nodes, vm_count=vms, ct_count=cts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/migrate", response_model=MigrateResponse)
async def migrate_vm(
    request: MigrateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Live migrate a VM to another node."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        result = pve.migrate_vm(request.source_node, request.vmid, request.target_node, request.online)
        audit = AuditLog(user_id=current_user.id, action="vm_migrate", target_type="vm",
                         target_id=f"{request.source_node}/{request.vmid}",
                         details=json.dumps({"target": request.target_node, "online": request.online}),
                         status=result.get("status","error"))
        db.add(audit)
        await db.commit()
        return MigrateResponse(status=result.get("status","error"), task_id=result.get("task_id"),
                               message=result.get("message","Unknown"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
