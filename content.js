/*
 * content.js: click a video on x.com and it plays large in a panel on the right, full
 * window height. While it is open the nav shrinks to icons, the timeline moves left
 * (CSS, see styles.css), a scrim covers the timeline and the original video is hidden.
 *
 * Where it fits: content script for x.com / twitter.com (see manifest.json).
 * Depends on: layout.js (dockRect, fitContain, fmtTime, NAV_W), dock-ui.js (buildDock),
 * styles.css.
 * Related: X's own selectors below (data-testid values) are the fragile part.
 *
 * Non-obvious constraints (verified on x.com 2026-10-17):
 * - X plays video from a blob: MediaSource URL, which only one <video> can use.
 *   So the dock plays original.captureStream() in its own <video> and the
 *   original keeps playing underneath (muted and hidden while docked).
 * - The original is hidden with visibility, not display: it keeps its size, so the
 *   feed does not jump, and X still sees it on screen and does not pause it.
 * - X virtualises the timeline: a post far off screen is removed from the DOM and
 *   its video dies. The dock closes when that happens (the timer in open()).
 * - The dock width is resizable (drag its left edge). The width is kept in x.com's
 *   localStorage under "xvd-width" and survives page loads.
 * - Tried and removed: blocking X's autoplay by replacing HTMLMediaElement.play in the page
 *   world. Resolving the call left every feed video on X's loading spinner, and pausing
 *   from a play listener made X retry about 1,600 times in 8 s. Do not retry without a
 *   better idea.
 * - Closing: Esc, the Close button, or a click anywhere outside the dock. A scrim over the
 *   timeline takes those clicks, so they never reach X's posts underneath.
 * - A captured stream cannot seek or change speed by itself, so the seek bar and the speed
 *   button drive the original.
 * - The only control X draws on a feed video is the mute button, so a click on a
 *   video that is not on a <button> opens the dock instead of X's own handler.
 */
