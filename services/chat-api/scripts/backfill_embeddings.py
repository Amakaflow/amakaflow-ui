#!/usr/bin/env python3
"""
Backfill embeddings for existing workouts (AMA-503).

This script generates embeddings for workouts that don't have them,
enabling semantic search across the entire workout library.

Usage:
    python scripts/backfill_embeddings.py [options]

Options:
    --table TABLE        Table to process: workouts or follow_along_workouts
    --batch-size N       Number of workouts per batch (default: 100)
    --delay SECONDS      Delay between batches for rate limiting (default: 0)
    --dry-run            Show counts without generating embeddings
    --progress-only      Only show current progress, then exit

Examples:
    # Show current embedding progress
    python scripts/backfill_embeddings.py --progress-only

    # Dry run to see what would be processed
    python scripts/backfill_embeddings.py --dry-run

    # Backfill with default settings
    python scripts/backfill_embeddings.py

    # Backfill with rate limiting (0.5s between batches)
    python scripts/backfill_embeddings.py --delay 0.5

    # Backfill follow-along workouts
    python scripts/backfill_embeddings.py --table follow_along_workouts
"""
import argparse
import os
import sys
import time
from typing import Any, Dict, List, NamedTuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from supabase import create_client

from application.use_cases.generate_embeddings import EmbeddingResult
from backend.services.embedding_service import (
    EmbeddingService,
    build_content,
    content_hash,
)
from infrastructure.db.embedding_repository import SupabaseEmbeddingRepository


class WorkoutContent(NamedTuple):
    """Container for workout data prepared for embedding."""

    workout: Dict[str, Any]
    text: str
    content_hash: str


