"""
INFORMIX Spa — Nodes Router
Endpoints for Proxmox cluster node monitoring.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from app.auth import get_current_user
from app.models import User
from app.main import get_proxmox
from app.schemas import NodeStatus, NodeListResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=NodeListResponse)
async def list_nodes(current_user: User = Depends(get_current_user)):
    """
    List all Proxmox cluster nodes with current resource usage.
    Maps to: GET /api2/json/nodes
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        raw_nodes = pve.get_nodes()
        nodes = []
        for n in raw_nodes:
            maxmem = n.get("maxmem", 1)
            maxdisk = n.get("maxdisk", 1)
            mem = n.get("mem", 0)
            disk = n.get("disk", 0)

            nodes.append(NodeStatus(
                node=n.get("node", "unknown"),
                status=n.get("status", "unknown"),
                cpu=round(n.get("cpu", 0) * 100, 1),  # Normalize: decimal → percentage
                maxcpu=n.get("maxcpu", 0),
                mem=mem,
                maxmem=maxmem,
                disk=disk,
                maxdisk=maxdisk,
                uptime=n.get("uptime", 0),
                mem_percent=round((mem / maxmem) * 100, 1) if maxmem > 0 else 0,
                disk_percent=round((disk / maxdisk) * 100, 1) if maxdisk > 0 else 0,
            ))

        return NodeListResponse(nodes=nodes, cluster_name="INFORMIX-Cluster")

    except Exception as e:
        logger.error(f"Error listing nodes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve nodes: {str(e)}")


@router.get("/{node}", response_model=NodeStatus)
async def get_node_detail(node: str, current_user: User = Depends(get_current_user)):
    """
    Get detailed status of a specific node.
    Maps to: GET /api2/json/nodes/{node}/status
    """
    pve = get_proxmox()
    if pve is None:
        raise HTTPException(status_code=503, detail="Proxmox client not available")

    try:
        n = pve.get_node_status(node)
        maxmem = n.get("maxmem", 1)
        maxdisk = n.get("maxdisk", 1)
        mem = n.get("mem", 0)
        disk = n.get("disk", 0)

        return NodeStatus(
            node=n.get("node", node),
            status=n.get("status", "online"),
            cpu=round(n.get("cpu", 0) * 100, 1),
            maxcpu=n.get("maxcpu", 0),
            mem=mem,
            maxmem=maxmem,
            disk=disk,
            maxdisk=maxdisk,
            uptime=n.get("uptime", 0),
            mem_percent=round((mem / maxmem) * 100, 1) if maxmem > 0 else 0,
            disk_percent=round((disk / maxdisk) * 100, 1) if maxdisk > 0 else 0,
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting node {node}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve node details: {str(e)}")
