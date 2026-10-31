#!/usr/bin/env python3
"""Prepare the app's web files from the site (one folder up):
- www/: the site's pages, scripts and data, with the fonts saved inside the app so it looks right offline
- android/mushafpages/: the mushaf page images (install-time asset pack); the large JPG
  mushafs are re-encoded as WebP, which looks the same and is about a third of the size."""
import os, re, shutil, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
WWW = os.path.join(HERE, "www")
PAGES = os.path.join(HERE, "android", "mushafpages", "src", "main", "assets", "public", "pages")
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"

shutil.rmtree(WWW, ignore_errors=True)
os.makedirs(WWW)
for f in ["index.html", "desktop.html", "data.js", "quran.js", "favicon.ico"]:
    shutil.copy(os.path.join(SITE, f), WWW)
for d in ["icons", "audio"]:
    shutil.copytree(os.path.join(SITE, d), os.path.join(WWW, d))

# Fonts: keep a copy inside the app
font_link = re.compile(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)">')
html = open(os.path.join(SITE, "index.html"), encoding="utf-8").read()
url = font_link.search(html).group(1).replace("&amp;", "&")
css = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA})).read().decode()
os.makedirs(os.path.join(WWW, "fonts"))
for n, src in enumerate(sorted(set(re.findall(r"url\((https://[^)]+)\)", css)))):
    name = "f%d.woff2" % n
    with urllib.request.urlopen(src) as r, open(os.path.join(WWW, "fonts", name), "wb") as out:
        out.write(r.read())
    css = css.replace(src, name)
open(os.path.join(WWW, "fonts", "fonts.css"), "w", encoding="utf-8").write(css)

for f in ["index.html", "desktop.html"]:
    p = os.path.join(WWW, f)
    h = open(p, encoding="utf-8").read()
    h = font_link.sub('<link rel="stylesheet" href="fonts/fonts.css">', h)
    h = h.replace('name, ext: "jpg", coords: "hafs"', 'name, ext: "webp", coords: "hafs"')   # re-encoded below
    h = re.sub(r'if \("serviceWorker" in navigator\)[^\n]*\n', "", h)                       # the app has its files already
    assert "fonts.googleapis" not in h and 'ext: "webp"' in h, f
    open(p, "w", encoding="utf-8").write(h)

# Mushaf pages
shutil.rmtree(PAGES, ignore_errors=True)
jobs = []
for m in sorted(os.listdir(os.path.join(SITE, "pages"))):
    src_dir = os.path.join(SITE, "pages", m)
    if not os.path.isdir(src_dir):
        continue
    os.makedirs(os.path.join(PAGES, m))
    for f in os.listdir(src_dir):
        jobs.append((os.path.join(src_dir, f), os.path.join(PAGES, m, f)))

def one(job):
    src, dst = job
    if src.endswith(".jpg"):
        Image.open(src).save(dst[:-4] + ".webp", "WEBP", quality=80, method=4)
    else:
        shutil.copy(src, dst)

with ThreadPoolExecutor(os.cpu_count() or 2) as ex:
    list(ex.map(one, jobs))
size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(PAGES) for f in fs)
print("pages:", len(jobs), "files,", round(size / 1e6), "MB")
