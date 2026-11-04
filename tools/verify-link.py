#!/usr/bin/env python3
import json
import os
import subprocess
import urllib.parse
import urllib.request

sha = os.environ["SHA"]
raw = f"https://raw.githubusercontent.com/sawadogojuliss-byte/Learning-DP1/{sha}/dist/study-plan.html"
preview = "https://htmlpreview.github.io/?" + raw
proxy = "https://api.codetabs.com/v1/proxy/?quest=" + urllib.parse.quote(raw, safe="")
lines = []


def grab(url):
    proc = subprocess.run(
        ["curl", "-sL", "--max-time", "50", "-D", "/tmp/h.txt", "-o", "/tmp/b.txt", "-w", "%{http_code} %{content_type}", url],
        capture_output=True, text=True,
    )
    headers = open("/tmp/h.txt", encoding="utf-8", errors="replace").read()
    body = open("/tmp/b.txt", encoding="utf-8", errors="replace").read()
    interesting = "\n".join(
        line for line in headers.splitlines()
        if line.lower().startswith(("http/", "content-type", "access-control", "content-security", "content-length"))
    )
    lines.append(f"URL {url}\n{proc.stdout}\n{interesting}\nmarker={'studyplan-public-bundle' in body} len={len(body)}\n")


grab(raw)
grab(proxy)
grab(preview)
summary = preview + "\n\n" + "\n".join(lines)
print(summary)
payload = {
    "name": "lien public",
    "head_sha": os.environ["GITHUB_SHA"],
    "status": "completed",
    "conclusion": "success",
    "details_url": preview,
    "output": {"title": "Verification du lien", "summary": summary[:60000]},
}
req = urllib.request.Request(
    "https://api.github.com/repos/sawadogojuliss-byte/Learning-DP1/check-runs",
    data=json.dumps(payload).encode(),
    headers={
        "Authorization": "Bearer " + os.environ["GH_TOKEN"],
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "studyplan",
    },
    method="POST",
)
urllib.request.urlopen(req, timeout=30).read()
