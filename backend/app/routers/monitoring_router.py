"""
INFORMIX Spa — Monitoring Router
Real-time resource monitoring with RRD data from Proxmox.
Data normalization: memory in bytes, CPU as decimal percentage (0.5 = 50%).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.models import User
from app.main import get_proxmox
from app.schemas import RRDDataPoint, MonitoringResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/nodes/{node}/rrddata", response_model=MonitoringResponse)
async def get_node_rrddata(
    node: str,
    timeframe: str = Query("hour", regex="^(hour|day|week|month|year)$"),
    current_user: User = Depends(get_current_user),
):
    """
    Get RRD monitoring data for a node (last 30 minutes by default).
    CPU values are normalized from decimal (0-1) to percentage (0-100).
    Memory values remain in bytes for frontend formatting.
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        raw_data = pve.get_rrddata(node, timeframe=timeframe)

        data_points = []
        for point in raw_data:
            if point.get("time") is None:
                continue
            data_points.append(RRDDataPoint(
                time=point.get("time", 0),
                cpu=round(point.get("cpu", 0) * 100, 2) if point.get("cpu") is not None else None,
                mem=point.get("mem"),
                maxmem=point.get("maxmem"),
                disk=point.get("disk"),
                maxdisk=point.get("maxdisk"),
                netin=point.get("netin"),
                netout=point.get("netout"),
                diskread=point.get("diskread"),
                diskwrite=point.get("diskwrite"),
            ))

        # Normalizza a 30 punti per timeframe "hour" (requisito: ultimi 30 min)
        if timeframe == "hour" and len(data_points) > 30:
            data_points = data_points[-30:]

        return MonitoringResponse(
            data=data_points,
            timeframe=timeframe,
            target=node,
        )
    except Exception as e:
        logger.error(f"Error fetching RRD data for node {node}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node}/vms/{vmid}/rrddata", response_model=MonitoringResponse)
async def get_vm_rrddata(
    node: str, vmid: int,
    timeframe: str = Query("hour", regex="^(hour|day|week|month|year)$"),
    vm_type: str = Query("qemu", regex="^(qemu|lxc)$"),
    current_user: User = Depends(get_current_user),
):
    """
    Get RRD monitoring data for a specific VM/CT.
    Used to render real-time charts in the frontend.
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        raw_data = pve.get_rrddata(node, vmid=vmid, vm_type=vm_type, timeframe=timeframe)

        data_points = []
        for point in raw_data:
            if point.get("time") is None:
                continue
            data_points.append(RRDDataPoint(
                time=point.get("time", 0),
                cpu=round(point.get("cpu", 0) * 100, 2) if point.get("cpu") is not None else None,
                mem=point.get("mem"),
                maxmem=point.get("maxmem"),
                disk=point.get("disk"),
                maxdisk=point.get("maxdisk"),
                netin=point.get("netin"),
                netout=point.get("netout"),
                diskread=point.get("diskread"),
                diskwrite=point.get("diskwrite"),
            ))

        # Normalizza a 30 punti per timeframe "hour" (requisito: ultimi 30 min)
        if timeframe == "hour" and len(data_points) > 30:
            data_points = data_points[-30:]

        return MonitoringResponse(
            data=data_points,
            timeframe=timeframe,
            target=f"{node}/{vmid}",
        )
    except Exception as e:
        logger.error(f"Error fetching RRD data for VM {vmid}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
