#!/usr/bin/env python3
"""
generate_blog_manifest.py

Scan the `portfolio/blogs/` directory and produce a manifest.json that lists
each blog directory, its index file (if any), resource files (excluding the
index), and asset subdirectories.

Usage:
    python3 portfolio/scripts/generate_blog_manifest.py
    python3 portfolio/scripts/generate_blog_manifest.py --blogs-dir path/to/blogs --out path/to/manifest.json
    python3 portfolio/scripts/generate_blog_manifest.py --dry-run

Conventions:
- Each immediate subdirectory of the blogs root is treated as a single blog.
- Index candidates (checked in order): index.md, index.markdown, index.html, index.htm.
  If no index candidate is found, the script will pick the first Markdown file in the folder.
  If no Markdown files exist, `index` will be set to null in the manifest for that blog.
- `resources` contains files in the blog folder excluding the index file(s).
- `assets` lists subdirectories inside the blog folder (trailing slash included).
- Paths in the manifest are returned relative to the blogs root (e.g. "AgentTesla_Analysis/AgentTesla.md").

The manifest format is intentionally simple and safe for static hosting.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Files considered index candidates (in priority order)
INDEX_CANDIDATES = ["index.md", "index.markdown", "index.html", "index.htm"]


# Hidden files/dirs (skip)
def is_hidden(name: str) -> bool:
    return name.startswith(".")


def find_index_file(files: List[str]) -> Optional[str]:
    """Return the index filename from the files list using INDEX_CANDIDATES priority.
    If none matched, returns the first markdown-like file or None."""
    lower = {f.lower(): f for f in files}
    for cand in INDEX_CANDIDATES:
        if cand in lower:
            return lower[cand]
    # fallback: first markdown file
    for f in files:
        if f.lower().endswith((".md", ".markdown")):
            return f
    return None


def scan_blog_dir(blogs_root: str, blog_dir_name: str) -> Dict:
    """Scan a single blog directory and return a manifest entry for it."""
    blog_path = os.path.join(blogs_root, blog_dir_name)
    if not os.path.isdir(blog_path):
        raise NotADirectoryError(blog_path)

    entries = sorted(os.listdir(blog_path))
    files = [
        f
        for f in entries
        if os.path.isfile(os.path.join(blog_path, f)) and not is_hidden(f)
    ]
    dirs = [
        d
        for d in entries
        if os.path.isdir(os.path.join(blog_path, d)) and not is_hidden(d)
    ]

    index_file = find_index_file(files)
    # resources: all files except the index candidate(s) and meta.json
    resources = []
    for f in files:
        if index_file and f == index_file:
            continue
        if f == "meta.json":
            continue
        resources.append(f)

    assets = [d + "/" for d in dirs]

    # Try to read display name from meta.json, fallback to directory name
    display_name = blog_dir_name.replace("_", " ")
    meta_path = os.path.join(blog_path, "meta.json")
    if os.path.isfile(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta_data = json.load(f)
                if meta_data.get("title"):
                    display_name = meta_data["title"]
        except (json.JSONDecodeError, IOError):
            # Keep the fallback display name if meta.json is invalid
            pass

    entry = {
        "id": blog_dir_name,
        "dir": blog_dir_name,
        "displayName": display_name,
        "index": os.path.join(blog_dir_name, index_file).replace("\\", "/")
        if index_file
        else None,
        "resources": sorted(resources),
        "assets": sorted(assets),
    }
    return entry


def build_manifest(blogs_root: str) -> Dict:
    """Scan the blogs_root and construct the manifest structure."""
    if not os.path.isdir(blogs_root):
        raise FileNotFoundError(f"Blogs root not found: {blogs_root}")

    entries = sorted(os.listdir(blogs_root))
    blogs = []
    for name in entries:
        if is_hidden(name):
            continue
        full = os.path.join(blogs_root, name)
        if os.path.isdir(full):
            try:
                blog_entry = scan_blog_dir(blogs_root, name)
                blogs.append(blog_entry)
            except Exception as e:
                # skip problematic entries but continue
                print(f"Warning: failed scanning '{name}': {e}", file=sys.stderr)

    manifest = {
        "version": 1,
        "generated": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "root": os.path.basename(os.path.normpath(blogs_root)),
        "blogs": blogs,
        "schemaNotes": {
            "pathsAreRelativeTo": blogs_root,
            "conventions": [
                "Each blog folder's index entry should point to its main page (index.md or index.html).",
                "'resources' lists files within the blog folder excluding the index file.",
                "'assets' lists directories under the blog folder (with trailing slash).",
            ],
        },
    }
    return manifest


def write_manifest(manifest: Dict, out_path: str) -> None:
    """Write manifest to out_path atomically."""
    out_dir = os.path.dirname(out_path)
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, out_path)


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Generate blogs/manifest.json for portfolio blog renderer"
    )
    p.add_argument(
        "--blogs-dir",
        default="portfolio/blogs",
        help="Path to blogs root directory (default: portfolio/blogs)",
    )
    p.add_argument(
        "--out",
        default="portfolio/blogs/manifest.json",
        help="Output manifest path (default: portfolio/blogs/manifest.json)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print manifest to stdout instead of writing",
    )
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    blogs_dir = args.blogs_dir
    out_path = args.out

    try:
        manifest = build_manifest(blogs_dir)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(2)

    if args.dry_run:
        print(json.dumps(manifest, indent=2, ensure_ascii=False))
        return

    try:
        write_manifest(manifest, out_path)
        print(
            f"Wrote manifest to {out_path} (blogs root: {os.path.abspath(blogs_dir)})"
        )
    except Exception as e:
        print(f"Failed to write manifest: {e}", file=sys.stderr)
        sys.exit(3)


if __name__ == "__main__":
    main()

# Usage notes
# ----------------
# This script generates (or updates) a manifest JSON describing the contents
# of the blogs directory. Place it in your repo and run it whenever you add or
# modify blog folders so the client-side renderer can discover new blogs.
#
# Examples:
#  - Run with defaults (scans portfolio/blogs and writes portfolio/blogs/manifest.json):
#      python3 portfolio/scripts/generate_blog_manifest.py
#
#  - Dry run (prints manifest to stdout without writing):
#      python3 portfolio/scripts/generate_blog_manifest.py --dry-run
#
#  - Specify a custom blogs directory and output path:
#      python3 portfolio/scripts/generate_blog_manifest.py --blogs-dir path/to/blogs --out path/to/manifest.json
#
# Recommended usage:
#  - Run the script after adding a new blog folder, or incorporate it into
#    your build/CI pipeline so the manifest remains up-to-date automatically.
#  - You can also add a Git pre-commit hook or a small Makefile/npm script that
#    runs this script before publishing.
#
# Notes & extensions:
#  - The script currently detects an index file by checking: index.md, index.markdown,
#    index.html, index.htm (in that order). If none is found it falls back to the
#    first markdown file in the folder (if present).
#  - `resources` lists regular files in the blog folder excluding the detected index.
#  - `assets` lists subdirectories inside the blog folder (helpful for images/attachments).
#  - If you want the manifest to include parsed frontmatter (title/summary/author/date)
#    so the client can render blog cards without fetching each index file, I can
#    extend this script to parse frontmatter and embed that metadata into the manifest.
#  - The manifest paths are relative to the blogs directory. Adjust the client
#    renderer if you serve the blogs from a different base path.
#
# Safe operation:
#  - The script writes the manifest atomically (writes to a .tmp file then renames),
#    so partial writes are avoided.
#
# If you want me to add an automatic invocation (Makefile target, npm script, or CI job),
# tell me which you prefer and I will add it.
