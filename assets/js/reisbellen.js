// /assets/js/call-demo.js

(() => {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";
// const API_BASE_URL = "http://127.0.0.1:5001"; (DOET HET NIET LOCAAL IVM TWILIO RESTRICTIONS)

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function setStatus(message, kind = "info") {
    // Jullie core/tools css bepaalt waarschijnlijk styling van .alert.
    // We gebruiken gewoon tekst + hidden toggles.
    const box = $("status");
    box.textContent = message;
    show(box);

    // Optioneel: kleine class switch als jullie alert varianten hebben
    // box.classList.remove("alert-success","alert-error","alert-info");
    // box.classList.add(kind === "error" ? "alert-error" : kind === "success" ? "alert-success" : "alert-info");
  }

  function clearStatus() {
    const box = $("status");
    box.textContent = "";
    hide(box);
  }

  function normalizeDutchNumber(input) {
    // Doel: backend verwacht "0612345678" (zonder +31)
    // We strippen spaties/dashes/() en plus.
    let s = (input || "").trim();
    s = s.replace(/[^\d+]/g, "");  // laat digits en + toe

    // +31... -> 0...
    if (s.startsWith("+31")) {
      s = "0" + s.slice(3);
    }

    // 0031... -> 0...
    if (s.startsWith("0031")) {
      s = "0" + s.slice(4);
    }

    // Nu digits only
    s = s.replace(/[^\d]/g, "");

    return s;
  }

  function isPlausibleNlNumber(s) {
    // Super basic checks voor PoC:
    // - begint met 0
    // - lengte 10 (meest gebruikelijk in NL)
    // - tweede digit meestal 6 (mobiel) of 1/2/3/4/5/7/8/9 (vast) → we laten veel toe
    return /^0\d{9}$/.test(s);
  }

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  function mapCallStatusLabel(status) {
    if (!status) return "—";
    const s = String(status).toLowerCase();
    if (s === "initiated") return "initiated";
    if (s === "ringing") return "ringing";
    if (s === "answered") return "answered";
    if (s === "completed") return "completed";
    return status;
  }

  // ---------- State ----------
  let pollTimer = null;
  let currentCallSid = null;

  function setBusy(isBusy) {
    const btn = $("callBtn");
    const resetBtn = $("resetBtn");
    const spinner = $("spinner");
    btn.disabled = isBusy;
    resetBtn.disabled = false; // reset mag altijd
    if (isBusy) show(spinner);
    else hide(spinner);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function resetUI() {
    stopPolling();
    currentCallSid = null;
    $("callSid").textContent = "—";
    $("callTo").textContent = "—";
    $("callStatusLabel").textContent = "—";
    $("transcriptBox").value = "";
    clearStatus();
    setBusy(false);
  }

  // ---------- Polling logic ----------
  async function pollCallState(callSid) {
    // Aanrader: backend endpoint dat status + transcript in 1 call geeft:
    // GET /call-state/<callSid>  -> { ok, call_sid, status, transcript, to, ... }

    // Fallback als jullie alleen /call-transcript en /call-status hebben:
    // - haal transcript via /call-transcript/<callSid>
    // - haal status via /call-status/<callSid> (Twilio API fetch)
    //
    // In deze JS gebruiken we primair /call-state.
    try {
      const state = await fetchJson(`${API_BASE_URL}/call-state/${encodeURIComponent(callSid)}`);

      // Update UI
      $("callStatusLabel").textContent = mapCallStatusLabel(state.status);
      if (state.to) $("callTo").textContent = state.to;

      if (state.transcript && state.transcript.trim().length > 0) {
        $("transcriptBox").value = state.transcript;
        setStatus("Transcript ontvangen ✅", "success");
        setBusy(false);
        stopPolling();
        return;
      }

      // Als call completed is en nog geen transcript -> stop (anders blijf je eindeloos pollen)
      if (String(state.status || "").toLowerCase() === "completed") {
        setBusy(false);
        stopPolling();
        setStatus("Call is afgerond, maar er is geen transcript ontvangen. (Mogelijk niets gehoord of herkenning mislukt.)", "error");
      }
    } catch (err) {
      // Endpoint kan 404 geven als store nog niets weet van CallSid.
      // Even tolerant zijn: toon niet meteen error, maar wel debug info.
      console.warn("Polling error:", err);
    }
  }

  function startPolling(callSid) {
    stopPolling();
    // eerste poll direct
    pollCallState(callSid);
    // daarna interval
    pollTimer = setInterval(() => pollCallState(callSid), 1200);
  }

  // ---------- Event handlers ----------
  async function onSubmit(e) {
    e.preventDefault();
    clearStatus();

    const raw = $("phoneInput").value;
    const normalized = normalizeDutchNumber(raw);

    if (!isPlausibleNlNumber(normalized)) {
      setStatus("Voer een geldig NL telefoonnummer in (bijv. 0612345678).", "error");
      return;
    }

    // UI reset voor nieuwe call
    resetUI();
    setBusy(true);

    try {
      // Start call
      const data = await fetchJson(`${API_BASE_URL}/call/${encodeURIComponent(normalized)}`, { method: "GET" });

      if (!data.ok || !data.call_sid) {
        throw new Error(data.error || "Kon call niet starten.");
      }

      currentCallSid = data.call_sid;
      $("callSid").textContent = data.call_sid;
      $("callTo").textContent = data.to || "—";
      $("callStatusLabel").textContent = "initiated";

      setStatus("Call gestart. Neem op en spreek een korte zin in…", "info");

      // Start polling voor status + transcript
      startPolling(currentCallSid);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setStatus(`Fout bij starten call: ${err.message}`, "error");
    }
  }

  async function onCopy() {
    const text = ($("transcriptBox").value || "").trim();
    if (!text) {
      setStatus("Er is nog geen transcript om te kopiëren.", "info");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Gekopieerd naar klembord ✅", "success");
    } catch {
      // Fallback: select + copy
      $("transcriptBox").focus();
      $("transcriptBox").select();
      document.execCommand("copy");
      setStatus("Gekopieerd (fallback) ✅", "success");
    }
  }

  function onReset() {
    resetUI();
    $("phoneInput").value = "";
    setStatus("Reset uitgevoerd.", "info");
  }

  // ---------- Init ----------
  function init() {
    $("callForm").addEventListener("submit", onSubmit);
    $("copyBtn").addEventListener("click", onCopy);
    $("resetBtn").addEventListener("click", onReset);

    // Start in schone toestand
    resetUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
