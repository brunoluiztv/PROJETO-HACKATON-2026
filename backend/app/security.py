"""Tokens aleatórios por gateway; somente o hash é persistido."""

import hashlib
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .database import Database

bearer = HTTPBearer(auto_error=False, scheme_name="GatewayToken", description="Token emitido por app.manage issue-token. Não usar token do Telegram.")
service_bearer = HTTPBearer(auto_error=False, scheme_name="BotServiceToken", description="Token interno emitido por app.manage issue-bot-token. Não é o token do Telegram ou do gateway.")


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_token(database: Database, gateway_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with database.transaction() as connection:
        if connection.execute("UPDATE gateways SET token_hash=? WHERE id=?", (token_hash(token), gateway_id)).rowcount != 1:
            raise ValueError("Gateway não cadastrado. Execute seed-demo ou confira o ID.")
    return token


def issue_bot_token(database: Database) -> str:
    from .database import utc_now
    token = secrets.token_urlsafe(32)
    with database.transaction() as connection:
        connection.execute("INSERT INTO service_credentials(name,token_hash,created_at) VALUES ('telegram-bot',?,?) ON CONFLICT(name) DO UPDATE SET token_hash=excluded.token_hash,created_at=excluded.created_at",(token_hash(token),utc_now()))
    return token


def authenticated_bot(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(service_bearer)) -> str:
    if credentials is not None and credentials.scheme.lower()=="bearer":
        with request.app.state.database.connection(readonly=True) as connection:
            row = connection.execute("SELECT name FROM service_credentials WHERE name='telegram-bot' AND token_hash=?",(token_hash(credentials.credentials),)).fetchone()
        if row:
            return row['name']
    raise HTTPException(status_code=401,detail="Credencial interna do bot ausente ou inválida.",headers={"WWW-Authenticate":"Bearer"})


def authenticated_gateway(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if credentials is not None and credentials.scheme.lower() == "bearer":
        with request.app.state.database.connection(readonly=True) as connection:
            row = connection.execute("SELECT id FROM gateways WHERE token_hash=?", (token_hash(credentials.credentials),)).fetchone()
        if row is not None:
            return row["id"]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credencial de gateway ausente ou inválida.", headers={"WWW-Authenticate": "Bearer"})
