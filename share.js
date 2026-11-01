/* Share ayahs: tap an ayah → a small menu (play / tafsir / share) → choose the range and share it as
   an image cut from the mushaf the reader is using (only the chosen ayahs, with that mushaf's own
   surah banner), as text, or as text without tashkeel. Works on the site and in the app. */
(() => {
  const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const cleanName = s => SURAHS[s - 1][0].replace(/ۡ/g, "ْ").replace(/[ۖ-ۭ]/g, "");
  const BRAND = "بواسطة تطبيق المصحف الكريم";
  const store2 = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const native = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppShare;

  document.head.insertAdjacentHTML("beforeend", `<style>
.sh-menu { position: fixed; z-index: 120; display: flex; background: #1d2320; color: #fff; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,.3); overflow: hidden; font-size: 14.5px; }
.sh-menu button { font: inherit; color: inherit; background: none; border: 0; padding: 11px 15px; cursor: pointer; white-space: nowrap; }
.sh-menu button + button { border-inline-start: 1px solid #3a423e; }
.sh-menu button.sh-main { background: var(--accent); }
#shModal .dialog { max-width: 520px; }
.sh-row2 { display: flex; gap: 10px; } .sh-row2 > * { flex: 1; min-width: 0; }
.sh-opts { display: flex; flex-direction: column; gap: 10px; }
.sh-opts label { display: flex; align-items: center; gap: 10px; font-size: 16px; cursor: pointer; }
.sh-opts input { width: 20px; height: 20px; accent-color: var(--accent); }
.sh-brand { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 15px; }
.sh-brand input { width: 22px; height: 22px; accent-color: var(--accent); }
.sh-note { font-size: 12.5px; color: var(--muted); margin-top: -6px; }
.sh-go { width: 100%; justify-content: center; background: var(--accent); border-color: var(--accent); color: var(--surface); font-weight: 600; }
.sh-msg { font-size: 13.5px; color: var(--muted); min-height: 1.3em; text-align: center; }
</style>`);
  document.body.insertAdjacentHTML("beforeend", `
<div class="sh-menu" id="shMenu" hidden>
  <button type="button" data-a="play">▶ تشغيل</button>
  <button type="button" data-a="tafsir">التفسير</button>
  <button type="button" data-a="share" class="sh-main">↗ مشاركة</button>
</div>
<div class="modal" id="shModal" hidden>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="shTitle">
    <div class="dialog-head">
      <h2 id="shTitle">مشاركة</h2>
      <button class="icon-btn" data-close aria-label="إغلاق">✕</button>
    </div>
    <div class="sh-row2">
      <label class="field">من الآية <select id="shFrom"></select></label>
      <label class="field">إلى الآية <select id="shTo"></select></label>
    </div>
    <div class="sh-opts">
      <label><input type="radio" name="shKind" value="image" checked> مشاركة صورة</label>
      <label><input type="radio" name="shKind" value="text"> مشاركة نص</label>
      <label><input type="radio" name="shKind" value="plain"> نص دون تشكيل</label>
    </div>
    <label class="sh-brand" for="shBrand"><span>إضافة «${BRAND}»</span><input type="checkbox" id="shBrand"></label>
    <div class="sh-note">ساعدنا في نشر التطبيق.</div>
    <div class="sh-msg" id="shMsg"></div>
    <button type="button" class="btn sh-go" id="shGo">مشاركة</button>
  </div>
</div>`);
  const $s = id => document.getElementById(id);
  const menu = $s("shMenu"), modal = $s("shModal");
  $s("shBrand").checked = store2.get("shareBrand") !== "0";
  $s("shBrand").onchange = () => store2.set("shareBrand", $s("shBrand").checked ? "1" : "0");

  // ---- the small menu on an ayah
  let menuIdx = -1;
  document.getElementById("spread").addEventListener("click", e => {
    const d = e.target.closest(".hl"); if (!d) return;
    menuIdx = +d.dataset.i;
    menu.hidden = false;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - w / 2)) + "px";
    menu.style.top = (e.clientY - h - 14 < 8 ? e.clientY + 18 : e.clientY - h - 14) + "px";
  });
  document.addEventListener("click", e => { if (!menu.hidden && !e.target.closest("#shMenu") && !e.target.closest(".hl")) menu.hidden = true; }, true);
  addEventListener("scroll", () => { menu.hidden = true; }, true);
  menu.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    menu.hidden = true;
    const i = menuIdx; if (i < 0) return;
    if (b.dataset.a === "play") playAyah(i);
    else if (b.dataset.a === "tafsir") { select(i); const t = $s("tafsirBtn"); if (t) t.click(); else { const p = $s("tafsir"); if (p) p.scrollIntoView({ block: "center", behavior: "smooth" }); } }
    else openShare(i);
  });

  // ---- the share dialog
  function fillTo() {
    const a = +$s("shFrom").value, o = AY[a], n = SURAHS[o.s - 1][1], keep = +$s("shTo").value;
    let h = "";
    for (let k = a; k < a + (n - o.a + 1); k++) h += `<option value="${k}">${cleanName(o.s)}: ${AR(AY[k].a)}</option>`;
    $s("shTo").innerHTML = h;
    $s("shTo").value = keep >= a && AY[keep] && AY[keep].s === o.s ? keep : a;
  }
  function openShare(i) {
    const o = AY[i], first = i - o.a + 1, n = SURAHS[o.s - 1][1];
    let h = "";
    for (let k = first; k < first + n; k++) h += `<option value="${k}">${cleanName(o.s)}: ${AR(AY[k].a)}</option>`;
    $s("shFrom").innerHTML = h; $s("shFrom").value = i;
    $s("shTo").innerHTML = ""; fillTo(); $s("shTo").value = i;
    $s("shMsg").textContent = "";
    modal.hidden = false;
  }
  $s("shFrom").onchange = fillTo;
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) modal.hidden = true; });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; e.stopPropagation(); });

  // ---- text
  const strip = t => t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "").replace(/ٱ/g, "ا");
  function textOf(a, b, plain) {
    const o1 = AY[a], o2 = AY[b];
    const body = [];
    for (let k = a; k <= b; k++) { const t = QURAN[AY[k].s - 1][AY[k].a - 1]; body.push((plain ? strip(t) : t) + " ﴿" + AR(AY[k].a) + "﴾"); }
    const ref = `[${cleanName(o1.s)}: ${AR(o1.a)}${b > a ? "-" + AR(o2.a) : ""}]`;
    return body.join(" ") + "\n" + ref + ($s("shBrand").checked ? "\n\n" + BRAND + "\nhttps://mushaff.com" : "");
  }

  // ---- image: the chosen ayahs cut from the reader's mushaf pages
  const loadImg = src => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = src; });
  function pageRects(p) { return rectsFor(p); }   // per ayah on page p: [[top, left, width, height], …] in page units (456 = page width)
  // where the surah banner (and basmala) sit, above the first line of ayah 1 of surah s
  function bannerBox(s) {
    const i1 = AY.findIndex(o => o.s === s && o.a === 1), p = X().pageOf[i1], f = X().first[p - 1];
    const rs = pageRects(p), r = rs[i1 - f];
    const cm = coordsOf(mushaf), M = MUSHAFS[cm].M, mz = MZ();
    let h = M.h, textTop = M.top;
    if (mz.T) { const [, , sy, by] = mz.T(p); h *= sy; textTop = sy * textTop + by; }
    const top1 = r[0][0];
    // the space between the line above (or the top of the text) and the first line of the surah
    const prev = i1 > f ? Math.max(...rs[i1 - f - 1].map(q => q[0] + q[3])) : textTop - h * 0.15;
    return { p, top: prev + h * 0.12, bottom: top1, line: h };
  }
  async function makeImage(a, b) {
    const o1 = AY[a], mz = MZ();
    const W = 1080, pad = 60;
    const parts = [];   // {img, sx, sy, sw, sh, erase:[...], keep:[...]} in pixels of the page image
    // surah banner from this mushaf (the decorated opening pages of al-Fatiha and al-Baqarah have none to cut)
    let banner = null;
    if (o1.s > 2) {
      const bb = bannerBox(o1.s);
      const src = await pageSrc(mushaf, bb.p), im = await loadImg(src), k = im.naturalWidth / 456;
      const withBasmala = o1.a === 1 && o1.s !== 9;
      const top = bb.top, bottom = withBasmala ? bb.bottom : bb.bottom - bb.line;
      const [x0, x1] = textSpan(bb.p);
      banner = { im, sx: x0 * k, sy: top * k, sw: (x1 - x0) * k, sh: (bottom - top) * k };
    }
    // the lines of the chosen ayahs, page by page
    const pages = [];
    for (let k2 = a; k2 <= b; k2++) { const p = X().pageOf[k2]; if (!pages.includes(p)) pages.push(p); }
    for (const p of pages) {
      const src = await pageSrc(mushaf, p), im = await loadImg(src), k = im.naturalWidth / 456;
      const rs = pageRects(p), f = X().first[p - 1];
      const sel = [], other = [];
      rs.forEach((r, n) => (f + n >= a && f + n <= b ? sel : other).push(...r));
      const top = Math.min(...sel.map(r => r[0])), bottom = Math.max(...sel.map(r => r[0] + r[3]));
      const [x0, x1] = textSpan(p);
      const padY = (bottom - top) ? Math.min(6, (sel[0][3]) * 0.18) : 0;
      parts.push({ im, k, x0, x1, top: top - padY, bottom: bottom + padY, sel, other });
    }
    // size
    const innerW = W - 2 * pad;
    const scaleOf = (wPx) => innerW / wPx;
    let H = pad;
    if (banner) H += banner.sh * scaleOf(banner.sw) + 16;
    parts.forEach(q => { q.s = scaleOf((q.x1 - q.x0) * q.k); H += (q.bottom - q.top) * q.k * q.s; });
    const brand = $s("shBrand").checked;
    H += brand ? 150 : pad;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = Math.round(H);
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.imageSmoothingQuality = "high";
    let y = pad;
    if (banner) {
      const s = scaleOf(banner.sw);
      g.drawImage(banner.im, banner.sx, banner.sy, banner.sw, banner.sh, pad, y, innerW, banner.sh * s);
      y += banner.sh * s + 16;
    } else {
      // al-Fatiha / al-Baqarah: a simple heading in the app's style
      g.fillStyle = "#1f5e5b"; g.font = "600 46px 'IBM Plex Sans Arabic', 'Noto Naskh Arabic', serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("سورة " + cleanName(o1.s), W / 2, y + 30); y += 90;
    }
    for (const q of parts) {
      const s = q.s, k = q.k, X0 = q.x0, T0 = q.top;
      const dx = u => pad + (u - X0) * k * s, dy = u => y + (u - T0) * k * s;
      // the whole band, then blank out other ayahs, then put the chosen ones back on top
      g.drawImage(q.im, X0 * k, T0 * k, (q.x1 - X0) * k, (q.bottom - T0) * k, pad, y, innerW, (q.bottom - T0) * k * s);
      g.fillStyle = "#fff";
      q.other.forEach(([t, l, w, h]) => { if (t + h > T0 && t < q.bottom) g.fillRect(dx(l), dy(t), w * k * s, h * k * s); });
      q.sel.forEach(([t, l, w, h]) => {
        const tt = Math.max(t, T0), bb = Math.min(t + h, q.bottom);
        if (bb > tt) g.drawImage(q.im, l * k, tt * k, w * k, (bb - tt) * k, dx(l), dy(tt), w * k * s, (bb - tt) * k * s);
      });
      y += (q.bottom - T0) * k * s;
    }
    if (brand) {
      const ic = await loadImg("icons/icon-192.png").catch(() => null);
      y += 34;
      if (ic) g.drawImage(ic, W / 2 - 32, y, 64, 64);
      g.fillStyle = "#7d8a83"; g.font = "500 26px 'IBM Plex Sans Arabic', sans-serif"; g.textAlign = "center"; g.textBaseline = "top";
      g.fillText(BRAND, W / 2, y + 74);
    }
    return cv;
  }
  // the text block's left and right edges on page p (page units), from all ayah boxes on it
  function textSpan(p) {
    const all = pageRects(p).flat();
    return [Math.min(...all.map(r => r[1])), Math.max(...all.map(r => r[1] + r[2]))];
  }

  // ---- sending
  async function send({ blob, text, name }) {
    if (native) {
      if (blob) {
        const b64 = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
        return native.share({ base64: b64, mime: "image/png", name, text: text || "" });
      }
      return native.share({ text });
    }
    if (blob) {
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      $s("shMsg").textContent = "تم حفظ الصورة في التنزيلات.";
      return;
    }
    if (navigator.share) return navigator.share({ text });
    await navigator.clipboard.writeText(text);
    $s("shMsg").textContent = "تم نسخ النص، الصقه حيث تريد.";
  }
  $s("shGo").onclick = async () => {
    const a = +$s("shFrom").value, b = Math.max(a, +$s("shTo").value);
    const kind = document.querySelector('input[name="shKind"]:checked').value;
    $s("shGo").disabled = true; $s("shMsg").textContent = "جارٍ التجهيز…";
    try {
      if (kind === "image") {
        await document.fonts.load("600 46px 'IBM Plex Sans Arabic'").catch(() => {});
        const cv = await makeImage(a, b);
        const blob = await new Promise(ok => cv.toBlob(ok, "image/png"));
        $s("shMsg").textContent = "";
        await send({ blob, name: `${cleanName(AY[a].s)}-${AY[a].a}-${AY[b].a}.png` });
      } else {
        await loadQuran();
        $s("shMsg").textContent = "";
        await send({ text: textOf(a, b, kind === "plain") });
      }
      if (!$s("shMsg").textContent) modal.hidden = true;
    } catch (e) {
      if (e && e.name === "AbortError") { $s("shMsg").textContent = ""; }
      else { console.error(e); $s("shMsg").textContent = "تعذّرت المشاركة. حاول مرة أخرى."; }
    } finally { $s("shGo").disabled = false; }
  };
  window.__shareMake = makeImage;   // for testing
})();