(function () {
  const SEL = {
    player: '[data-testid="videoPlayer"]',
    user: '[data-testid="User-Name"]',
    avatar: '[data-testid="Tweet-User-Avatar"] img',
    text: '[data-testid="tweetText"]',
  };
  const SPEEDS = [1, 1.25, 1.5, 2];
  const HEAD_H = 56; // dock header height, same value as .xvd-head in styles.css
  const BAR_H = 52; // control bar height, same as .xvd-bar
  const PAD = 12; // stage padding and the gap between video and bar

  const KEY = "xvd-width"; // user-dragged dock width; absent = fill the space right of the timeline
  let dock = null; // { ui, scrim, src, player, userW, wasMuted, userPaused, timer, ... }

  function savedWidth() {
    try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; }
  }

  function saveWidth(w) {
    try { if (w) localStorage.setItem(KEY, String(w)); else localStorage.removeItem(KEY); } catch (e) {}
  }

  /** Author, avatar, link and text of the post the video belongs to (a quoted post counts). */
  function postMeta(player) {
    let scope = player.parentElement;
    while (scope && !scope.querySelector(SEL.user)) scope = scope.parentElement;
    const meta = { name: "", handle: "", avatar: "", url: "", text: "" };
    if (!scope) return meta;
    // The name row has no links inside a quoted post, so read its text pieces instead:
    // ["Historic Vids", "@historyinmemes", "·", "11h"].
    const pieces = Array.from(scope.querySelector(SEL.user).querySelectorAll("span"))
      .filter(function (s) { return s.children.length === 0; })
      .map(function (s) { return s.textContent.trim(); })
      .filter(Boolean);
    meta.name = pieces[0] || "";
    meta.handle = pieces.find(function (t) { return t.charAt(0) === "@"; }) || "";
    const img = scope.querySelector(SEL.avatar);
    if (img) meta.avatar = img.src;
    const status = scope.querySelector('a[href*="/status/"]') || player.closest("article")?.querySelector('a[href*="/status/"]');
    if (status) meta.url = status.href;
    const text = scope.querySelector(SEL.text);
    if (text) meta.text = text.textContent.trim();
    return meta;
  }

  function place() {
    if (!dock) return;
    const r = dockRect(innerWidth, innerHeight, dock.userW);
    // The timeline column gets an explicit width (styles.css reads this variable), so it
    // follows the dock instead of leaving a gap, and does not shrink-wrap on post pages.
    document.documentElement.style.setProperty("--xvd-main", r.mainW + "px");
    Object.assign(dock.scrim.style, { left: NAV_W + "px", width: Math.max(r.left - NAV_W, 0) + "px" });
    Object.assign(dock.ui.root.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    const v = dock.src;
    const f = fitContain(r.width - 2 * PAD - 8, r.height - HEAD_H - BAR_H - 3 * PAD, v.videoWidth, v.videoHeight);
    dock.ui.video.style.width = f.w + "px";
    dock.ui.video.style.height = f.h + "px";
    // The bar and text are as wide as the video, but never narrower than the bar's own controls.
    dock.ui.col.style.width = Math.min(Math.max(f.w, 360), r.width - 2 * PAD - 8) + "px";
  }

  function toggle() {
    const src = dock.src;
    if (src.paused) {
      dock.userPaused = false;
      src.play();
    } else {
      dock.userPaused = true;
      src.pause();
    }
  }

  function skip(sec) {
    const src = dock.src;
    if (src.duration) src.currentTime = Math.min(Math.max(src.currentTime + sec, 0), src.duration);
  }

  function toggleMute() {
    dock.ui.video.muted = !dock.ui.video.muted;
    dock.ui.setMuted(dock.ui.video.muted);
  }

  function open(src) {
    close(); // switching videos
    const player = src.closest(SEL.player);
    const ui = buildDock(player ? postMeta(player) : {});
    const scrim = document.createElement("div");
    scrim.className = "xvd-scrim";
    scrim.title = "Click to close the video";
    document.body.append(scrim, ui.root);

    dock = { ui, scrim, src, player, userW: savedWidth(), wasMuted: src.muted, userPaused: false, speed: 0, timer: 0 };
    ui.video.srcObject = src.captureStream();
    document.documentElement.classList.add("xvd-open"); // moves the timeline aside, see styles.css
    if (player) player.classList.add("xvd-src"); // hides the original
    src.muted = true;
    if (src.paused) src.play().catch(function () {});

    // X pauses a video when its post scrolls out of view, and unmutes it when sound is
    // switched on globally. The dock copy follows the original, so undo both while docked.
    dock.onPause = function () {
      if (!dock.userPaused && !src.ended && src.isConnected) src.play().catch(function () {});
    };
    dock.onVolume = function () { if (!src.muted) src.muted = true; };
    src.addEventListener("pause", dock.onPause);
    src.addEventListener("volumechange", dock.onVolume);
    src.addEventListener("loadedmetadata", place);

    ui.close.addEventListener("click", close);
    ui.play.addEventListener("click", toggle);
    ui.video.addEventListener("click", toggle);
    ui.vol.addEventListener("click", toggleMute);
    ui.speed.addEventListener("click", function () {
      dock.speed = (dock.speed + 1) % SPEEDS.length;
      src.playbackRate = SPEEDS[dock.speed];
      ui.speed.textContent = SPEEDS[dock.speed] + "×";
    });
    ui.seek.addEventListener("input", function () {
      if (src.duration) src.currentTime = (ui.seek.value / 1000) * src.duration;
    });

    // Drag the left edge to resize; double-click it to fill the free space again.
    ui.grip.addEventListener("pointerdown", function (e) {
      ui.grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    ui.grip.addEventListener("pointermove", function (e) {
      if (!ui.grip.hasPointerCapture(e.pointerId)) return;
      dock.userW = clampDockWidth(innerWidth - e.clientX, innerWidth);
      place();
    });
    ui.grip.addEventListener("pointerup", function () { saveWidth(dock.userW); });
    ui.grip.addEventListener("dblclick", function () {
      dock.userW = 0;
      saveWidth(0);
      place();
    });

    dock.timer = setInterval(function () {
      if (!src.isConnected) return close(); // X removed the post (virtualised list)
      ui.setPlaying(!src.paused);
      if (src.duration) {
        const pct = (src.currentTime / src.duration) * 100;
        ui.seek.value = pct * 10;
        ui.seek.style.setProperty("--p", pct + "%");
      }
      ui.time.textContent = fmtTime(src.currentTime) + " / " + fmtTime(src.duration);
      place();
    }, 250);
    ui.setMuted(false);
    place();
  }

  /**
   * The original is always paused: it must not keep playing in the feed, and a <video> that X
   * removed keeps playing sound if nobody pauses it. Listeners come off first, so our own
   * "replay on pause" handler does not undo this.
   */
  function close() {
    if (!dock) return;
    clearInterval(dock.timer);
    dock.src.removeEventListener("pause", dock.onPause);
    dock.src.removeEventListener("volumechange", dock.onVolume);
    dock.src.removeEventListener("loadedmetadata", place);
    dock.src.pause();
    dock.src.playbackRate = 1;
    dock.src.muted = dock.wasMuted;
    if (dock.player) dock.player.classList.remove("xvd-src");
    dock.ui.video.srcObject = null;
    dock.ui.root.remove();
    dock.scrim.remove();
    document.documentElement.classList.remove("xvd-open");
    document.documentElement.style.removeProperty("--xvd-main");
    dock = null;
  }

  // Capture phase on document runs before X's React handlers, so stopPropagation wins.
  document.addEventListener("click", function (e) {
    if (!(e.target instanceof Element)) return;
    if (dock && dock.ui.root.contains(e.target)) return; // the dock's own controls
    const p = e.target.closest(SEL.player);
    if (p && e.target.closest("button")) return; // leave the mute button alone
    const v = p && p.querySelector("video");
    if (v) {
      e.stopPropagation();
      e.preventDefault();
      open(v); // also switches the dock to this video
      return;
    }
    // Any other click on the page closes the dock. The scrim covers the timeline, so in
    // practice this is a click on the nav.
    close();
  }, true);

  // Keys, capture phase so X's own shortcuts (j, k, space) do not also act.
  addEventListener("keydown", function (e) {
    if (!dock) return;
    if (e.key === "Escape") return close();
    const t = e.target;
    if (t instanceof Element && (t.closest("textarea, [contenteditable]") || t === dock.ui.seek)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === " " || k === "k") toggle();
    else if (k === "ArrowLeft") skip(-5);
    else if (k === "ArrowRight") skip(5);
    else if (k === "m") toggleMute();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  addEventListener("resize", place);
})();
