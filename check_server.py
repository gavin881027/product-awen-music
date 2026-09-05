"""Read-only identity check. Never changes ports or kills another process."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import build_opener, ProxyHandler

urlopen = build_opener(ProxyHandler({})).open


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    expected = hashlib.sha256((root / 'server.py').read_bytes()).hexdigest()[:16]
    try:
        with urlopen(f'http://127.0.0.1:{args.port}/api/health', timeout=3) as response:
            health = json.load(response)
        if health.get('projectRoot') != str(root) or health.get('serverRevision') != expected:
            raise ValueError('服务目录或运行代码与当前工作树不一致')
    except Exception:
        print('现有服务无法确认为当前版本；请停止旧服务后重新启动。未切换端口。')
        return 1
    print(f'当前版本已运行：http://127.0.0.1:{args.port}/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
