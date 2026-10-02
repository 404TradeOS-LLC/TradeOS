#!/bin/sh

git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1

# An explicit redeploy can be needed after Preview environment variables change.
# Vercel sets both SHAs to the same commit in that case, so let the build run.
if [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  exit 1
fi

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  ':(top)web/**' \
  ':(top)app/domain/**'
