#!/usr/bin/env python3
"""
tools/scan-metadata.py
扫描 received 目录，生成/验证元数据库
"""

import hashlib
import json
import os
import sys
import glob

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RECEIVED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "received")
META_FILE = os.path.join(RECEIVED_DIR, "metadata.jsonl")

SUPPORTED_EXT = ('.jpg', '.png', '.gif', '.txt')


def compute_sha256(filepath):
    """Compute SHA256 of a file."""
    h = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return ""


def load_existing_metadata():
    """Load existing metadata into dict: path -> entry."""
    existing = {}
    if not os.path.exists(META_FILE):
        return existing
    try:
        with open(META_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                existing[entry.get("path", "")] = entry
    except Exception as e:
        print("读取元数据库失败: {}".format(e))
    return existing


def scan_and_update():
    """Scan received/ and update metadata."""
    existing = load_existing_metadata()
    new_entries = []
    warnings = []
    updated_count = 0
    new_count = 0
    match_count = 0

    lrit_base = os.path.join(RECEIVED_DIR, "LRIT")
    if not os.path.isdir(lrit_base):
        print("未找到目录: {}".format(lrit_base))
        return

    files = []
    for root, dirs, filenames in os.walk(lrit_base):
        for f in filenames:
            if f.lower().endswith(SUPPORTED_EXT):
                files.append(os.path.join(root, f))

    files.sort()
    total = len(files)
    print("扫描到 {} 个文件\n".format(total))

    for i, filepath in enumerate(files):
        rel_path = os.path.relpath(filepath, RECEIVED_DIR).replace("\\", "/")
        sha256 = compute_sha256(filepath)

        if rel_path in existing:
            existing_entry = existing[rel_path]
            if existing_entry.get("sha256") == sha256:
                match_count += 1
            else:
                warnings.append(
                    "WARNING: sha256 mismatch: {} (expected: {}, actual: {})".format(
                        rel_path, existing_entry.get("sha256", ""), sha256
                    )
                )
        else:
            # New file - create metadata entry
            fname = os.path.basename(filepath)
            entry = {
                "file_name": fname,
                "path": rel_path,
                "type": "",
                "product": "",
                "observation_mode": "",
                "date": "",
                "time": "",
                "saved_at": "",
                "size": os.path.getsize(filepath),
                "sha256": sha256,
            }

            # Try to parse filename
            parts = fname.replace('.', '_').split('_')
            if fname.startswith("IMG_"):
                entry["type"] = "IMG"
                if len(parts) >= 3:
                    entry["observation_mode"] = parts[1]
                    entry["product"] = parts[1]
                # Check for FC/IRE
                parent = os.path.dirname(filepath)
                base = os.path.basename(filepath)
                fc_path = os.path.join(parent, "FC", base)
                if os.path.exists(fc_path):
                    entry["fc"] = os.path.relpath(fc_path, RECEIVED_DIR).replace("\\", "/")
                ire_path = os.path.join(parent, "IRE", base)
                if os.path.exists(ire_path):
                    entry["ire"] = os.path.relpath(ire_path, RECEIVED_DIR).replace("\\", "/")
            elif fname.startswith("ADD_"):
                entry["type"] = "ADD"
                if len(parts) >= 3:
                    entry["product"] = parts[1]

            # Extract date/time from path
            path_parts = rel_path.replace("\\", "/").split("/")
            for p in path_parts:
                if len(p) == 8 and p.isdigit():
                    entry["date"] = p
                    break

            new_entries.append(entry)
            new_count += 1

        # Progress indicator
        if (i + 1) % 100 == 0 or i == total - 1:
            print("\r处理中: {}/{}".format(i + 1, total), end="", flush=True)

    print()

    # Write new entries
    if new_entries:
        with open(META_FILE, "a", encoding="utf-8") as f:
            for entry in new_entries:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    # Print report
    print("\n====== 扫描报告 ======")
    print("已有记录 (SHA256 匹配): {}".format(match_count))
    print("新增记录: {}".format(new_count))
    print("总计文件: {}".format(total))
    if warnings:
        print("\n警告 ({} 条):".format(len(warnings)))
        for w in warnings:
            print("  " + w)
    else:
        print("\nSHA256 全部一致，无警告")


if __name__ == "__main__":
    scan_and_update()
