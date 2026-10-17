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

# For Pull Request preview builds: verify that GitHub Actions CI has completed successfully
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ] && [ -n "$VERCEL_GIT_COMMIT_SHA" ]; then
  REPO="Siddhcreator-1706/IT314_Software_Project"
  echo "🔍 Checking GitHub Actions CI status for commit $VERCEL_GIT_COMMIT_SHA..."

  # Query GitHub commit check runs
  CHECK_STATUS=$(curl -s "https://api.github.com/repos/$REPO/commits/$VERCEL_GIT_COMMIT_SHA/check-runs" \
    -H "Accept: application/vnd.github+json" \
    | grep -o '"conclusion": "[^"]*"' | head -10)

  # If any check failed or if checks are still in progress / no checks finished yet
  if echo "$CHECK_STATUS" | grep -q '"conclusion": "failure"'; then
    echo "🛑 GitHub Actions CI failed. Cancelling Vercel preview build."
    exit 0
  fi

  # If CI gatekeeper has not succeeded yet, do not build yet
  if ! echo "$CHECK_STATUS" | grep -q '"conclusion": "success"'; then
    echo "⏳ GitHub Actions CI is still running or pending. Deferring Vercel preview until CI passes."
    exit 0
  fi
fi

echo "✅ Frontend changes detected and CI checks verified. Proceeding with Vercel build."
exit 1
