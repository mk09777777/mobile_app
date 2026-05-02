#!/usr/bin/env bash
# Run Gradle from android/ with JAVA_HOME, ANDROID_HOME, and sdk.dir for this machine.
# Creates android/local.properties if missing (file is gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" == "Darwin" ]] && [[ -x /usr/libexec/java_home ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home)"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="${PATH}:${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools"

if [[ ! -f android/local.properties ]]; then
  printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
  echo "Created android/local.properties with sdk.dir=$ANDROID_HOME" >&2
fi

cd android
exec ./gradlew "$@"
