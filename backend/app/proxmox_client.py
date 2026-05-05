"""
INFORMIX Spa — Proxmox VE Client
Wrapper around proxmoxer with robust error handling and DEMO_MODE.
Uses API Tokens exclusively (no root passwords in clear text).
"""

import logging
import time
import random
import math
import os
import requests
from typing import List, Dict, Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ╔══════════════════════════════════════════════════════════════╗
# ║                    DEMO DATA GENERATOR                       ║
# ║  Realistic mock data simulating a 3-node Proxmox cluster     ║
# ╚══════════════════════════════════════════════════════════════╝

class DemoDataProvider:
    """Generates realistic demo data for presentations."""

    NODES = [
        {
            "node": "pve-node01",
            "status": "online",
            "maxcpu": 16,
            "maxmem": 68719476736,      # 64 GB
            "maxdisk": 1099511627776,    # 1 TB
            "uptime": 2592000,           # 30 days
        },
        {
            "node": "pve-node02",
            "status": "online",
            "maxcpu": 32,
            "maxmem": 137438953472,     # 128 GB
            "maxdisk": 2199023255552,   # 2 TB
            "uptime": 1728000,          # 20 days
        },
        {
            "node": "pve-node03",
            "status": "online",
            "maxcpu": 16,
            "maxmem": 34359738368,      # 32 GB
            "maxdisk": 549755813888,    # 512 GB
            "uptime": 864000,           # 10 days
        },
    ]

    VMS = [
        # ── Node 01 VMs ──
        {"vmid": 100, "name": "web-server-prod", "node": "pve-node01", "type": "qemu", "status": "running",
         "maxmem": 8589934592, "maxdisk": 107374182400, "tags": "production,web"},
        {"vmid": 101, "name": "db-master-mysql", "node": "pve-node01", "type": "qemu", "status": "running",
         "maxmem": 17179869184, "maxdisk": 214748364800, "tags": "production,database"},
        {"vmid": 102, "name": "mail-server", "node": "pve-node01", "type": "qemu", "status": "running",
         "maxmem": 4294967296, "maxdisk": 53687091200, "tags": "production,mail"},
        {"vmid": 103, "name": "backup-proxy", "node": "pve-node01", "type": "qemu", "status": "stopped",
         "maxmem": 2147483648, "maxdisk": 32212254720, "tags": "infrastructure"},
        {"vmid": 200, "name": "dns-resolver", "node": "pve-node01", "type": "lxc", "status": "running",
         "maxmem": 1073741824, "maxdisk": 8589934592, "tags": "infrastructure,dns"},
        {"vmid": 201, "name": "monitoring-agent", "node": "pve-node01", "type": "lxc", "status": "running",
         "maxmem": 2147483648, "maxdisk": 16106127360, "tags": "infrastructure"},
        # ── Node 02 VMs ──
        {"vmid": 110, "name": "app-server-01", "node": "pve-node02", "type": "qemu", "status": "running",
         "maxmem": 16384000000, "maxdisk": 107374182400, "tags": "production,app"},
        {"vmid": 111, "name": "app-server-02", "node": "pve-node02", "type": "qemu", "status": "running",
         "maxmem": 16384000000, "maxdisk": 107374182400, "tags": "production,app"},
        {"vmid": 112, "name": "redis-cache", "node": "pve-node02", "type": "qemu", "status": "running",
         "maxmem": 8589934592, "maxdisk": 53687091200, "tags": "production,cache"},
        {"vmid": 113, "name": "dev-environment", "node": "pve-node02", "type": "qemu", "status": "stopped",
         "maxmem": 4294967296, "maxdisk": 53687091200, "tags": "development"},
        {"vmid": 114, "name": "staging-server", "node": "pve-node02", "type": "qemu", "status": "running",
         "maxmem": 8589934592, "maxdisk": 107374182400, "tags": "staging"},
        {"vmid": 210, "name": "nginx-proxy", "node": "pve-node02", "type": "lxc", "status": "running",
         "maxmem": 1073741824, "maxdisk": 8589934592, "tags": "production,proxy"},
        {"vmid": 211, "name": "log-collector", "node": "pve-node02", "type": "lxc", "status": "running",
         "maxmem": 2147483648, "maxdisk": 32212254720, "tags": "infrastructure,logs"},
        # ── Node 03 VMs ──
        {"vmid": 120, "name": "test-vm-ubuntu", "node": "pve-node03", "type": "qemu", "status": "running",
         "maxmem": 4294967296, "maxdisk": 53687091200, "tags": "testing"},
        {"vmid": 121, "name": "test-vm-windows", "node": "pve-node03", "type": "qemu", "status": "stopped",
         "maxmem": 8589934592, "maxdisk": 107374182400, "tags": "testing,windows"},
        {"vmid": 220, "name": "pihole-dns", "node": "pve-node03", "type": "lxc", "status": "running",
         "maxmem": 536870912, "maxdisk": 4294967296, "tags": "infrastructure,dns"},
    ]

    SNAPSHOTS = {
        100: [
            {"name": "pre-update-2024-03", "description": "Before kernel update", "snaptime": 1711900800, "vmstate": False},
            {"name": "stable-config", "description": "Stable production config", "snaptime": 1714492800, "vmstate": True},
            {"name": "current", "description": "You are here", "snaptime": None, "vmstate": False, "parent": "stable-config"},
        ],
        101: [
            {"name": "pre-migration", "description": "Before DB migration v5.2", "snaptime": 1713283200, "vmstate": False},
            {"name": "current", "description": "You are here", "snaptime": None, "vmstate": False, "parent": "pre-migration"},
        ],
        110: [
            {"name": "deploy-v3.1", "description": "App v3.1 deployment", "snaptime": 1714060800, "vmstate": True},
            {"name": "deploy-v3.2", "description": "App v3.2 deployment", "snaptime": 1714406400, "vmstate": True},
            {"name": "current", "description": "You are here", "snaptime": None, "vmstate": False, "parent": "deploy-v3.2"},
        ],
    }

    BACKUPS = [
        {"volid": "pbs:backup/vzdump-qemu-100-2024_04_20-02_00_00.vma.zst", "ctime": 1713578400, "size": 5368709120, "format": "vma.zst", "vmid": 100, "notes": "Scheduled backup"},
        {"volid": "pbs:backup/vzdump-qemu-100-2024_04_13-02_00_00.vma.zst", "ctime": 1712973600, "size": 5200000000, "format": "vma.zst", "vmid": 100, "notes": "Scheduled backup"},
        {"volid": "pbs:backup/vzdump-qemu-101-2024_04_20-03_00_00.vma.zst", "ctime": 1713582000, "size": 15032385536, "format": "vma.zst", "vmid": 101, "notes": "DB backup"},
        {"volid": "pbs:backup/vzdump-qemu-110-2024_04_19-02_00_00.vma.zst", "ctime": 1713492000, "size": 8589934592, "format": "vma.zst", "vmid": 110, "notes": "Pre-deploy backup"},
        {"volid": "pbs:backup/vzdump-qemu-112-2024_04_18-02_00_00.vma.zst", "ctime": 1713405600, "size": 2147483648, "format": "vma.zst", "vmid": 112, "notes": "Redis snapshot"},
    ]

    @classmethod
    def _dynamic_usage(cls, base_ratio=0.5, variance=0.15):
        """Generate realistic fluctuating usage values."""
        t = time.time()
        # Sine wave + random noise for realistic fluctuation
        wave = math.sin(t * 0.01) * variance
        noise = random.uniform(-0.05, 0.05)
        return max(0.05, min(0.95, base_ratio + wave + noise))

    @classmethod
    def get_nodes(cls) -> List[Dict]:
        nodes = []
        for n in cls.NODES:
            usage = cls._dynamic_usage(0.45, 0.2)
            mem_usage = cls._dynamic_usage(0.62, 0.1)
            disk_usage = cls._dynamic_usage(0.55, 0.05)
            nodes.append({
                **n,
                "cpu": round(usage, 4),
                "mem": int(n["maxmem"] * mem_usage),
                "disk": int(n["maxdisk"] * disk_usage),
            })
        return nodes

    @classmethod
    def get_node_status(cls, node_name: str) -> Optional[Dict]:
        for n in cls.NODES:
            if n["node"] == node_name:
                usage = cls._dynamic_usage(0.45, 0.2)
                mem_usage = cls._dynamic_usage(0.62, 0.1)
                disk_usage = cls._dynamic_usage(0.55, 0.05)
                return {
                    **n,
                    "cpu": round(usage, 4),
                    "mem": int(n["maxmem"] * mem_usage),
                    "disk": int(n["maxdisk"] * disk_usage),
                }
        return None

    @classmethod
    def get_vms(cls, node: str, vm_type: str = "qemu") -> List[Dict]:
        vms = []
        for vm in cls.VMS:
            if vm["node"] == node and vm["type"] == vm_type:
                is_running = vm["status"] == "running"
                cpu_usage = cls._dynamic_usage(0.3, 0.2) if is_running else 0.0
                mem_ratio = cls._dynamic_usage(0.55, 0.15) if is_running else 0.0
                disk_ratio = cls._dynamic_usage(0.4, 0.1)
                vms.append({
                    **vm,
                    "cpu": round(cpu_usage, 4) if is_running else 0.0,
                    "mem": int(vm["maxmem"] * mem_ratio) if is_running else 0,
                    "disk": int(vm["maxdisk"] * disk_ratio),
                    "uptime": random.randint(86400, 2592000) if is_running else 0,
                    "netin": random.randint(100000000, 50000000000) if is_running else 0,
                    "netout": random.randint(50000000, 20000000000) if is_running else 0,
                })
        return vms

    @classmethod
    def get_all_vms(cls) -> List[Dict]:
        result = []
        for node in cls.NODES:
            result.extend(cls.get_vms(node["node"], "qemu"))
            result.extend(cls.get_vms(node["node"], "lxc"))
        return result

    @classmethod
    def get_rrddata(cls, timeframe: str = "hour") -> List[Dict]:
        """Generate realistic RRD time-series data for the last 30 minutes."""
        now = time.time()
        data = []
        points = 30  # one per minute
        for i in range(points):
            t = now - (points - i) * 60
            base_cpu = 0.35 + 0.15 * math.sin(i * 0.3) + random.uniform(-0.05, 0.05)
            base_mem = 0.6 + 0.05 * math.sin(i * 0.2) + random.uniform(-0.02, 0.02)
            data.append({
                "time": t,
                "cpu": round(max(0, min(1, base_cpu)), 4),
                "mem": round(max(0, min(1, base_mem)) * 8589934592),
                "maxmem": 8589934592,
                "disk": round(max(0, min(1, 0.45 + random.uniform(-0.02, 0.02))) * 107374182400),
                "maxdisk": 107374182400,
                "netin": random.randint(500000, 5000000),
                "netout": random.randint(200000, 3000000),
                "diskread": random.randint(100000, 10000000),
                "diskwrite": random.randint(50000, 5000000),
            })
        return data

    @classmethod
    def get_snapshots(cls, vmid: int) -> List[Dict]:
        return cls.SNAPSHOTS.get(vmid, [
            {"name": "current", "description": "You are here", "snaptime": None, "vmstate": False}
        ])

    @classmethod
    def get_backups(cls, vmid: Optional[int] = None) -> List[Dict]:
        if vmid:
            return [b for b in cls.BACKUPS if b.get("vmid") == vmid]
        return cls.BACKUPS

    @classmethod
    def get_cluster_resources(cls) -> List[Dict]:
        resources = []
        # Add nodes
        for n in cls.get_nodes():
            resources.append({
                "id": f"node/{n['node']}",
                "type": "node",
                "node": n["node"],
                "name": n["node"],
                "status": n["status"],
                "cpu": n["cpu"],
                "mem": n["mem"],
                "maxmem": n["maxmem"],
                "disk": n["disk"],
                "maxdisk": n["maxdisk"],
            })
        # Add VMs and CTs
        for vm in cls.get_all_vms():
            resources.append({
                "id": f"{vm['type']}/{vm['vmid']}",
                "type": vm["type"],
                "node": vm["node"],
                "name": vm["name"],
                "status": vm["status"],
                "vmid": vm["vmid"],
                "cpu": vm["cpu"],
                "mem": vm["mem"],
                "maxmem": vm["maxmem"],
                "disk": vm["disk"],
                "maxdisk": vm["maxdisk"],
            })
        # Add storage
        for n in cls.NODES:
            resources.append({
                "id": f"storage/{n['node']}/local-lvm",
                "type": "storage",
                "node": n["node"],
                "name": "local-lvm",
                "status": "available",
                "disk": int(n["maxdisk"] * 0.55),
                "maxdisk": n["maxdisk"],
            })
        return resources


