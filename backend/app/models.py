"""
INFORMIX Spa — ORM Models
Database models for users and audit logging.
"""

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    """Portal user account."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="operator")  # operator, admin
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class AuditLog(Base):
    """Audit trail for all VM/CT operations."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # e.g., vm_start, vm_stop, backup_create
    target_type = Column(String(20), nullable=True)  # vm, ct, node
    target_id = Column(String(50), nullable=True)  # e.g., "node1/100"
    target_name = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)  # JSON string with extra info
    status = Column(String(20), default="success")  # success, error
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action}', target='{self.target_id}')>"
