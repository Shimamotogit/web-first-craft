(() => {
  "use strict";

  const STORAGE_KEY = "jibun-page-kobo-draft-v2";
  const LEGACY_STORAGE_KEY = "jibun-page-kobo-draft-v1";
  const MAX_FAVORITES = 6;
  const MAX_STORIES = 8;
  const THEMES = ["notebook", "sky", "forest", "pop"];
  const LAYOUTS = ["cards", "journal", "poster", "catalog"];
  const DECORS = ["none", "doodles", "stickers", "stamps"];
  const MOTIONS = ["none", "fade", "bounce", "float"];
  const AVATARS = ["🐧", "🦊", "🐸", "🐼", "🦖", "🚀"];
  const DEFAULT_STORY_TITLES = ["とくいなこと", "いま、むちゅう", "これからやりたい"];

  const defaultState = Object.freeze({
    version: 2,
    nickname: "",
    tagline: "",
    intro: "",
    avatarMode: "illustration",
    avatar: "🐧",
    photo: "",
    favorites: [],
    stories: DEFAULT_STORY_TITLES.map((title) => ({ id: createId(), title, text: "" })),
    theme: "notebook",
    accent: "#e15b3d",
    layout: "cards",
    decor: "doodles",
    motion: "fade"
  });

  let state = loadState();
  let currentStep = 0;
  let saveTimer = null;
  let previewTimer = null;
  let toastTimer = null;
  let pendingAction = null;
  let photoPollTimer = null;
  let activePhotoToken = "";
  let lanInfo = { enabled: false, baseUrl: "" };

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
    openPhonePhotoButton: $("#openPhonePhotoButton"),
    favoriteChoices: $$(".choice-chip[data-favorite]"),
    customFavorite: $("#customFavorite"),
    addFavoriteButton: $("#addFavoriteButton"),
    selectedFavorites: $("#selectedFavorites"),
    storyPresetChoices: $$(".story-preset"),
    customStoryTitle: $("#customStoryTitle"),
    addStoryButton: $("#addStoryButton"),
    storyItems: $("#storyItems"),
    themeCards: $$(".theme-card"),
    accentChoices: $$(".color-swatch"),
    accentPicker: $("#accentPicker"),
    layoutChoices: $$(".layout-choice"),
    decorChoices: $$('[data-decor]'),
    motionChoices: $$('[data-motion]'),
    privacyCheckList: $("#privacyCheckList"),
    checkSummary: $("#checkSummary"),
    completionTitle: $("#completionTitle"),
    completionText: $("#completionText"),
    downloadSiteButton: $("#downloadSiteButton"),
    downloadDraftButton: $("#downloadDraftButton"),
    importDraftInput: $("#importDraftInput"),
    printButton: $("#printButton"),
    shareToPhoneButton: $("#shareToPhoneButton"),
    resetButton: $("#resetButton"),
    helpButton: $("#helpButton"),
    helpDialog: $("#helpDialog"),
    safetyDialog: $("#safetyDialog"),
    safetyForm: $("#safetyForm"),
    adultConfirm: $("#adultConfirm"),
    confirmDownloadButton: $("#confirmDownloadButton"),
    dialogWarnings: $("#dialogWarnings"),
    phonePhotoDialog: $("#phonePhotoDialog"),
    phonePhotoQr: $("#phonePhotoQr"),
    phonePhotoQrPlaceholder: $("#phonePhotoQrPlaceholder"),
    phonePhotoStatus: $("#phonePhotoStatus"),
    phonePhotoUrl: $("#phonePhotoUrl"),
    shareDialog: $("#shareDialog"),
    shareQr: $("#shareQr"),
    shareQrPlaceholder: $("#shareQrPlaceholder"),
    shareStatus: $("#shareStatus"),
    shareUrl: $("#shareUrl"),
    previewFrame: $("#previewFrame"),
    browserFrame: $("#browserFrame"),
    deviceButtons: $$('[data-device]'),
    toast: $("#toast")
  };

  init();

  function init() {
    hydrateForm();
    bindEvents();
    showStep(0, false);
    renderAll();
    checkLanAvailability();
  }

  function bindEvents() {
    elements.stepTabs.forEach((tab) => {
      tab.addEventListener("click", () => showStep(Number(tab.dataset.step)));
      tab.addEventListener("keydown", handleTabKeys);
    });

    $$(".next-step").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.next))));
    $$(".previous-step").forEach((button) => button.addEventListener("click", () => showStep(Number(button.dataset.previous))));

    bindTextInput(elements.nickname, "nickname", elements.nicknameCount, 18);
    bindTextInput(elements.tagline, "tagline", elements.taglineCount, 36);
    bindTextInput(elements.intro, "intro", elements.introCount, 180);

    elements.avatarModeButtons.forEach((button) => button.addEventListener("click", () => setAvatarMode(button.dataset.avatarMode)));
    elements.avatarChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.avatar = AVATARS.includes(button.dataset.avatar) ? button.dataset.avatar : "🐧";
        state.avatarMode = "illustration";
        renderAvatarControls();
        stateChanged();
      });
    });

    elements.photoInput.addEventListener("change", handlePhotoUpload);
    elements.removePhotoButton.addEventListener("click", removePhoto);
    elements.openPhonePhotoButton.addEventListener("click", openPhonePhotoTransfer);

    elements.favoriteChoices.forEach((button) => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
    elements.addFavoriteButton.addEventListener("click", addCustomFavorite);
    elements.customFavorite.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomFavorite();
      }
    });

    elements.storyPresetChoices.forEach((button) => button.addEventListener("click", () => addStory(button.dataset.storyTitle)));
    elements.addStoryButton.addEventListener("click", addCustomStory);
    elements.customStoryTitle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCustomStory();
      }
    });

    elements.themeCards.forEach((button) => {
      button.addEventListener("click", () => {
        state.theme = THEMES.includes(button.dataset.theme) ? button.dataset.theme : "notebook";
        renderDesignControls();
        stateChanged();
      });
    });
    elements.accentChoices.forEach((button) => button.addEventListener("click", () => setAccent(button.dataset.accent)));
    elements.accentPicker.addEventListener("input", () => setAccent(elements.accentPicker.value));

    elements.layoutChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.layout = LAYOUTS.includes(button.dataset.layout) ? button.dataset.layout : "cards";
        renderDesignControls();
        stateChanged();
      });
    });
    elements.decorChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.decor = DECORS.includes(button.dataset.decor) ? button.dataset.decor : "none";
        renderDesignControls();
        stateChanged();
      });
    });
    elements.motionChoices.forEach((button) => {
      button.addEventListener("click", () => {
        state.motion = MOTIONS.includes(button.dataset.motion) ? button.dataset.motion : "none";
        renderDesignControls();
        stateChanged();
      });
    });

    elements.deviceButtons.forEach((button) => button.addEventListener("click", () => setPreviewDevice(button.dataset.device)));

    elements.downloadSiteButton.addEventListener("click", () => prepareSiteAction("download"));
    elements.downloadDraftButton.addEventListener("click", downloadDraft);
    elements.importDraftInput.addEventListener("change", importDraft);
    elements.printButton.addEventListener("click", printPreview);
    elements.shareToPhoneButton.addEventListener("click", () => prepareSiteAction("share"));
    elements.resetButton.addEventListener("click", resetAll);

    elements.helpButton.addEventListener("click", () => openDialog(elements.helpDialog));
    $$('[data-close-dialog]').forEach((button) => {
      button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
    });

    elements.adultConfirm.addEventListener("change", () => {
      elements.confirmDownloadButton.disabled = !elements.adultConfirm.checked;
    });
    elements.safetyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!elements.adultConfirm.checked || !pendingAction) return;
      const action = pendingAction;
      pendingAction = null;
      elements.safetyDialog.close();
      if (action === "share") shareSiteToPhone();
      else downloadSite();
    });

    [elements.helpDialog, elements.safetyDialog, elements.phonePhotoDialog, elements.shareDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("cancel", () => {
        if (dialog === elements.safetyDialog) pendingAction = null;
      });
    });
    elements.phonePhotoDialog.addEventListener("close", stopPhotoPolling);
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
    elements.accentPicker.value = normalizeAccent(state.accent);
    updateAllCounters();
    renderAvatarControls();
    renderFavorites();
    renderStories();
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

  function removePhoto() {
    state.photo = "";
    elements.photoInput.value = "";
    renderPhotoPreview();
    stateChanged();
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
    if (exists) state.favorites = state.favorites.filter((item) => item !== value);
    else if (state.favorites.length < MAX_FAVORITES) state.favorites = [...state.favorites, value];
    else {
      showToast("すきなものは6こまでだよ");
      return;
    }
    renderFavorites();
    stateChanged();
  }

  function addCustomFavorite() {
    const value = cleanShortText(elements.customFavorite.value, 12);
    if (!value) return showToast("すきなものを書いてね");
    if (state.favorites.includes(value)) return showToast("それはもう入っているよ");
    if (state.favorites.length >= MAX_FAVORITES) return showToast("すきなものは6こまでだよ");
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

  function addCustomStory() {
    const title = cleanShortText(elements.customStoryTitle.value, 18);
    if (!title) return showToast("見出しを書いてね");
    addStory(title);
    elements.customStoryTitle.value = "";
  }

  function addStory(rawTitle) {
    if (state.stories.length >= MAX_STORIES) return showToast("しょうかいカードは8こまでだよ");
    const title = cleanShortText(rawTitle, 18);
    if (!title) return;
    const item = { id: createId(), title, text: "" };
    state.stories = [...state.stories, item];
    renderStories();
    stateChanged();
    requestAnimationFrame(() => elements.storyItems.querySelector(`[data-story-id="${item.id}"] textarea`)?.focus());
  }

  function updateStory(id, key, value) {
    state.stories = state.stories.map((item) => item.id === id ? { ...item, [key]: value } : item);
    stateChanged();
  }

  function moveStory(id, direction) {
    const index = state.stories.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.stories.length) return;
    const next = [...state.stories];
    [next[index], next[target]] = [next[target], next[index]];
    state.stories = next;
    renderStories();
    stateChanged();
  }

  function removeStory(id) {
    state.stories = state.stories.filter((item) => item.id !== id);
    renderStories();
    stateChanged();
  }

  function renderStories() {
    elements.storyItems.replaceChildren();
    if (!state.stories.length) {
      const empty = document.createElement("p");
      empty.className = "story-empty";
      empty.textContent = "上の見出しを押すと、ここに書くカードがふえるよ。";
      elements.storyItems.append(empty);
    }

    state.stories.forEach((story, index) => {
      const card = document.createElement("article");
      card.className = "story-edit-card";
      card.dataset.storyId = story.id;

      const toolbar = document.createElement("div");
      toolbar.className = "story-edit-toolbar";
      const order = document.createElement("span");
      order.className = "story-order";
      order.textContent = `${index + 1}こめ`;
      const controls = document.createElement("div");
      controls.className = "story-edit-controls";
      controls.append(
        iconButton("↑", "ひとつ上へ", index === 0, () => moveStory(story.id, -1)),
        iconButton("↓", "ひとつ下へ", index === state.stories.length - 1, () => moveStory(story.id, 1)),
        iconButton("×", "このカードを削除", false, () => removeStory(story.id), "remove")
      );
      toolbar.append(order, controls);

      const titleLabel = document.createElement("label");
      titleLabel.textContent = "見出し";
      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.maxLength = 18;
      titleInput.value = story.title;
      titleInput.placeholder = "例：わたしの宝もの";
      titleInput.addEventListener("input", () => updateStory(story.id, "title", titleInput.value));
      titleLabel.append(titleInput);

      const textLabel = document.createElement("label");
      textLabel.textContent = "書くこと";
      const textarea = document.createElement("textarea");
      textarea.rows = 3;
      textarea.maxLength = 120;
      textarea.value = story.text;
      textarea.placeholder = storyPlaceholder(story.title);
      const count = document.createElement("span");
      count.className = "counter";
      count.textContent = `${story.text.length} / 120`;
      textarea.addEventListener("input", () => {
        count.textContent = `${textarea.value.length} / 120`;
        updateStory(story.id, "text", textarea.value);
      });
      textLabel.append(textarea, count);
      card.append(toolbar, titleLabel, textLabel);
      elements.storyItems.append(card);
    });

    const atLimit = state.stories.length >= MAX_STORIES;
    elements.storyPresetChoices.forEach((button) => { button.disabled = atLimit; });
    elements.addStoryButton.disabled = atLimit;
  }

  function iconButton(text, label, disabled, handler, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `story-icon-button ${className}`.trim();
    button.textContent = text;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.disabled = disabled;
    button.addEventListener("click", handler);
    return button;
  }

  function storyPlaceholder(title) {
    if (/とくい/.test(title)) return "例：小さいものをていねいに作ること";
    if (/むちゅう/.test(title)) return "例：公園で見つけた虫を図かんで調べること";
    if (/やりたい|やってみたい/.test(title)) return "例：自分で考えたゲームを作ってみたい";
    return "ここに、みんなへ伝えたいことを書こう";
  }

  function setAccent(value) {
    state.accent = normalizeAccent(value);
    elements.accentPicker.value = state.accent;
    renderDesignControls();
    stateChanged();
  }

  function renderDesignControls() {
    toggleChoice(elements.themeCards, "theme", state.theme);
    toggleChoice(elements.layoutChoices, "layout", state.layout);
    toggleChoice(elements.decorChoices, "decor", state.decor);
    toggleChoice(elements.motionChoices, "motion", state.motion);
    elements.accentChoices.forEach((button) => {
      const active = button.dataset.accent.toLowerCase() === state.accent.toLowerCase();
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.accentPicker.value = normalizeAccent(state.accent);
  }

  function toggleChoice(buttons, dataKey, selected) {
    buttons.forEach((button) => {
      const active = button.dataset[dataKey] === selected;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
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
    renderStories();
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
        localStorage.removeItem(LEGACY_STORAGE_KEY);
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
    previewTimer = setTimeout(renderPreview, 100);
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
        title: lanInfo.enabled ? "QR転送は同じLAN内の一時メモリだけ" : "通常の入力は外部へ送信されません",
        detail: lanInfo.enabled ? "写真は約20分、完成ページは約30分で消えます。" : "QR機能を使わない限り、このブラウザの中だけで動きます。"
      },
      {
        status: "warn",
        title: "見せる相手と場所を大人と決めよう",
        detail: "LAN内でも、知らない人がいるネットワークではQR共有を使わないでください。"
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
      ? "内容を大人と確認したら、保存したりスマホへ送ったりできます。"
      : "STEP 1でニックネームを入れると保存できます。";
    [elements.downloadSiteButton, elements.shareToPhoneButton].forEach((button) => {
      button.disabled = !ready;
      button.setAttribute("aria-disabled", String(!ready));
    });
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
    const storyText = data.stories.flatMap((item) => [item.title, item.text]);
    const joined = [data.nickname, data.tagline, data.intro, ...storyText, ...data.favorites].join("\n");
    const findings = [];
    const checks = [
      { regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, title: "メールアドレスらしい文字があります", detail: "連絡先は消してから公開してください。" },
      { regex: /(?:0\d{1,4}[-ー‐−]?\d{1,4}[-ー‐−]?\d{3,4}|\d{3}[-ー‐−]\d{4}[-ー‐−]\d{4})/, title: "電話番号らしい数字があります", detail: "電話番号は公開しないでください。" },
      { regex: /(?:https?:\/\/|www\.|line\s*id|instagram|tiktok|discord|@[a-z0-9_]{3,})/i, title: "SNSやURLらしい文字があります", detail: "知らない人から連絡できる情報は消しましょう。" },
      { regex: /(?:小学校|中学校|学校名|\d年\d組|[一二三四五六1-6]年[一二三四五六1-6]組)/, title: "学校やクラスがわかるかもしれません", detail: "学校名、学年とクラスの組み合わせは書かないでください。" },
      { regex: /(?:都|道|府|県).{0,10}(?:市|区|町|村)|(?:丁目|番地|号室)|〒\s*\d{3}[-ー‐−]?\d{4}/, title: "住所らしい文字があります", detail: "住んでいる場所がわかる書き方は消しましょう。" },
      { regex: /(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*歳/, title: "年れいが書かれています", detail: "年れいも個人を見つける手がかりになるので、大人と確認してください。" }
    ];
    checks.forEach((check) => { if (check.regex.test(joined)) findings.push({ status: "warn", title: check.title, detail: check.detail }); });
    if (data.avatarMode === "photo" && isSafeImageDataUrl(data.photo)) {
      findings.push({ status: "warn", title: "写真を使っています", detail: "顔、名札、制服、家のまわりなどが写っていないか大人と確認してください。" });
    }
    if (/\s/.test(data.nickname.trim()) || data.nickname.trim().length >= 10) {
      findings.push({ status: "warn", title: "ニックネームが本名に見えないか確認しよう", detail: "名字と名前の組み合わせではなく、短い呼び名がおすすめです。" });
    }
    return findings;
  }

  function prepareSiteAction(action) {
    if (!state.nickname.trim()) {
      showStep(0);
      elements.nickname.focus();
      showToast("まずニックネームを入れてね");
      return;
    }
    if (action === "share" && !lanInfo.enabled) {
      ensureLanAvailable().then((enabled) => { if (enabled) prepareSiteAction("share"); });
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
    elements.confirmDownloadButton.textContent = action === "share" ? "QRコードを作る" : "HTMLを保存する";
    pendingAction = action;
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
      state = sanitizeState(JSON.parse(await file.text()));
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
    if (!popup) return showToast("印刷画面を開けませんでした。ポップアップを許可してください");
    try { popup.opener = null; } catch (_) { /* noop */ }
    popup.document.open();
    popup.document.write(buildProfileHTML(state, { standalone: true, print: true }));
    popup.document.close();
    popup.addEventListener("load", () => setTimeout(() => { popup.focus(); popup.print(); }, 150), { once: true });
  }

  function resetAll() {
    const confirmed = window.confirm("入力した内容と、この端末の下書きをぜんぶ消します。よいですか？");
    if (!confirmed) return;
    state = cloneDefaultState();
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) { console.warn("下書きを削除できませんでした", error); }
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

  async function checkLanAvailability() {
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("not-lan-server");
      const data = await response.json();
      lanInfo = { enabled: Boolean(data.enabled), baseUrl: String(data.baseUrl || "") };
    } catch (_) {
      lanInfo = { enabled: false, baseUrl: "" };
    }
    document.body.classList.toggle("lan-ready", lanInfo.enabled);
    renderSafetyCheck();
    return lanInfo.enabled;
  }

  async function ensureLanAvailable() {
    if (lanInfo.enabled) return true;
    const enabled = await checkLanAvailability();
    if (!enabled) showToast("QR機能は『python server.py』で起動したときに使えます");
    return enabled;
  }

  async function openPhonePhotoTransfer() {
    if (!await ensureLanAvailable()) return;
    stopPhotoPolling();
    resetQrDialog(elements.phonePhotoQr, elements.phonePhotoQrPlaceholder, elements.phonePhotoUrl);
    elements.phonePhotoStatus.textContent = "アップロード用URLを作っています…";
    openDialog(elements.phonePhotoDialog);
    try {
      const response = await fetch("/api/photo-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "failed");
      activePhotoToken = data.token;
      showQr(elements.phonePhotoQr, elements.phonePhotoQrPlaceholder, data.uploadUrl);
      setLanLink(elements.phonePhotoUrl, data.uploadUrl);
      elements.phonePhotoStatus.textContent = "スマホから写真が届くのを待っています…";
      pollPhotoSession();
    } catch (error) {
      console.error(error);
      elements.phonePhotoStatus.textContent = "QRコードを作れませんでした。サーバーを起動し直してください。";
    }
  }

  function pollPhotoSession() {
    clearTimeout(photoPollTimer);
    if (!activePhotoToken || !elements.phonePhotoDialog.open) return;
    photoPollTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/photo-sessions/${encodeURIComponent(activePhotoToken)}`, { cache: "no-store" });
        const data = await response.json();
        if (response.status === 410) {
          elements.phonePhotoStatus.textContent = "QRコードの時間が切れました。閉じて作り直してください。";
          return;
        }
        if (!response.ok) throw new Error(data.error || "failed");
        if (data.status === "received" && isSafeImageDataUrl(data.photo)) {
          state.photo = data.photo;
          state.avatarMode = "photo";
          renderAvatarControls();
          stateChanged();
          elements.phonePhotoStatus.textContent = "写真が届きました！";
          setTimeout(() => { if (elements.phonePhotoDialog.open) elements.phonePhotoDialog.close(); }, 650);
          showToast("スマホから写真が届きました");
          return;
        }
        pollPhotoSession();
      } catch (error) {
        console.error(error);
        elements.phonePhotoStatus.textContent = "通信を確認しています…";
        pollPhotoSession();
      }
    }, 1500);
  }

  function stopPhotoPolling() {
    clearTimeout(photoPollTimer);
    photoPollTimer = null;
    activePhotoToken = "";
  }

  async function shareSiteToPhone() {
    if (!await ensureLanAvailable()) return;
    resetQrDialog(elements.shareQr, elements.shareQrPlaceholder, elements.shareUrl);
    elements.shareStatus.textContent = "完成ページを一時共有しています…";
    openDialog(elements.shareDialog);
    try {
      const filename = `${safeFilename(state.nickname || "じぶんページ")}.html`;
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: buildProfileHTML(state, { standalone: true }), filename, nickname: state.nickname.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "failed");
      showQr(elements.shareQr, elements.shareQrPlaceholder, data.shareUrl);
      setLanLink(elements.shareUrl, data.shareUrl);
      elements.shareStatus.textContent = "スマホでQRコードを読みこんでください。";
    } catch (error) {
      console.error(error);
      elements.shareStatus.textContent = "共有ページを作れませんでした。サーバーを起動し直してください。";
    }
  }

  function resetQrDialog(image, placeholder, link) {
    image.hidden = true;
    image.removeAttribute("src");
    placeholder.hidden = false;
    placeholder.textContent = "QRコードを準備しています…";
    link.hidden = true;
    link.removeAttribute("href");
    link.textContent = "";
  }

  function showQr(image, placeholder, url) {
    image.onload = () => { image.hidden = false; placeholder.hidden = true; };
    image.onerror = () => { placeholder.textContent = "QRコードを表示できませんでした。下のURLを開いてください。"; };
    image.src = `/api/qr?text=${encodeURIComponent(url)}&t=${Date.now()}`;
  }

  function setLanLink(link, url) {
    link.href = url;
    link.textContent = url;
    link.hidden = false;
  }

  function buildProfileHTML(rawState, options = {}) {
    const data = sanitizeState(rawState);
    const theme = THEMES.includes(data.theme) ? data.theme : "notebook";
    const layout = LAYOUTS.includes(data.layout) ? data.layout : "cards";
    const decor = DECORS.includes(data.decor) ? data.decor : "none";
    const motion = MOTIONS.includes(data.motion) ? data.motion : "none";
    const accent = normalizeAccent(data.accent);
    const nickname = escapeHTML(data.nickname.trim() || "ニックネーム");
    const tagline = escapeHTML(data.tagline.trim() || "ここに、ひとことが入ります");
    const intro = escapeHTML(data.intro.trim() || "じこしょうかいを書いてみよう。すきなことや、いま夢中なことを短く書くと読みやすいよ。");
    const favorites = data.favorites.length ? data.favorites : ["すきなもの"];
    const avatarMarkup = data.avatarMode === "photo" && isSafeImageDataUrl(data.photo)
      ? `<img class="profile-photo" src="${data.photo}" alt="${nickname}のプロフィール画像">`
      : `<div class="profile-avatar" role="img" aria-label="プロフィールのイラスト">${escapeHTML(data.avatar)}</div>`;
    const storySections = data.stories.filter((item) => item.title.trim() && item.text.trim());
    const storyMarkup = storySections.length
      ? storySections.map((item, index) => `<article class="story-card"><span class="story-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><div><h2>${escapeHTML(item.title.trim())}</h2><p>${escapeHTML(item.text.trim())}</p></div></article>`).join("")
      : `<article class="story-card empty-story"><span class="story-index" aria-hidden="true">＋</span><div><h2>じぶんの話</h2><p>作成画面で見出しをえらぶと、ここに紹介カードがふえます。</p></div></article>`;
    const decorationMarkup = buildDecorationMarkup(decor);
    const printClass = options.print ? " print-now" : "";

    return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="${accent}"><title>${nickname}のじぶんページ</title>
<style>
:root{--accent:${accent};--ink:#292621;--muted:#665f56;--paper:#fffdf7;--line:#312d28;--soft:#d2c7b7;--shadow:8px 9px 0 rgba(49,45,40,.15)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:280px;color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",system-ui,sans-serif;line-height:1.75;background:#e9e1d2}img{max-width:100%;display:block}.page{position:relative;min-height:100vh;overflow:hidden;padding:clamp(22px,6vw,78px) clamp(14px,5vw,58px)}
.page-inner{position:relative;z-index:2;width:min(1040px,100%);margin:0 auto;padding:clamp(26px,6vw,68px);background:var(--paper);border:3px solid var(--line);box-shadow:var(--shadow)}
.hero{position:relative;display:grid;grid-template-columns:minmax(120px,190px) 1fr;align-items:center;gap:clamp(22px,5vw,54px)}.profile-avatar,.profile-photo{width:clamp(120px,22vw,180px);height:clamp(120px,22vw,180px);object-fit:cover;border:4px solid var(--line);box-shadow:6px 7px 0 color-mix(in srgb,var(--accent) 34%,transparent)}.profile-avatar{display:grid;place-items:center;background:#fff5cf;font-size:clamp(4rem,10vw,7rem);line-height:1}.kicker{margin:0 0 5px;color:var(--accent);font:900 .78rem/1.2 ui-monospace,monospace;letter-spacing:.16em}.hero h1{margin:0;font-size:clamp(2.1rem,7vw,5rem);line-height:1.08;word-break:break-word}.tagline{margin:13px 0 0;font-size:clamp(1.05rem,2.4vw,1.5rem);font-weight:900}.intro{margin:24px 0 0;font-size:clamp(1rem,2vw,1.17rem);white-space:pre-wrap}.favorites{margin-top:36px}.section-label{margin:0 0 14px;font-size:1rem}.favorite-list{display:flex;flex-wrap:wrap;gap:9px;margin:0;padding:0;list-style:none}.favorite-tag{padding:7px 14px;font-weight:800}.stories{display:grid;gap:18px;margin-top:36px}.story-card{position:relative;min-width:0}.story-card h2{margin:0 0 7px;font-size:1.08rem}.story-card p{margin:0;color:#4e4942;white-space:pre-wrap}.story-index{font-weight:900}.page-footer{display:flex;justify-content:space-between;gap:20px;margin-top:48px;padding-top:17px;color:var(--muted);font-size:.76rem}.page-footer p{margin:0}.decoration{position:absolute;z-index:1;pointer-events:none}
/* 紙のテーマ：背景、書体、形を大きく変える */
.theme-notebook{background:repeating-linear-gradient(#fffdf7 0 33px,#d5e1e4 33px 34px)}.theme-notebook .page-inner{border-radius:5px;background:linear-gradient(90deg,transparent 0 54px,#e9a7a0 54px 56px,transparent 56px),rgba(255,253,247,.96)}.theme-notebook .hero{padding-left:20px;padding-bottom:38px;border-bottom:2px dashed #aca395}.theme-notebook .profile-avatar,.theme-notebook .profile-photo{border-radius:47% 53% 46% 54%;transform:rotate(-2deg)}.theme-notebook .tagline{display:inline;background:linear-gradient(transparent 58%,color-mix(in srgb,var(--accent) 28%,transparent) 58%)}.theme-notebook .favorite-tag{background:#fff;border:2px solid var(--line);border-radius:999px;box-shadow:2px 3px 0 color-mix(in srgb,var(--accent) 20%,transparent)}
.theme-sky{background:linear-gradient(#88cef0 0 42%,#dff5ff 42%)}.theme-sky::before,.theme-sky::after{content:"";position:absolute;width:220px;height:70px;background:#fff;border-radius:999px;opacity:.85;box-shadow:70px 16px 0 -10px #fff,-65px 21px 0 -18px #fff}.theme-sky::before{left:6%;top:7%}.theme-sky::after{right:4%;top:28%;transform:scale(.75)}.theme-sky .page-inner{border:0;border-radius:42px;background:rgba(255,255,255,.94);box-shadow:0 28px 65px rgba(38,92,122,.23)}.theme-sky .hero{padding:10px 10px 42px;text-align:left}.theme-sky .profile-avatar,.theme-sky .profile-photo{border:0;border-radius:50%;box-shadow:0 14px 35px color-mix(in srgb,var(--accent) 28%,transparent)}.theme-sky .kicker{padding:5px 11px;width:max-content;color:#fff;background:var(--accent);border-radius:999px}.theme-sky .favorite-tag{color:#18465e;background:#eaf8ff;border-radius:999px}.theme-sky .section-label{color:#286b8a}.theme-sky .story-card{border-radius:26px;background:#f2fbff;box-shadow:0 10px 26px rgba(48,104,134,.12)}
.theme-forest{background-color:#d9e6d0;background-image:radial-gradient(#789b70 1px,transparent 1px);background-size:22px 22px}.theme-forest .page-inner{border:8px double #476345;border-radius:4px;background:#fbfff7;box-shadow:12px 14px 0 rgba(53,78,49,.18);font-family:"Yu Mincho","Hiragino Mincho ProN",serif}.theme-forest .hero{grid-template-columns:1fr;justify-items:center;text-align:center;padding-bottom:42px;border-bottom:1px solid #789174}.theme-forest .profile-avatar,.theme-forest .profile-photo{border-radius:50% 50% 44% 56%;border-color:#476345;box-shadow:0 0 0 12px #e5efdf}.theme-forest .kicker{color:#4d6a49}.theme-forest .tagline{padding:5px 18px;background:#e2eedc;border:1px solid #76906f;border-radius:50%}.theme-forest .favorite-list{justify-content:center}.theme-forest .favorite-tag{background:#edf5e8;border:1px solid #789174;border-radius:4px}.theme-forest .section-label{text-align:center;color:#476345}.theme-forest .story-card{border-left:10px solid #73946d;background:#f1f7ed}
.theme-pop{background-color:#ffd7bf;background-image:linear-gradient(45deg,#fff2e9 25%,transparent 25%),linear-gradient(-45deg,#fff2e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#fff2e9 75%),linear-gradient(-45deg,transparent 75%,#fff2e9 75%);background-size:38px 38px;background-position:0 0,0 19px,19px -19px,-19px 0}.theme-pop .page-inner{border:5px solid var(--line);border-radius:0;background:#fff9f3;box-shadow:14px 14px 0 var(--accent)}.theme-pop .hero{padding:8px 8px 42px;border-bottom:7px solid var(--line)}.theme-pop .profile-avatar,.theme-pop .profile-photo{border-radius:0;transform:rotate(-4deg);box-shadow:10px 10px 0 var(--accent)}.theme-pop .kicker{display:inline-block;padding:6px 10px;color:#fff;background:var(--ink);transform:rotate(-2deg)}.theme-pop .hero h1{text-transform:uppercase;text-shadow:4px 4px 0 color-mix(in srgb,var(--accent) 55%,#fff)}.theme-pop .tagline{display:inline-block;padding:4px 10px;background:#fff;border:3px solid var(--line);transform:rotate(1deg)}.theme-pop .favorite-tag{background:var(--accent);border:3px solid var(--line);box-shadow:3px 3px 0 var(--line);transform:rotate(-1deg)}.theme-pop .favorite-tag:nth-child(even){transform:rotate(2deg)}.theme-pop .story-card{border:4px solid var(--line);box-shadow:7px 7px 0 var(--accent)}
/* ならべかた：ページ構成そのものを変える */
.layout-cards .stories{grid-template-columns:repeat(2,minmax(0,1fr))}.layout-cards .story-card{display:grid;grid-template-columns:48px 1fr;gap:13px;min-height:150px;padding:20px;background:#fff;border:2px solid var(--line);border-radius:12px 20px 11px 17px}.layout-cards .story-card:nth-child(3n+2){transform:translateY(10px)}.layout-cards .story-index{display:grid;place-items:center;width:42px;height:42px;background:color-mix(in srgb,var(--accent) 24%,#fff);border:2px solid var(--line);border-radius:50%}
.layout-journal .page-inner{max-width:820px}.layout-journal .hero{grid-template-columns:130px 1fr;padding-bottom:28px}.layout-journal .profile-avatar,.layout-journal .profile-photo{width:130px;height:130px}.layout-journal .stories{position:relative;padding-left:48px}.layout-journal .stories::before{content:"";position:absolute;left:16px;top:0;bottom:0;border-left:4px solid color-mix(in srgb,var(--accent) 48%,#aaa)}.layout-journal .story-card{padding:18px 22px;background:#fff;border:1px solid #aaa;border-radius:2px;box-shadow:3px 5px 0 rgba(0,0,0,.09);transform:rotate(-.35deg)}.layout-journal .story-card:nth-child(even){transform:rotate(.45deg)}.layout-journal .story-index{position:absolute;left:-48px;top:18px;display:grid;place-items:center;width:34px;height:34px;background:var(--paper);border:3px solid var(--accent);border-radius:50%}
.layout-poster .page-inner{width:min(1180px,100%);padding:clamp(22px,4vw,46px)}.layout-poster .hero{min-height:420px;grid-template-columns:1.15fr .85fr;grid-template-areas:"copy avatar";padding:clamp(18px,4vw,48px);color:#fff;background:var(--accent);border:5px solid var(--line)}.layout-poster .hero-copy{grid-area:copy}.layout-poster .profile-avatar,.layout-poster .profile-photo{grid-area:avatar;width:min(290px,100%);height:auto;aspect-ratio:1;margin:auto;border-width:7px;background:#fff}.layout-poster .kicker{color:#fff}.layout-poster .hero h1{font-size:clamp(3rem,9vw,7rem);text-shadow:5px 5px 0 var(--line)}.layout-poster .tagline{display:block;font-size:clamp(1.25rem,3vw,2rem)}.layout-poster .intro{max-width:52ch}.layout-poster .favorites{padding:17px;background:var(--ink)}.layout-poster .section-label{display:none}.layout-poster .favorite-list{justify-content:center}.layout-poster .favorite-tag{color:var(--ink);background:#fff;border-radius:0}.layout-poster .stories{grid-template-columns:repeat(3,minmax(0,1fr))}.layout-poster .story-card{min-height:220px;padding:24px;background:#fff;border:5px solid var(--line)}.layout-poster .story-index{display:block;margin-bottom:18px;color:var(--accent);font-size:2rem}
.layout-catalog .page-inner{border-radius:0}.layout-catalog .hero{grid-template-columns:210px 1fr;padding-bottom:24px;border-bottom:5px double var(--line)}.layout-catalog .profile-avatar,.layout-catalog .profile-photo{width:190px;height:190px;border-radius:3px;box-shadow:none}.layout-catalog .hero h1{font-family:Georgia,"Yu Mincho",serif}.layout-catalog .tagline{color:var(--accent)}.layout-catalog .favorites{display:grid;grid-template-columns:150px 1fr;align-items:start;padding:20px 0;border-bottom:1px solid var(--line)}.layout-catalog .section-label{margin:0;font-family:Georgia,"Yu Mincho",serif}.layout-catalog .favorite-tag{padding:3px 10px;background:transparent;border-left:4px solid var(--accent)}.layout-catalog .stories{grid-template-columns:repeat(2,minmax(0,1fr));counter-reset:catalog}.layout-catalog .story-card{counter-increment:catalog;display:grid;grid-template-columns:70px 1fr;gap:18px;padding:21px 0;border-top:1px solid var(--line)}.layout-catalog .story-index{font:900 1.55rem/1 Georgia,serif;color:var(--accent)}
/* かざり */
.decor-doodles .doodle-ring{right:3%;top:5%;width:100px;height:100px;border:6px solid var(--accent);border-radius:48% 52% 45% 55%;opacity:.42;transform:rotate(18deg)}.decor-doodles .doodle-dash{left:2%;bottom:7%;width:75px;height:75px;border:6px dashed var(--accent);border-radius:50%;opacity:.38}.decor-doodles .doodle-wave{left:1%;top:24%;width:150px;color:var(--accent);opacity:.35;transform:rotate(-12deg)}
.decor-stickers .sticker-star{right:4%;top:5%;font-size:5rem;filter:drop-shadow(4px 5px 0 rgba(0,0,0,.16));transform:rotate(13deg)}.decor-stickers .sticker-tape{left:2%;top:17%;width:110px;height:34px;background:#f6df8e;opacity:.82;transform:rotate(-16deg)}.decor-stickers .sticker-dot{right:3%;bottom:8%;width:74px;height:74px;background:var(--accent);border:5px solid var(--line);border-radius:50%;box-shadow:8px 8px 0 rgba(0,0,0,.13)}
.decor-stamps .stamp-one,.decor-stamps .stamp-two{display:grid;place-items:center;width:120px;height:54px;color:var(--accent);border:5px double currentColor;font:900 .9rem/1 serif;letter-spacing:.12em;opacity:.55}.decor-stamps .stamp-one{right:3%;top:7%;transform:rotate(12deg)}.decor-stamps .stamp-two{left:2%;bottom:8%;transform:rotate(-9deg)}
/* うごき */
.motion-fade .page-inner{animation:fade-in .65s ease-out both}.motion-fade .story-card{animation:rise .52s ease-out both}.motion-fade .story-card:nth-child(2){animation-delay:.08s}.motion-fade .story-card:nth-child(3){animation-delay:.16s}.motion-bounce .profile-avatar,.motion-bounce .profile-photo{animation:pop-in .7s cubic-bezier(.2,1.55,.45,1) both}.motion-bounce .story-card{animation:pop-in .55s cubic-bezier(.2,1.45,.45,1) both}.motion-bounce .story-card:nth-child(even){animation-delay:.1s}.motion-float .profile-avatar,.motion-float .profile-photo{animation:float 3.2s ease-in-out infinite}.motion-float .decoration{animation:float 4.5s ease-in-out infinite alternate}.motion-float .story-card:nth-child(even){animation:float-card 4s ease-in-out infinite alternate}
@keyframes fade-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1}}@keyframes pop-in{0%{opacity:0;transform:scale(.72) rotate(-5deg)}70%{transform:scale(1.05) rotate(1deg)}100%{opacity:1;transform:none}}@keyframes float{50%{transform:translateY(-10px) rotate(1deg)}}@keyframes float-card{to{transform:translateY(-7px) rotate(.3deg)}}
@media(max-width:760px){.page{padding:13px}.page-inner{padding:28px 19px;border-width:2px;box-shadow:4px 5px 0 rgba(49,45,40,.14)}.hero,.layout-poster .hero,.layout-catalog .hero,.layout-journal .hero{grid-template-columns:1fr;grid-template-areas:none;text-align:center;min-height:0}.layout-poster .hero-copy,.layout-poster .profile-avatar,.layout-poster .profile-photo{grid-area:auto}.profile-avatar,.profile-photo,.layout-journal .profile-avatar,.layout-journal .profile-photo,.layout-catalog .profile-avatar,.layout-catalog .profile-photo{margin:auto}.layout-cards .stories,.layout-poster .stories,.layout-catalog .stories{grid-template-columns:1fr}.layout-cards .story-card:nth-child(3n+2){transform:none}.layout-catalog .favorites{grid-template-columns:1fr}.layout-poster .hero h1{font-size:clamp(2.8rem,15vw,5rem)}.page-footer{display:block}.page-footer p+p{margin-top:4px}.decoration{opacity:.23!important}.theme-notebook .page-inner{background:rgba(255,253,247,.97)}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;scroll-behavior:auto!important}}@media print{body{background:#fff}.page{padding:0}.page-inner{width:100%;border:0;box-shadow:none}.decoration{display:none}.page-footer{break-inside:avoid}}
</style></head>
<body class="theme-${theme} layout-${layout} decor-${decor} motion-${motion}${printClass}"><main class="page">${decorationMarkup}<div class="page-inner">
<header class="hero">${avatarMarkup}<div class="hero-copy"><p class="kicker">MY PAGE</p><h1>${nickname}</h1><p class="tagline">${tagline}</p><p class="intro">${intro}</p></div></header>
<section class="favorites" aria-labelledby="favorite-title"><h2 class="section-label" id="favorite-title">すきなもの</h2><ul class="favorite-list">${favorites.map((favorite) => `<li class="favorite-tag">${escapeHTML(favorite)}</li>`).join("")}</ul></section>
<section class="stories" aria-label="もっとくわしい自己紹介">${storyMarkup}</section>
<footer class="page-footer"><p>${nickname}のじぶんページ</p><p>見せる前に、おうちの人と内容を確認しました。</p></footer>
</div></main></body></html>`;
  }

  function buildDecorationMarkup(decor) {
    if (decor === "doodles") return `<div class="decoration doodle-ring" aria-hidden="true"></div><div class="decoration doodle-dash" aria-hidden="true"></div><svg class="decoration doodle-wave" viewBox="0 0 160 70" aria-hidden="true"><path d="M5 45c20-40 38 32 61-9s38 45 88-16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>`;
    if (decor === "stickers") return `<div class="decoration sticker-star" aria-hidden="true">★</div><div class="decoration sticker-tape" aria-hidden="true"></div><div class="decoration sticker-dot" aria-hidden="true"></div>`;
    if (decor === "stamps") return `<div class="decoration stamp-one" aria-hidden="true">MY PAGE</div><div class="decoration stamp-two" aria-hidden="true">SPECIAL</div>`;
    return "";
  }

  function sanitizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const avatar = AVATARS.includes(source.avatar) ? source.avatar : defaultState.avatar;
    const favorites = Array.isArray(source.favorites)
      ? [...new Set(source.favorites.map((item) => cleanShortText(item, 12)).filter(Boolean))].slice(0, MAX_FAVORITES)
      : [];
    const photo = isSafeImageDataUrl(source.photo) ? source.photo : "";
    let stories = [];
    if (Array.isArray(source.stories)) {
      stories = source.stories.map((item) => ({
        id: cleanShortText(item?.id, 64) || createId(),
        title: cleanShortText(item?.title, 18),
        text: cleanText(item?.text, 120)
      })).filter((item) => item.title).slice(0, MAX_STORIES);
    } else {
      const legacy = [
        { title: "とくいなこと", text: source.goodAt },
        { title: "いま、むちゅう", text: source.intoNow },
        { title: "これからやりたい", text: source.nextGoal }
      ];
      stories = legacy.map((item) => ({ id: createId(), title: item.title, text: cleanText(item.text, 120) }));
    }
    const legacyDecor = source.doodles === false ? "none" : "doodles";
    const legacyMotion = source.motion === false ? "none" : "fade";
    return {
      version: 2,
      nickname: cleanText(source.nickname, 18),
      tagline: cleanText(source.tagline, 36),
      intro: cleanText(source.intro, 180),
      avatarMode: source.avatarMode === "photo" ? "photo" : "illustration",
      avatar,
      photo,
      favorites,
      stories,
      theme: THEMES.includes(source.theme) ? source.theme : defaultState.theme,
      accent: normalizeAccent(source.accent),
      layout: LAYOUTS.includes(source.layout) ? source.layout : defaultState.layout,
      decor: DECORS.includes(source.decor) ? source.decor : legacyDecor,
      motion: MOTIONS.includes(source.motion) ? source.motion : legacyMotion
    };
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored ? sanitizeState(JSON.parse(stored)) : cloneDefaultState();
    } catch (error) {
      console.warn("下書きを読みこめませんでした", error);
      return cloneDefaultState();
    }
  }

  function cloneDefaultState() {
    return {
      ...defaultState,
      favorites: [],
      stories: DEFAULT_STORY_TITLES.map((title) => ({ id: createId(), title, text: "" }))
    };
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    const cleaned = String(value).normalize("NFKC").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return cleaned || "じぶんページ";
  }

  function updateAllCounters() {
    updateCounter(elements.nicknameCount, elements.nickname.value.length, 18);
    updateCounter(elements.taglineCount, elements.tagline.value.length, 36);
    updateCounter(elements.introCount, elements.intro.value.length, 180);
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
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2800);
  }
})();
