/*
 * content.js: click a video on x.com and it plays large in a panel on the right, full
 * window height. While it is open the nav shrinks to icons, the timeline moves left
 * (CSS, see styles.css) and the original video in the feed is hidden.
 *
 * Where it fits: content script for x.com / twitter.com (see manifest.json).
 * Depends on: layout.js (dockRect, fitContain, fmtTime), styles.css.
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
 * - Closing: Esc, the Close button, or a click anywhere outside the dock.
 * - A captured stream cannot seek by itself, so the seek bar drives the original.
 * - The only control X draws on a feed video is the mute button, so a click on a
 *   video that is not on a <button> opens the dock instead of X's own handler.
 */
(function () {
  const SEL = {
    player: '[data-testid="videoPlayer"]',
  };

  const KEY = "xvd-width"; // user-dragged dock width; absent = fill the space right of the timeline
  let dock = null; // { root, video, src, player, wasMuted, timer }

  function savedWidth() {
    try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; }
  }

  function saveWidth(w) {
    try { if (w) localStorage.setItem(KEY, String(w)); else localStorage.removeItem(KEY); } catch (e) {}
  }

  function place() {
    if (!dock) return;
    const r = dockRect(innerWidth, innerHeight, dock.userW);
    // The timeline column gets an explicit width (styles.css reads this variable), so it
    // follows the dock instead of leaving a gap, and does not shrink-wrap on post pages.
    document.documentElement.style.setProperty("--xvd-main", r.mainW + "px");
    Object.assign(dock.root.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    const v = dock.src;
    const f = fitContain(r.width - 24, r.height - 48 - 64 - 12, v.videoWidth, v.videoHeight);
    dock.video.style.width = f.w + "px";
    dock.video.style.height = f.h + "px";
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function open(src) {
    close(true); // switching videos: stop the old original, or it keeps playing in the feed
    const player = src.closest(SEL.player);
    const root = el("div", "xvd-dock");
    const bar = el("div", "xvd-top");
    const title = el("span", "", "Docked video");
    const x = el("button", "xvd-x", "Close");
    x.type = "button";
    x.addEventListener("click", function () { close(false); });
    bar.append(title, x);

    const video = el("video", "xvd-video");
    video.srcObject = src.captureStream();
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

    const ctl = el("div", "xvd-ctl");
    const pp = el("button", "xvd-pp", "Pause");
    pp.type = "button";
    const seek = el("input", "xvd-seek");
    seek.type = "range";
    seek.min = 0;
    seek.max = 1000;
    seek.value = 0;
    seek.setAttribute("aria-label", "Seek");
    const time = el("span", "xvd-time", "0:00");
    ctl.append(pp, seek, time);

    // Drag the left edge to resize; double-click it to fill the free space again.
    const grip = el("div", "xvd-grip");
    grip.title = "Drag to resize, double-click to reset";
    grip.addEventListener("pointerdown", function (e) {
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (!grip.hasPointerCapture(e.pointerId)) return;
      dock.userW = clampDockWidth(innerWidth - e.clientX, innerWidth);
      place();
    });
    grip.addEventListener("pointerup", function () { saveWidth(dock.userW); });
    grip.addEventListener("dblclick", function () {
      dock.userW = 0;
      saveWidth(0);
      place();
    });

    root.append(grip, bar, video, ctl);
    document.body.append(root);

    dock = { root, video, src, player, userW: savedWidth(), wasMuted: src.muted, userPaused: false, timer: 0 };
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

    pp.addEventListener("click", function () {
      if (src.paused) {
        dock.userPaused = false;
        src.play();
      } else {
        dock.userPaused = true;
        src.pause();
      }
    });
    video.addEventListener("click", function () { pp.click(); });
    seek.addEventListener("input", function () {
      if (src.duration) src.currentTime = (seek.value / 1000) * src.duration;
    });
    src.addEventListener("loadedmetadata", place);

    dock.timer = setInterval(function () {
      if (!src.isConnected) return close(true); // X removed the post (virtualised list)
      pp.textContent = src.paused ? "Play" : "Pause";
      if (src.duration) seek.value = (src.currentTime / src.duration) * 1000;
      time.textContent = fmtTime(src.currentTime) + " / " + fmtTime(src.duration);
      place();
    }, 250);
    place();
  }

  /**
   * stopSource: pause the original too. Used when switching videos and when X has removed the
   * post, because a removed <video> keeps playing sound if nobody pauses it.
   * Otherwise the original goes back to the feed as it was (sound state restored).
   */
  function close(stopSource) {
    if (!dock) return;
    clearInterval(dock.timer);
    dock.src.removeEventListener("pause", dock.onPause);
    dock.src.removeEventListener("volumechange", dock.onVolume);
    if (stopSource) dock.src.pause(); else dock.src.muted = dock.wasMuted;
    if (dock.player) dock.player.classList.remove("xvd-src");
    dock.video.srcObject = null;
    dock.root.remove();
    document.documentElement.classList.remove("xvd-open");
    document.documentElement.style.removeProperty("--xvd-main");
    dock = null;
  }

  // Capture phase on document runs before X's React handlers, so stopPropagation wins.
  document.addEventListener("click", function (e) {
    if (!(e.target instanceof Element)) return;
    if (dock && dock.root.contains(e.target)) return; // the dock's own controls
    const p = e.target.closest(SEL.player);
    if (p && e.target.closest("button")) return; // leave the mute button alone
    const v = p && p.querySelector("video");
    if (v) {
      e.stopPropagation();
      e.preventDefault();
      open(v); // also switches the dock to this video
      return;
    }
    // Any other click on the page closes the dock. The click itself goes on to X
    // (open a post, follow a link), so closing never costs the user a second click.
    close(false);
  }, true);

  addEventListener("resize", place);
  // Capture phase, so Esc closes the dock even when X's own handlers use the key.
  addEventListener("keydown", function (e) { if (e.key === "Escape") close(false); }, true);
})();
