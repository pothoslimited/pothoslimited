#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repository_root=$(CDPATH= cd -- "$script_dir/.." && pwd)
output_path=${1:-"$repository_root/maintenance-report.md"}

exec python3 "$script_dir/weekly-maintenance.py" \
    --root "$repository_root" \
    --output "$output_path"
