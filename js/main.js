(function () {
  var TEMPLATE = "+7 (___) ___-__-__";

  function initPhoneMask(input) {
    var digitPositions = [];
    for (var i = 0; i < TEMPLATE.length; i++) {
      if (TEMPLATE[i] === "_") digitPositions.push(i);
    }

    // Local-number digits only (no country code) — kept as our own state
    // instead of re-parsed from input.value, so the fixed "+7" prefix can
    // never be mistaken for a digit the user actually typed.
    var digits = [];

    function render() {
      var chars = TEMPLATE.split("");
      for (var i = 0; i < digitPositions.length; i++) {
        chars[digitPositions[i]] = digits[i] !== undefined ? digits[i] : "_";
      }
      input.value = chars.join("");
    }

    function cursorPos() {
      return digits.length >= digitPositions.length
        ? TEMPLATE.length
        : digitPositions[digits.length];
    }

    function placeCursor() {
      var pos = cursorPos();
      input.setSelectionRange(pos, pos);
    }

    function insertText(text) {
      var typed = text.replace(/\D/g, "");
      for (var i = 0; i < typed.length; i++) {
        if (digits.length === 0 && (typed[i] === "7" || typed[i] === "8")) {
          continue; // country code is implicit — a leading 7/8 is redundant
        }
        if (digits.length < digitPositions.length) {
          digits.push(typed[i]);
        }
      }
    }

    input.addEventListener("focus", function () {
      render();
      requestAnimationFrame(placeCursor);
    });

    input.addEventListener("beforeinput", function (e) {
      if (
        e.inputType === "insertText" ||
        e.inputType === "insertFromPaste" ||
        e.inputType === "insertCompositionText"
      ) {
        e.preventDefault();
        insertText(e.data || "");
        render();
        placeCursor();
      } else if (e.inputType && e.inputType.indexOf("delete") === 0) {
        e.preventDefault();
        digits.pop();
        render();
        placeCursor();
      }
    });

    input.addEventListener("click", function () {
      placeCursor();
    });

    input.addEventListener("blur", function () {
      if (digits.length === 0) input.value = "";
    });
  }

  document.querySelectorAll('input[type="tel"]').forEach(initPhoneMask);
})();

