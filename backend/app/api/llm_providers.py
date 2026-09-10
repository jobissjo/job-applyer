from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.llm import LLMProvider
from app.schemas.llm import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderOut,
    LLMTestRequest,
    LLMTestResponse
)
from app.services.llm.manager import LLMManager
from app.utils.security import get_current_user

router = APIRouter(prefix="/llm-providers", tags=["LLM Providers"])


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:4]}...{key[-4:]}"


@router.get("", response_model=List[LLMProviderOut])
async def list_providers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(LLMProvider)
        .where(LLMProvider.user_id == current_user.id)
        .order_by(LLMProvider.priority.asc(), LLMProvider.id.asc())
    )
    res = await db.execute(stmt)
    providers = list(res.scalars().all())

    return [
        LLMProviderOut(
            id=p.id,
            user_id=p.user_id,
            provider=p.provider,
            model=p.model,
            priority=p.priority,
            active=p.active,
            enabled=p.enabled,
            api_key_configured=bool(p.api_key),
            api_key_preview=mask_key(p.api_key),
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in providers
    ]


@router.post("", response_model=LLMProviderOut, status_code=status.HTTP_201_CREATED)
async def create_provider(
    payload: LLMProviderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    provider = LLMProvider(
        user_id=current_user.id,
        provider=payload.provider.lower().strip(),
        api_key=payload.api_key.strip(),
        model=payload.model.strip(),
        priority=payload.priority,
        active=payload.active,
        enabled=payload.enabled
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)

    return LLMProviderOut(
        id=provider.id,
        user_id=provider.user_id,
        provider=provider.provider,
        model=provider.model,
        priority=provider.priority,
        active=provider.active,
        enabled=provider.enabled,
        api_key_configured=True,
        api_key_preview=mask_key(provider.api_key),
        created_at=provider.created_at,
        updated_at=provider.updated_at
    )


@router.put("/{provider_id}", response_model=LLMProviderOut)
async def update_provider(
    provider_id: int,
    payload: LLMProviderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(LLMProvider).where(
        LLMProvider.id == provider_id,
        LLMProvider.user_id == current_user.id
    )
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM provider configuration not found")

    if payload.provider is not None:
        p.provider = payload.provider.lower().strip()
    if payload.api_key is not None and payload.api_key.strip():
        p.api_key = payload.api_key.strip()
    if payload.model is not None:
        p.model = payload.model.strip()
    if payload.priority is not None:
        p.priority = payload.priority
    if payload.active is not None:
        p.active = payload.active
    if payload.enabled is not None:
        p.enabled = payload.enabled

    await db.commit()
    await db.refresh(p)

    return LLMProviderOut(
        id=p.id,
        user_id=p.user_id,
        provider=p.provider,
        model=p.model,
        priority=p.priority,
        active=p.active,
        enabled=p.enabled,
        api_key_configured=bool(p.api_key),
        api_key_preview=mask_key(p.api_key),
        created_at=p.created_at,
        updated_at=p.updated_at
    )


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(LLMProvider).where(
        LLMProvider.id == provider_id,
        LLMProvider.user_id == current_user.id
    )
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM provider configuration not found")

    await db.delete(p)
    await db.commit()
    return None


@router.post("/{provider_id}/test", response_model=LLMTestResponse)
async def test_provider(
    provider_id: int,
    payload: LLMTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(LLMProvider).where(
        LLMProvider.id == provider_id,
        LLMProvider.user_id == current_user.id
    )
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()

    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM provider configuration not found")

    try:
        client = LLMManager.create_client(p.provider, p.api_key, p.model)
        reply = await client.generate(prompt=payload.prompt or "Hello, test.")
        return LLMTestResponse(
            success=True,
            provider=p.provider,
            model=p.model,
            response=reply
        )
    except Exception as e:
        return LLMTestResponse(
            success=False,
            provider=p.provider,
            model=p.model,
            error=str(e)
        )
