#!/usr/bin/env bash
# One-time setup for SyscallScope on Ubuntu / WSL2. Run from the project root:  bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this as your normal user (it will call sudo where needed), not as root." >&2
  exit 1
fi

echo "==> Installing system packages (strace, compiler, Python venv)"
sudo apt update
sudo apt install -y strace build-essential python3-venv python3-pip curl

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "==> Installing Node.js 20 LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "==> Compiling sample programs"
make -C sample_programs

echo "==> Creating Python virtual environment"
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r backend/requirements.txt

echo "==> Installing frontend dependencies"
(cd frontend && npm install)

scope=$(cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null || echo "n/a")
echo
echo "ptrace_scope = $scope"
if [ "$scope" = "2" ] || [ "$scope" = "3" ]; then
  echo "Tracing is restricted. Allow tracing of your own child processes with:"
  echo "  sudo sysctl kernel.yama.ptrace_scope=1"
fi
echo
echo "Setup complete. Start the app with:  bash scripts/run.sh"
