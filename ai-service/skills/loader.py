# Skills loader — reads markdown skill files with YAML frontmatter from
# agent-type-specific directories and returns them as structured dicts.
#
# The caller (agent base class) passes an AgentType; only skills in the
# corresponding directory are loaded. Storefront agents have zero code
# path to admin skills — the directory is never scanned, the files are
# never read.
import os
import re
from typing import Any

from agents.types import AgentType, SKILL_DIR_MAP

_SKILLS_ROOT = os.path.join(os.path.dirname(__file__))


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Parse YAML frontmatter from a markdown string.

    Expects the file to start with ``---``, followed by YAML-like key: value
    lines, then a closing ``---``. Returns (frontmatter_dict, body_text).
    If no frontmatter is found, returns ({}, text).
    """
    text = text.lstrip("﻿")  # strip BOM if present
    if not text.startswith("---"):
        return {}, text

    # Find closing ---
    end = text.find("---", 3)
    if end == -1:
        return {}, text

    raw = text[3:end].strip()
    body = text[end + 3 :].strip()

    frontmatter: dict[str, Any] = {}
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^(\w[\w_-]*)\s*:\s*(.+)$", line)
        if match:
            key = match.group(1)
            value = match.group(2).strip()
            # Strip surrounding quotes if present
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            frontmatter[key] = value

    return frontmatter, body


def load_skills(agent_type: AgentType) -> list[dict[str, Any]]:
    """Load all skill files for the given agent type.

    Returns a list of dicts with keys: name, description, content.
    Returns an empty list if no skills are found or the directory
    doesn't exist. Never scans directories belonging to other agent types.
    """
    dir_name = SKILL_DIR_MAP.get(agent_type)
    if not dir_name:
        return []

    skills_dir = os.path.join(_SKILLS_ROOT, dir_name)
    if not os.path.isdir(skills_dir):
        return []

    skills: list[dict[str, Any]] = []
    for entry in sorted(os.listdir(skills_dir)):
        if not entry.endswith(".md"):
            continue
        filepath = os.path.join(skills_dir, entry)
        try:
            with open(filepath, encoding="utf-8") as f:
                content = f.read()
        except OSError:
            continue

        frontmatter, body = _parse_frontmatter(content)

        # Only include skills with valid frontmatter
        name = frontmatter.get("name", entry.replace(".md", ""))
        description = frontmatter.get("description", "")

        skills.append({
            "name": name,
            "description": description,
            "content": body,
            "source": entry,
        })

    return skills
