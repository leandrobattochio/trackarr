#!/usr/bin/env bash
# Prints the CHANGELOG.md section of the version tagged in GITHUB_REF_NAME (a leading "v" is dropped).
set -euo pipefail

version="${GITHUB_REF_NAME:?GITHUB_REF_NAME is not set}"
version="${version#v}"
changelog="${1:-CHANGELOG.md}"

section=$(awk -v heading="## [${version}]" '
  /^## / { if (found) exit; found = index($0, heading) == 1; next }
  /^\[[^]]+\]: / { next }
  found { print }
' "$changelog" | sed -e '/./,$!d')

if [ -z "$section" ]; then
  echo "::error file=${changelog}::${changelog} has no section for version ${version}" >&2
  exit 1
fi

printf '%s\n' "$section"
