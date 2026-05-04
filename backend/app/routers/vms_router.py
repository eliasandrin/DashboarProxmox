"""
INFORMIX Spa — Virtual Machines & Containers Router
CRUD operations and power management for QEMU VMs and LXC containers.
"""

import json
import logging
import os
import shutil
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User, AuditLog
from app.main import get_proxmox
from app.schemas import (
    VMInfo,
    VMListResponse,
    PowerActionResponse,
    CreateVmRequest,
    CreateVmResponse,
    IsoUploadResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _normalize_vm(vm: dict, node: str, vm_type: str) -> VMInfo:
    """Normalize raw VM/CT data for frontend consumption."""
    maxmem = vm.get("maxmem", 1)
    mem = vm.get("mem", 0)
    is_running = vm.get("status", "stopped") == "running"

    return VMInfo(
        vmid=vm.get("vmid", 0),
        name=vm.get("name", f"vm-{vm.get('vmid', 0)}"),
        status=vm.get("status", "unknown"),
        type=vm_type,
        node=vm.get("node", node),
        cpu=round(vm.get("cpu", 0) * 100, 1) if is_running else 0,
        mem=mem,
        maxmem=maxmem,
        disk=vm.get("disk", 0),
        maxdisk=vm.get("maxdisk", 0),
        uptime=vm.get("uptime", 0),
        netin=vm.get("netin", 0),
        netout=vm.get("netout", 0),
        tags=vm.get("tags", None),
    )


@router.get("/nodes/{node}/vms", response_model=VMListResponse)
async def list_vms(node: str, current_user: User = Depends(get_current_user)):
    """
    List all QEMU virtual machines on a node.
    Maps to: GET /api2/json/nodes/{node}/qemu
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        raw_vms = pve.get_vms(node)
        vms = [_normalize_vm(vm, node, "qemu") for vm in raw_vms]
        return VMListResponse(vms=vms, total=len(vms), node=node)
    except Exception as e:
        logger.error(f"Error listing VMs for node {node}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node}/containers", response_model=VMListResponse)
async def list_containers(node: str, current_user: User = Depends(get_current_user)):
    """
    List all LXC containers on a node.
    Maps to: GET /api2/json/nodes/{node}/lxc
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        raw_cts = pve.get_containers(node)
        cts = [_normalize_vm(ct, node, "lxc") for ct in raw_cts]
        return VMListResponse(vms=cts, total=len(cts), node=node)
    except Exception as e:
        logger.error(f"Error listing containers for node {node}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vms/all", response_model=VMListResponse)
async def list_all_vms(current_user: User = Depends(get_current_user)):
    """List all VMs and containers across all nodes."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        all_vms = []
        nodes = pve.get_nodes()
        for n in nodes:
            node_name = n.get("node", "")
            raw_vms = pve.get_vms(node_name)
            raw_cts = pve.get_containers(node_name)
            all_vms.extend([_normalize_vm(vm, node_name, "qemu") for vm in raw_vms])
            all_vms.extend([_normalize_vm(ct, node_name, "lxc") for ct in raw_cts])
        return VMListResponse(vms=all_vms, total=len(all_vms))
    except Exception as e:
        logger.error(f"Error listing all VMs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/{node}/vms/{vmid}/status/{action}", response_model=PowerActionResponse)
async def vm_power_action(
    node: str, vmid: int, action: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a power action on a QEMU VM.
    Valid actions: start, stop, shutdown, reboot, suspend, resume
    Maps to: POST /api2/json/nodes/{node}/qemu/{vmid}/status/{action}
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    valid_actions = ["start", "stop", "shutdown", "reboot", "suspend", "resume"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")

    try:
        result = pve.vm_action(node, vmid, action, vm_type="qemu")

        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            action=f"vm_{action}",
            target_type="vm",
            target_id=f"{node}/{vmid}",
            details=json.dumps({"task_id": result.get("task_id")}),
            status="success",
        )
        db.add(audit)
        await db.commit()

        action_labels = {
            "start": "started", "stop": "force stopped", "shutdown": "gracefully shut down",
            "reboot": "rebooted", "suspend": "suspended", "resume": "resumed",
        }

        return PowerActionResponse(
            vmid=vmid,
            action=action,
            status="ok",
            task_id=result.get("task_id"),
            message=f"VM {vmid} has been {action_labels.get(action, action)}",
        )
    except Exception as e:
        # Log failed action
        audit = AuditLog(
            user_id=current_user.id,
            action=f"vm_{action}",
            target_type="vm",
            target_id=f"{node}/{vmid}",
            details=json.dumps({"error": str(e)}),
            status="error",
        )
        db.add(audit)
        await db.commit()

        logger.error(f"Power action {action} failed on VM {vmid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/{node}/containers/{vmid}/status/{action}", response_model=PowerActionResponse)
async def container_power_action(
    node: str, vmid: int, action: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a power action on an LXC container.
    Maps to: POST /api2/json/nodes/{node}/lxc/{vmid}/status/{action}
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    valid_actions = ["start", "stop", "shutdown", "reboot"]
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action for containers. Must be one of: {valid_actions}")

    try:
        result = pve.vm_action(node, vmid, action, vm_type="lxc")

        audit = AuditLog(
            user_id=current_user.id,
            action=f"ct_{action}",
            target_type="ct",
            target_id=f"{node}/{vmid}",
            details=json.dumps({"task_id": result.get("task_id")}),
            status="success",
        )
        db.add(audit)
        await db.commit()

        return PowerActionResponse(
            vmid=vmid,
            action=action,
            status="ok",
            task_id=result.get("task_id"),
            message=f"Container {vmid} {action} command executed",
        )
    except Exception as e:
        logger.error(f"Power action {action} failed on CT {vmid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/{node}/iso/upload", response_model=IsoUploadResponse)
async def upload_iso(
    node: str,
    storage: str = "local",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an ISO file to Proxmox storage."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    filename = os.path.basename(file.filename or "")
    if not filename.lower().endswith(".iso"):
        raise HTTPException(status_code=400, detail="Only .iso files are supported")

    temp_dir = tempfile.mkdtemp(prefix="informix-iso-")
    temp_path = os.path.join(temp_dir, filename)
    try:
        with open(temp_path, "wb") as out_file:
            shutil.copyfileobj(file.file, out_file)
        result = pve.upload_iso(node, storage, temp_path, filename)
        return IsoUploadResponse(
            status="ok",
            iso_file=result.get("iso_file", filename),
            storage=storage,
            message="ISO uploaded successfully",
        )
    except Exception as e:
        logger.error(f"ISO upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


@router.post("/nodes/{node}/provision", response_model=CreateVmResponse)
async def create_vm_or_ct(
    node: str,
    request: CreateVmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a VM or CT on a node."""
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        if request.vm_type == "qemu":
            payload = {
                "vmid": request.vmid,
                "name": request.name,
                "cores": request.cores,
                "memory": request.memory_mb,
                "scsihw": "virtio-scsi-pci",
                "scsi0": f"{request.disk_storage}:{request.disk_gb}",
                "net0": f"virtio,bridge={request.network_bridge}",
            }
            if request.description:
                payload["description"] = request.description
            if request.iso_file:
                storage = request.iso_storage or "local"
                payload["ide2"] = f"{storage}:iso/{request.iso_file},media=cdrom"

            result = pve.create_vm(node, payload)
            action = "vm_create"
            target_type = "vm"
            target_name = request.name
        else:
            if not request.ct_template:
                raise HTTPException(status_code=400, detail="CT template is required for LXC creation")
            payload = {
                "vmid": request.vmid,
                "hostname": request.name,
                "cores": request.cores,
                "memory": request.memory_mb,
                "rootfs": f"{request.disk_storage}:{request.disk_gb}",
                "net0": f"name=eth0,bridge={request.network_bridge},ip=dhcp",
                "ostemplate": request.ct_template,
            }
            if request.description:
                payload["description"] = request.description

            result = pve.create_ct(node, payload)
            action = "ct_create"
            target_type = "ct"
            target_name = request.name

        audit = AuditLog(
            user_id=current_user.id,
            action=action,
            target_type=target_type,
            target_id=f"{node}/{request.vmid}",
            target_name=target_name,
            details=json.dumps({"node": node, "vmid": request.vmid}),
            status=result.get("status", "error"),
        )
        db.add(audit)
        await db.commit()

        return CreateVmResponse(
            status=result.get("status", "ok"),
            vmid=request.vmid,
            task_id=result.get("task_id"),
            message=f"{request.vm_type.upper()} creation task submitted for {request.name}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create {request.vm_type} failed on node {node}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
