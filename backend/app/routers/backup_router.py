"""
INFORMIX Spa — Backup & Snapshot Router
Snapshot management and PBS backup integration with resilience handling.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, AuditLog
from app.main import get_proxmox
from app.schemas import (
    SnapshotInfo, SnapshotListResponse, CreateSnapshotRequest,
    BackupRequest, BackupInfo, BackupResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/storages")
async def list_storages(current_user: User = Depends(get_current_user)):
    """List available storages for backups."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        storages = pve.get_storages(backup_only=True)
        default_storage = None
        if storages:
            names = [s.get("storage") or s.get("name") for s in storages]
            if names and settings.BACKUP_STORAGE_DEFAULT in names:
                default_storage = settings.BACKUP_STORAGE_DEFAULT
            else:
                default_storage = names[0]
        return {"storages": storages, "default_storage": default_storage}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node}/vms/{vmid}/snapshots", response_model=SnapshotListResponse)
async def list_snapshots(
    node: str, vmid: int,
    vm_type: str = Query("qemu"),
    current_user: User = Depends(get_current_user),
):
    """List all snapshots for a VM/CT."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        raw = pve.get_snapshots(node, vmid, vm_type)
        snaps = [SnapshotInfo(name=s.get("name",""), description=s.get("description",""),
                 snaptime=s.get("snaptime"), vmstate=bool(s.get("vmstate",False)),
                 parent=s.get("parent")) for s in raw]
        return SnapshotListResponse(snapshots=snaps, vmid=vmid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/{node}/vms/{vmid}/snapshots", response_model=BackupResponse)
async def create_snapshot(
    node: str, vmid: int, request: CreateSnapshotRequest,
    vm_type: str = Query("qemu"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a snapshot for a VM/CT."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        result = pve.create_snapshot(node, vmid, request.name, request.description or "", request.include_ram, vm_type)
        audit = AuditLog(user_id=current_user.id, action="snapshot_create", target_type="vm",
                         target_id=f"{node}/{vmid}", target_name=request.name, status="success")
        db.add(audit)
        await db.commit()
        return BackupResponse(status="ok", task_id=result.get("task_id"),
                              message=f"Snapshot '{request.name}' created for VM {vmid}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/{node}/vms/{vmid}/backup", response_model=BackupResponse)
async def create_backup(
    node: str, vmid: int,
    request: BackupRequest = BackupRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Start backup to storage. RESILIENCE: returns warning if storage is unreachable.
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    result = pve.create_backup(node, vmid, request.storage, request.mode, request.compress, request.notes)
    audit = AuditLog(user_id=current_user.id, action="backup_create", target_type="vm",
                     target_id=f"{node}/{vmid}", status=result.get("status","error"),
                     details=json.dumps({"storage": request.storage, "task_id": result.get("task_id")}))
    db.add(audit)
    await db.commit()
    return BackupResponse(status=result.get("status","error"), task_id=result.get("task_id"),
                          message=result.get("message","Unknown"))


@router.get("/storage/{storage}/content")
async def list_backups(storage: str = settings.BACKUP_STORAGE_DEFAULT, vmid: int = None,
                       current_user: User = Depends(get_current_user)):
    """List backups on storage (PBS)."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        raw = pve.get_backups(storage, vmid)
        backups = [BackupInfo(volid=b.get("volid",""), ctime=b.get("ctime",0), size=b.get("size",0),
                   format=b.get("format","unknown"), notes=b.get("notes"), vmid=b.get("vmid")) for b in raw]
        return {"backups": backups, "total": len(backups), "storage": storage}
    except Exception as e:
        return {"backups": [], "total": 0, "storage": storage, "warning": "Storage temporarily unavailable"}


@router.get("/nodes/{node}/tasks/{upid}/status")
async def get_task_status(
    node: str,
    upid: str,
    current_user: User = Depends(get_current_user),
):
    """Get Proxmox task status by UPID."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        return pve.get_task_status(node, upid)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node}/tasks/{upid}/log")
async def get_task_log(
    node: str,
    upid: str,
    start: int = 0,
    limit: int = 200,
    current_user: User = Depends(get_current_user),
):
    """Get Proxmox task log lines by UPID."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox not available")
    try:
        return {"logs": pve.get_task_log(node, upid, start=start, limit=limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
