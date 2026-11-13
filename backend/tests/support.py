"""Cliente ASGI mínimo compartilhado pelos testes de integração."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlsplit

from app.config import Settings
from app.database import Database
from app.main import create_app
from app.seed import seed_demo
from app.security import issue_token

EXAMPLE = json.loads((Path(__file__).resolve().parent.parent / "examples/readings-batch.json").read_text())


class ASGITestCase(unittest.IsolatedAsyncioTestCase):
    settings_overrides = {}
    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = Database(Path(self.directory.name) / "api.sqlite3")
        self.app = create_app(Settings(self.database.path, **self.settings_overrides))
        self.lifespan = self.app.router.lifespan_context(self.app)
        await self.lifespan.__aenter__()
        seed_demo(self.database)
        self.token = issue_token(self.database, "gateway-demo-01")

    async def asyncTearDown(self):
        await self.lifespan.__aexit__(None, None, None)
        self.directory.cleanup()

    async def request(self, path="/api/v1/readings", data=None, *, method="POST", token=True, headers=None, chunks=None):
        if data is None:
            data = copy.deepcopy(EXAMPLE)
        body = json.dumps(data).encode()
        pieces = list(chunks) if chunks is not None else [body]
        messages = []
        request_headers = {"content-type": "application/json"}
        if token:
            request_headers["authorization"] = f"Bearer {self.token if token is True else token}"
        request_headers.update(headers or {})

        async def receive():
            if pieces:
                piece = pieces.pop(0)
                return {"type": "http.request", "body": piece, "more_body": bool(pieces)}
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        parsed = urlsplit(path)
        scope = {"type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"}, "http_version": "1.1", "method": method, "scheme": "http", "path": parsed.path, "raw_path": parsed.path.encode(), "root_path": "", "query_string": parsed.query.encode(), "headers": [(k.encode(), v.encode()) for k, v in request_headers.items()], "server": ("test", 80), "client": ("127.0.0.1", 1234)}
        await self.app(scope, receive, send)
        response = next(m for m in messages if m["type"] == "http.response.start")
        output = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
        response_headers = {k.decode(): v.decode() for k, v in response["headers"]}
        return response["status"], json.loads(output) if output else None, response_headers

    def count(self):
        with self.database.connection(readonly=True) as connection:
            return connection.execute("SELECT COUNT(*) FROM readings").fetchone()[0]

