#!/bin/sh

git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null || exit 1

# The dedicated S053 evidence branch must produce an exact-head Preview even
# when its only web-tree delta is evidence tooling. This branch is temporary
# and is never merged into main.
if [ "$VERCEL_GIT_COMMIT_REF" = "evidence/s053-current-main-20261004" ]; then
  exit 1
fi

# An explicit redeploy can be needed after Preview environment variables change.
# Vercel sets both SHAs to the same commit in that case, so let the build run.
if [ "$VERCEL_GIT_PREVIOUS_SHA" = "$VERCEL_GIT_COMMIT_SHA" ]; then
  exit 1
fi

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  ':(top)web/**' \
  ':(top)app/domain/**'
