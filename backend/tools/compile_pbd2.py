from __future__ import annotations

import sys
import importlib
from pathlib import Path


def main() -> int:
    script_path = Path(__file__).resolve()
    candidate_roots = [
        script_path.parents[2],
        script_path.parents[1],
        Path.cwd(),
        Path.cwd().parent,
    ]

    repo_root: Path | None = None
    for candidate in candidate_roots:
        if (candidate / "pbd2.proto").exists() and (candidate / "backend").exists():
            repo_root = candidate
            break

    if repo_root is None:
        repo_root = script_path.parents[2]

    proto_file = repo_root / "pbd2.proto"
    output_dir = repo_root / "backend" / "app" / "integrations" / "crfs" / "generated"

    if not proto_file.exists():
        print(f"Proto file not found: {proto_file}")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)
    init_file = output_dir / "__init__.py"
    if not init_file.exists():
        init_file.write_text("", encoding="utf-8")

    try:
        protoc = importlib.import_module("grpc_tools.protoc")
    except Exception as exc:
        print(f"grpc_tools import failed: {exc}")
        print("Install dependencies: pip install -r backend/requirements.txt")
        return 1

    command = [
        "grpc_tools.protoc",
        f"-I{repo_root}",
        f"--python_out={output_dir}",
        str(proto_file),
    ]

    result = protoc.main(command)
    if result != 0:
        print(f"protoc compilation failed with code {result}")
        return result

    generated = output_dir / "pbd2_pb2.py"
    if generated.exists():
        print(f"Generated: {generated}")
    else:
        print("Compilation returned success but output file was not found")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
