#!/bin/sh
set -eu

mkdir -p "${Data__Directory:-/data}"

exec dotnet TrackerStats.Api.dll
