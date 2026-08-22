// =====================================================================
// 画面レイヤーマネージャー (Stream Screen Layer Manager)
// =====================================================================

(function () {
  const DEFAULT_LAYERS = [
    {
      id: "comments",
      name: "コメントビューアー",
      icon: "🗨️",
      elId: "comment-viewer",
      toggleId: "comment-viewer-toggle",
      maxBounds: { width: "350px", height: "260px", desc: "Max: 350×260px" },
      applyPos: (el) => {
        el.style.top = "auto";
        el.style.bottom = "90px";
        el.style.left = "30px";
        el.style.right = "auto";
        el.style.transform = "none";
        localStorage.setItem("commentViewer_left", "30px");
        localStorage.setItem("commentViewer_top", "auto");
      }
    },
    {
      id: "subtitles",
      name: "リアルタイム字幕",
      icon: "💬",
      elId: "avatar-subtitles",
      toggleId: "subtitles-display-toggle",
      maxBounds: { width: "calc(100% - 340px)", height: "48px", desc: "Max: 幅安全枠" },
      applyPos: (el) => {
        el.style.top = "auto";
        el.style.bottom = "35px";
        el.style.left = "30px";
        el.style.right = "auto";
        el.style.transform = "none";
        localStorage.setItem("subtitlesPosition", JSON.stringify({ left: "30px", bottom: "35px", top: "auto", transform: "none" }));
      }
    },
    {
      id: "newsBoard",
      name: "ニュースボード",
      icon: "📰",
      elId: "news-board",
      toggleId: null,
      maxBounds: { width: "290px", height: "205px", desc: "Max: 290×205px" },
      applyPos: (el) => {
        const parentW = el.parentElement ? el.parentElement.clientWidth : 800;
        const targetLeft = Math.max(parentW - 350, 300) + "px";
        el.style.top = "160px";
        el.style.left = targetLeft;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "none";
        localStorage.setItem("newsBoardLeft", targetLeft);
        localStorage.setItem("newsBoardTop", "160px");
      }
    },
    {
      id: "newsSetlistBoard",
      name: "ニュースセトリ（アジェンダ）",
      icon: "📋",
      elId: "news-setlist-board",
      toggleId: null,
      maxBounds: { width: "230px", height: "320px", desc: "Max: 230×320px" },
      applyPos: (el) => {
        el.style.top = "120px";
        el.style.left = "30px";
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "none";
        localStorage.setItem("newsSetlistBoardLeft", "30px");
        localStorage.setItem("newsSetlistBoardTop", "120px");
      }
    },
    {
      id: "stats",
      name: "統計カウンター",
      icon: "📊",
      elId: "stream-stats",
      toggleId: "stats-toggle",
      maxBounds: { width: "240px", height: "42px", desc: "Max: 240×42px" },
      applyPos: (el) => {
        const parentW = el.parentElement ? el.parentElement.clientWidth : 800;
        const targetLeft = Math.max(parentW - 260, 300) + "px";
        el.style.top = "25px";
        el.style.left = targetLeft;
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "none";
        localStorage.setItem("streamStats_left", targetLeft);
        localStorage.setItem("streamStats_top", "25px");
      }
    },
    {
      id: "clock",
      name: "デジタル時計",
      icon: "⏰",
      elId: "stream-clock",
      toggleId: "clock-toggle",
      maxBounds: { width: "260px", height: "75px", desc: "Max: 260×75px" },
      applyPos: (el) => {
        el.style.top = "25px";
        el.style.left = "30px";
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "none";
        localStorage.setItem("streamClock_left", "30px");
        localStorage.setItem("streamClock_top", "25px");
      }
    },
    {
      id: "webcam",
      name: "Webcam枠",
      icon: "📷",
      elId: "camera-preview-container",
      toggleId: null,
      maxBounds: { width: "130px", height: "130px", desc: "Max: 130×130px" },
      applyPos: (el) => {
        el.style.top = "15px";
        el.style.left = "15px";
        el.style.right = "auto";
        el.style.bottom = "auto";
        el.style.transform = "none";
      }
    }
  ];

  let currentLayerOrder = [];

  // 保存された順序を読み込み
  function loadLayerOrder() {
    const saved = localStorage.getItem("streamLayerOrder");
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const reordered = [];
        savedIds.forEach((id) => {
          const found = DEFAULT_LAYERS.find(l => l.id === id);
          if (found) reordered.push(found);
        });
        DEFAULT_LAYERS.forEach((l) => {
          if (!reordered.some(item => item.id === l.id)) {
            reordered.push(l);
          }
        });
        currentLayerOrder = reordered;
        return;
      } catch (e) { }
    }
    currentLayerOrder = [...DEFAULT_LAYERS];
  }

  // レイヤーの重なり順（z-index）をDOM要素に適用
  function applyZIndices() {
    const BASE_Z_INDEX = 120;
    currentLayerOrder.forEach((layer, index) => {
      const el = document.getElementById(layer.elId);
      if (el) {
        const z = BASE_Z_INDEX - (index * 10);
        el.style.zIndex = z;
      }
    });
  }

  let highlightedEl = null;
  let badgeEl = null;
  let guideBoxEl = null;
  let previewCleanupFn = null;
  let activeSelectedRow = null;
  let currentSelectedLayerId = null;

  function highlightLayer(layer, rowEl) {
    const el = document.getElementById(layer.elId);
    if (!el) return;

    // もし既に選択中の同じレイヤーをクリックした場合は選択解除
    if (currentSelectedLayerId === layer.id) {
      clearHighlight();
      return;
    }

    // 前のハイライトを解除
    clearHighlight();

    currentSelectedLayerId = layer.id;

    if (rowEl) {
      rowEl.classList.add("selected");
      activeSelectedRow = rowEl;
    }

    let cleanupCallbacks = [];

    // 1. 強制可視化 (display, opacity, visibility, visibleクラス)
    const origDisplay = el.style.display;
    const origOpacity = el.style.opacity;
    const origVisibility = el.style.visibility;
    const origPointerEvents = el.style.pointerEvents;
    const hadVisibleClass = el.classList.contains("visible");

    el.classList.add("visible");
    el.style.display = (layer.id === "comments" || layer.id === "subtitles") ? "flex" : "block";
    el.style.opacity = "1";
    el.style.visibility = "visible";
    el.style.pointerEvents = "auto";

    cleanupCallbacks.push(() => {
      el.style.display = origDisplay;
      el.style.opacity = origOpacity;
      el.style.visibility = origVisibility;
      el.style.pointerEvents = origPointerEvents;
      if (!hadVisibleClass) el.classList.remove("visible");
    });

    // 2. 空データの場合、一時的なダミープレビューを注入してサイズと場所を可視化
    if (layer.id === "comments") {
      const hasContent = el.children.length > 0 && el.textContent.trim().length > 0;
      if (!hasContent) {
        const dummy = document.createElement("div");
        dummy.id = "dummy-comment-preview";
        dummy.style.display = "flex";
        dummy.style.flexDirection = "column";
        dummy.style.gap = "6px";
        dummy.style.width = "100%";
        dummy.innerHTML = `
          <div style="background:rgba(10,9,21,0.88); border:1px solid rgba(0,255,255,0.5); border-radius:6px; padding:6px 10px; font-size:0.85rem; color:#fff; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.6);">
            <span style="color:#00ffff; font-weight:bold;">👤 リスナーA</span>: こんばんは！配信楽しみにしてました✨
          </div>
          <div style="background:rgba(10,9,21,0.88); border:1px solid rgba(255,100,150,0.5); border-radius:6px; padding:6px 10px; font-size:0.85rem; color:#fff; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.6);">
            <span style="color:#ff7675; font-weight:bold;">👤 視聴者B</span>: とろろちゃん今日もかわいい！🐾
          </div>
          <div style="background:rgba(10,9,21,0.88); border:1px solid rgba(0,255,150,0.5); border-radius:6px; padding:6px 10px; font-size:0.85rem; color:#fff; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.6);">
            <span style="color:#2ecc71; font-weight:bold;">👤 常連さん</span>: 今日のニュース楽しみ！🎉
          </div>
        `;
        el.appendChild(dummy);
        cleanupCallbacks.push(() => dummy.remove());
      }
    } else if (layer.id === "subtitles") {
      const textEl = document.getElementById("avatar-subtitles-text");
      if (textEl && (!textEl.textContent || !textEl.textContent.trim())) {
        const origText = textEl.textContent;
        textEl.textContent = "💬 ここにリアルタイム字幕テロップ（1行）が表示されます";
        cleanupCallbacks.push(() => {
          textEl.textContent = origText;
        });
      }
    } else if (layer.id === "newsBoard") {
      const hadActive = el.classList.contains("active");
      el.classList.add("active");
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      cleanupCallbacks.push(() => {
        if (!hadActive) {
          el.classList.remove("active");
          el.style.transform = "";
          el.style.opacity = "";
          el.style.pointerEvents = "";
        }
      });
    } else if (layer.id === "webcam") {
      const origBorder = el.style.border;
      const origBg = el.style.background;
      el.style.border = "2px solid #00ffff";
      el.style.background = "rgba(10, 15, 30, 0.85)";
      
      const dummyWebcam = document.createElement("div");
      dummyWebcam.style.display = "flex";
      dummyWebcam.style.flexDirection = "column";
      dummyWebcam.style.alignItems = "center";
      dummyWebcam.style.justifyContent = "center";
      dummyWebcam.style.width = "100%";
      dummyWebcam.style.height = "100%";
      dummyWebcam.style.color = "#00ffff";
      dummyWebcam.style.fontSize = "0.75rem";
      dummyWebcam.style.fontWeight = "bold";
      dummyWebcam.innerHTML = `<span>📷 Webcam</span><span style="font-size:0.6rem; color:#aaa;">プレビュー枠</span>`;
      el.appendChild(dummyWebcam);

      cleanupCallbacks.push(() => {
        el.style.border = origBorder;
        el.style.background = origBg;
        dummyWebcam.remove();
      });
    }

    el.classList.add("layer-highlight-target");
    highlightedEl = el;

    // バッジを生成（右上: 名前 + 最大サイズ情報）
    badgeEl = document.createElement("div");
    badgeEl.className = "layer-tag-badge";
    const boundsDesc = layer.maxBounds ? ` (${layer.maxBounds.desc})` : "";
    badgeEl.textContent = `${layer.icon} ${layer.name}${boundsDesc}`;
    el.appendChild(badgeEl);

    // 最大専有エリア（Max Bounds）の点線ガイド枠を親コンテナに描画
    if (layer.maxBounds && el.parentElement) {
      guideBoxEl = document.createElement("div");
      guideBoxEl.className = "layer-max-bounds-guide";
      guideBoxEl.style.width = layer.maxBounds.width;
      guideBoxEl.style.height = layer.maxBounds.height;
      
      // getBoundingClientRect で親コンテナ基準の正確な左上座標を取得して1pxのズレもなく完全一致
      const elRect = el.getBoundingClientRect();
      const parentRect = el.parentElement.getBoundingClientRect();
      const exactLeft = elRect.left - parentRect.left;
      const exactTop = elRect.top - parentRect.top;

      guideBoxEl.style.position = "absolute";
      guideBoxEl.style.left = `${exactLeft}px`;
      guideBoxEl.style.top = `${exactTop}px`;
      guideBoxEl.style.right = "auto";
      guideBoxEl.style.bottom = "auto";
      guideBoxEl.style.transform = "none";
      guideBoxEl.style.margin = "0";

      const label = document.createElement("div");
      label.className = "layer-max-bounds-label";
      label.textContent = `📐 最大専有エリア: ${layer.maxBounds.width} × ${layer.maxBounds.height}`;
      guideBoxEl.appendChild(label);

      el.parentElement.appendChild(guideBoxEl);
    }

    previewCleanupFn = () => {
      cleanupCallbacks.forEach(fn => fn());
    };
  }

  function clearHighlight() {
    currentSelectedLayerId = null;
    if (activeSelectedRow) {
      activeSelectedRow.classList.remove("selected");
      activeSelectedRow = null;
    }
    if (guideBoxEl) {
      guideBoxEl.remove();
      guideBoxEl = null;
    }
    if (highlightedEl) {
      highlightedEl.classList.remove("layer-highlight-target");
      if (badgeEl && badgeEl.parentElement) {
        badgeEl.remove();
      }
      if (previewCleanupFn) {
        previewCleanupFn();
        previewCleanupFn = null;
      }
      highlightedEl = null;
      badgeEl = null;
    }
  }

  function applyGoldenLayout() {
    DEFAULT_LAYERS.forEach((layer) => {
      const el = document.getElementById(layer.elId);
      if (!el || typeof layer.applyPos !== "function") return;
      layer.applyPos(el);
    });
    applyZIndices();
    console.log("[レイヤーマネージャー] 黄金比レイアウトに一括整列しました。");
  }

  // レイヤーを1つ上に移動（より前面へ）
  function moveLayerUp(index) {
    if (index <= 0) return;
    const temp = currentLayerOrder[index];
    currentLayerOrder[index] = currentLayerOrder[index - 1];
    currentLayerOrder[index - 1] = temp;
    saveAndRefresh();
  }

  // レイヤーを1つ下に移動（より背面へ）
  function moveLayerDown(index) {
    if (index >= currentLayerOrder.length - 1) return;
    const temp = currentLayerOrder[index];
    currentLayerOrder[index] = currentLayerOrder[index + 1];
    currentLayerOrder[index + 1] = temp;
    saveAndRefresh();
  }

  function saveAndRefresh() {
    const ids = currentLayerOrder.map(l => l.id);
    localStorage.setItem("streamLayerOrder", JSON.stringify(ids));
    applyZIndices();
    renderLayerList();
  }

  function renderLayerList() {
    const listContainer = document.getElementById("layer-manager-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    currentLayerOrder.forEach((layer, index) => {
      const row = document.createElement("div");
      row.className = "layer-item-row";
      if (currentSelectedLayerId === layer.id) {
        row.classList.add("selected");
        activeSelectedRow = row;
      }

      // 左側：アイコン＋名前＋クリックでハイライト
      const label = document.createElement("div");
      label.className = "layer-label";
      label.innerHTML = `<span>${layer.icon}</span><span>${layer.name}</span>`;
      label.title = "クリックして画面上の位置を確認（もう一度クリックで解除）";
      label.addEventListener("click", () => {
        highlightLayer(layer, row);
      });

      // 右側：アクション（▲/▼ 並び替え / 👁️トグル / 🎯配置）
      const actions = document.createElement("div");
      actions.className = "layer-actions";

      // ▲ 前面へ
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "layer-order-btn";
      upBtn.textContent = "▲";
      upBtn.title = "前面へ移動（重なり順を上に）";
      upBtn.disabled = (index === 0);
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayerUp(index);
      });
      actions.appendChild(upBtn);

      // ▼ 背面へ
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "layer-order-btn";
      downBtn.textContent = "▼";
      downBtn.title = "背面へ移動（重なり順を下に）";
      downBtn.disabled = (index === currentLayerOrder.length - 1);
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveLayerDown(index);
      });
      actions.appendChild(downBtn);

      // 👁️ 表示トグル
      if (layer.toggleId) {
        const toggleEl = document.getElementById(layer.toggleId);
        const eyeBtn = document.createElement("button");
        eyeBtn.type = "button";
        const isShown = toggleEl ? toggleEl.checked : true;
        eyeBtn.textContent = isShown ? "👁️" : "🙈";
        eyeBtn.style.background = "transparent";
        eyeBtn.style.border = "none";
        eyeBtn.style.fontSize = "0.75rem";
        eyeBtn.style.cursor = "pointer";
        eyeBtn.title = "表示/非表示を切り替え";

        eyeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (toggleEl) {
            toggleEl.checked = !toggleEl.checked;
            toggleEl.dispatchEvent(new Event("change", { bubbles: true }));
            eyeBtn.textContent = toggleEl.checked ? "👁️" : "🙈";
          }
        });

        if (toggleEl) {
          toggleEl.addEventListener("change", () => {
            eyeBtn.textContent = toggleEl.checked ? "👁️" : "🙈";
          });
        }
        actions.appendChild(eyeBtn);
      }

      // 🎯 ハイライトボタン
      const focusBtn = document.createElement("button");
      focusBtn.type = "button";
      focusBtn.textContent = "🎯";
      focusBtn.style.background = "transparent";
      focusBtn.style.border = "none";
      focusBtn.style.fontSize = "0.75rem";
      focusBtn.style.cursor = "pointer";
      focusBtn.title = "画面上の位置をハイライト";
      focusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        highlightLayer(layer, row);
      });
      actions.appendChild(focusBtn);

      row.appendChild(label);
      row.appendChild(actions);
      listContainer.appendChild(row);
    });

    // 🔄 黄金比整列ボタンのバインド
    const resetBtn = document.getElementById("btn-reset-golden-layout");
    if (resetBtn) {
      resetBtn.onclick = () => {
        applyGoldenLayout();
        resetBtn.textContent = "✅ 整列完了！";
        setTimeout(() => {
          resetBtn.textContent = "🔄 黄金比に整列";
        }, 1500);
      };
    }
  }

  // 初期化
  function initLayoutManager() {
    loadLayerOrder();
    applyZIndices();
    renderLayerList();
  }

  (window.onUILoaded || ((id, fn) => window.addEventListener("uiLoaded", fn)))("layout-manager", initLayoutManager);
  document.addEventListener("DOMContentLoaded", initLayoutManager);

  window.layoutManager = {
    highlightLayer,
    clearHighlight,
    applyGoldenLayout,
    moveLayerUp,
    moveLayerDown,
    renderLayerList
  };
})();