# ╔══════════════════════════════════════════════════════════════╗
# ║                    PROXMOX CLIENT                            ║
# ╚══════════════════════════════════════════════════════════════╝

class ProxmoxClient:
    """
    Wrapper around proxmoxer with error handling and demo mode.
    Uses API Tokens exclusively (no root passwords).
    """

    def __init__(self):
        self._proxmox = None
        self._demo_mode = settings.DEMO_MODE
        self._connected = False

        if not self._demo_mode:
            self._connect()

    def _connect(self):
        """Establish connection to Proxmox VE using API Token.
        PROXMOX_USER format: 'user@realm!token-name'
        proxmoxer requires user and token_name as separate parameters.
        """
        try:
            from proxmoxer import ProxmoxAPI

            # Parse PROXMOX_USER: e.g. 'apiuser@pve!portal-token'
            pve_user = settings.PROXMOX_USER
            token_name = None
            if "!" in pve_user:
                pve_user, token_name = pve_user.split("!", 1)

            self._proxmox = ProxmoxAPI(
                settings.PROXMOX_HOST,
                port=settings.PROXMOX_PORT,
                user=pve_user,
                token_name=token_name,
                token_value=settings.PROXMOX_TOKEN_VALUE,
                verify_ssl=settings.PROXMOX_VERIFY_SSL,
                service="PVE",
            )
            self._connected = True
            logger.info(f"✅ Connected to Proxmox VE at {settings.PROXMOX_HOST}:{settings.PROXMOX_PORT}")
            logger.info(f"   User: {pve_user}, Token: {token_name}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Proxmox: {e}")
            self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._demo_mode or self._connected

    # ── Node Operations ───────────────────────────────

    def get_nodes(self) -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_nodes()
        try:
            return self._proxmox.nodes.get()
        except Exception as e:
            logger.error(f"Error fetching nodes: {e}")
            raise

    def get_node_status(self, node: str) -> Dict:
        if self._demo_mode:
            result = DemoDataProvider.get_node_status(node)
            if result is None:
                raise ValueError(f"Node '{node}' not found")
            return result
        try:
            return self._proxmox.nodes(node).status.get()
        except Exception as e:
            logger.error(f"Error fetching node status for {node}: {e}")
            raise

    # ── VM Operations ─────────────────────────────────

    def get_vms(self, node: str) -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_vms(node, "qemu")
        try:
            return self._proxmox.nodes(node).qemu.get()
        except Exception as e:
            logger.error(f"Error fetching VMs for node {node}: {e}")
            raise

    def get_containers(self, node: str) -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_vms(node, "lxc")
        try:
            return self._proxmox.nodes(node).lxc.get()
        except Exception as e:
            logger.error(f"Error fetching containers for node {node}: {e}")
            raise

    def vm_action(self, node: str, vmid: int, action: str, vm_type: str = "qemu") -> Dict:
        """Execute a power action on a VM/CT."""
        valid_actions = ["start", "stop", "shutdown", "reboot", "suspend", "resume"]
        if action not in valid_actions:
            raise ValueError(f"Invalid action: {action}. Must be one of {valid_actions}")

        if self._demo_mode:
            # Simulate state change
            for vm in DemoDataProvider.VMS:
                if vm["vmid"] == vmid:
                    if action == "start":
                        vm["status"] = "running"
                    elif action in ("stop", "shutdown"):
                        vm["status"] = "stopped"
                    elif action == "suspend":
                        vm["status"] = "paused"
                    elif action == "resume":
                        vm["status"] = "running"
                    elif action == "reboot":
                        vm["status"] = "running"
                    break
            return {"task_id": f"UPID:demo:{vmid}:{action}:demo:", "status": "ok"}

        try:
            if vm_type == "qemu":
                result = getattr(self._proxmox.nodes(node).qemu(vmid).status, action).post()
            else:
                result = getattr(self._proxmox.nodes(node).lxc(vmid).status, action).post()
            return {"task_id": result, "status": "ok"}
        except Exception as e:
            logger.error(f"Error executing {action} on {vm_type}/{vmid}: {e}")
            raise

    def upload_iso(self, node: str, storage: str, file_path: str, filename: str) -> Dict:
        """Upload ISO to Proxmox storage."""
        if self._demo_mode:
            return {"status": "ok", "iso_file": filename, "storage": storage}

        url = f"https://{settings.PROXMOX_HOST}:{settings.PROXMOX_PORT}/api2/json/nodes/{node}/storage/{storage}/upload"
        auth_header = f"PVEAPIToken={settings.PROXMOX_USER}={settings.PROXMOX_TOKEN_VALUE}"
        headers = {"Authorization": auth_header}

        try:
            with open(file_path, "rb") as iso_file:
                files = {"filename": (filename, iso_file, "application/octet-stream")}
                data = {"content": "iso"}
                response = requests.post(
                    url,
                    headers=headers,
                    files=files,
                    data=data,
                    verify=settings.PROXMOX_VERIFY_SSL,
                    timeout=120,
                )
            response.raise_for_status()
            return {"status": "ok", "iso_file": filename, "storage": storage, "raw": response.json()}
        except Exception as e:
            logger.error(f"ISO upload failed on {node}/{storage}: {e}")
            raise

    def create_vm(self, node: str, payload: Dict) -> Dict:
        """Create a QEMU VM."""
        if self._demo_mode:
            disk_gb = 8
            scsi0 = payload.get("scsi0", "")
            if isinstance(scsi0, str) and ":" in scsi0:
                try:
                    disk_gb = int(scsi0.split(":")[-1])
                except ValueError:
                    disk_gb = 8
            DemoDataProvider.VMS.append({
                "vmid": payload.get("vmid"),
                "name": payload.get("name"),
                "node": node,
                "type": "qemu",
                "status": "stopped",
                "maxmem": int(payload.get("memory", 1024)) * 1024 * 1024,
                "maxdisk": int(disk_gb) * 1024 * 1024 * 1024,
                "tags": "created",
            })
            return {"status": "ok", "task_id": f"UPID:demo:{payload.get('vmid')}:create:demo:"}

        try:
            result = self._proxmox.nodes(node).qemu.post(**payload)
            return {"status": "ok", "task_id": result}
        except Exception as e:
            logger.error(f"Error creating VM on {node}: {e}")
            raise

    def create_ct(self, node: str, payload: Dict) -> Dict:
        """Create an LXC container."""
        if self._demo_mode:
            disk_gb = 8
            rootfs = payload.get("rootfs", "")
            if isinstance(rootfs, str) and ":" in rootfs:
                try:
                    disk_gb = int(rootfs.split(":")[-1])
                except ValueError:
                    disk_gb = 8
            DemoDataProvider.VMS.append({
                "vmid": payload.get("vmid"),
                "name": payload.get("hostname"),
                "node": node,
                "type": "lxc",
                "status": "stopped",
                "maxmem": int(payload.get("memory", 1024)) * 1024 * 1024,
                "maxdisk": int(disk_gb) * 1024 * 1024 * 1024,
                "tags": "created",
            })
            return {"status": "ok", "task_id": f"UPID:demo:{payload.get('vmid')}:create-ct:demo:"}

        try:
            result = self._proxmox.nodes(node).lxc.post(**payload)
            return {"status": "ok", "task_id": result}
        except Exception as e:
            logger.error(f"Error creating CT on {node}: {e}")
            raise

    # ── Monitoring ────────────────────────────────────

    def get_rrddata(self, node: str, vmid: Optional[int] = None,
                    vm_type: str = "qemu", timeframe: str = "hour") -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_rrddata(timeframe)
        try:
            if vmid:
                if vm_type == "qemu":
                    return self._proxmox.nodes(node).qemu(vmid).rrddata.get(timeframe=timeframe)
                else:
                    return self._proxmox.nodes(node).lxc(vmid).rrddata.get(timeframe=timeframe)
            else:
                return self._proxmox.nodes(node).rrddata.get(timeframe=timeframe)
        except Exception as e:
            logger.error(f"Error fetching RRD data: {e}")
            raise

    # ── Snapshots ─────────────────────────────────────

    def get_snapshots(self, node: str, vmid: int, vm_type: str = "qemu") -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_snapshots(vmid)
        try:
            if vm_type == "qemu":
                return self._proxmox.nodes(node).qemu(vmid).snapshot.get()
            else:
                return self._proxmox.nodes(node).lxc(vmid).snapshot.get()
        except Exception as e:
            logger.error(f"Error fetching snapshots for {vmid}: {e}")
            raise

    def create_snapshot(self, node: str, vmid: int, name: str,
                       description: str = "", include_ram: bool = False,
                       vm_type: str = "qemu") -> Dict:
        if self._demo_mode:
            snap = {"name": name, "description": description,
                    "snaptime": int(time.time()), "vmstate": include_ram}
            if vmid in DemoDataProvider.SNAPSHOTS:
                DemoDataProvider.SNAPSHOTS[vmid].insert(-1, snap)
            else:
                DemoDataProvider.SNAPSHOTS[vmid] = [snap, {"name": "current", "description": "You are here", "snaptime": None, "vmstate": False, "parent": name}]
            return {"task_id": f"UPID:demo:{vmid}:snapshot:{name}:", "status": "ok"}
        try:
            if vm_type == "qemu":
                result = self._proxmox.nodes(node).qemu(vmid).snapshot.post(
                    snapname=name, description=description, vmstate=int(include_ram)
                )
            else:
                result = self._proxmox.nodes(node).lxc(vmid).snapshot.post(
                    snapname=name, description=description
                )
            return {"task_id": result, "status": "ok"}
        except Exception as e:
            logger.error(f"Error creating snapshot for {vmid}: {e}")
            raise

    # ── Backup (PBS) ──────────────────────────────────

    def create_backup(self, node: str, vmid: int, storage: str = settings.BACKUP_STORAGE_DEFAULT,
                      mode: str = "snapshot", compress: str = "zstd",
                      notes: Optional[str] = None) -> Dict:
        """
        Start a backup to Proxmox Backup Server.
        Resilience: if PBS is unreachable, returns an error message
        instead of crashing the application.
        """
        if self._demo_mode:
            # Simulate PBS unreachable 20% of the time for demo purposes
            if random.random() < 0.2:
                return {
                    "status": "error",
                    "message": "⚠️ Proxmox Backup Server is temporarily unreachable. Please try again later.",
                    "task_id": None,
                }
            new_backup = {
                "volid": f"pbs:backup/vzdump-qemu-{vmid}-{time.strftime('%Y_%m_%d-%H_%M_%S')}.vma.zst",
                "ctime": int(time.time()),
                "size": random.randint(1073741824, 10737418240),
                "format": "vma.zst",
                "vmid": vmid,
                "notes": notes or "Manual backup",
            }
            DemoDataProvider.BACKUPS.append(new_backup)
            return {"status": "ok", "task_id": f"UPID:demo:{vmid}:vzdump:backup:", "message": "Backup started"}

        try:
            params = {
                "vmid": vmid,
                "storage": storage,
                "mode": mode,
                "compress": compress,
            }
            if notes:
                params["notes-template"] = notes
            result = self._proxmox.nodes(node).vzdump.post(**params)
            return {"status": "ok", "task_id": result, "message": "Backup started"}
        except Exception as e:
            # RESILIENCE: Don't crash on PBS failure
            error_msg = str(e)
            logger.error(f"Backup failed for VM {vmid}: {error_msg}")
            if "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "unreachable" in error_msg.lower():
                return {
                    "status": "error",
                    "message": "⚠️ Proxmox Backup Server is temporarily unreachable. Please try again later.",
                    "task_id": None,
                }
            return {"status": "error", "message": f"Backup failed: {error_msg}", "task_id": None}

    def get_backups(self, storage: str = settings.BACKUP_STORAGE_DEFAULT, vmid: Optional[int] = None) -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_backups(vmid)
        try:
            contents = self._proxmox.nodes(self.get_nodes()[0]["node"]).storage(storage).content.get()
            if vmid:
                contents = [c for c in contents if c.get("vmid") == vmid]
            return contents
        except Exception as e:
            logger.warning(f"⚠️ Could not retrieve backups from {storage}: {e}")
            return []

    def get_task_status(self, node: str, upid: str) -> Dict:
        """Get task status for a given UPID."""
        if self._demo_mode:
            return {
                "status": "stopped",
                "exitstatus": "OK",
                "upid": upid,
                "node": node,
            }
        try:
            return self._proxmox.nodes(node).tasks(upid).status.get()
        except Exception as e:
            logger.error(f"Error fetching task status {upid}: {e}")
            raise

    def get_task_log(self, node: str, upid: str, start: int = 0, limit: int = 200) -> List[Dict]:
        """Get task log lines for a given UPID."""
        if self._demo_mode:
            return [{"n": 1, "t": "INFO: 50%"}]
        try:
            return self._proxmox.nodes(node).tasks(upid).log.get(start=start, limit=limit)
        except Exception as e:
            logger.error(f"Error fetching task log {upid}: {e}")
            raise

    def get_storages(self, backup_only: bool = False) -> List[Dict]:
        """List storages across nodes with basic metadata."""
        if self._demo_mode:
            storages = [
                {"storage": "proxmox-backup-server", "node": "pve-node01", "type": "pbs", "status": "available", "content": "backup"},
                {"storage": "Test-Pool", "node": "pve-node01", "type": "zfspool", "status": "available", "content": "images,rootdir"},
                {"storage": "local", "node": "pve-node01", "type": "dir", "status": "available", "content": "iso,backup"},
                {"storage": "local-lvm", "node": "pve-node01", "type": "lvmthin", "status": "available", "content": "images,rootdir"},
            ]
            return self._filter_backup_storages(storages) if backup_only else storages

        storages: List[Dict] = []
        seen = set()
        for n in self.get_nodes():
            node = n.get("node")
            if not node:
                continue
            try:
                items = self._proxmox.nodes(node).storage.get()
                for s in items:
                    name = s.get("storage") or s.get("name")
                    if not name:
                        continue
                    key = f"{node}:{name}"
                    if key in seen:
                        continue
                    seen.add(key)
                    storages.append({
                        "storage": name,
                        "node": node,
                        "type": s.get("type"),
                        "status": s.get("status"),
                        "content": s.get("content"),
                    })
            except Exception as e:
                logger.warning(f"⚠️ Could not retrieve storages for {node}: {e}")
        return self._filter_backup_storages(storages) if backup_only else storages

    @staticmethod
    def _filter_backup_storages(storages: List[Dict]) -> List[Dict]:
        filtered: List[Dict] = []
        for s in storages:
            content = (s.get("content") or "").lower()
            status = (s.get("status") or "").lower()
            has_backup = "backup" in [c.strip() for c in content.split(",") if c.strip()]
            status_ok = status in ("", "available", "active")
            if has_backup and status_ok:
                filtered.append(s)
        return filtered

    # ── Cluster Operations (Bonus) ────────────────────

    def get_cluster_resources(self) -> List[Dict]:
        if self._demo_mode:
            return DemoDataProvider.get_cluster_resources()
        try:
            return self._proxmox.cluster.resources.get()
        except Exception as e:
            logger.error(f"Error fetching cluster resources: {e}")
            raise

    def migrate_vm(self, node: str, vmid: int, target: str,
                   online: bool = True) -> Dict:
        """Live migrate a VM to another node."""
        if self._demo_mode:
            # Simulate migration by updating the VM's node
            for vm in DemoDataProvider.VMS:
                if vm["vmid"] == vmid:
                    old_node = vm["node"]
                    vm["node"] = target
                    logger.info(f"Demo: Migrated VM {vmid} from {old_node} to {target}")
                    return {
                        "status": "ok",
                        "task_id": f"UPID:demo:{vmid}:migrate:{target}:",
                        "message": f"VM {vmid} migrated from {old_node} to {target}",
                    }
            return {"status": "error", "task_id": None, "message": f"VM {vmid} not found"}

        try:
            result = self._proxmox.nodes(node).qemu(vmid).migrate.post(
                target=target, online=int(online)
            )
            return {"status": "ok", "task_id": result, "message": f"Migration of VM {vmid} to {target} started"}
        except Exception as e:
            logger.error(f"Error migrating VM {vmid}: {e}")
            raise
