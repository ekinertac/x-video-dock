/*
 * dock-ui.js: builds the dock's DOM (header, video, control bar, post text) and nothing else.
 *
 * Role: pure view. It creates elements and returns references; content.js wires the
 * behaviour (playback, sizing, closing) and fills in the post details it read from X's page.
 * Loaded after layout.js and before content.js (see manifest.json); styles live in styles.css.
 * Constraint: no innerHTML. Elements are built with createElement(NS), so nothing from X's
 * page (author name, post text) is ever parsed as markup.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// 24x24 icons. "f" paths are filled, "s" paths are stroked lines.
const ICONS = {
  play: [["f", "M8 5v14l11-7z"]],
  pause: [["f", "M6 5h4v14H6zM14 5h4v14h-4z"]],
  volume: [["f", "M3 9v6h4l5 5V4L7 9H3z"], ["s", "M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"]],
  muted: [["f", "M3 9v6h4l5 5V4L7 9H3z"], ["s", "M16 9l5 6M21 9l-5 6"]],
  close: [["s", "M6 6l12 12M18 6L6 18"]],
  open: [["s", "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"]],
};

function xvdIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  ICONS[name].forEach(function (p) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", p[1]);
    if (p[0] === "f") {
      path.setAttribute("fill", "currentColor");
    } else {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
    }
    svg.append(path);
  });
  return svg;
}

function xvdEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function xvdButton(cls, label, icon) {
  const b = xvdEl("button", "xvd-btn " + cls);
  b.type = "button";
  b.title = label;
  b.setAttribute("aria-label", label);
  if (icon) b.append(xvdIcon(icon));
  return b;
}

/**
 * meta: { name, handle, avatar, url, text } (any may be empty).
 * Returns the root element and the pieces content.js needs to drive.
 */
function buildDock(meta) {
  const root = xvdEl("div", "xvd-dock");
  const grip = xvdEl("div", "xvd-grip");
  grip.title = "Drag to resize, double-click to reset";

  const head = xvdEl("div", "xvd-head");
  if (meta.avatar) {
    const img = xvdEl("img", "xvd-avatar");
    img.src = meta.avatar;
    img.alt = "";
    head.append(img);
  }
  const who = xvdEl("div", "xvd-who");
  who.append(xvdEl("span", "xvd-name", meta.name || "Video"), xvdEl("span", "xvd-handle", meta.handle || ""));
  head.append(who);
  if (meta.url) {
    const a = xvdEl("a", "xvd-btn xvd-open");
    a.href = meta.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = "Open post in a new tab";
    a.setAttribute("aria-label", a.title);
    a.append(xvdIcon("open"));
    head.append(a);
  }
  const close = xvdButton("xvd-close", "Close (Esc)", "close");
  head.append(close);

  const video = xvdEl("video", "xvd-video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = false;

  const play = xvdButton("xvd-play", "Pause (Space)", "pause");
  const time = xvdEl("span", "xvd-time", "0:00 / 0:00");
  const seek = xvdEl("input", "xvd-seek");
  seek.type = "range";
  seek.min = 0;
  seek.max = 1000;
  seek.value = 0;
  seek.setAttribute("aria-label", "Seek");
  const speed = xvdEl("button", "xvd-speed", "1×");
  speed.type = "button";
  speed.title = "Playback speed";
  const vol = xvdButton("xvd-vol", "Mute (M)", "volume");
  const bar = xvdEl("div", "xvd-bar");
  bar.append(play, time, seek, speed, vol);

  const info = xvdEl("div", "xvd-info");
  if (meta.text) info.append(xvdEl("p", "xvd-text", meta.text));

  const col = xvdEl("div", "xvd-col");
  col.append(video, bar, info);
  const stage = xvdEl("div", "xvd-stage");
  stage.append(col);

  root.append(grip, head, stage);

  return {
    root: root, grip: grip, close: close, col: col, video: video,
    play: play, time: time, seek: seek, speed: speed, vol: vol,
    setPlaying: function (on) {
      play.replaceChildren(xvdIcon(on ? "pause" : "play"));
      play.title = on ? "Pause (Space)" : "Play (Space)";
      play.setAttribute("aria-label", play.title);
    },
    setMuted: function (on) {
      vol.replaceChildren(xvdIcon(on ? "muted" : "volume"));
      vol.title = on ? "Unmute (M)" : "Mute (M)";
      vol.setAttribute("aria-label", vol.title);
    },
  };
}
