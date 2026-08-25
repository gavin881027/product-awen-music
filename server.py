#!/usr/bin/env python3
"""Local Awen Music server with a minimal OpenAI-compatible API proxy.

The proxy exists because many providers (including OpenCode Go) do not allow
browser CORS. It binds to 127.0.0.1, never logs request bodies or credentials,
and only forwards to HTTPS endpoints or loopback HTTP endpoints.
"""

import argparse
import functools
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


MAX_REQUEST_BYTES = 2 * 1024 * 1024
UPSTREAM_TIMEOUT_SECONDS = 180


class AwenHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # The app is a single HTML file with inline JavaScript. During local
        # development a cached document can keep running an older provider
        # implementation even after the file has been fixed.
        if self.command in {"GET", "HEAD"}:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def _json_error(self, status, message):
        body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.rstrip("/") != "/api/llm":
            self._json_error(404, "Not found")
            return

        origin = self.headers.get("Origin", "")
        if origin:
            origin_host = urlparse(origin).hostname
            if origin_host not in {"127.0.0.1", "localhost", "::1"}:
                self._json_error(403, "Only local browser requests are allowed")
                return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json_error(400, "Invalid Content-Length")
            return
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._json_error(413, "Request body is empty or too large")
            return

        try:
            request_data = json.loads(self.rfile.read(length).decode("utf-8"))
            endpoint = str(request_data.get("endpoint", "")).strip()
            api_key = str(request_data.get("apiKey", "")).strip()
            payload = request_data.get("payload")
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json_error(400, "Invalid JSON")
            return

        parsed = urlparse(endpoint)
        loopback = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
        if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):
            self._json_error(400, "Remote providers must use HTTPS")
            return
        if not parsed.netloc or not isinstance(payload, dict) or not api_key:
            self._json_error(400, "endpoint, apiKey, and payload are required")
            return

        upstream_request = Request(
            endpoint,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Awen-Music-Local/1.0",
            },
            method="POST",
        )

        try:
            with urlopen(upstream_request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
                status = response.status
                body = response.read(MAX_REQUEST_BYTES)
                content_type = response.headers.get("Content-Type", "application/json")
        except HTTPError as error:
            status = error.code
            body = error.read(MAX_REQUEST_BYTES)
            content_type = error.headers.get("Content-Type", "application/json")
        except URLError as error:
            self._json_error(502, f"Upstream connection failed: {error.reason}")
            return
        except TimeoutError:
            self._json_error(504, "Upstream request timed out")
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Standard access logs include only method/path/status, never body or key.
        super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser(description="Run Awen Music locally")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    docs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
    handler = functools.partial(AwenHandler, directory=docs_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Awen Music: http://127.0.0.1:{args.port}/")
    print("API proxy: local-only; press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
