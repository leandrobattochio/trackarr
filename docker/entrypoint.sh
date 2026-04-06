#!/bin/sh
set -eu

plugins_dir="${Plugins__Directory:-/data/templates}"
source_dir="/app/built-in-templates"

mkdir -p /data
mkdir -p "$plugins_dir"

if [ -d "$source_dir" ]; then
  find "$source_dir" -maxdepth 1 -type f -name '*.yaml' | while read -r source_path; do
    target_path="$plugins_dir/$(basename "$source_path")"
    if [ ! -f "$target_path" ]; then
      cp "$source_path" "$target_path"
    fi
  done
fi

exec dotnet TrackerStats.Api.dll
