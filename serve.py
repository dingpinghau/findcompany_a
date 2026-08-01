"""Production entrypoint — reads PORT directly via os.environ so the start
command never depends on the platform's shell expanding $PORT (Zeabur's
Start Command is not run through a shell, so `--port $PORT` fails there).
"""

import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port)
