/* In the app only: the web view has no speech recognition, so this gives the page the same
   SpeechRecognition interface it uses in Chrome, backed by Android's recognizer (SpeechPlugin). */
(function () {
  var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Speech;
  if (!P || window.SpeechRecognition || window.webkitSpeechRecognition) return;
  var active = null;   // the recognition object currently listening
  function NativeSR() { this.lang = "ar-SA"; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this._done = []; }
  function fire(o, name, ev) { var f = o["on" + name]; if (typeof f === "function") try { f.call(o, ev || {}); } catch (e) { console.error(e); } }
  P.addListener("result", function (d) {
    var o = active; if (!o) return;
    var list = o._done.slice(); var cur = [{ transcript: d.text, confidence: 0.9 }]; cur.isFinal = !!d.final; list.push(cur);
    if (d.final) o._done.push(cur);
    if (d.final || o.interimResults) fire(o, "result", { results: list, resultIndex: list.length - 1 });
  });
  P.addListener("start", function () { if (active) fire(active, "start"); });
  P.addListener("error", function (d) { if (active) fire(active, "error", { error: d.error || "aborted" }); });
  P.addListener("end", function () { var o = active; if (!o) return; active = null; fire(o, "end"); });
  NativeSR.prototype.start = function () { active = this; P.start({ lang: this.lang || "ar-SA" }).catch(function () {}); };
  NativeSR.prototype.stop = NativeSR.prototype.abort = function () { if (active === this) active = null; P.stop().catch(function () {}); };
  window.SpeechRecognition = window.webkitSpeechRecognition = NativeSR;
})();
