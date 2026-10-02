#!/usr/bin/env python3
"""Upload a public copy of the site and record the working link."""

import json
import os
import pathlib
import subprocess
import traceback
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHA = os.environ.get("SHA") or os.environ.get("GITHUB_SHA") or ""
REPO = os.environ.get("GITHUB_REPOSITORY", "sawadogojuliss-byte/Learning-DP1")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""


def run(args, timeout=90):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def verify(url):
    proc = run([
        "curl", "-sL", "--max-time", "40",
        "-D", "/tmp/headers.txt", "-o", "/tmp/got.html",
        "-w", "%{http_code} %{content_type}", url,
    ])
    meta = (proc.stdout or "").strip()
    headers = pathlib.Path("/tmp/headers.txt").read_text(encoding="utf-8", errors="replace").lower() if pathlib.Path("/tmp/headers.txt").exists() else ""
    body = pathlib.Path("/tmp/got.html").read_text(encoding="utf-8", errors="replace") if pathlib.Path("/tmp/got.html").exists() else ""
    ok = (
        meta.startswith("200")
        and "text/html" in meta
        and "studyplan-public-bundle" in body
        and "content-disposition: attachment" not in headers
    )
    return ok, meta, body[:80].replace("\n", " ")


def upload_attempts(site, launcher):
    attempts = []
    commands = [
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", "reqtype=fileupload", "-F", f"fileToUpload=@{site};type=text/html;filename=study-plan.html", "https://catbox.moe/user/api.php"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", f"file=@{site};type=text/html", "https://0x0.st"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", "reqtype=fileupload", "-F", "time=72h", "-F", f"fileToUpload=@{launcher};type=text/html;filename=ouvrir.html", "https://litterbox.catbox.moe/resources/internals/api.php"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", f"file=@{launcher};type=text/html", "https://0x0.st"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", "reqtype=fileupload", "-F", f"fileToUpload=@{launcher};type=text/html;filename=ouvrir.html", "https://catbox.moe/user/api.php"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", f"file=@{launcher}", "https://tmpfiles.org/api/v1/upload"],
        ["curl", "-sS", "--max-time", "90", "-A", "studyplan", "-F", "file=@%s" % launcher, "-F", "expire=0", "https://api.onlyfiles.com/v1/upload"],
    ]
    chosen = ""
    for cmd in commands:
        try:
            proc = run(cmd)
        except Exception as exc:
            attempts.append(f"- erreur {exc}")
            continue
        raw = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip().replace("\n", " ")[:220]
        url = ""
        for line in raw.splitlines():
            if line.strip().startswith("http"):
                url = line.strip()
        if not url and raw.startswith("{"):
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = {}
            url = (
                data.get("url")
                or data.get("link")
                or (data.get("data") or {}).get("url")
                or (data.get("file") or {}).get("url")
                or ""
            )
            if isinstance(url, str) and "tmpfiles.org/" in url and "/dl/" not in url:
                url = url.replace("tmpfiles.org/", "tmpfiles.org/dl/", 1)
        ok, meta, snippet = (False, "", "")
        if url.startswith("http"):
            ok, meta, snippet = verify(url)
        attempts.append(f"- ok={ok} {meta} url={url or raw[:180]} err={err} body={snippet}")
        print(attempts[-1], flush=True)
        if ok and not chosen:
            chosen = url
    return chosen, attempts


def post_check(chosen, summary, ok):
    if not TOKEN:
        print(summary)
        return
    payload = {
        "name": "lien public",
        "head_sha": SHA,
        "status": "completed",
        "conclusion": "success" if ok else "failure",
        "details_url": chosen or f"https://github.com/{REPO}",
        "output": {"title": "Lien a envoyer", "summary": summary[:60000]},
    }
    req = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/check-runs",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "studyplan",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            print("check", res.status)
    except Exception as exc:
        print("check failed", exc)
    if chosen:
        status = {
            "state": "success",
            "context": "lien public",
            "description": "Lien a envoyer aux amis",
            "target_url": chosen,
        }
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/statuses/{SHA}",
            data=json.dumps(status).encode(),
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
                "User-Agent": "studyplan",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=30).read()
        except Exception as exc:
            print("status failed", exc)


def main():
    chosen = ""
    lines = []
    try:
        subprocess.check_call(["python3", str(ROOT / "tools" / "bundle-site.py")], cwd=ROOT)
        site = ROOT / "dist" / "study-plan.html"
        raw = f"https://raw.githubusercontent.com/{REPO}/{SHA}/dist/study-plan.html"
        launcher = ROOT / "dist" / "ouvrir.html"
        launcher.write_text(
            "<!DOCTYPE html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
            "<title>Study Plan IB</title></head><body>"
            "<p>Chargement de Study Plan IB…</p>"
            f"<script>fetch({json.dumps(raw)}).then(function(r){{return r.text();}})"
            ".then(function(html){document.open();document.write(html);document.close();})"
            ".catch(function(){document.body.textContent='Impossible de charger Study Plan IB.';});"
            "</script></body></html>",
            encoding="utf-8",
        )
        preview = "https://htmlpreview.github.io/?" + raw
        proc = run(["curl", "-sI", "--max-time", "30", "https://htmlpreview.github.io/"])
        lines.append("htmlpreview headers:\n" + (proc.stdout or proc.stderr or "")[:800])
        chosen, attempts = upload_attempts(site, launcher)
        lines.extend(attempts)
        if not chosen:
            ok, meta, snippet = verify(preview)
            lines.append(f"- htmlpreview ok={ok} {meta} body={snippet} url={preview}")
            # htmlpreview itself is text/html; the app loads after. Accept it only
            # if its shell page is HTML and the raw bundle is reachable.
            raw_ok, raw_meta, raw_snip = verify(raw) if False else (False, "", "")
            raw_proc = run(["curl", "-sL", "--max-time", "40", "-o", "/tmp/raw.html", "-w", "%{http_code} %{content_type}", raw])
            raw_body = pathlib.Path("/tmp/raw.html").read_text(encoding="utf-8", errors="replace") if pathlib.Path("/tmp/raw.html").exists() else ""
            lines.append(f"- raw {(raw_proc.stdout or '').strip()} marker={'studyplan-public-bundle' in raw_body}")
            if "text/html" in (proc.stdout or "").lower() and "studyplan-public-bundle" in raw_body:
                chosen = preview
                lines.append("- htmlpreview retenu comme lien")
    except Exception:
        lines.append(traceback.format_exc())
    summary = (chosen or "aucun lien") + "\n\n" + "\n".join(lines)
    print(summary)
    post_check(chosen, summary, bool(chosen))
    if not chosen:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