(function () {
  // Desktop (>=1280px) gets the accordion layout (hover expands one card,
  // flex-grow handles the rest, arrows/dots page a 4-card window across
  // however many cards there are); everything else (mobile/tablet) gets a
  // Swiper slider. Custom slideClass/wrapperClass point Swiper at our own
  // BEM classes instead of forcing swiper-wrapper/swiper-slide into the
  // markup.
  var DESKTOP_QUERY = "(min-width: 1280px)";
  var VISIBLE_COUNT = 4;

  function isDesktop() {
    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  function panelMode() {
    return isDesktop() ? "accordion" : "slider";
  }

  // Wires two independent things that share the same cards:
  // - hover sets which card is expanded (setActive) — purely a mouse
  //   effect, never touched by the arrows/dots.
  // - windowStart controls which VISIBLE_COUNT-sized slice of cards is
  //   laid out at all (the rest get display:none); arrows/dots move this
  //   window, i.e. they page through the set instead of changing the
  //   hover state. Only meaningful in accordion mode — slider mode makes
  //   every card visible and lets Swiper own paging entirely.
  function setupAccordion(panel) {
    var cards = Array.prototype.slice.call(panel.querySelectorAll(".catalog-card"));
    var cardsRow = panel.querySelector(".catalog-cards");
    if (!cards.length || !cardsRow) return;

    var windowStart = 0;

    function maxWindowStart() {
      return Math.max(0, cards.length - VISIBLE_COUNT);
    }

    function setActive(card) {
      cards.forEach(function (c) {
        c.classList.toggle("is-active", c === card);
      });
    }

    panel._catalogCards = cards;
    panel._setActive = setActive;

    cards.forEach(function (card) {
      card.addEventListener("mouseenter", function () {
        setActive(card);
      });
    });

    cardsRow.addEventListener("mouseleave", function () {
      setActive(null);
    });

    var prevBtn = panel.querySelector(".catalog-nav--prev");
    var nextBtn = panel.querySelector(".catalog-nav--next");
    var dotsEl = panel.querySelector(".catalog-dots");

    function updateDotsActive() {
      if (!dotsEl) return;
      var dots = dotsEl.querySelectorAll(".swiper-pagination-bullet");
      dots.forEach(function (d, i) {
        d.classList.toggle("swiper-pagination-bullet-active", i === windowStart);
      });
    }

    function renderWindow() {
      cards.forEach(function (c, i) {
        var visible = i >= windowStart && i < windowStart + VISIBLE_COUNT;
        c.style.display = visible ? "" : "none";
      });
      setActive(null);
      if (prevBtn) prevBtn.classList.toggle("swiper-button-disabled", windowStart <= 0);
      if (nextBtn) nextBtn.classList.toggle("swiper-button-disabled", windowStart >= maxWindowStart());
      updateDotsActive();
    }

    function goTo(start) {
      windowStart = Math.min(Math.max(start, 0), maxWindowStart());
      renderWindow();
    }

    if (prevBtn) prevBtn.addEventListener("click", function () {
      if (panel.dataset.catalogMode === "accordion") goTo(windowStart - 1);
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (panel.dataset.catalogMode === "accordion") goTo(windowStart + 1);
    });

    panel._accordionActivate = function () {
      renderDots();
      goTo(0);
    };

    panel._accordionDeactivate = function () {
      cards.forEach(function (c) {
        c.style.display = "";
      });
    };

    function renderDots() {
      if (!dotsEl) return;
      dotsEl.innerHTML = "";
      var total = maxWindowStart() + 1;
      for (var i = 0; i < total; i++) {
        (function (pageStart) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "swiper-pagination-bullet";
          dot.setAttribute("aria-label", "Показать карточки " + (pageStart + 1) + "–" + Math.min(pageStart + VISIBLE_COUNT, cards.length));
          dot.addEventListener("click", function () {
            goTo(pageStart);
          });
          dotsEl.appendChild(dot);
        })(i);
      }
    }
  }

  function refreshPanel(panel) {
    if (panel.hidden) return;

    var mode = panelMode();
    if (panel.dataset.catalogMode === mode) {
      if (mode === "slider" && panel._swiper) panel._swiper.update();
      return;
    }
    panel.dataset.catalogMode = mode;

    panel.classList.toggle("catalog__panel--accordion", mode === "accordion");
    panel.classList.toggle("catalog__panel--slider", mode === "slider");

    if (panel._swiper) {
      panel._swiper.destroy(true, true);
      panel._swiper = null;
    }

    var dotsEl = panel.querySelector(".catalog-dots");

    if (mode === "slider") {
      if (panel._accordionDeactivate) panel._accordionDeactivate();
      if (dotsEl) dotsEl.innerHTML = "";
      var swiperEl = panel.querySelector(".catalog-swiper");
      panel._swiper = new Swiper(swiperEl, {
        slidesPerView: "auto",
        spaceBetween: 16,
        wrapperClass: "catalog-cards",
        slideClass: "catalog-card",
        navigation: {
          nextEl: panel.querySelector(".catalog-nav--next"),
          prevEl: panel.querySelector(".catalog-nav--prev"),
        },
        pagination: {
          el: dotsEl,
          clickable: true,
        },
      });
    } else if (panel._accordionActivate) {
      panel._accordionActivate();
    }
  }

  function initCatalog(catalog) {
    var tabs = Array.prototype.slice.call(catalog.querySelectorAll(".catalog__tab"));
    var panels = Array.prototype.slice.call(catalog.querySelectorAll("[data-catalog-panel]"));

    panels.forEach(setupAccordion);
    panels.forEach(refreshPanel);

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.classList.contains("is-active")) return;

        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });

        var target = tab.dataset.catalogTab;
        panels.forEach(function (panel) {
          panel.hidden = panel.dataset.catalogPanel !== target;
        });
        panels.forEach(refreshPanel);
      });
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        panels.forEach(refreshPanel);
      }, 150);
    });
  }

  document.querySelectorAll(".catalog").forEach(initCatalog);
})();
