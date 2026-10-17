/*
 * content.js: adds a "dock" button to every video on x.com. Clicking it plays
 * that video large in a panel on the right, full window height. While it is open the
 * nav shrinks to icons and the timeline moves left (CSS, see styles.css).
 *
 * Where it fits: content script for x.com / twitter.com (see manifest.json).
 * Depends on: layout.js (dockRect, fitContain, fmtTime), styles.css.
 * Related: X's own selectors below (data-testid values) are the fragile part.
 *
 * Non-obvious constraints (verified on x.com 2026-10-17):
 * - X plays video from a blob: MediaSource URL, which only one <video> can use.
 *   So the dock plays original.captureStream() in its own <video> and the
 *   original keeps playing underneath (muted while docked, to avoid echo).
 * - X virtualises the timeline: a post far off screen is removed from the DOM and
 *   its video dies. The dock closes when that happens (watch() below).
 * - A captured stream cannot seek by itself, so the seek bar drives the original.
 */
(function () {
  const SEL = {
    player: '[data-testid="videoPlayer"]',
    column: '[data-testid="primaryColumn"]',
  };

  let dock = null; // { root, video, src, wasMuted, timer }

  function colRight() {
    const col = document.querySelector(SEL.column);
    return col ? col.getBoundingClientRect().right : innerWidth * 0.6;
  }

  function place() {
    if (!dock) return;
    const r = dockRect(colRight(), innerWidth, innerHeight);
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
    close();
    const root = el("div", "xvd-dock");
    const bar = el("div", "xvd-top");
    const title = el("span", "", "Docked video");
    const x = el("button", "xvd-x", "Close");
    x.type = "button";
    x.addEventListener("click", close);
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

    root.append(bar, video, ctl);
    document.body.append(root);

    dock = { root, video, src, wasMuted: src.muted, timer: 0 };
    document.documentElement.classList.add("xvd-open"); // moves the timeline aside, see styles.css
    src.muted = true;
    if (src.paused) src.play().catch(function () {});

    pp.addEventListener("click", function () {
      if (src.paused) src.play(); else src.pause();
    });
    video.addEventListener("click", function () { pp.click(); });
    seek.addEventListener("input", function () {
      if (src.duration) src.currentTime = (seek.value / 1000) * src.duration;
    });
    src.addEventListener("loadedmetadata", place);

    dock.timer = setInterval(function () {
      if (!src.isConnected) return close(); // X removed the post (virtualised list)
      pp.textContent = src.paused ? "Play" : "Pause";
      if (src.duration) seek.value = (src.currentTime / src.duration) * 1000;
      time.textContent = fmtTime(src.currentTime) + " / " + fmtTime(src.duration);
      place();
    }, 250);
    place();
  }

  function close() {
    if (!dock) return;
    clearInterval(dock.timer);
    dock.src.muted = dock.wasMuted;
    dock.video.srcObject = null;
    dock.root.remove();
    document.documentElement.classList.remove("xvd-open");
    dock = null;
  }

  function addButtons() {
    document.querySelectorAll(SEL.player).forEach(function (p) {
      if (p.querySelector(".xvd-btn")) return;
      const b = el("button", "xvd-btn", "Dock");
      b.type = "button";
      b.title = "Play in the right dock";
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        const v = p.querySelector("video");
        if (v) open(v);
      });
      p.append(b);
    });
  }

  let queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; addButtons(); });
  }).observe(document.body, { childList: true, subtree: true });

  addEventListener("resize", place);
  addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  addButtons();
})();
