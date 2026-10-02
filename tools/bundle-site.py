#!/usr/bin/env python3
"""Build one HTML file so the site can be opened without a private preview."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "study-plan.html"

CSS = [
    "style_v1.css",
    "style_v2.css",
    "style_v3.css",
    "css/pages/planning-panels.css",
    "css/compte.css",
]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def script_list():
    text = read("js/registre.js")
    match = re.search(r"STUDYPLAN_SCRIPTS\s*=\s*\[(.*?)\]", text, re.S)
    if not match:
        raise SystemExit("scripts introuvables")
    return re.findall(r"'([^']+)'", match.group(1))


def page_list():
    text = read("js/registre.js")
    match = re.search(r"STUDYPLAN_HTML\s*=\s*\[(.*?)\]", text, re.S)
    if not match:
        raise SystemExit("pages introuvables")
    return re.findall(r"'([^']+)'", match.group(1))


def inline_js(text):
    return text.replace("</script>", "<\\/script>")


def main():
    pages = {name: read(name) for name in page_list()}
    payload = json.dumps(pages, ensure_ascii=False).replace("<", "\\u003c")
    css = "\n".join(read(name) for name in CSS)
    scripts = "\n".join(
        '<script>\n' + inline_js(read(name)) + '\n</script>'
        for name in script_list()
    )
    html = """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Study Plan IB - Planificateur intelligent pour le Baccalauréat International</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
__CSS__
    </style>
</head>
<body>
    <!-- studyplan-public-bundle -->
    <div class="bg-shapes">
        <div class="shape shape-1 animate-float"></div>
        <div class="shape shape-2 animate-float-reverse"></div>
        <div class="shape shape-3 animate-float-subtle"></div>
    </div>
    <div id="app-pages"></div>
    <script type="application/json" id="studyplan-pages">__PAGES__</script>
    <script>
        (function () {
            var raw = document.getElementById('studyplan-pages').textContent;
            var pages = JSON.parse(raw);
            var order = __ORDER__;
            var root = document.getElementById('app-pages');
            root.innerHTML = order.map(function (name) { return pages[name] || ''; }).join('\\n');
            window.__STUDYPLAN_READY = true;
        })();
    </script>
__SCRIPTS__
</body>
</html>
"""
    order = json.dumps(page_list(), ensure_ascii=False)
    html = (html
            .replace("__CSS__", css)
            .replace("__PAGES__", payload)
            .replace("__ORDER__", order)
            .replace("__SCRIPTS__", scripts))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT} {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
