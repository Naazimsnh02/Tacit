"""Starts a device-code login against a running, private Codex runner service."""

from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen


def main() -> None:
    secret = os.environ.get("CODEX_SUBSCRIPTION_RUNNER_SECRET")
    if not secret:
        raise SystemExit("CODEX_SUBSCRIPTION_RUNNER_SECRET is required.")
    request = Request(
        "http://127.0.0.1:8100/codex/auth/device",
        method="POST",
        headers={"X-Tacit-Codex-Runner-Secret": secret},
    )
    with urlopen(request, timeout=15) as response:
        challenge = json.loads(response.read())
    print("Open this URL in a browser and enter the displayed code:")
    print(challenge["verification_url"])
    print(challenge["user_code"])


if __name__ == "__main__":
    main()
