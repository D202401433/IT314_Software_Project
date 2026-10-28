#!/usr/bin/env python3
"""CLI utility to check and trigger monthly administrative boundary synchronization.

Usage:
    python scripts/sync_boundaries.py            # Check upstream and sync if due / modified
    python scripts/sync_boundaries.py --force    # Force immediate sync regardless of ETag
    python scripts/sync_boundaries.py --status   # Display current boundary sync status table
"""

import argparse
import sys
from pathlib import Path

# Add backend to sys.path so app modules are resolvable
ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.spatial_sync import check_and_sync_all_sources, get_sync_status  # noqa: E402


def main():
    parser = argparse.ArgumentParser(
        description="ResQ Spatial Boundaries Dynamic Sync Tool"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-synchronization of all sources regardless of ETag or check interval.",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print status of all tracked boundary sources and exit.",
    )
    args = parser.parse_args()

    if args.status:
        print("[*] Querying current boundary synchronization state...")
        try:
            status_list = get_sync_status()
            if not status_list:
                print("No boundary sources recorded yet in boundary_sync_state.")
                return
            print(f"{'Source Key':<25} {'Status':<15} {'Features':<10} {'Last Checked':<25} {'ETag':<15}")
            print("-" * 90)
            for s in status_list:
                print(
                    f"{s['source_key']:<25} {s['status']:<15} {s['feature_count']:<10} "
                    f"{str(s['last_checked_at'])[:19]:<25} {str(s['etag'] or 'None'):<15}"
                )
        except Exception as exc:
            print(f"Error querying sync status: {exc}")
        return

    print(f"[*] Starting spatial boundary sync (force={args.force})...")
    try:
        results = check_and_sync_all_sources(force=args.force)
        for r in results:
            print(f" -> [{r.get('source')}]: {r.get('status')} (count: {r.get('count', 0)}, reason: {r.get('reason')})")
        print("[+] Spatial boundary check finished successfully.")
    except Exception as exc:
        print(f"[-] Spatial boundary sync failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
