import asyncio
import os
import shlex
from pathlib import Path

from dotenv import load_dotenv

from supermemory_bash import create_bash


DOCS_DIR = Path(__file__).parent / "docs"
CONTAINER_PATH = "/contracts"


async def main() -> None:
    load_dotenv()

    result = await create_bash(
        api_key=os.environ["SUPERMEMORY_API_KEY"],
        container_tag="legal_docs",
    )
    bash = result.bash

    await bash.exec(f"mkdir -p {CONTAINER_PATH}")

    files = sorted(DOCS_DIR.glob("*.txt"))
    if not files:
        print(f"No .txt files found in {DOCS_DIR}")
        return

    for path in files:
        content = path.read_text()
        target = f"{CONTAINER_PATH}/{path.name}"
        cmd = f"cat > {shlex.quote(target)} <<'SMEOF_DOC'\n{content}\nSMEOF_DOC"
        r = await bash.exec(cmd)
        if r.exit_code != 0:
            print(f"FAILED {path.name}: {r.stderr}")
            continue
        print(f"ingested {target} ({len(content)} bytes)")

    listing = await bash.exec(f"ls -la {CONTAINER_PATH}")
    print("\nContainer contents:")
    print(listing.stdout)


if __name__ == "__main__":
    asyncio.run(main())