def get_supabase_client():
    """Create Supabase client with service role key."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    return create_client(url, key)


def get_embedding_service():
    """Create OpenAI embedding service."""
    api_key = os.environ.get("OPENAI_API_KEY")

    if not api_key:
        print("ERROR: OPENAI_API_KEY must be set")
        sys.exit(1)

    return EmbeddingService(api_key=api_key)


def show_progress(repo: SupabaseEmbeddingRepository, table: str) -> dict:
    """Display and return current embedding progress."""
    progress = repo.get_progress(table)
    print(f"\nProgress for '{table}':")
    print(f"  Total workouts:    {progress['total']}")
    print(f"  Already embedded:  {progress['embedded']}")
    print(f"  Remaining:         {progress['remaining']}")
    return progress


def backfill_embeddings(
    table: str = "workouts",
    batch_size: int = 100,
    delay: float = 0.0,
    dry_run: bool = False,
) -> EmbeddingResult:
    """
    Generate embeddings for workouts missing them.

    Args:
        table: 'workouts' or 'follow_along_workouts'
        batch_size: Number of workouts per batch
        delay: Seconds to wait between batches (rate limiting)
        dry_run: If True, only show what would be processed

    Returns:
        EmbeddingResult with counts and any errors
    """
    supabase = get_supabase_client()
    repo = SupabaseEmbeddingRepository(supabase)

    # Show initial progress
    initial_progress = show_progress(repo, table)

    if initial_progress["remaining"] == 0:
        print("\nAll workouts already have embeddings. Nothing to do.")
        return EmbeddingResult()

    if dry_run:
        print(f"\n[DRY RUN] Would process {initial_progress['remaining']} workouts")
        print(f"[DRY RUN] Batch size: {batch_size}")
        print(
            f"[DRY RUN] Estimated batches: "
            f"{(initial_progress['remaining'] + batch_size - 1) // batch_size}"
        )
        return EmbeddingResult(total_processed=initial_progress["remaining"])

    embedding_service = get_embedding_service()
    result = EmbeddingResult()
    skip_ids: set[str] = set()
    batch_num = 0
    start_time = time.time()

    print(f"\nStarting backfill with batch_size={batch_size}, delay={delay}s...")
    print("-" * 50)

    while True:
        # Fetch next batch of unembedded workouts
        batch = repo.get_workouts_without_embeddings(table=table, limit=batch_size)

        # Filter out already-skipped/errored IDs
        batch = [w for w in batch if w["id"] not in skip_ids]

        if not batch:
            break

        batch_num += 1
        batch_start = time.time()
        print(f"\nBatch {batch_num}: Processing {len(batch)} workouts...")

        # Build content for each workout
        contents: List[WorkoutContent] = []
        for w in batch:
            result.total_processed += 1
            text = build_content(w)
            if not text.strip():
                result.total_skipped += 1
                skip_ids.add(w["id"])
                print(f"  Skipped {w['id']}: empty content")
                continue
            contents.append(WorkoutContent(w, text, content_hash(text)))

        if not contents:
            continue

        # Call OpenAI embedding API
        texts = [c.text for c in contents]
        try:
            embeddings = embedding_service.embed_batch(texts)
        except Exception as e:
            print(f"  ERROR: Batch embedding failed: {e}")
            for item in contents:
                result.errors.append({"workout_id": item.workout["id"], "error": str(e)})
                skip_ids.add(item.workout["id"])
            continue

        # Save each embedding to database
        for item, embedding in zip(contents, embeddings):
            try:
                repo.save_embedding(
                    table=table,
                    workout_id=item.workout["id"],
                    embedding=embedding,
                    content_hash=item.content_hash,
                )
                result.total_embedded += 1
            except Exception as e:
                print(f"  ERROR: Failed to save {item.workout['id']}: {e}")
                result.errors.append({"workout_id": item.workout["id"], "error": str(e)})
                skip_ids.add(item.workout["id"])

        batch_duration = time.time() - batch_start
        print(
            f"  Embedded: {result.total_embedded} | "
            f"Skipped: {result.total_skipped} | "
            f"Errors: {len(result.errors)} | "
            f"Batch time: {batch_duration:.2f}s"
        )

        # Rate limiting delay
        if delay > 0:
            print(f"  Waiting {delay}s before next batch...")
            time.sleep(delay)

    result.duration_seconds = round(time.time() - start_time, 2)

    # Show final progress
    print("-" * 50)
    print("\nBackfill complete!")
    show_progress(repo, table)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Backfill embeddings for existing workouts (AMA-503)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s --progress-only          # Check current progress
    %(prog)s --dry-run                # Preview without changes
    %(prog)s                          # Run backfill
    %(prog)s --batch-size 50 --delay 1  # Slower, rate-limited run
""",
    )
    parser.add_argument(
        "--table",
        choices=["workouts", "follow_along_workouts"],
        default="workouts",
        help="Table to process (default: workouts)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of workouts per batch (default: 100)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Seconds to wait between batches (default: 0)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without generating embeddings",
    )
    parser.add_argument(
        "--progress-only",
        action="store_true",
        help="Only show current progress, then exit",
    )

    args = parser.parse_args()

    print("=" * 50)
    print("AMA-503: Embedding Backfill Script")
    print("=" * 50)

    if args.progress_only:
        supabase = get_supabase_client()
        repo = SupabaseEmbeddingRepository(supabase)
        show_progress(repo, args.table)
        return

    if args.dry_run:
        print("\n[DRY RUN MODE] No changes will be made")

    result = backfill_embeddings(
        table=args.table,
        batch_size=args.batch_size,
        delay=args.delay,
        dry_run=args.dry_run,
    )

    # Print summary
    print("\n" + "=" * 50)
    print("Summary:")
    print(f"  Total processed: {result.total_processed}")
    print(f"  Embedded:        {result.total_embedded}")
    print(f"  Skipped:         {result.total_skipped}")
    print(f"  Errors:          {len(result.errors)}")
    print(f"  Duration:        {result.duration_seconds}s")

    if result.errors:
        print("\nErrors encountered:")
        for err in result.errors[:10]:  # Show first 10 errors
            print(f"  - {err['workout_id']}: {err['error']}")
        if len(result.errors) > 10:
            print(f"  ... and {len(result.errors) - 10} more errors")

    # Exit with error code if there were failures
    if result.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
