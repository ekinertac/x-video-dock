/*
 * block-autoplay.js: stops x.com from starting videos by itself.
 *
 * Role: runs in the PAGE's own JS world (manifest "world": "MAIN", at document_start),
 * because only there can it replace HTMLMediaElement.prototype.play, which X calls.
 * Related: content.js marks the docked video with data-xvd-ok (a DOM attribute, the one
 * channel both JS worlds can see) and gives the dock's own <video> the class xvd-video.
 *
 * Why block the call instead of pausing after "play" fires: X retries play() after every
 * pause. Measured on x.com 2026-10-17: pausing from a play listener caused about 1,600
 * play/pause cycles in 8 seconds of scrolling. Blocking the call causes none.
 */
(function () {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const allowed = this.hasAttribute("data-xvd-ok") || this.classList.contains("xvd-video");
    // Reject, like a browser's own autoplay block. Resolving without playing left every feed
    // video on X's loading spinner (verified 2026-10-17); a rejection makes X show a play button.
    if (this instanceof HTMLVideoElement && !allowed) {
      return Promise.reject(new DOMException("play() blocked by X Video Dock", "NotAllowedError"));
    }
    return play.apply(this, arguments);
  };
})();
