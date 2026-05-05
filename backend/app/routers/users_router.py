"""
INFORMIX Spa — Users Management Router
Admin-only endpoints for managing portal users.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_admin_user, hash_password
from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreateRequest,
    UserResponse,
    UserStatusUpdateRequest,
    UserRoleUpdateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _ensure_not_last_admin(target_user: User, admin_count: int, action_label: str) -> None:
    if target_user.role == "admin" and admin_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot {action_label} the last admin user",
        )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).order_by(User.username))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    existing_user = await db.scalar(select(User).where(User.username == request.username))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )

    existing_email = await db.scalar(select(User).where(User.email == request.email))
    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        )

    user = User(
        username=request.username,
        email=request.email,
        full_name=request.full_name,
        hashed_password=hash_password(request.password),
        role=request.role,
        is_active=request.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("Admin created user '%s'", user.username)
    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: int,
    request: UserStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    if admin_user.id == user_id and request.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot disable your own account",
        )

    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if request.is_active is False:
        admin_count = await db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))
        _ensure_not_last_admin(target, admin_count, "disable")

    await db.execute(update(User).where(User.id == user_id).values(is_active=request.is_active))
    await db.commit()

    updated = await db.scalar(select(User).where(User.id == user_id))
    return UserResponse.model_validate(updated)


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    request: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    if admin_user.id == user_id and request.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove your own admin role",
        )

    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.role == "admin" and request.role != "admin":
        admin_count = await db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))
        _ensure_not_last_admin(target, admin_count, "demote")

    await db.execute(update(User).where(User.id == user_id).values(role=request.role))
    await db.commit()

    updated = await db.scalar(select(User).where(User.id == user_id))
    return UserResponse.model_validate(updated)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete your own account",
        )

    target = await db.scalar(select(User).where(User.id == user_id))
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    admin_count = await db.scalar(select(func.count()).select_from(User).where(User.role == "admin"))
    _ensure_not_last_admin(target, admin_count, "delete")

    await db.delete(target)
    await db.commit()

    logger.info("Admin deleted user '%s'", target.username)