#!/usr/bin/env python3
"""Find a public URL that actually renders the site, then keep it alive."""

import json
import os
import pathlib
import subprocess
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHA = os.environ.get("GITHUB_SHA", "")
TOKEN = os.environ.get("GH_TOKEN", "")
REPO = "sawadogojuliss-byte/Learning-DP1"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def run(args, timeout=120):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def verify(url):
    proc = run([
        "curl", "-sL", "--max-time", "40", "-A", UA,
        "-D", "/tmp/headers.txt", "-o", "/tmp/got.html",
        "-w", "%{http_code} %{content_type}", url,
    ])
    meta = (proc.stdout or "").strip()
    headers = pathlib.Path("/tmp/headers.txt").read_text(encoding="utf-8", errors="replace").lower() if pathlib.Path("/tmp/headers.txt").exists() else ""
    body = pathlib.Path("/tmp/got.html").read_text(encoding="utf-8", errors="replace") if pathlib.Path("/tmp/got.html").exists() else ""
    ok = meta.startswith("200") and "text/html" in meta and "Study Plan IB" in body and "content-disposition: attachment" not in headers
    return ok, meta


def post(url, summary, keep):
    if not TOKEN or not SHA:
        print(summary)
        return
    payload = {
        "name": "lien public",
        "head_sha": SHA,
        "status": "completed",
        "conclusion": "success" if url else "failure",
        "details_url": url or f"https://github.com/{REPO}",
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
    with urllib.request.urlopen(req, timeout=30) as res:
        print("posted", res.status, url)
    pathlib.Path("/tmp/share-url.txt").write_text(url or "", encoding="utf-8")
    pathlib.Path("/tmp/share-keep.txt").write_text("1" if keep else "0", encoding="utf-8")


def try_uploads(site):
    notes = []
    commands = [
        ["curl", "-sS", "--max-time", "90", "-A", UA, "-F", "reqtype=fileupload", "-F", f"fileToUpload=@{site};type=text/html;filename=study-plan.html", "https://catbox.moe/user/api.php"],
        ["curl", "-sS", "--max-time", "90", "-A", UA, "-F", "reqtype=fileupload", "-F", "time=72h", "-F", f"fileToUpload=@{site};type=text/html;filename=study-plan.html", "https://litterbox.catbox.moe/resources/internals/api.php"],
        ["curl", "-sS", "--max-time", "90", "-A", UA, "-F", f"file=@{site};type=text/html", "https://x0.at"],
    ]
    for cmd in commands:
        try:
            proc = run(cmd)
        except Exception as exc:
            notes.append(str(exc))
            continue
        raw = (proc.stdout or "").strip()
        url = next((line.strip() for line in raw.splitlines() if line.strip().startswith("http")), "")
        ok, meta = verify(url) if url.startswith("http") else (False, "")
        notes.append(f"{url or raw[:160]} ok={ok} {meta}")
        print(notes[-1], flush=True)
        if ok:
            return url, notes
    return "", notes


def start_tunnel():
    bin_path = pathlib.Path("/tmp/cloudflared")
    if not bin_path.exists():
        proc = run(["curl", "-L", "--max-time", "120", "-o", str(bin_path), "https://github.com/cloudflare/cloudflared/releases/download/2026.9.3/cloudflared-linux-amd64"])
        if proc.returncode != 0 or not bin_path.exists():
            raise RuntimeError(proc.stderr[-400:])
        bin_path.chmod(0o755)
    subprocess.Popen(["python3", "-m", "http.server", "8000", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    log = open("/tmp/cf.log", "w", encoding="utf-8")
    subprocess.Popen([str(bin_path), "tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate"], stdout=log, stderr=subprocess.STDOUT)
    url = ""
    for _ in range(40):
        time.sleep(2)
        text = pathlib.Path("/tmp/cf.log").read_text(encoding="utf-8", errors="replace")
        for token in text.split():
            if token.startswith("https://") and "trycloudflare.com" in token:
                url = token.strip().rstrip(".,)")
                break
        if url:
            break
    if not url:
        raise RuntimeError(pathlib.Path("/tmp/cf.log").read_text(encoding="utf-8", errors="replace")[-800:])
    ok, meta = verify(url + "/")
    return url + "/", ok, meta


def main():
    site = ROOT / "dist" / "study-plan.html"
    if not site.exists():
        subprocess.check_call(["python3", str(ROOT / "tools" / "bundle-site.py")], cwd=ROOT)
    url, notes = try_uploads(site)
    keep = False
    if url:
        summary = url + "\n\n" + "\n".join(notes)
        post(url, summary, False)
        return
    try:
        tunnel, ok, meta = start_tunnel()
        notes.append(f"tunnel {tunnel} ok={ok} {meta}")
        if ok:
            url = tunnel
            keep = True
    except Exception as exc:
        notes.append("tunnel error " + str(exc))
    summary = (url or "aucun") + "\n\n" + "\n".join(notes)
    print(summary)
    post(url, summary, keep)
    if keep:
        time.sleep(350 * 60)


if __name__ == "__main__":
    main()
