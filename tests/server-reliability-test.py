#!/usr/bin/env python3
"""Isolated tests for the local server; no provider or GitHub traffic."""

import json
import socket
import sys
import urllib.request
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server as awen_server


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def read_json(url, payload=None):
    from urllib.parse import urlparse
    parsed = urlparse(url)
    request = HTTPConnection(parsed.hostname, parsed.port, timeout=3)
    try:
        request.request("POST" if payload else "GET", parsed.path,
                        body=payload, headers={"Content-Type": "application/json"} if payload else {})
        response = request.getresponse()
        return response.status, json.loads(response.read().decode("utf-8"))
    finally:
        request.close()


class OversizedUpstream(BaseHTTPRequestHandler):
    def do_POST(self):
        # Deliberately larger than MAX_RESPONSE_BYTES. The Awen proxy must
        # reject it rather than returning an invalid partial JSON document.
        body = b"{" + (b"x" * (8 * 1024 * 1024 + 1))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


def main():
    upstream_port, awen_port = free_port(), free_port()
    while awen_port == upstream_port:
        awen_port = free_port()
    upstream = ThreadingHTTPServer(("127.0.0.1", upstream_port), OversizedUpstream)
    worker = threading.Thread(target=upstream.serve_forever, daemon=True)
    worker.start()
    # The test endpoint is a loopback fixture, never a real provider. Bypass
    # a workstation's optional corporate HTTP proxy just for this process.
    awen_server.urlopen = urllib.request.build_opener(urllib.request.ProxyHandler({})).open
    from functools import partial
    awen = ThreadingHTTPServer(("127.0.0.1", awen_port), partial(awen_server.AwenHandler, directory=str(ROOT / "docs")))
    awen_worker = threading.Thread(target=awen.serve_forever, daemon=True)
    awen_worker.start()
    try:
        status, body = read_json(f"http://127.0.0.1:{awen_port}/api/health")
        assert status == 200
        assert body["ok"] is True and body["service"] == "awen-local"
        assert body["projectRoot"] == str(ROOT)
        assert body["serverRevision"] == awen_server.SERVER_REVISION
        assert isinstance(body["pid"], int)
        payload = json.dumps({
            "endpoint": f"http://127.0.0.1:{upstream_port}/v1/test",
            "apiKey": "test-key",
            "payload": {"model": "isolated-test"},
        }).encode("utf-8")
        status, body = read_json(f"http://127.0.0.1:{awen_port}/api/llm", payload)
        assert status == 502
        assert body["error"] == "Upstream response is too large; it was not forwarded partially"
        print("PASS: health endpoint and oversized upstream response are explicit, never partial JSON")
    finally:
        awen.shutdown()
        awen.server_close()
        upstream.shutdown()
        upstream.server_close()


if __name__ == "__main__":
    main()
