from fastapi import APIRouter, Request

from ..repositories.catalog import list_profiles

router = APIRouter(prefix="/api/v1", tags=["Catálogo"])


@router.get("/profiles", summary="Consultar perfis versionados da demonstração")
def profiles(request: Request) -> dict:
    with request.app.state.database.connection(readonly=True) as connection:
        return {"items": list_profiles(connection)}
