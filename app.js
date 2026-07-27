(() => {
  "use strict";

  const STORAGE_KEY = "jibun-page-kobo-draft-v1";
  const MAX_FAVORITES = 6;
  const THEMES = ["notebook", "sky", "forest", "pop"];
  const LAYOUTS = ["cards", "journal"];
  const AVATARS = ["🐧", "🦊", "🐸", "🐼", "🦖", "🚀"];

  const defaultState = Object.freeze({
    version: 1,
    nickname: "",
    tagline: "",
    intro: "",
    avatarMode: "illustration",
    avatar: "🐧",
    photo: "",
    favorites: [],
    goodAt: "",
    intoNow: "",
    nextGoal: "",
    theme: "notebook",
    accent: "#e15b3d",
    layout: "cards",
    doodles: true,
    motion: true
  });

  let state = loadState();
  let currentStep = 0;
  let saveTimer = null;
  let previewTimer = null;
  let toastTimer = null;
  let pendingDownload = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    stepTabs: $$(".step-tab"),
    panels: $$(".step-panel"),
    saveStatus: $("#saveStatus"),
    autosaveNote: $(".autosave-note"),
    nickname: $("#nickname"),
    tagline: $("#tagline"),
    intro: $("#intro"),
    nicknameCount: $("#nicknameCount"),
    taglineCount: $("#taglineCount"),
    introCount: $("#introCount"),
    avatarModeButtons: $$('[data-avatar-mode]'),
    illustrationChooser: $("#illustrationChooser"),
    photoChooser: $("#photoChooser"),
    avatarChoices: $$(".avatar-choice"),
    photoInput: $("#photoInput"),
    photoPreview: $("#photoPreview"),
    photoPlaceholder: $("#photoPlaceholder"),
    removePhotoButton: $("#removePhotoButton"),
    favoriteChoices: $$(".choice-chip"),
    customFavorite: $("#customFavorite"),
    addFavoriteButton: $("#addFavoriteButton"),
    selectedFavorites: $("#selectedFavorites"),
    goodAt: $("#goodAt"),
    intoNow: $("#intoNow"),
    nextGoal: $("#nextGoal"),
    goodAtCount: $("#goodAtCount"),
    intoNowCount: $("#intoNowCount"),
    nextGoalCount: $("#nextGoalCount"),
    themeCards: $$(".theme-card"),
    accentChoices: $$(".color-swatch"),
    accentPicker: $("#accentPicker"),
    layoutChoices: $$(".layout-choice"),
    doodlesToggle: $("#doodlesToggle"),
    motionToggle: $("#motionToggle"),
    privacyCheckList: $("#privacyCheckList"),
    checkSummary: $("#checkSummary"),
    completionTitle: $("#completionTitle"),
    completionText: $("#completionText"),
    downloadSiteButton: $("#downloadSiteButton"),
    downloadDraftButton: $("#downloadDraftButton"),
    importDraftInput: $("#importDraftInput"),
    printButton: $("#printButton"),
    resetButton: $("#resetButton"),
    helpButton: $("#helpButton"),
    helpDialog: $("#helpDialog"),
    safetyDialog: $("#safetyDialog"),
    safetyForm: $("#safetyForm"),
    adultConfirm: $("#adultConfirm"),
    confirmDownloadButton: $("#confirmDownloadButton"),
    dialogWarnings: $("#dialogWarnings"),
    previewFrame: $("#previewFrame"),
    browserFrame: $("#browserFrame"),
    deviceButtons: $$("[data-device]"),
    toast: $("#toast")
  };

  init();

  function init() {
    hydrateForm();
    bindEvents();
    showStep(0, false);
    renderAll();
  }

  function bindEvents() {
    elements.stepTabs.forEach((tab) => {
      tab.addEventListener("click", () => showStep(Number(tab.dataset.step)));
      tab.addEventListener("keydown", handleTabKeys);
    });

    $$(".next-step").forEach((button) => {
      button.addEventListener("click", () => showStep(Number(button.dataset.next)));
    });
    $$(".previous-step").forEach((button) => {
      button.addEventListener("click", () => showStep(Number(button.dataset.previous)));
    });

    bindTextInput(elements.nickname, "nickname", elements.nicknameCount, 18);
    bindTextInput(elements.tagline, "tagline", elements.taglineCount, 36);
    bindTextInput(elements.intro, "intro", elements.introCount, 180);
    bindTextInput(elements.goodAt, "goodAt", elements.goodAtCount, 90);
    bindTextInput(elements.intoNow, "intoNow", elements.intoNowCount, 90);
    bindTextInput(elements.nextGoal, "nextGoal", elements.nextGoalCount, 90);

    elements.avatarModeButtons.forEach((button) => {
      button.addEventListener("click", () => setAvatarMode(button.dataset.avatarMode));
    });

    elements.avatarChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.avatar = AVATARS.includes(button.dataset.avatar) ? button.dataset.avatar : "🐧";
        state.avatarMode = "illustration";
        renderAvatarControls();
        stateChanged();
      });
    });

    elements.photoInput.addEventListener("change", handlePhotoUpload);
    elements.removePhotoButton.addEventListener("click", () => {
      state.photo = "";
      elements.photoInput.value = "";
      renderPhotoPreview();
      stateChanged();
    });

    elements.favoriteChoices.forEach((button) => {
      button.addEventListener("click", () => toggleFavorite(button.dataset.favorite));
    });
    elements.addFavoriteButton.addEventListener("click", addCustomFavorite);
    elements.customFavorite.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomFavorite();
      }
    });

    elements.themeCards.forEach((button) => {
      button.addEventListener("click", () => {
        state.theme = THEMES.includes(button.dataset.theme) ? button.dataset.theme : "notebook";
        renderDesignControls();
        stateChanged();
      });
    });

    elements.accentChoices.forEach((button) => {
      button.addEventListener("click", () => setAccent(button.dataset.accent));
    });
    elements.accentPicker.addEventListener("input", () => setAccent(elements.accentPicker.value));

    elements.layoutChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.layout = LAYOUTS.includes(button.dataset.layout) ? button.dataset.layout : "cards";
        renderDesignControls();
        stateChanged();
      });
    });

    elements.doodlesToggle.addEventListener("change", () => {
      state.doodles = elements.doodlesToggle.checked;
      stateChanged();
    });
    elements.motionToggle.addEventListener("change", () => {
      state.motion = elements.motionToggle.checked;
      stateChanged();
    });

    elements.deviceButtons.forEach((button) => {
      button.addEventListener("click", () => setPreviewDevice(button.dataset.device));
    });

    elements.downloadSiteButton.addEventListener("click", prepareSiteDownload);
    elements.downloadDraftButton.addEventListener("click", downloadDraft);
    elements.importDraftInput.addEventListener("change", importDraft);
    elements.printButton.addEventListener("click", printPreview);
    elements.resetButton.addEventListener("click", resetAll);

    elements.helpButton.addEventListener("click", () => openDialog(elements.helpDialog));
    $$('[data-close-dialog]').forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.closeDialog);
        dialog?.close();
      });
    });

    elements.adultConfirm.addEventListener("change", () => {
      elements.confirmDownloadButton.disabled = !elements.adultConfirm.checked;
    });

    elements.safetyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!elements.adultConfirm.checked || !pendingDownload) return;
      elements.safetyDialog.close();
      pendingDownload = false;
      downloadSite();
    });

    [elements.helpDialog, elements.safetyDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("cancel", () => { pendingDownload = false; });
    });
  }

  function bindTextInput(input, key, counter, max) {
    input.addEventListener("input", () => {
      state[key] = input.value;
      updateCounter(counter, input.value.length, max);
      stateChanged();
    });
  }

  function hydrateForm() {
    elements.nickname.value = state.nickname;
    elements.tagline.value = state.tagline;
    elements.intro.value = state.intro;
    elements.goodAt.value = state.goodAt;
    elements.intoNow.value = state.intoNow;
    elements.nextGoal.value = state.nextGoal;
    elements.accentPicker.value = normalizeAccent(state.accent);
    elements.doodlesToggle.checked = state.doodles;
    elements.motionToggle.checked = state.motion;
    updateAllCounters();
    renderAvatarControls();
    renderFavorites();
    renderDesignControls();
  }

  function handleTabKeys(event) {
    const index = elements.stepTabs.indexOf(event.currentTarget);
    let nextIndex = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % elements.stepTabs.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + elements.stepTabs.length) % elements.stepTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = elements.stepTabs.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      elements.stepTabs[nextIndex].focus();
      showStep(nextIndex);
    }
  }

  function showStep(index, focus = true) {
    currentStep = Math.max(0, Math.min(elements.panels.length - 1, index));
    elements.panels.forEach((panel, panelIndex) => {
      const active = panelIndex === currentStep;
      panel.hidden = !active;
      elements.stepTabs[panelIndex].classList.toggle("is-active", active);
      elements.stepTabs[panelIndex].setAttribute("aria-selected", String(active));
      elements.stepTabs[panelIndex].tabIndex = active ? 0 : -1;
    });
    if (currentStep === 3) renderSafetyCheck();
    if (focus) {
      elements.panels[currentStep].focus({ preventScroll: true });
      elements.panels[currentStep].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function setAvatarMode(mode) {
    state.avatarMode = mode === "photo" ? "photo" : "illustration";
    renderAvatarControls();
    stateChanged();
  }

  function renderAvatarControls() {
    elements.avatarModeButtons.forEach((button) => {
      const active = button.dataset.avatarMode === state.avatarMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.illustrationChooser.hidden = state.avatarMode !== "illustration";
    elements.photoChooser.hidden = state.avatarMode !== "photo";
    elements.avatarChoices.forEach((button) => {
      const active = button.dataset.avatar === state.avatar;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderPhotoPreview();
  }

  function renderPhotoPreview() {
    const hasPhoto = isSafeImageDataUrl(state.photo);
    elements.photoPreview.hidden = !hasPhoto;
    elements.photoPlaceholder.hidden = hasPhoto;
    elements.removePhotoButton.hidden = !hasPhoto;
    if (hasPhoto) elements.photoPreview.src = state.photo;
    else elements.photoPreview.removeAttribute("src");
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      showToast("PNG・JPEG・WebPの画像をえらんでね");
      event.target.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast("写真が大きすぎます。12MBより小さい画像にしてね");
      event.target.value = "";
      return;
    }

    try {
      state.photo = await resizeImage(file, 900, 0.84);
      state.avatarMode = "photo";
      renderAvatarControls();
      stateChanged();
      showToast("写真を入れました。公開前に大人と確認してね");
    } catch (error) {
      console.error(error);
      showToast("写真を読みこめませんでした");
    }
  }

  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { alpha: false });
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function toggleFavorite(value) {
    if (!value) return;
    const exists = state.favorites.includes(value);
    if (exists) {
      state.favorites = state.favorites.filter((item) => item !== value);
    } else if (state.favorites.length < MAX_FAVORITES) {
      state.favorites = [...state.favorites, value];
    } else {
      showToast("すきなものは6こまでだよ");
      return;
    }
    renderFavorites();
    stateChanged();
  }

  function addCustomFavorite() {
    const value = cleanShortText(elements.customFavorite.value, 12);
    if (!value) {
      showToast("すきなものを書いてね");
      return;
    }
    if (state.favorites.includes(value)) {
      showToast("それはもう入っているよ");
      return;
    }
    if (state.favorites.length >= MAX_FAVORITES) {
      showToast("すきなものは6こまでだよ");
      return;
    }
    state.favorites = [...state.favorites, value];
    elements.customFavorite.value = "";
    renderFavorites();
    stateChanged();
  }

  function renderFavorites() {
    elements.favoriteChoices.forEach((button) => {
      const selected = state.favorites.includes(button.dataset.favorite);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !selected && state.favorites.length >= MAX_FAVORITES;
    });

    elements.selectedFavorites.replaceChildren();
    state.favorites.forEach((favorite) => {
      const chip = document.createElement("span");
      chip.className = "selected-chip";
      const label = document.createElement("span");
      label.textContent = favorite;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `${favorite}をはずす`);
      remove.textContent = "×";
      remove.addEventListener("click", () => toggleFavorite(favorite));
      chip.append(label, remove);
      elements.selectedFavorites.append(chip);
    });
  }

  function setAccent(value) {
    state.accent = normalizeAccent(value);
    elements.accentPicker.value = state.accent;
    renderDesignControls();
    stateChanged();
  }

  function renderDesignControls() {
    elements.themeCards.forEach((button) => {
      const active = button.dataset.theme === state.theme;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.accentChoices.forEach((button) => {
      const active = button.dataset.accent.toLowerCase() === state.accent.toLowerCase();
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.layoutChoices.forEach((button) => {
      const active = button.dataset.layout === state.layout;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.accentPicker.value = normalizeAccent(state.accent);
    elements.doodlesToggle.checked = state.doodles;
    elements.motionToggle.checked = state.motion;
  }

  function stateChanged() {
    scheduleSave();
    schedulePreview();
    if (currentStep === 3) renderSafetyCheck();
  }

  function renderAll() {
    updateAllCounters();
    renderAvatarControls();
    renderFavorites();
    renderDesignControls();
    renderPreview();
    renderSafetyCheck();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    elements.autosaveNote.classList.add("is-saving");
    elements.saveStatus.textContent = "保存中…";
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state)));
        elements.saveStatus.textContent = "この端末に保存しました";
      } catch (error) {
        console.error(error);
        elements.saveStatus.textContent = "保存できませんでした";
      } finally {
        elements.autosaveNote.classList.remove("is-saving");
      }
    }, 380);
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 110);
  }

  function renderPreview() {
    elements.previewFrame.srcdoc = buildProfileHTML(state, { standalone: false });
  }

  function renderSafetyCheck() {
    const findings = scanPrivacy(state);
    elements.privacyCheckList.replaceChildren();

    const manualItems = [
      {
        status: "ok",
        title: "入力データは外へ送信されません",
        detail: "このアプリは通信やアカウント登録を使いません。"
      },
      {
        status: "warn",
        title: "公開先は大人と決めよう",
        detail: "HTMLをインターネットに置く前に、見せる相手と場所を相談してください。"
      }
    ];

    const items = findings.length
      ? [...findings, ...manualItems]
      : [{ status: "ok", title: "自動チェックでは連絡先などを見つけませんでした", detail: "見落としもあるので、最後は大人と読んで確認してください。" }, ...manualItems];

    items.forEach((item) => elements.privacyCheckList.append(createCheckItem(item)));

    const warnings = findings.length + 1;
    elements.checkSummary.textContent = findings.length ? `要確認 ${warnings}こ` : "自動チェック OK";
    elements.checkSummary.className = `check-summary ${findings.length ? "warn" : "ok"}`;

    const ready = state.nickname.trim().length > 0;
    elements.completionTitle.textContent = ready ? `${state.nickname.trim()}さんのページ、できました！` : "あと少しで完成！";
    elements.completionText.textContent = ready
      ? "内容を大人と確認したら、HTMLファイルに保存できます。"
      : "STEP 1でニックネームを入れると保存できます。";
    elements.downloadSiteButton.disabled = !ready;
    elements.downloadSiteButton.setAttribute("aria-disabled", String(!ready));
  }

  function createCheckItem(item) {
    const li = document.createElement("li");
    li.className = `check-item ${item.status}`;
    const icon = document.createElement("span");
    icon.className = "check-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.status === "ok" ? "✓" : "!";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.textContent = item.detail;
    body.append(title, detail);
    li.append(icon, body);
    return li;
  }

  function scanPrivacy(data) {
    const joined = [data.nickname, data.tagline, data.intro, data.goodAt, data.intoNow, data.nextGoal, ...data.favorites].join("\n");
    const findings = [];
    const checks = [
      {
        regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
        title: "メールアドレスらしい文字があります",
        detail: "連絡先は消してから公開してください。"
      },
      {
        regex: /(?:0\d{1,4}[-ー‐−]?\d{1,4}[-ー‐−]?\d{3,4}|\d{3}[-ー‐−]\d{4}[-ー‐−]\d{4})/,
        title: "電話番号らしい数字があります",
        detail: "電話番号は公開しないでください。"
      },
      {
        regex: /(?:https?:\/\/|www\.|line\s*id|instagram|tiktok|discord|@[a-z0-9_]{3,})/i,
        title: "SNSやURLらしい文字があります",
        detail: "知らない人から連絡できる情報は消しましょう。"
      },
      {
        regex: /(?:小学校|中学校|学校名|\d年\d組|[一二三四五六1-6]年[一二三四五六1-6]組)/,
        title: "学校やクラスがわかるかもしれません",
        detail: "学校名、学年とクラスの組み合わせは書かないでください。"
      },
      {
        regex: /(?:都|道|府|県).{0,10}(?:市|区|町|村)|(?:丁目|番地|号室)|〒\s*\d{3}[-ー‐−]?\d{4}/,
        title: "住所らしい文字があります",
        detail: "住んでいる場所がわかる書き方は消しましょう。"
      },
      {
        regex: /(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*歳/,
        title: "年れいが書かれています",
        detail: "年れいも個人を見つける手がかりになるので、大人と確認してください。"
      }
    ];

    checks.forEach((check) => {
      if (check.regex.test(joined)) findings.push({ status: "warn", title: check.title, detail: check.detail });
    });

    if (data.avatarMode === "photo" && isSafeImageDataUrl(data.photo)) {
      findings.push({
        status: "warn",
        title: "写真を使っています",
        detail: "顔、名札、制服、家のまわりなどが写っていないか大人と確認してください。"
      });
    }

    if (/\s/.test(data.nickname.trim()) || data.nickname.trim().length >= 10) {
      findings.push({
        status: "warn",
        title: "ニックネームが本名に見えないか確認しよう",
        detail: "名字と名前の組み合わせではなく、短い呼び名がおすすめです。"
      });
    }

    return findings;
  }

  function prepareSiteDownload() {
    if (!state.nickname.trim()) {
      showStep(0);
      elements.nickname.focus();
      showToast("まずニックネームを入れてね");
      return;
    }

    const findings = scanPrivacy(state);
    elements.dialogWarnings.replaceChildren();
    if (findings.length) {
      const intro = document.createElement("p");
      intro.textContent = "自動チェックで、次の内容が見つかりました。消すか、大人といっしょに確認してください。";
      const list = document.createElement("ul");
      list.className = "dialog-warning-list";
      findings.forEach((finding) => {
        const li = document.createElement("li");
        li.textContent = finding.title;
        list.append(li);
      });
      elements.dialogWarnings.append(intro, list);
    } else {
      const clear = document.createElement("p");
      clear.className = "dialog-all-clear";
      clear.textContent = "自動チェックでは、連絡先や住所らしい文字は見つかりませんでした。";
      elements.dialogWarnings.append(clear);
    }

    elements.adultConfirm.checked = false;
    elements.confirmDownloadButton.disabled = true;
    pendingDownload = true;
    openDialog(elements.safetyDialog);
  }

  function downloadSite() {
    const html = buildProfileHTML(state, { standalone: true });
    const filename = `${safeFilename(state.nickname || "じぶんページ")}.html`;
    downloadBlob(html, "text/html;charset=utf-8", filename);
    showToast("完成ページを保存しました");
  }

  function downloadDraft() {
    const draft = JSON.stringify(sanitizeState(state), null, 2);
    const filename = `${safeFilename(state.nickname || "じぶんページ")}-つづき.json`;
    downloadBlob(draft, "application/json;charset=utf-8", filename);
    showToast("つづき用データを保存しました");
  }

  async function importDraft(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("too-large");
      const parsed = JSON.parse(await file.text());
      state = sanitizeState(parsed);
      hydrateForm();
      renderAll();
      scheduleSave();
      showStep(0);
      showToast("つづき用データを読みこみました");
    } catch (error) {
      console.error(error);
      showToast("このデータは読みこめませんでした");
    } finally {
      event.target.value = "";
    }
  }

  function printPreview() {
    const popup = window.open("", "_blank");
    if (!popup) {
      showToast("印刷画面を開けませんでした。ポップアップを許可してください");
      return;
    }
    try { popup.opener = null; } catch (_) { /* noop */ }
    popup.document.open();
    popup.document.write(buildProfileHTML(state, { standalone: true, print: true }));
    popup.document.close();
    popup.addEventListener("load", () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
      }, 150);
    }, { once: true });
  }

  function resetAll() {
    const confirmed = window.confirm("入力した内容と、この端末の下書きをぜんぶ消します。よいですか？");
    if (!confirmed) return;
    state = { ...defaultState, favorites: [] };
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.warn("下書きを削除できませんでした", error); }
    elements.photoInput.value = "";
    hydrateForm();
    renderAll();
    showStep(0);
    elements.saveStatus.textContent = "この端末に自動保存します";
    showToast("最初の状態にもどしました");
  }

  function setPreviewDevice(device) {
    const mobile = device === "mobile";
    elements.browserFrame.classList.toggle("mobile", mobile);
    elements.browserFrame.classList.toggle("desktop", !mobile);
    elements.deviceButtons.forEach((button) => {
      const active = button.dataset.device === (mobile ? "mobile" : "desktop");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function buildProfileHTML(rawState, options = {}) {
    const data = sanitizeState(rawState);
    const theme = THEMES.includes(data.theme) ? data.theme : "notebook";
    const layout = LAYOUTS.includes(data.layout) ? data.layout : "cards";
    const accent = normalizeAccent(data.accent);
    const nickname = escapeHTML(data.nickname.trim() || "ニックネーム");
    const tagline = escapeHTML(data.tagline.trim() || "ここに、ひとことが入ります");
    const intro = escapeHTML(data.intro.trim() || "じこしょうかいを書いてみよう。すきなことや、いま夢中なことを短く書くと読みやすいよ。");
    const favorites = data.favorites.length ? data.favorites : ["すきなもの"];
    const avatarMarkup = data.avatarMode === "photo" && isSafeImageDataUrl(data.photo)
      ? `<img class="profile-photo" src="${data.photo}" alt="${nickname}のプロフィール画像">`
      : `<div class="profile-avatar" role="img" aria-label="プロフィールのイラスト">${escapeHTML(data.avatar)}</div>`;

    const storySections = [
      { title: "とくいなこと", text: data.goodAt, mark: "A" },
      { title: "いま、むちゅう", text: data.intoNow, mark: "B" },
      { title: "これからやりたい", text: data.nextGoal, mark: "C" }
    ].filter((item) => item.text.trim());

    const storyMarkup = storySections.length
      ? storySections.map((item) => `
        <article class="story-card">
          <span class="story-mark" aria-hidden="true">${item.mark}</span>
          <div><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.text.trim())}</p></div>
        </article>`).join("")
      : `<article class="story-card empty-story"><span class="story-mark" aria-hidden="true">+</span><div><h2>じぶんの話</h2><p>とくいなことや、これからやりたいことを書くと、ここにカードがふえます。</p></div></article>`;

    const doodles = data.doodles ? `
      <div class="doodle doodle-one" aria-hidden="true"></div>
      <div class="doodle doodle-two" aria-hidden="true"></div>
      <svg class="scribble" viewBox="0 0 160 70" aria-hidden="true"><path d="M5 45c20-40 38 32 61-9s38 45 88-16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>` : "";

    const animationClass = data.motion ? " motion-on" : "";
    const printClass = options.print ? " print-now" : "";

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${nickname}のじぶんページ</title>
<style>
:root{--accent:${accent};--ink:#26231f;--muted:#676157;--paper:#fffdf7;--line:#312d28;--soft:#d3c8b8;--shadow:7px 8px 0 rgba(49,45,40,.14)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:280px;color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",system-ui,sans-serif;line-height:1.75;background:#e9e1d2}img{max-width:100%;display:block}.page{position:relative;min-height:100vh;overflow:hidden;padding:clamp(24px,6vw,80px) clamp(16px,5vw,62px)}
.theme-notebook{background:repeating-linear-gradient(#fffdf7 0 33px,#dbe5e8 33px 34px);}.theme-notebook .page-inner{background:rgba(255,253,247,.92)}
.theme-sky{background:#e9f6fb}.theme-sky .page-inner{background:#fff}.theme-sky .story-card{background:#f7fcff}.theme-sky .hero::after{content:"";position:absolute;right:8%;top:10%;width:90px;height:35px;background:#fff;border:2px solid var(--line);border-radius:50%;box-shadow:35px 10px 0 -5px #fff,-35px 14px 0 -8px #fff}
.theme-forest{background:#e8f0e4}.theme-forest .page-inner{background:#fbfff8}.theme-forest .story-card{background:#f1f7ed}.theme-forest .favorite-tag{background:#edf5e8}
.theme-pop{background:#ffe9dc}.theme-pop .page-inner{background:#fff9f2}.theme-pop .hero{border-bottom-style:dotted}.theme-pop .story-card:nth-child(even){transform:rotate(.6deg)}
.page-inner{position:relative;z-index:2;width:min(980px,100%);margin:0 auto;padding:clamp(25px,6vw,68px);border:3px solid var(--line);border-radius:18px 13px 23px 15px;box-shadow:var(--shadow)}
.hero{position:relative;display:grid;grid-template-columns:minmax(120px,190px) 1fr;align-items:center;gap:clamp(22px,5vw,54px);padding-bottom:clamp(30px,5vw,55px);border-bottom:2px dashed var(--soft)}
.profile-avatar,.profile-photo{width:clamp(120px,22vw,180px);height:clamp(120px,22vw,180px);border:4px solid var(--line);border-radius:51% 45% 53% 47%;box-shadow:6px 7px 0 color-mix(in srgb,var(--accent) 32%,transparent);transform:rotate(-2deg)}.profile-avatar{display:grid;place-items:center;background:#fff5cf;font-size:clamp(4rem,10vw,7rem);line-height:1}.profile-photo{object-fit:cover;background:#eee}
.kicker{margin:0 0 4px;color:var(--accent);font:900 .78rem/1.2 ui-monospace,monospace;letter-spacing:.16em}.hero h1{margin:0;font-size:clamp(2rem,7vw,4.8rem);line-height:1.14;letter-spacing:.03em;word-break:break-word}.tagline{display:inline;margin:13px 0 0;background:linear-gradient(transparent 58%,color-mix(in srgb,var(--accent) 32%,transparent) 58%);font-size:clamp(1.05rem,2.4vw,1.42rem);font-weight:900}.intro{margin:28px 0 0;font-size:clamp(1rem,2vw,1.16rem);white-space:pre-wrap}
.favorites{margin-top:36px}.section-label{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:1rem}.section-label::before{content:"";width:28px;height:7px;background:var(--accent);border:2px solid var(--line);transform:rotate(-5deg)}.favorite-list{display:flex;flex-wrap:wrap;gap:9px;margin:0;padding:0;list-style:none}.favorite-tag{padding:7px 14px;background:#fff;border:2px solid var(--line);border-radius:999px;font-weight:800;box-shadow:2px 3px 0 color-mix(in srgb,var(--accent) 20%,transparent)}
.stories{display:grid;gap:16px;margin-top:34px}.layout-cards .stories{grid-template-columns:repeat(3,1fr)}.story-card{position:relative;display:grid;grid-template-columns:45px 1fr;gap:13px;min-height:150px;padding:18px;background:#fff;border:2px solid var(--line);border-radius:12px 18px 11px 15px}.story-card:nth-child(2){transform:translateY(8px)}.story-mark{display:grid;place-items:center;width:40px;height:40px;background:color-mix(in srgb,var(--accent) 24%,#fff);border:2px solid var(--line);border-radius:50%;font-family:Georgia,serif;font-weight:900}.story-card h2{margin:2px 0 7px;font-size:1.05rem}.story-card p{margin:0;color:#4e4942;white-space:pre-wrap}.empty-story{grid-column:1/-1;min-height:auto}
.layout-journal .stories{position:relative;padding-left:28px}.layout-journal .stories::before{content:"";position:absolute;left:7px;top:0;bottom:0;border-left:3px solid color-mix(in srgb,var(--accent) 45%,#aaa)}.layout-journal .story-card{min-height:auto;background:transparent;border-width:0 0 1px;border-radius:0;box-shadow:none;transform:none}.layout-journal .story-mark{margin-left:-42px;background:var(--paper)}
.page-footer{display:flex;justify-content:space-between;gap:20px;margin-top:45px;padding-top:17px;color:var(--muted);border-top:1px solid var(--soft);font-size:.76rem}.page-footer p{margin:0}.doodle{position:absolute;z-index:1;border:5px solid var(--accent);opacity:.42}.doodle-one{width:95px;height:95px;right:4%;top:5%;border-radius:48% 52% 45% 55%;transform:rotate(18deg)}.doodle-two{width:64px;height:64px;left:3%;bottom:8%;border-radius:50%;border-style:dashed}.scribble{position:absolute;z-index:1;left:1%;top:22%;width:150px;color:var(--accent);opacity:.33;transform:rotate(-13deg)}
.motion-on .page-inner{animation:arrive .55s ease-out both}.motion-on .story-card{animation:rise .45s ease-out both}.motion-on .story-card:nth-child(2){animation-delay:.08s}.motion-on .story-card:nth-child(3){animation-delay:.16s}@keyframes arrive{from{opacity:0;transform:translateY(14px) rotate(-.2deg)}to{opacity:1;transform:none}}@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1}}
@media(max-width:720px){.page{padding:14px}.page-inner{padding:28px 20px;border-width:2px;box-shadow:4px 5px 0 rgba(49,45,40,.14)}.hero{grid-template-columns:1fr;text-align:center}.profile-avatar,.profile-photo{margin:auto}.tagline{display:inline-block}.layout-cards .stories{grid-template-columns:1fr}.story-card:nth-child(2){transform:none}.page-footer{display:block}.page-footer p+p{margin-top:4px}.scribble{display:none}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}@media print{body{background:#fff}.page{padding:0}.page-inner{width:100%;border:0;box-shadow:none}.doodle,.scribble{display:none}.page-footer{break-inside:avoid}}
</style>
</head>
<body class="theme-${theme}${animationClass}${printClass}">
<main class="page layout-${layout}">
${doodles}
<div class="page-inner">
  <header class="hero">
    ${avatarMarkup}
    <div class="hero-copy">
      <p class="kicker">MY PAGE</p>
      <h1>${nickname}</h1>
      <p class="tagline">${tagline}</p>
      <p class="intro">${intro}</p>
    </div>
  </header>
  <section class="favorites" aria-labelledby="favorite-title">
    <h2 class="section-label" id="favorite-title">すきなもの</h2>
    <ul class="favorite-list">${favorites.map((favorite) => `<li class="favorite-tag">${escapeHTML(favorite)}</li>`).join("")}</ul>
  </section>
  <section class="stories" aria-label="もっとくわしい自己紹介">${storyMarkup}</section>
  <footer class="page-footer"><p>${nickname}のじぶんページ</p><p>見せる前に、おうちの人と内容を確認しました。</p></footer>
</div>
</main>
</body>
</html>`;
  }

  function sanitizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const avatar = AVATARS.includes(source.avatar) ? source.avatar : defaultState.avatar;
    const favorites = Array.isArray(source.favorites)
      ? [...new Set(source.favorites.map((item) => cleanShortText(item, 12)).filter(Boolean))].slice(0, MAX_FAVORITES)
      : [];
    const photo = isSafeImageDataUrl(source.photo) ? source.photo : "";

    return {
      version: 1,
      nickname: cleanText(source.nickname, 18),
      tagline: cleanText(source.tagline, 36),
      intro: cleanText(source.intro, 180),
      avatarMode: source.avatarMode === "photo" ? "photo" : "illustration",
      avatar,
      photo,
      favorites,
      goodAt: cleanText(source.goodAt, 90),
      intoNow: cleanText(source.intoNow, 90),
      nextGoal: cleanText(source.nextGoal, 90),
      theme: THEMES.includes(source.theme) ? source.theme : defaultState.theme,
      accent: normalizeAccent(source.accent),
      layout: LAYOUTS.includes(source.layout) ? source.layout : defaultState.layout,
      doodles: source.doodles !== false,
      motion: source.motion !== false
    };
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? sanitizeState(JSON.parse(stored)) : { ...defaultState, favorites: [] };
    } catch (error) {
      console.warn("下書きを読みこめませんでした", error);
      return { ...defaultState, favorites: [] };
    }
  }

  function cleanText(value, maxLength) {
    return String(value ?? "").replace(/\u0000/g, "").slice(0, maxLength);
  }

  function cleanShortText(value, maxLength) {
    return cleanText(value, maxLength).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  }

  function normalizeAccent(value) {
    const text = String(value ?? "").trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : defaultState.accent;
  }

  function isSafeImageDataUrl(value) {
    return typeof value === "string" && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length < 2_800_000;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeFilename(value) {
    const cleaned = String(value)
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return cleaned || "じぶんページ";
  }

  function updateAllCounters() {
    updateCounter(elements.nicknameCount, elements.nickname.value.length, 18);
    updateCounter(elements.taglineCount, elements.tagline.value.length, 36);
    updateCounter(elements.introCount, elements.intro.value.length, 180);
    updateCounter(elements.goodAtCount, elements.goodAt.value.length, 90);
    updateCounter(elements.intoNowCount, elements.intoNow.value.length, 90);
    updateCounter(elements.nextGoalCount, elements.nextGoal.value.length, 90);
  }

  function updateCounter(element, length, max) {
    element.textContent = `${length} / ${max}`;
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2600);
  }
})();
