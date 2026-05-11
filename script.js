const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const button = document.getElementById("hold-button");
const videoWrap = document.getElementById("video-wrap");

const grain = document.getElementById("grain");
const darkness = document.getElementById("darkness");
const glitchLines = document.getElementById("glitch-lines");

let isHolding = false;
let degradation = 0;

// 0 = clear
// 100 = illegible glitch

const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");

function resizeCanvas() {
  const rect = videoWrap.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function startHolding(event) {
  if (event) event.preventDefault();

  isHolding = true;

  video.muted = false;
  video.volume = 1;

  if (video.paused) {
    video.play();
  }
}

function stopHolding(event) {
  if (event) event.preventDefault();

  isHolding = false;
}

button.addEventListener("mousedown", startHolding);
button.addEventListener("mouseup", stopHolding);
button.addEventListener("mouseleave", stopHolding);

button.addEventListener("touchstart", startHolding, { passive: false });
button.addEventListener("touchend", stopHolding, { passive: false });
button.addEventListener("touchcancel", stopHolding, { passive: false });

videoWrap.addEventListener("mousedown", startHolding);
videoWrap.addEventListener("mouseup", stopHolding);
videoWrap.addEventListener("mouseleave", stopHolding);

videoWrap.addEventListener("touchstart", startHolding, { passive: false });
videoWrap.addEventListener("touchend", stopHolding, { passive: false });
videoWrap.addEventListener("touchcancel", stopHolding, { passive: false });

function getContainedDrawSettings(videoWidth, videoHeight, canvasWidth, canvasHeight) {
  // Change this number to resize the artwork.
  // Smaller = smaller video on the page.
  const artworkScale = 0.62;

  const maxWidth = canvasWidth * artworkScale;
  const maxHeight = canvasHeight * artworkScale;

  const videoRatio = videoWidth / videoHeight;
  const maxRatio = maxWidth / maxHeight;

  let drawWidth;
  let drawHeight;

  if (videoRatio > maxRatio) {
    drawWidth = maxWidth;
    drawHeight = maxWidth / videoRatio;
  } else {
    drawHeight = maxHeight;
    drawWidth = maxHeight * videoRatio;
  }

  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  return {
    drawX,
    drawY,
    drawWidth,
    drawHeight
  };
}

function updateAudioGlitch() {
  // Keep audio basically present, but corrupt it as the image corrupts.
  if (video.paused) return;

  const glitchAmount = degradation / 100;

  if (degradation < 15) {
    video.volume = 1;
    video.playbackRate = 1;
    return;
  }

  const time = performance.now();

  // Choppy gating: this makes the audio flicker/stutter rather than fade.
  const chopSpeed = 55 - glitchAmount * 38;
  const chop = Math.sin(time / chopSpeed);

  if (degradation > 75) {
    video.volume = chop > 0.15 ? 1 : 0.03;
  } else if (degradation > 45) {
    video.volume = chop > -0.25 ? 1 : 0.12;
  } else {
    video.volume = chop > -0.55 ? 1 : 0.32;
  }

  // Playback-rate wobble.
  if (degradation > 25) {
    const wobble = (Math.random() - 0.5) * glitchAmount * 0.22;
    video.playbackRate = Math.max(0.82, Math.min(1.22, 1 + wobble));
  } else {
    video.playbackRate = 1;
  }

  // Tiny forward skips at heavy degradation.
  if (degradation > 70 && Math.random() < 0.018 && video.duration) {
    video.currentTime = Math.min(video.duration, video.currentTime + 0.025);
  }

  // Tiny backward skips at extreme degradation.
  if (degradation > 88 && Math.random() < 0.012 && video.currentTime > 0.08) {
    video.currentTime = Math.max(0, video.currentTime - 0.045);
  }
}

function draw() {
  if (isHolding) {
    degradation -= 0.8;
  } else {
    degradation += 1.6;
  }

  degradation = Math.max(0, Math.min(100, degradation));

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Pure black page background.
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);

  if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const drawSettings = getContainedDrawSettings(
      video.videoWidth,
      video.videoHeight,
      w,
      h
    );

    // The image becomes extremely low-res as degradation increases.
    const lowResWidth = Math.max(
      5,
      Math.floor(drawSettings.drawWidth * (1 - degradation / 103))
    );

    const lowResHeight = Math.max(
      5,
      Math.floor(drawSettings.drawHeight * (1 - degradation / 103))
    );

    tempCanvas.width = lowResWidth;
    tempCanvas.height = lowResHeight;

    tempCtx.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight,
      0,
      0,
      lowResWidth,
      lowResHeight
    );

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      tempCanvas,
      0,
      0,
      lowResWidth,
      lowResHeight,
      drawSettings.drawX,
      drawSettings.drawY,
      drawSettings.drawWidth,
      drawSettings.drawHeight
    );

    // Heavy glitch slices.
    if (degradation > 8) {
      const sliceCount = Math.floor(degradation / 2);

      for (let i = 0; i < sliceCount; i++) {
        const y = drawSettings.drawY + Math.random() * drawSettings.drawHeight;
        const sliceHeight = Math.random() * 26 + 3;
        const shift = (Math.random() - 0.5) * degradation * 3.8;

        ctx.drawImage(
          canvas,
          drawSettings.drawX,
          y,
          drawSettings.drawWidth,
          sliceHeight,
          drawSettings.drawX + shift,
          y,
          drawSettings.drawWidth,
          sliceHeight
        );
      }
    }

    // Pixel block corruption, not black fade.
    if (degradation > 28) {
      const blockCount = Math.floor(degradation / 4);

      for (let i = 0; i < blockCount; i++) {
        const blockX = drawSettings.drawX + Math.random() * drawSettings.drawWidth;
        const blockY = drawSettings.drawY + Math.random() * drawSettings.drawHeight;
        const blockW = Math.random() * 120 + 15;
        const blockH = Math.random() * 70 + 10;

        const grey = Math.floor(Math.random() * 255);
        const alpha = Math.random() * 0.5 + 0.18;

        ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, ${alpha})`;
        ctx.fillRect(blockX, blockY, blockW, blockH);
      }
    }

    // Harsh white scan tears.
    if (degradation > 40 && Math.random() < 0.28) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
      ctx.fillRect(
        drawSettings.drawX,
        drawSettings.drawY + Math.random() * drawSettings.drawHeight,
        drawSettings.drawWidth,
        Math.random() * 34 + 4
      );
    }

    // At maximum degradation, make it illegible but still visibly active.
    if (degradation > 82) {
      const noiseCount = Math.floor((degradation - 80) * 8);

      for (let i = 0; i < noiseCount; i++) {
        const x = drawSettings.drawX + Math.random() * drawSettings.drawWidth;
        const y = drawSettings.drawY + Math.random() * drawSettings.drawHeight;
        const size = Math.random() * 18 + 3;

        const value = Math.random() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgba(${value}, ${value}, ${value}, ${Math.random() * 0.75})`;
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  grain.style.opacity = Math.min(1, degradation / 18);

  // No fade to black.
  darkness.style.opacity = 0;

  glitchLines.style.opacity = Math.min(
    0.95,
    Math.max(0, (degradation - 10) / 40)
  );

  updateAudioGlitch();

  requestAnimationFrame(draw);
}

draw();