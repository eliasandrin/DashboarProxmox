"""
INFORMIX Spa — Pydantic Schemas
Request/Response models for API validation and serialization.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from app.config import settings


# ── Authentication ────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)


class RegistrationStatusResponse(BaseModel):
    requires_registration: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=100)
    role: str = Field("operator", pattern="^(admin|operator)$")
    is_active: bool = True


class UserStatusUpdateRequest(BaseModel):
    is_active: bool


class UserRoleUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(admin|operator)$")


# ── Nodes ─────────────────────────────────────────────

class NodeStatus(BaseModel):
    node: str
    status: str  # online, offline
    cpu: float  # percentage (0-100)
    maxcpu: int  # number of cores
    mem: int  # bytes used
    maxmem: int  # bytes total
    disk: int  # bytes used
    maxdisk: int  # bytes total
    uptime: int  # seconds
    mem_percent: float = 0.0
    disk_percent: float = 0.0

    class Config:
        from_attributes = True


class NodeListResponse(BaseModel):
    nodes: List[NodeStatus]
    cluster_name: Optional[str] = None


# ── VM / Container ────────────────────────────────────

class VMInfo(BaseModel):
    vmid: int
    name: str
    status: str  # running, stopped, paused
    type: str  # qemu, lxc
    node: str
    cpu: float = 0.0  # percentage
    mem: int = 0  # bytes used
    maxmem: int = 0  # bytes total
    disk: int = 0
    maxdisk: int = 0
    uptime: int = 0
    netin: int = 0
    netout: int = 0
    tags: Optional[str] = None

    class Config:
        from_attributes = True


class VMListResponse(BaseModel):
    vms: List[VMInfo]
    total: int
    node: Optional[str] = None


class PowerActionRequest(BaseModel):
    action: str = Field(..., pattern="^(start|stop|shutdown|reboot|suspend|resume)$")


class PowerActionResponse(BaseModel):
    vmid: int
    action: str
    status: str
    task_id: Optional[str] = None
    message: str


class CreateVmRequest(BaseModel):
    vm_type: str = Field(..., pattern="^(qemu|lxc)$")
    vmid: int
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = ""
    cores: int = Field(1, ge=1, le=128)
    memory_mb: int = Field(1024, ge=256, le=1048576)
    disk_gb: int = Field(8, ge=1, le=1048576)
    network_bridge: str = Field("vmbr0", min_length=1, max_length=32)
    disk_storage: str = Field("local-lvm", min_length=1, max_length=64)
    iso_storage: Optional[str] = Field("local", min_length=1, max_length=64)
    iso_file: Optional[str] = None
    ct_template: Optional[str] = None


class CreateVmResponse(BaseModel):
    status: str
    vmid: int
    task_id: Optional[str] = None
    message: str


class IsoUploadResponse(BaseModel):
    status: str
    iso_file: str
    storage: str
    message: str


# ── Monitoring ────────────────────────────────────────

class RRDDataPoint(BaseModel):
    time: float
    cpu: Optional[float] = None
    mem: Optional[float] = None
    maxmem: Optional[float] = None
    disk: Optional[float] = None
    maxdisk: Optional[float] = None
    netin: Optional[float] = None
    netout: Optional[float] = None
    diskread: Optional[float] = None
    diskwrite: Optional[float] = None


class MonitoringResponse(BaseModel):
    data: List[RRDDataPoint]
    timeframe: str = "hour"
    target: str  # node name or vmid


# ── Snapshots & Backup ───────────────────────────────

class SnapshotInfo(BaseModel):
    name: str
    description: Optional[str] = None
    snaptime: Optional[int] = None
    vmstate: Optional[bool] = False
    parent: Optional[str] = None


class SnapshotListResponse(BaseModel):
    snapshots: List[SnapshotInfo]
    vmid: int


class CreateSnapshotRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    description: Optional[str] = ""
    include_ram: bool = False


class BackupRequest(BaseModel):
    storage: str = Field(default_factory=lambda: settings.BACKUP_STORAGE_DEFAULT)
    mode: str = "snapshot"  # snapshot, suspend, stop
    compress: str = "zstd"
    notes: Optional[str] = None


class BackupInfo(BaseModel):
    volid: str
    ctime: int
    size: int
    format: str
    notes: Optional[str] = None
    vmid: Optional[int] = None


class BackupResponse(BaseModel):
    status: str
    task_id: Optional[str] = None
    message: str


# ── Cluster ───────────────────────────────────────────

class ClusterResource(BaseModel):
    id: str
    type: str  # node, qemu, lxc, storage
    node: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None
    vmid: Optional[int] = None
    cpu: Optional[float] = None
    mem: Optional[int] = None
    maxmem: Optional[int] = None
    disk: Optional[int] = None
    maxdisk: Optional[int] = None


class ClusterResourcesResponse(BaseModel):
    resources: List[ClusterResource]
    node_count: int
    vm_count: int
    ct_count: int


class MigrateRequest(BaseModel):
    vmid: int
    source_node: str
    target_node: str
    online: bool = True  # live migration


class MigrateResponse(BaseModel):
    status: str
    task_id: Optional[str] = None
    message: str


# ── Audit Log ─────────────────────────────────────────

class AuditLogEntry(BaseModel):
    id: int
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    status: str
    timestamp: datetime
    username: Optional[str] = None

    class Config:
        from_attributes = True


# ── Health ────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    environment: str
    demo_mode: bool
    database: str = "connected"
    proxmox: str = "connected"
