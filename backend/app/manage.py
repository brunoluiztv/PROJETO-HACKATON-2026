"""Comandos locais para preparar e inspecionar o banco sem iniciar a API."""

import argparse
import json
from pathlib import Path

from .config import load_settings
from .database import Database
from .seed import seed_demo


def main() -> None:
    parser = argparse.ArgumentParser(description="Administração local do backend")
    parser.add_argument("command", choices=("init-db", "seed-demo", "inspect-db", "issue-token", "issue-bot-token", "seed-alert-demo", "add-rule", "disable-rule", "requeue-notification"))
    parser.add_argument("gateway_id", nargs="?", help="ID de gateway/regra/notificação ou caminho do JSON, conforme o comando")
    args = parser.parse_args()
    command = args.command
    if command in {"issue-token", "add-rule", "disable-rule", "requeue-notification"} and not args.gateway_id:
        parser.error("O comando exige ID do gateway, arquivo de regra ou ID da regra, respectivamente.")
    settings = load_settings()
    database = Database(settings.database_path, settings.sqlite_timeout_seconds)
    if command == "init-db":
        result = {"database_path": str(database.path), "schema_version": database.initialize()}
    elif command == "seed-demo":
        result = {"catalog": seed_demo(database)}
    elif command == "issue-token":
        from .security import issue_token
        try:
            token = issue_token(database, args.gateway_id)
        except ValueError as exc:
            parser.error(str(exc))
        result = {"gateway_id": args.gateway_id, "token": token, "note": "Guarde o token fora do Git. Emitir novamente invalida o anterior."}
    elif command == "issue-bot-token":
        from .security import issue_bot_token
        result = {"service": "telegram-bot", "token": issue_bot_token(database), "note": "Token interno da API, não do Telegram. Emitir novamente invalida o anterior."}
    elif command == "requeue-notification":
        from .services.notifications import requeue
        try:
            result = requeue(database,args.gateway_id)
        except ValueError as exc:
            parser.error(str(exc))
    elif command in {"seed-alert-demo", "add-rule", "disable-rule"}:
        from .schemas.alerts import AlertRule
        from .services.rules import add_rule, disable_rule
        try:
            if command == "disable-rule":
                result = disable_rule(database,args.gateway_id)
            else:
                path = Path(args.gateway_id) if command == "add-rule" else Path(__file__).resolve().parent.parent / "examples" / "alert-rule.json"
                result = add_rule(database,AlertRule.model_validate_json(path.read_text()))
        except (OSError,ValueError) as exc:
            parser.error(str(exc))
    else:
        with database.connection(readonly=True) as connection:
            result = {
                "schema_version": connection.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0],
                "catalog": {name: connection.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0] for name in ("gateways", "nodes", "profiles", "channels")},
                "readings": connection.execute("SELECT COUNT(*) FROM readings").fetchone()[0],
                "alerts": connection.execute("SELECT COUNT(*) FROM alerts").fetchone()[0],
                "notifications": connection.execute("SELECT COUNT(*) FROM notification_outbox").fetchone()[0],
            }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
