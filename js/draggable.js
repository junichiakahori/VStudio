// Universal Draggable UI Logic

window.makeDraggable = function (element, handleElement, storageKeyPrefix) {
  if (!element) return;
  const handle = handleElement || element;
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  // Load saved position
  const savedLeft = localStorage.getItem(`${storageKeyPrefix}_left`);
  const savedTop = localStorage.getItem(`${storageKeyPrefix}_top`);
  if (savedLeft !== null && savedTop !== null) {
    element.style.left = savedLeft;
    element.style.top = savedTop;
    element.style.right = "auto"; // Disable right/bottom if positioned
    element.style.bottom = "auto";
  }

  handle.style.cursor = "grab";

  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    handle.style.cursor = "grabbing";
    element.classList.add("dragging");

    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;

    // Force absolute positioning
    element.style.position = "absolute";
    element.style.margin = "0";
    element.style.right = "auto";
    element.style.bottom = "auto";

    // Disable transitions during drag
    element.style.transition = "none";

    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;

    newLeft = Math.max(
      0,
      Math.min(newLeft, window.innerWidth - element.offsetWidth),
    );
    newTop = Math.max(
      0,
      Math.min(newTop, window.innerHeight - element.offsetHeight),
    );

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = "grab";
      element.classList.remove("dragging");

      // Restore transitions
      element.style.transition = "";

      localStorage.setItem(`${storageKeyPrefix}_left`, element.style.left);
      localStorage.setItem(`${storageKeyPrefix}_top`, element.style.top);
    }
  });
};

function initDraggableElements() {
  // 1. Clock
  const clock = document.getElementById("stream-clock");
  if (clock && !clock.dataset.draggableInit) {
    clock.dataset.draggableInit = "true";
    window.makeDraggable(clock, clock, "streamClock");
  }

  // 2. Stats
  const stats = document.getElementById("stream-stats");
  if (stats && !stats.dataset.draggableInit) {
    stats.dataset.draggableInit = "true";
    window.makeDraggable(stats, stats, "streamStats");
  }

  // 3. Comment Viewer
  const commentViewer = document.getElementById("comment-viewer");
  if (commentViewer && !commentViewer.dataset.draggableInit) {
    commentViewer.dataset.draggableInit = "true";
    window.makeDraggable(commentViewer, commentViewer, "commentViewer");
  }

  // 4. ニュースボード (右側)
  const newsBoard = document.getElementById("news-board");
  if (newsBoard && !newsBoard.dataset.draggableInit) {
    newsBoard.dataset.draggableInit = "true";
    const header = newsBoard.querySelector(".news-header") || newsBoard;
    window.makeDraggable(newsBoard, header, "newsBoard");
  }

  // 5. ニューストピックス/アジェンダボード (左側 TODAY'S TOPICS)
  const setlistBoard = document.getElementById("news-setlist-board");
  if (setlistBoard && !setlistBoard.dataset.draggableInit) {
    setlistBoard.dataset.draggableInit = "true";
    const header = setlistBoard.querySelector(".setlist-header") || setlistBoard;
    window.makeDraggable(setlistBoard, header, "newsSetlistBoard");
  }

  // 6. リアルタイム字幕テロップ
  const subtitles = document.getElementById("avatar-subtitles");
  if (subtitles && !subtitles.dataset.draggableInit) {
    subtitles.dataset.draggableInit = "true";
    const handle = document.getElementById("subtitles-drag-handle") || subtitles;
    window.makeDraggable(subtitles, handle, "avatarSubtitles");
  }
}

(window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("draggable", initDraggableElements);
document.addEventListener("DOMContentLoaded", initDraggableElements);
if (document.readyState === "complete" || document.readyState === "interactive") {
  initDraggableElements();
}
