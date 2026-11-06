/* Listening without internet: download a whole surah, a range of ayahs, or the whole mushaf for a reciter.
   The files are kept in the browser's cache ("recitations-v1"); the player in the page reads them from
   there (see OFF / playSrc in index.html and desktop.html). Works the same on the site and in the app. */
(() => {
  const CACHE = "recitations-v1", LIST = "offlineList";
  const AR = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const P3 = n => String(n).padStart(3, "0");
  const allReciters = () => RECITERS.concat(RECITERS_WARSH).filter(r => !SURAH_FILES[r[0]] || SURAH_FILES[r[0]].dl || window.OWNER);  // surah-file reciters: once released ("dl"), or the owner trying one out
  const abs = u => new URL(u, location.href).href;
  const nameOf = id => (allReciters().find(r => r[0] === id) || [id, id])[1];
  // the UI font has no Uthmani marks: the small high sukun becomes a normal sukun, the rest are dropped
  const surahName = s => SURAHS[s - 1][0].replace(/\u06E1/g, "\u0652").replace(/[\u06D6-\u06ED]/g, "");
  const urlOf = (id, s, a) => AUDIO_BASE + id + "/" + P3(s) + P3(a) + ".mp3";
  const load = () => { try { return JSON.parse(localStorage.getItem(LIST) || "[]"); } catch (e) { return []; } };
  const save = l => { try { localStorage.setItem(LIST, JSON.stringify(l)); } catch (e) {} };
  const mb = b => AR((b / 1048576).toFixed(b < 10485760 ? 1 : 0)) + " ميقابايت";
  if (!("caches" in window)) return;

  // what is already saved, so the player knows which ayahs it can play without internet
  caches.open(CACHE).then(c => c.keys()).then(keys => keys.forEach(r => OFF.have.add(r.url))).catch(() => {});

  document.head.insertAdjacentHTML("beforeend", `<style>
#dlModal .dialog { max-width: 520px; }
.dl-tabs { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; gap: 3px; }
.dl-tabs button { flex: 1; font: inherit; font-size: 14px; border: 0; background: none; color: var(--muted); padding: 8px 0; border-radius: 8px; cursor: pointer; }
.dl-tabs button[aria-selected="true"] { background: var(--surface); color: var(--accent); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.dl-row2 { display: flex; gap: 10px; } .dl-row2 > * { flex: 1; min-width: 0; }
.dl-info { font-size: 13.5px; color: var(--muted); min-height: 1.4em; }
.dl-go { width: 100%; justify-content: center; background: var(--accent); border-color: var(--accent); color: var(--surface); font-weight: 600; }
.dl-bar { height: 8px; background: var(--line); border-radius: 8px; overflow: hidden; }
.dl-bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .2s; }
.dl-pt { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); margin-top: 5px; font-variant-numeric: tabular-nums; }
.dl-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); }
.dl-item b { display: block; font-size: 15px; font-weight: 600; } .dl-item span { font-size: 12.5px; color: var(--muted); }
.dl-play { flex: 1; min-width: 0; cursor: pointer; }
.dl-empty { font-size: 13.5px; color: var(--muted); padding: 6px 0; }
.dl-toast { position: fixed; left: 16px; right: 16px; bottom: calc(110px + env(safe-area-inset-bottom, 0px)); margin: 0 auto; max-width: 520px; background: #1d2320; color: #fff; border-radius: 12px; padding: 12px 16px; font-size: 14.5px; line-height: 1.7; z-index: 200; box-shadow: 0 6px 20px rgba(0,0,0,.3); }
</style>`);
  document.body.insertAdjacentHTML("beforeend", `
<div class="modal" id="dlModal" hidden>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlTitle">
    <div class="dialog-head">
      <h2 id="dlTitle">الاستماع دون اتصال بالإنترنت</h2>
      <button class="icon-btn" data-close aria-label="إغلاق">✕</button>
    </div>
    <label class="field">القارئ <select id="dlRec"></select></label>
    <div class="dl-tabs" role="tablist">
      <button type="button" role="tab" data-k="surah">سورة كاملة</button>
      <button type="button" role="tab" data-k="range">آيات محددة</button>
      <button type="button" role="tab" data-k="all">المصحف كاملًا</button>
    </div>
    <label class="field" id="dlSurahF">السورة <select id="dlSurah"></select></label>
    <div class="dl-row2" id="dlRangeF">
      <label class="field">من الآية <input id="dlFrom" type="number" inputmode="numeric" min="1"></label>
      <label class="field">إلى الآية <input id="dlTo" type="number" inputmode="numeric" min="1"></label>
    </div>
    <div class="dl-info" id="dlInfo"></div>
    <button type="button" class="btn dl-go" id="dlGo"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>تنزيل</button>
    <div id="dlProg" hidden>
      <div class="dl-bar"><i id="dlBar"></i></div>
      <div class="dl-pt"><span id="dlPt1"></span><span id="dlPt2"></span></div>
      <button type="button" class="btn" id="dlStop" style="margin-top:8px">إيقاف التنزيل</button>
    </div>
    <div class="label" style="margin-top:6px">المحفوظ للاستماع دون اتصال</div>
    <div id="dlList"></div>
  </div>
</div>
<div class="dl-toast" id="dlToast" role="status" hidden></div>`);

  const $d = id => document.getElementById(id);
  const modal = $d("dlModal");
  let kind = "surah", busy = null, toastTimer = 0;

  $d("dlRec").innerHTML = allReciters().map(r => `<option value="${r[0]}">${r[1]}</option>`).join("");
  $d("dlSurah").innerHTML = SURAHS.map((s, i) => `<option value="${i + 1}">${AR(i + 1)}. ${surahName(i + 1)}</option>`).join("");

  function range() {
    const id = $d("dlRec").value, s = +$d("dlSurah").value, n = SURAHS[s - 1][1];
    if (kind === "all") return { id, s: 0, from: 0, to: 0, list: SURAHS.flatMap((x, k) => Array.from({ length: x[1] }, (_, a) => [k + 1, a + 1])) };
    let from = 1, to = n;
    if (kind === "range") {
      from = Math.min(n, Math.max(1, +$d("dlFrom").value || 1));
      to = Math.min(n, Math.max(from, +$d("dlTo").value || n));
    }
    return { id, s, from, to, list: Array.from({ length: to - from + 1 }, (_, k) => [s, from + k]) };
  }
  // with the basmala; a reciter recorded a surah per file saves the whole files, its basmala and its ayah timing
  const urlsOf = r => {
    const g = SURAH_FILES[r.id], one = ([s]) => g && g.ayahs && g.ayahs.includes(s);
    const per = r.list.filter(x => !g || one(x)), whole = g ? r.list.filter(x => !one(x)) : [];
    const ss = [...new Set(whole.map(x => x[0]))];
    return (whole.length ? [segJson(r.id), abs(g.basmala)] : []).concat(ss.flatMap(s => segFiles(g, s)),
      per.length ? [urlOf(r.id, 1, 1)].concat(per.map(([s, a]) => urlOf(r.id, s, a))) : []);
  };
  const title = e => e.s === 0 ? "المصحف كاملًا" : e.from === 1 && e.to === SURAHS[e.s - 1][1]
    ? `سورة ${surahName(e.s)} · كاملة` : `سورة ${surahName(e.s)} · من الآية ${AR(e.from)} إلى الآية ${AR(e.to)}`;
  const doneMsg = e => {
    const who = `بصوت الشيخ ${nameOf(e.id)}`;
    if (e.s === 0) return `تم تنزيل المصحف كاملًا ${who}، ويمكنك الاستماع إليه الآن دون اتصال بالإنترنت`;
    const full = e.from === 1 && e.to === SURAHS[e.s - 1][1];
    return `تم تنزيل سورة ${surahName(e.s)}${full ? "" : ` من الآية ${AR(e.from)} إلى الآية ${AR(e.to)}`} ${who}، ويمكنك الاستماع إليها الآن دون اتصال بالإنترنت`;
  };

  // an estimate before downloading: the size of a few ayahs of this reciter, scaled to the whole range
  let estTok = 0;
  function refresh() {
    $d("dlSurahF").hidden = kind === "all";
    $d("dlRangeF").hidden = kind !== "range";
    modal.querySelectorAll(".dl-tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === kind));
    const r = range(), n = r.list.length, tok = ++estTok;
    $d("dlInfo").textContent = `${AR(n)} آية`;
    if (SURAH_FILES[r.id]) {
      Promise.all(urlsOf(r).filter(u => !u.endsWith(".json") && !u.includes("basmala")).map(u => fetch(u, { method: "HEAD" }).then(x => +x.headers.get("content-length") || 0)))
        .then(sz => { const t = sz.reduce((x, y) => x + y, 0); if (tok === estTok && t) $d("dlInfo").textContent = `${AR(n)} آية · الحجم تقريبًا ${mb(t)}`; }).catch(() => {});
      return;
    }
    const pick = [0, n >> 1, n - 1].map(k => r.list[k]).filter((x, k, a) => a.findIndex(y => y === x) === k);
    Promise.all(pick.map(([s, a]) => fetch(urlOf(r.id, s, a), { method: "HEAD" }).then(x => +x.headers.get("content-length") || 0)))
      .then(sz => {
        if (tok !== estTok) return;
        const avg = sz.reduce((x, y) => x + y, 0) / sz.length;
        if (avg) $d("dlInfo").textContent = `${AR(n)} آية · الحجم تقريبًا ${mb(avg * n)}`;
      }).catch(() => {});
  }

  function renderList() {
    const l = load();
    $d("dlList").innerHTML = l.length ? l.map((e, k) => `<div class="dl-item"><div class="dl-play" data-play="${k}" role="button" tabindex="0"><b><svg class="ic" style="color:var(--accent)" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>${title(e)}</b><span>الشيخ ${nameOf(e.id)}${e.bytes ? " · " + mb(e.bytes) : ""}</span></div>
      <button type="button" class="btn" data-del="${k}">حذف</button></div>`).join("")
      : '<div class="dl-empty">لم تُنزّل شيئًا بعد.</div>';
  }

  function toast(text, ok = true) {
    const t = $d("dlToast"); t.textContent = text; if (ok) t.insertAdjacentHTML("afterbegin", '<svg class="ic" style="color:#8fd3bf" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>'); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
  }

  async function download() {
    if (busy) return;
    const r = range(), urls = urlsOf(r), total = urls.length;
    const c = await caches.open(CACHE);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    busy = { stop: false };
    $d("dlGo").hidden = true; $d("dlProg").hidden = false;
    let done = 0, bytes = 0, next = 0, failed = 0;
    const show = () => {
      const p = Math.round(done / total * 100);
      $d("dlBar").style.width = p + "%";
      $d("dlPt1").textContent = `${SURAH_FILES[r.id] ? "ملف" : "آية"} ${AR(Math.min(done, total))} من ${AR(total)}`;
      $d("dlPt2").textContent = `${AR(p)}٪ · ${mb(bytes)}`;
    };
    show();
    async function worker() {
      while (!busy.stop && next < total) {
        const u = urls[next++];
        try {
          let hit = OFF.have.has(u) ? await c.match(u) : null;
          if (hit) { bytes += +hit.headers.get("content-length") || 0; }
          else {
            const res = await fetch(u);
            if (!res.ok) throw new Error(res.status);
            const blob = await res.blob();
            await c.put(u, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg", "Content-Length": String(blob.size) } }));
            OFF.have.add(u); bytes += blob.size;
          }
        } catch (e) { failed++; }
        done++; show();
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    const stopped = busy.stop; busy = null;
    $d("dlGo").hidden = false; $d("dlProg").hidden = true;
    if (stopped) return;
    if (failed) { toast(`تعذّر تنزيل ${AR(failed)} من ${SURAH_FILES[r.id] ? "الملفات" : "الآيات"}. تأكد من اتصال الإنترنت ثم أعد المحاولة.`, false); return; }
    const e = { id: r.id, s: r.s, from: r.from, to: r.to, bytes };
    const l = load().filter(x => !(x.id === e.id && x.s === e.s && x.from === e.from && x.to === e.to));
    l.unshift(e); save(l); renderList();
    toast(doneMsg(e));
  }

  const listOf = e => e.s === 0 ? SURAHS.flatMap((x, j) => Array.from({ length: x[1] }, (_, a) => [j + 1, a + 1]))
    : Array.from({ length: e.to - e.from + 1 }, (_, j) => [e.s, e.from + j]);
  async function remove(k) {
    const l = load(), e = l.splice(k, 1)[0]; if (!e) return;
    save(l); renderList();
    // keep files that another saved item still needs (the same ayahs, or the basmala)
    const keep = new Set(l.flatMap(x => urlsOf(Object.assign({}, x, { list: listOf(x) }))));
    const gone = urlsOf(Object.assign({}, e, { list: listOf(e) })).filter(u => !keep.has(u));
    const c = await caches.open(CACHE);
    for (const u of gone) { await c.delete(u); OFF.have.delete(u); }
  }

  function open() {
    if (typeof closeSheets === "function") closeSheets();
    const cur = typeof rec === "function" ? rec() : "";
    if (allReciters().some(r => r[0] === cur)) $d("dlRec").value = cur;
    const i = playing && playIdx >= 0 ? playIdx : cur;
    const s = i >= 0 && AY[i] ? AY[i].s : (+$d("dlSurah").value || 1);
    $d("dlSurah").value = s;
    $d("dlFrom").value = 1; $d("dlTo").value = SURAHS[s - 1][1];
    renderList(); refresh();
    modal.hidden = false;
  }

  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest("[data-close]")) modal.hidden = true;
    const t = e.target.closest(".dl-tabs button"); if (t) { kind = t.dataset.k; refresh(); }
    const del = e.target.closest("[data-del]"); if (del) remove(+del.dataset.del);
    const pl = e.target.closest("[data-play]"); if (pl) playSaved(load()[+pl.dataset.play]);
  });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") modal.hidden = true; e.stopPropagation(); });
  $d("dlRec").onchange = refresh;
  $d("dlSurah").onchange = () => { const n = SURAHS[$d("dlSurah").value - 1][1]; $d("dlFrom").value = 1; $d("dlTo").value = n; refresh(); };
  $d("dlFrom").oninput = $d("dlTo").oninput = refresh;
  $d("dlGo").onclick = download;
  $d("dlStop").onclick = () => { if (busy) busy.stop = true; };

  // A saved item plays straight away: its reciter, from its first ayah, and it stops after its last one
  let stopRange = null;
  const origPlayAyah = window.playAyah;
  window.playAyah = function (i, fresh) {
    if (stopRange) {
      if (i === stopRange[1] + 1) { stopRange = null; return stop(); }
      if (i < stopRange[0] || i > stopRange[1]) stopRange = null;
    }
    return origPlayAyah.apply(this, arguments);
  };
  function playSaved(e) {
    if (!e) return;
    modal.hidden = true;
    const sel = document.getElementById("reciterSel");
    if (sel && [...sel.options].some(o => o.value === e.id) && sel.value !== e.id) { sel.value = e.id; sel.dispatchEvent(new Event("change")); }
    const a = AY.findIndex(o => o.s === (e.s || 1) && o.a === (e.s ? e.from : 1));
    const b = e.s ? AY.findIndex(o => o.s === e.s && o.a === e.to) : AY.length - 1;
    if (a < 0) return;
    if (playing) stop();
    stopRange = [a, b];
    playAyah(a);
  }

  // No internet: offer the saved recitations
  let asked = false;
  function offerSaved() {
    if (asked || navigator.onLine || !load().length || document.getElementById("dlAsk")) return;
    asked = true;
    $d("dlToast").hidden = true;
    const box = document.createElement("div");
    box.className = "modal"; box.id = "dlAsk";
    box.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlAskT" style="max-width:420px">
      <div style="font-size:17px;font-weight:600;line-height:1.8" id="dlAskT">لا يوجد اتصال بالإنترنت. هل تريد الانتقال إلى التلاوات المحفوظة؟</div>
      <div style="display:flex;gap:10px;margin-top:6px"><button type="button" class="btn dl-go" data-yes>نعم</button><button type="button" class="btn" data-no style="flex:1;justify-content:center">لا</button></div></div>`;
    document.body.appendChild(box);
    box.addEventListener("click", ev => {
      if (ev.target.closest("[data-yes]")) { box.remove(); open(); }
      else if (ev.target.closest("[data-no]") || ev.target === box) box.remove();
    });
  }
  addEventListener("offline", () => { asked = false; offerSaved(); });
  addEventListener("online", () => { const b = document.getElementById("dlAsk"); if (b) b.remove(); });
  setTimeout(offerSaved, 800);

  // In the app: the recitation shows as a media player in the notifications and on the lock screen,
  // with previous / pause-play / next, and it keeps playing when the user leaves the app
  const RP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Recitation;
  if (RP) {
    let t = 0, lastState = "";
    const push = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const state = playing ? "playing" : paused ? "paused" : "none";
        if (state === "none" && lastState === "none") return;
        lastState = state;
        const o = AY[playIdx >= 0 ? playIdx : cur];
        const r = (typeof reciters === "function" ? reciters() : []).find(x => x[0] === rec());
        RP.update({
          state,
          title: o ? `سورة ${surahName(o.s)} · الآية ${AR(o.a)}` : "",
          artist: r ? r[1] : "",
          position: isFinite(audio.currentTime) ? audio.currentTime : 0,
          duration: isFinite(audio.duration) ? audio.duration : 0,
        }).catch(() => {});
      }, 250);   // after the page has updated its own state; also skips the short gap between two ayahs
    };
    ["play", "playing", "pause", "ended", "loadedmetadata", "seeked"].forEach(ev => audio.addEventListener(ev, push));
    const origStop = window.stop;
    window.stop = function () { const r = origStop.apply(this, arguments); push(); return r; };
    RP.addListener("control", e => {
      if (e.action === "pause") { if (playing) pause(); }
      else if (e.action === "play") { if (paused) resume(); else if (!playing) document.getElementById("playBtn").click(); }
      else if (e.action === "next") document.getElementById("nextAyah").click();
      else if (e.action === "prev") document.getElementById("prevAyah").click();
    });
  }

  document.querySelectorAll("#dlOpen").forEach(b => { b.onclick = open; });
})();
