#!/bin/bash
# Vercel Ignored Build Step Script
# Determines whether Vercel should build or cancel based on Git changes

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

# Only check on non-empty parent commits
if [ -n "$CACHED_COMMIT_REF" ]; then
  # Check if any files under frontend/ or shared root configs changed
  CHANGED=$(git diff --name-only "$CACHED_COMMIT_REF" "$VERCEL_GIT_COMMIT_SHA" -- . ':!backend' ':!ai-workers')
  
  if [ -z "$CHANGED" ]; then
    echo "🛑 No frontend files changed. Skipping Vercel build."
    exit 0
  fi
fi

echo "✅ Frontend changes detected. Proceeding with Vercel build."
exit 1
