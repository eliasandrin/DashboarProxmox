"""
INFORMIX Spa — Authentication Router
Handles login, logout, and user profile endpoints.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import authenticate_user, create_access_token, get_current_user, hash_password
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, RegistrationStatusResponse, TokenResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/registration-status", response_model=RegistrationStatusResponse)
async def registration_status(db: AsyncSession = Depends(get_db)):
    """Return whether the portal needs an initial user registration."""
    user_count = await db.scalar(select(func.count()).select_from(User))
    return RegistrationStatusResponse(requires_registration=(user_count == 0))


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    If no users exist, the first user is created as admin.
    """
    user_count = await db.scalar(select(func.count()).select_from(User))

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

    role = "admin" if user_count == 0 else "operator"
    user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=role,
        is_active=True,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"Registered new user '{user.username}' with role '{user.role}'")
    return UserResponse.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    Credentials are stored in the database (PostgreSQL / AWS RDS).
    """
    user = await authenticate_user(db, request.username, request.password)

    if user is None:
        logger.warning(f"Failed login attempt for user: {request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token
    access_token = create_access_token(data={"sub": user.username, "role": user.role})

    logger.info(f"User '{user.username}' logged in successfully")

    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout endpoint (client-side token invalidation).
    The client should remove the JWT from sessionStorage.
    """
    logger.info(f"User '{current_user.username}' logged out")
    return {"message": "Logged out successfully", "detail": "Please remove the token from client storage"}
