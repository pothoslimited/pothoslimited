#!/usr/bin/env python3
"""Dependency-free weekly audit for the Pothos Limited static website."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import ssl
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


PRODUCTION_URL = "https://pothosltd.com/"
EXPECTED_FILES = (
    "index.html",
    "css/style.css",
    "js/script.js",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    "_headers",
)
SECURITY_HEADERS = (
    "content-security-policy",
    "permissions-policy",
    "referrer-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
)
IMAGE_SUFFIXES = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


@dataclass(frozen=True)
class Finding:
    severity: str
    area: str
    message: str


class SiteHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, int, str]] = []
        self.ids: list[tuple[str, int]] = []
        self.images: list[tuple[str, str | None, int]] = []
        self.has_canonical = False
        self.meta_properties: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        line, _ = self.getpos()

        element_id = values.get("id")
        if element_id:
            self.ids.append((element_id, line))

        for attribute in ("href", "src", "poster"):
            value = values.get(attribute)
            if value:
                self.references.append((value, line, attribute))

        srcset = values.get("srcset")
        if srcset:
            for candidate in srcset.split(","):
                reference = candidate.strip().split()[0] if candidate.strip() else ""
                if reference:
                    self.references.append((reference, line, "srcset"))

        if tag == "img":
            self.images.append((values.get("src", "unknown image"), values.get("alt"), line))

        if tag == "link" and "canonical" in (values.get("rel") or "").split():
            self.has_canonical = bool(values.get("href"))

        if tag == "meta":
            property_name = values.get("property") or values.get("name")
            if property_name and values.get("content"):
                self.meta_properties.add(property_name.lower())


def add(findings: list[Finding], severity: str, area: str, message: str) -> None:
    findings.append(Finding(severity, area, message))


def local_path(root: Path, reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if reference.startswith(("#", "mailto:", "tel:", "data:")):
        return None
    if parsed.scheme or parsed.netloc:
        if parsed.scheme not in {"http", "https"} or parsed.netloc not in {"pothosltd.com", "www.pothosltd.com"}:
            return None
    clean_path = unquote(parsed.path)
    if not clean_path or clean_path == "/":
        return root / "index.html"
    return root / clean_path.lstrip("/")


def detect_image_format(path: Path) -> str:
    header = path.read_bytes()[:16]
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header[:4] in (b"GIF8",):
        return "gif"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "webp"
    if header.startswith(b"<svg") or b"<svg" in header:
        return "svg"
    if len(header) >= 12 and header[4:12] in (b"ftypavif", b"ftypavis"):
        return "avif"
    return "unknown"


def expected_image_format(path: Path) -> str:
    return "jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else path.suffix.lower().lstrip(".")


def audit_repository(root: Path, findings: list[Finding]) -> tuple[SiteHTMLParser | None, set[Path]]:
    for relative_path in EXPECTED_FILES:
        path = root / relative_path
        if not path.is_file():
            add(findings, "high", "Repository", f"Required file is missing: `{relative_path}`.")
        elif path.stat().st_size == 0:
            add(findings, "high", "Repository", f"Required file is empty: `{relative_path}`.")

    index_path = root / "index.html"
    if not index_path.is_file():
        return None, set()

    html = index_path.read_text(encoding="utf-8")
    parser = SiteHTMLParser()
    try:
        parser.feed(html)
    except Exception as error:  # HTMLParser is tolerant; reaching this is actionable.
        add(findings, "high", "HTML", f"Could not parse `index.html`: {error}.")
        return parser, set()

    referenced_files: set[Path] = set()
    for reference, line, attribute in parser.references:
        path = local_path(root, reference)
        if path is None:
            continue
        referenced_files.add(path.resolve())
        if not path.exists():
            add(
                findings,
                "high",
                "References",
                f"`index.html:{line}` has a missing `{attribute}` target: `{reference}`.",
            )

    # Include assets referenced from metadata and JSON-LD, which HTMLParser does
    # not expose as normal src/href attributes.
    for reference in re.findall(r"assets/[A-Za-z0-9._/-]+", html):
        path = root / reference
        referenced_files.add(path.resolve())
        if not path.exists():
            add(findings, "high", "References", f"`index.html` references missing asset `{reference}`.")

    id_counts = Counter(element_id for element_id, _ in parser.ids)
    for duplicate_id, count in sorted(id_counts.items()):
        if count > 1:
            add(findings, "medium", "Accessibility", f"HTML id `{duplicate_id}` occurs {count} times.")

    for source, alt_text, line in parser.images:
        if source == "unknown image":
            continue
        if alt_text is None:
            add(findings, "medium", "Accessibility", f"Image `{source}` at `index.html:{line}` has no alt attribute.")
        elif not alt_text.strip():
            add(findings, "low", "Accessibility", f"Image `{source}` at `index.html:{line}` has empty alternative text; verify that it is decorative.")

    if not parser.has_canonical:
        add(findings, "medium", "SEO", "`index.html` is missing a canonical link.")

    for required_meta in ("description", "og:title", "og:description", "og:image", "twitter:card"):
        if required_meta not in parser.meta_properties:
            add(findings, "medium", "SEO", f"`index.html` is missing populated `{required_meta}` metadata.")

    if "coming soon" in html.lower():
        add(findings, "low", "Content", "`index.html` still contains one or more “coming soon” placeholders.")

    return parser, referenced_files


def audit_images(root: Path, referenced_files: set[Path], findings: list[Finding]) -> None:
    asset_root = root / "assets"
    if not asset_root.is_dir():
        add(findings, "high", "Images", "The `assets` directory is missing.")
        return

    total_bytes = 0
    for path in sorted(asset_root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        size = path.stat().st_size
        total_bytes += size
        relative = path.relative_to(root)
        actual = detect_image_format(path)
        expected = expected_image_format(path)

        if actual != expected:
            add(
                findings,
                "medium",
                "Images",
                f"`{relative}` uses a .{expected} extension but contains {actual.upper()} data.",
            )
        if size > 500_000:
            add(findings, "low", "Performance", f"`{relative}` is {size / 1_000_000:.2f} MB; consider optimizing it.")
        if path.resolve() not in referenced_files and "responsive" not in path.parts:
            add(findings, "info", "Images", f"`{relative}` is not referenced by `index.html`.")

    if total_bytes > 8_000_000:
        add(findings, "low", "Performance", f"Image assets total {total_bytes / 1_000_000:.2f} MB.")


def request_url(url: str) -> tuple[int, dict[str, str], str | None]:
    request = urllib.request.Request(url, headers={"User-Agent": "PothosWeeklyMaintenance/1.0"})
    context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=20, context=context) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, headers, None
    except urllib.error.HTTPError as error:
        return error.code, {key.lower(): value for key, value in error.headers.items()}, str(error)
    except Exception as error:
        return 0, {}, str(error)


def audit_production(findings: list[Finding]) -> None:
    status, headers, error = request_url(PRODUCTION_URL)
    if error or status != 200:
        add(findings, "critical", "Production", f"`{PRODUCTION_URL}` returned status {status or 'unavailable'}: {error or 'unexpected response'}.")
        return

    for header in SECURITY_HEADERS:
        if header not in headers:
            add(findings, "medium", "Security", f"Production response is missing the `{header}` header.")

    content_type = headers.get("content-type", "")
    if "text/html" not in content_type.lower():
        add(findings, "high", "Production", f"Homepage returned unexpected content type `{content_type or 'missing'}`.")

    for path in ("robots.txt", "sitemap.xml"):
        url = PRODUCTION_URL + path
        child_status, _, child_error = request_url(url)
        if child_error or child_status != 200:
            add(findings, "medium", "SEO", f"`{url}` returned status {child_status or 'unavailable'}: {child_error or 'unexpected response'}.")


def write_report(output: Path, root: Path, findings: list[Finding]) -> None:
    counts = Counter(finding.severity for finding in findings)
    timestamp = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    lines = [
        "# Pothos Limited weekly maintenance report",
        "",
        f"Generated: {timestamp}",
        f"Repository: `{root}`",
        f"Production URL: {PRODUCTION_URL}",
        "",
        "## Summary",
        "",
    ]

    if findings:
        lines.append(
            ", ".join(f"{counts[level]} {level}" for level in SEVERITY_ORDER if counts[level]) + "."
        )
        lines.extend(["", "## Findings", ""])
        for finding in sorted(findings, key=lambda item: (SEVERITY_ORDER[item.severity], item.area, item.message)):
            lines.append(f"- **{finding.severity.upper()} — {finding.area}:** {finding.message}")
    else:
        lines.append("No deterministic issues were found.")

    lines.extend(
        [
            "",
            "## Scope note",
            "",
            "This dependency-free audit checks repository structure, local references, image signatures and sizes, basic accessibility/SEO markers, production availability, and response headers. Codex should interpret these results and inspect source code for issues that deterministic checks cannot confirm.",
            "",
        ]
    )
    output.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--root", type=Path, required=True)
    argument_parser.add_argument("--output", type=Path, required=True)
    arguments = argument_parser.parse_args()

    root = arguments.root.resolve()
    output = arguments.output.resolve()
    findings: list[Finding] = []

    try:
        _, referenced_files = audit_repository(root, findings)
        audit_images(root, referenced_files, findings)
        audit_production(findings)
    except Exception as error:
        add(findings, "critical", "Audit", f"Maintenance checker failed unexpectedly: {error}.")

    output.parent.mkdir(parents=True, exist_ok=True)
    write_report(output, root, findings)
    print(f"Maintenance report written to {output}")
    print(Counter(finding.severity for finding in findings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
