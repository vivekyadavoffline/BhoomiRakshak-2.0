import json
import os
import shutil
import subprocess
from typing import Any


class TinyFishError(RuntimeError):
    """Raised when the TinyFish CLI cannot complete a request."""


def search_web(query: str) -> dict[str, Any]:
    api_key = os.getenv("TINYFISH_API_KEY")
    if not api_key:
        raise TinyFishError("TINYFISH_API_KEY is not configured on the backend")

    npx_command = shutil.which("npx.cmd") or shutil.which("npx")
    tinyfish_command = shutil.which("tinyfish")
    if tinyfish_command:
        command = [tinyfish_command, "search", "query", "--pretty", "--", query]
    elif npx_command:
        command = [npx_command, "-y", "@tiny-fish/cli@latest", "search", "query", "--pretty", "--", query]
    else:
        raise TinyFishError("TinyFish CLI requires either tinyfish or npx on PATH")

    environment = os.environ.copy()
    environment["TINYFISH_API_KEY"] = api_key
    try:
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
            env=environment,
        )
    except subprocess.TimeoutExpired as error:
        raise TinyFishError("TinyFish search timed out") from error

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise TinyFishError(detail or "TinyFish search failed")

    output = completed.stdout.strip()
    try:
        results: Any = json.loads(output)
    except json.JSONDecodeError:
        results = output
    return {"query": query, "results": results}
