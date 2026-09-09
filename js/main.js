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
  // >=992px (tablet and below stays touch/Swiper) gets the accordion
  // layout: hover expands one card, arrows/dots page a 4-card window
  // across however many cards there are. Below 1280px specifically the
  // card doesn't actually grow on hover (that's a pure CSS media-gated
  // rule — see the flex-grow comment in the SCSS) so it reads as a
  // "small desktop/laptop" variant of the same accordion rather than a
  // separate mode; JS doesn't need to know about that distinction.
  // <992px (mobile/tablet) gets a Swiper slider instead. Custom
  // slideClass/wrapperClass point Swiper at our own BEM classes instead
  // of forcing swiper-wrapper/swiper-slide into the markup.
  var DESKTOP_QUERY = "(min-width: 992px)";
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

    // Nothing to page through with 4 cards or fewer — hide the arrows and
    // dots instead of leaving them sitting there doing nothing.
    function updateNavVisibility() {
      var hasPages = maxWindowStart() > 0;
      if (prevBtn) prevBtn.style.display = hasPages ? "" : "none";
      if (nextBtn) nextBtn.style.display = hasPages ? "" : "none";
      if (dotsEl) dotsEl.style.display = hasPages ? "" : "none";
    }

    function renderWindow() {
      cards.forEach(function (c, i) {
        var visible = i >= windowStart && i < windowStart + VISIBLE_COUNT;
        c.style.display = visible ? "" : "none";
      });
      setActive(null);
      updateNavVisibility();
      updateDotsActive();
    }

    // A real slide, like Swiper's own: freeze every card between the old
    // and new window at a fixed pixel width (flex:1 1 0% can't be
    // transitioned smoothly — see the flex-grow comment above), position
    // the row so the current cards are exactly where they already are,
    // then transform it by one slot per step. Once the transition ends,
    // drop back to the normal flexible layout for whichever 4 are now
    // the window, so hover still works between slides.
    var SLIDE_MS = 450;
    var animating = false;

    function goTo(start) {
      var target = Math.min(Math.max(start, 0), maxWindowStart());
      if (target === windowStart || animating) return;

      var dir = target > windowStart ? 1 : -1;
      var delta = Math.abs(target - windowStart);
      animating = true;
      setActive(null);
      cardsRow.style.pointerEvents = "none";

      var slotWidth = cards[windowStart].getBoundingClientRect().width;
      var gap = parseFloat(getComputedStyle(cardsRow).columnGap) || 16;
      var step = (slotWidth + gap) * delta;

      var rangeStart = Math.min(windowStart, target);
      var rangeEnd = Math.max(windowStart, target) + VISIBLE_COUNT - 1;
      for (var i = rangeStart; i <= rangeEnd; i++) {
        cards[i].style.display = "";
        cards[i].style.transition = "none";
        cards[i].style.flex = "0 0 " + slotWidth + "px";
      }

      cardsRow.style.transition = "none";
      cardsRow.style.transform = dir > 0 ? "translateX(0)" : "translateX(-" + step + "px)";
      void cardsRow.offsetHeight; // force the start position to apply before animating
      cardsRow.style.transition = "transform " + SLIDE_MS + "ms ease";
      requestAnimationFrame(function () {
        cardsRow.style.transform = dir > 0 ? "translateX(-" + step + "px)" : "translateX(0)";
      });

      setTimeout(function () {
        windowStart = target;
        cardsRow.style.transition = "none";
        cardsRow.style.transform = "";
        // Drop the fixed pixel width back to the normal flex:1 1 0% while
        // transition is still "none" on each card, so the swap is
        // instant. Restoring `transition` in the *same* tick as `flex`
        // would let the class's `transition: flex-grow` catch that
        // change and briefly animate away any subpixel rounding
        // difference between the frozen width and the real flex layout —
        // which is what read as a flash/"reload" after every slide.
        cards.forEach(function (c, i) {
          var visible = i >= windowStart && i < windowStart + VISIBLE_COUNT;
          c.style.display = visible ? "" : "none";
          c.style.flex = "";
        });
        void cardsRow.offsetHeight; // commit the flex reset before re-enabling transitions
        cards.forEach(function (c) {
          c.style.transition = "";
        });
        cardsRow.style.pointerEvents = "";
        animating = false;
        updateDotsActive();
      }, SLIDE_MS + 30);
    }

    // No dead ends: past the last page wraps to the first and vice versa,
    // so the arrows stay clickable instead of disabling at the edges.
    if (prevBtn) prevBtn.addEventListener("click", function () {
      if (panel.dataset.catalogMode !== "accordion") return;
      goTo(windowStart <= 0 ? maxWindowStart() : windowStart - 1);
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (panel.dataset.catalogMode !== "accordion") return;
      goTo(windowStart >= maxWindowStart() ? 0 : windowStart + 1);
    });

    panel._accordionActivate = function () {
      renderDots();
      windowStart = 0;
      renderWindow();
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
      // Mobile bleeds the swiper past its container with 16px of CSS
      // padding on the element itself (see the SCSS). That's already
      // enough for Swiper to work with on its own — the wrapper sits
      // inside the padding box, so the first slide naturally lands at
      // the padded inset with no further configuration. Explicitly
      // telling Swiper about that same inset via slidesOffsetBefore/After
      // double-counted it (16px padding + 16px offset = 32px), which is
      // why the first card wasn't flush at the intended 16px.
      panel._swiper = new Swiper(swiperEl, {
        slidesPerView: "auto",
        spaceBetween: 16,
        speed: 450,
        loop: true, // cyclic like the desktop accordion — arrows never dead-end/disable
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
        // Below 576px the fixed 308px card (see .catalog-card's own CSS)
        // is the real Figma-mobile design and already works fine. From
        // 576px up — tablet and any narrowed desktop window — a fixed
        // card just overflows the row uncut, which read as "cards don't
        // fit"; a decimal slidesPerView (same fluid-card technique as
        // FeaturesSection) makes Swiper size each slide as a share of the
        // container instead, so it always fits with just the next one
        // peeking, same as the fixed-width mobile version overrides via
        // its own inline slide width — but resizing with the viewport
        // instead of a plain px slide width.
        breakpoints: {
          576: {
            slidesPerView: 1.4,
            spaceBetween: 16,
          },
          768: {
            slidesPerView: 2.3,
            spaceBetween: 16,
          },
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

  var CALCULATOR_SCHEME_BASE = "assets/calculator/";
  var CALCULATOR_DEFAULT_TYPE = "angle";

  function initCalculator(calculator) {
    var groups = Array.prototype.slice.call(calculator.querySelectorAll(".calculator__tabs"));
    var schemeImg = calculator.querySelector("[data-calculator-scheme]");
    var barInput = calculator.querySelector("[data-calculator-bar]");
    var typeGroup = calculator.querySelector('[data-calculator-group="type"]');
    var customPanel = calculator.querySelector("[data-calculator-custom]");
    var customToggle = calculator.querySelector("[data-calculator-custom-toggle]");
    var resetBtn = calculator.querySelector("[data-calculator-reset]");

    function activeTypeValue() {
      var active = typeGroup && typeGroup.querySelector(".calculator__tab.is-active");
      return (active && active.dataset.value) || CALCULATOR_DEFAULT_TYPE;
    }

    function updateScheme() {
      if (!schemeImg) return;
      var type = activeTypeValue();
      var withBar = !barInput || barInput.checked;
      schemeImg.src = CALCULATOR_SCHEME_BASE + type + (withBar ? "-bar" : "") + ".svg";
    }

    function updateCustomPanel() {
      if (!customPanel || !customToggle) return;
      customPanel.hidden = !customToggle.classList.contains("is-active");
    }

    groups.forEach(function (group) {
      var tabs = Array.prototype.slice.call(group.querySelectorAll(".calculator__tab"));
      var multiple = group.dataset.select === "multiple";

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          if (multiple) {
            tab.classList.toggle("is-active");
          } else {
            if (tab.classList.contains("is-active")) return;
            tabs.forEach(function (t) {
              t.classList.toggle("is-active", t === tab);
            });
          }

          if (group === typeGroup) updateScheme();
          if (tab === customToggle) updateCustomPanel();
        });
      });
    });

    if (barInput) {
      barInput.addEventListener("change", updateScheme);
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        groups.forEach(function (group) {
          var tabs = Array.prototype.slice.call(group.querySelectorAll(".calculator__tab"));
          var multiple = group.dataset.select === "multiple";
          tabs.forEach(function (tab, i) {
            tab.classList.toggle("is-active", multiple ? tab === customToggle : i === 0);
          });
        });

        if (barInput) barInput.checked = false;
        updateScheme();
        updateCustomPanel();

        var dimInputs = calculator.querySelectorAll(".calculator__dims input");
        if (dimInputs[0]) dimInputs[0].value = "3890";
        if (dimInputs[1]) dimInputs[1].value = "";

        var customInput = customPanel && customPanel.querySelector("input");
        if (customInput) customInput.value = "";

        var textarea = calculator.querySelector(".calculator__textarea");
        if (textarea) textarea.value = "";
      });
    }

    updateCustomPanel();
    updateScheme();
  }

  document.querySelectorAll(".calculator").forEach(initCalculator);
})();

(function () {
  // Per-card photo browser — a small slider nested inside the outer
  // Swiper carousel. .portfolio-card__photos holds every photo as a real
  // <img>, laid out in a row; the arrows translateX it by one slide
  // width, so switching photos visibly pages like a slider instead of
  // cross-dissolving.
  function initPortfolioCardMedia(media) {
    var photos = media.querySelector(".portfolio-card__photos");
    var images = Array.prototype.slice.call(photos.querySelectorAll("img"));
    if (images.length < 2) return;

    var index = 0;

    function show(i) {
      index = (i + images.length) % images.length;
      photos.style.transform = "translateX(-" + index * 100 + "%)";
    }

    var prevBtn = media.querySelector(".portfolio-card__img-nav--prev");
    var nextBtn = media.querySelector(".portfolio-card__img-nav--next");

    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        show(index - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        show(index + 1);
      });
    }

    // Belt-and-suspenders against "save image": pointer-events:none on
    // the <img>s (see _portfolio.scss) already keeps the cursor's hit
    // target off real image content, but block the context menu outright
    // too in case a browser still offers to save/copy from here.
    media.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  document.querySelectorAll(".portfolio-card__media").forEach(initPortfolioCardMedia);

  function initPortfolio(section) {
    var swiperEl = section.querySelector(".portfolio-swiper");
    if (!swiperEl) return;

    var prevBtn = section.querySelector(".portfolio-nav--prev");
    var nextBtn = section.querySelector(".portfolio-nav--next");

    // Below 768px: "auto" + the fixed 296px card width in CSS gives a
    // peeking mobile card; 768–991.98px is still "auto" but with a fixed
    // 416px tablet card (see _portfolio.scss) — the nav is hidden at both
    // of these tiers anyway. From 992px, numeric slidesPerView takes over
    // and Swiper sizes each slide itself (stretched to exactly fill the
    // row): 2.5-up, then 3-up once there's enough room for the full
    // 1280px/416px-card layout.
    new Swiper(swiperEl, {
      slidesPerView: "auto",
      spaceBetween: 16,
      speed: 450,
      loop: true,
      wrapperClass: "portfolio-cards",
      slideClass: "portfolio-card",
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn,
      },
      pagination: {
        el: section.querySelector(".portfolio-dots"),
        clickable: true,
      },
      breakpoints: {
        992: { slidesPerView: 2.5, spaceBetween: 16 },
        1327: { slidesPerView: 3, spaceBetween: 16 },
      },
    });
  }

  document.querySelectorAll(".portfolio").forEach(initPortfolio);
})();

(function () {
  // SliderSection (Карточка материала): same "auto" width / numeric
  // slidesPerView split as .portfolio-swiper, just a plain photo slide
  // instead of a whole card.
  function initMaterialSlider(section) {
    var swiperEl = section.querySelector(".material-slider__viewport");
    if (!swiperEl) return;

    var prevBtn = section.querySelector(".material-slider__nav--prev");
    var nextBtn = section.querySelector(".material-slider__nav--next");

    // Same options as initMaterials' .materials-swiper (home.html) —
    // loop needs at least slidesPerView*2 real slides to work, which is
    // why the page carries 6 photos for a desktop slidesPerView of 3.
    new Swiper(swiperEl, {
      slidesPerView: "auto",
      spaceBetween: 16,
      speed: 450,
      loop: true,
      wrapperClass: "material-slider__track",
      slideClass: "material-slider__slide",
      navigation: {
        nextEl: nextBtn,
        prevEl: prevBtn,
      },
      pagination: {
        el: section.querySelector(".material-slider__dots"),
        clickable: true,
      },
      breakpoints: {
        992: { slidesPerView: 3, spaceBetween: 16 },
      },
    });
  }

  document.querySelectorAll(".material-slider").forEach(initMaterialSlider);
})();

(function () {
  // Каталог page: one tab bar (reusing .materials__tabs/.materials__tab's
  // pill styling) toggles between the "по комнате" and "по мебели"
  // panels — plain hidden-attribute show/hide, no Swiper involved, so
  // it's simpler than initMaterials/initCatalog and doesn't share their
  // section scoping.
  function initCatalogSwitch(section) {
    var tabs = Array.prototype.slice.call(section.querySelectorAll("[data-catalog-switch-tab]"));
    var panels = Array.prototype.slice.call(section.querySelectorAll("[data-catalog-switch-panel]"));

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.classList.contains("is-active")) return;

        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });

        var target = tab.dataset.catalogSwitchTab;
        panels.forEach(function (panel) {
          panel.hidden = panel.dataset.catalogSwitchPanel !== target;
        });
      });
    });
  }

  document.querySelectorAll(".catalog-switch").forEach(initCatalogSwitch);
})();

(function () {
  // Same markup for every breakpoint — a real Swiper instance only
  // exists below 768px; at 768px+ it's destroyed entirely and plain CSS
  // grid (see .features__grid's own breakpoints in _features.scss) owns
  // the layout. This used to be one Swiper instance left alive the whole
  // time, toggled via its own `enabled` breakpoint instead — but
  // resizing down across 768px (desktop -> mobile width, no reload)
  // left it "enabled" again per Swiper's own state, yet not actually
  // re-listening for touch/pointer input, so swipe silently stopped
  // working until the next full page load re-ran everything from
  // scratch. Destroying and constructing a fresh instance on every
  // crossing sidesteps that re-enable path completely.
  var FEATURES_DESKTOP_QUERY = "(min-width: 768px)";

  function initFeatures(section) {
    var swiperEl = section.querySelector(".features-swiper");
    if (!swiperEl) return;

    var swiper = null;

    // 1.1 (not "auto") is what makes the mobile card stretch to fill
    // the container instead of sitting at a fixed px width — Swiper
    // sets each slide's width inline as a share of the container,
    // peeking the next one at the edge without any manual bleed math
    // (and without ever growing the page's own scrollWidth, since it
    // all stays inside .features-swiper's overflow:hidden). That 1.1
    // is only right for true small phones though — held all the way up
    // to 767.98px it turned into a single giant near-full-width square
    // (aspect-ratio:1/1 on a ~600-700px-wide card) on wider "adaptive"
    // phones/small tablets, so 576px+ steps up to ~2.3 cards per view,
    // keeping each one a reasonably-sized square instead.
    function build() {
      var isDesktop = window.matchMedia(FEATURES_DESKTOP_QUERY).matches;
      if (swiper) {
        swiper.destroy(true, true);
        swiper = null;
      }
      if (isDesktop) return;

      swiper = new Swiper(swiperEl, {
        slidesPerView: 1.1,
        spaceBetween: 16,
        speed: 450,
        wrapperClass: "features__grid",
        slideClass: "features__item",
        pagination: {
          el: section.querySelector(".features-dots"),
          clickable: true,
        },
        breakpoints: {
          576: { slidesPerView: 2.3, spaceBetween: 16 },
        },
      });
    }

    build();

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    });
  }

  document.querySelectorAll(".features").forEach(initFeatures);
})();

(function () {
  // MaterialsSection: same fixed-width-peeking-card technique as
  // .portfolio-cards (slidesPerView:"auto" + a fixed CSS card width, not
  // a fluid one), plus a tab row that swaps which panel's Swiper is
  // visible — one real Swiper instance per panel, both built up front,
  // so switching tabs is just a hidden-attribute toggle + telling the
  // now-visible one to recompute its layout (Swiper miscalculates sizes
  // while its container is display:none).
  function initMaterials(section) {
    var tabs = Array.prototype.slice.call(section.querySelectorAll(".materials__tab"));
    var panels = Array.prototype.slice.call(section.querySelectorAll("[data-materials-panel]"));

    panels.forEach(function (panel) {
      var swiperEl = panel.querySelector(".materials-swiper");
      if (!swiperEl) return;

      panel._swiper = new Swiper(swiperEl, {
        slidesPerView: "auto",
        spaceBetween: 16,
        speed: 450,
        loop: true,
        wrapperClass: "materials-cards",
        slideClass: "materials-card",
        navigation: {
          nextEl: panel.querySelector(".materials-nav--next"),
          prevEl: panel.querySelector(".materials-nav--prev"),
        },
        pagination: {
          el: panel.querySelector(".materials-dots"),
          clickable: true,
        },
        // 992–1279.98px ("small desktop/laptop", nav arrows already
        // visible there): 4 fixed-308px cards don't fit. 3 (not 3.2)
        // makes Swiper size each slide as an exact 1/3 share of the
        // container instead (inline width, overriding the CSS 308px) —
        // 3 cards fill the whole row, no 4th peeking. Full desktop
        // (1280px+, where 4 real cards fit exactly per Figma) reverts
        // to "auto" so cards go back to their fixed width.
        breakpoints: {
          992: { slidesPerView: 3 },
          1280: { slidesPerView: "auto" },
        },
      });
    });

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.classList.contains("is-active")) return;

        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });

        var target = tab.dataset.materialsTab;
        panels.forEach(function (panel) {
          var visible = panel.dataset.materialsPanel === target;
          panel.hidden = !visible;
          if (visible && panel._swiper) panel._swiper.update();
        });
      });
    });
  }

  document.querySelectorAll(".materials").forEach(initMaterials);
})();

(function () {
  // Per-card photo/video browser — identical to
  // initPortfolioCardMedia below, plus hiding the video play button
  // once its slide (always index 0) has been paged away from.
  function initReviewsCardMedia(media) {
    var photos = media.querySelector(".reviews-card__photos");
    var images = Array.prototype.slice.call(photos.querySelectorAll("img"));
    var playBtn = media.querySelector(".reviews-card__play");
    if (images.length < 2) return;

    var index = 0;

    function show(i) {
      index = (i + images.length) % images.length;
      photos.style.transform = "translateX(-" + index * 100 + "%)";
      if (playBtn) playBtn.style.display = index === 0 ? "flex" : "none";
    }

    var prevBtn = media.querySelector(".reviews-card__img-nav--prev");
    var nextBtn = media.querySelector(".reviews-card__img-nav--next");

    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        show(index - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        show(index + 1);
      });
    }

    media.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
  }

  document.querySelectorAll(".reviews-card__media").forEach(initReviewsCardMedia);

  // ReviewsSection: same slider as .portfolio-cards — "auto"
  // slidesPerView + a fixed CSS card width below 992px, numeric
  // slidesPerView (cards stretch to fill the row) above it; nav
  // hidden below 992px, same breakpoint as .portfolio-nav's.
  function initReviews(section) {
    var swiperEl = section.querySelector(".reviews-swiper");
    if (swiperEl) {
      new Swiper(swiperEl, {
        slidesPerView: "auto",
        spaceBetween: 16,
        speed: 450,
        loop: true,
        wrapperClass: "reviews-cards",
        slideClass: "reviews-card",
        navigation: {
          nextEl: section.querySelector(".reviews-nav--next"),
          prevEl: section.querySelector(".reviews-nav--prev"),
        },
        pagination: {
          el: section.querySelector(".reviews-dots"),
          clickable: true,
        },
        breakpoints: {
          992: { slidesPerView: 2.5, spaceBetween: 16 },
          1327: { slidesPerView: 3, spaceBetween: 16 },
        },
      });
    }

    // "Развернуть"/"Свернуть" — max-height transitions between the
    // CSS's 4-line collapsed value and the text's real measured height,
    // smoothly both ways (see .reviews-card__text in _reviews.scss).
    var toggles = section.querySelectorAll(".reviews-card__toggle");
    toggles.forEach(function (toggle) {
      var text = toggle.previousElementSibling;
      toggle.addEventListener("click", function () {
        var expanded = text.classList.toggle("is-expanded");
        text.style.maxHeight = expanded ? text.scrollHeight + "px" : "";
        toggle.textContent = expanded ? "Свернуть" : "Развернуть";
      });
    });
  }

  document.querySelectorAll(".reviews").forEach(initReviews);
})();

(function () {
  // FAQSection: single-open accordion — opening one closes whichever
  // else was open, matching Figma's default of exactly one expanded.
  function initFaq(section) {
    var items = Array.prototype.slice.call(section.querySelectorAll("[data-faq-item]"));

    items.forEach(function (item) {
      var head = item.querySelector(".faq-item__head");
      head.addEventListener("click", function () {
        var wasOpen = item.classList.contains("is-open");
        items.forEach(function (other) {
          other.classList.remove("is-open");
          other.querySelector(".faq-item__head").setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          item.classList.add("is-open");
          head.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  document.querySelectorAll(".faq").forEach(initFaq);
})();

(function () {
  // FooterSection nav columns: independent toggles (unlike FAQ, any
  // number can be open at once) — only meaningful on mobile, where CSS
  // turns each column into a collapsible accordion row; desktop forces
  // every column open regardless of .is-open via its own media query.
  function initFooterCol(col) {
    var head = col.querySelector(".footer-col__head");
    head.addEventListener("click", function () {
      var isOpen = col.classList.toggle("is-open");
      head.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-footer-col]").forEach(initFooterCol);
})();

(function () {
  // ContactSection map: real Yandex Maps JS API instance (see the
  // <script src="https://api-maps.yandex.ru/..."> tag) with a custom
  // brand-gold pin instead of the stock preset markers the plain
  // iframe embed was limited to. scrollZoom starts disabled so
  // scrolling the page past the map doesn't hijack it into zooming —
  // a click enables it for as long as the cursor stays over the map,
  // mouseleave disables it again for the next time the page scrolls by.
  function initContactMap(canvas) {
    if (typeof ymaps === "undefined") return;

    ymaps.ready(function () {
      var center = [parseFloat(canvas.dataset.lat), parseFloat(canvas.dataset.lon)];
      var zoom = parseInt(canvas.dataset.zoom, 10) || 15;

      var map = new ymaps.Map(canvas, {
        center: center,
        zoom: zoom,
        controls: ["zoomControl"],
      });

      map.behaviors.disable("scrollZoom");

      canvas.addEventListener("click", function () {
        map.behaviors.enable("scrollZoom");
      });
      canvas.addEventListener("mouseleave", function () {
        map.behaviors.disable("scrollZoom");
      });

      var placemark = new ymaps.Placemark(center, {}, {
        iconLayout: "default#image",
        iconImageHref: "assets/icons/pin.svg",
        iconImageSize: [64, 64],
        iconImageOffset: [-32, -64],
      });

      map.geoObjects.add(placemark);
    });
  }

  document.querySelectorAll("[data-map-canvas]").forEach(initContactMap);
})();

(function () {
  // "Желаемые дата и время" (.input-field--select, hero-cta's form and
  // the product page's final CTA): a real month calendar opens above
  // the trigger on click. No weekday header row — matches Figma, which
  // starts the grid straight at day 1, so the leading empty cells are
  // the only thing establishing which weekday column it falls in.
  var MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var MONTHS_NOMINATIVE = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  function initDateSelect(trigger) {
    var span = trigger.querySelector("span");
    var viewDate = new Date();
    viewDate.setDate(1);
    var selected = null;
    var timeValue = "";
    var popup = null;

    function daysInMonth(y, m) {
      return new Date(y, m + 1, 0).getDate();
    }

    // Monday=0 ... Sunday=6, so a Ru calendar's leading gap is just this.
    function mondayIndex(date) {
      return (date.getDay() + 6) % 7;
    }

    function isSameDay(a, b) {
      return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function outsideClick(e) {
      if (popup && !trigger.contains(e.target)) closePopup();
    }

    function onEscape(e) {
      if (e.key === "Escape") closePopup();
    }

    function closePopup() {
      if (!popup) return;
      popup.remove();
      popup = null;
      document.removeEventListener("click", outsideClick);
      document.removeEventListener("keydown", onEscape);
    }

    function render() {
      var y = viewDate.getFullYear();
      var m = viewDate.getMonth();
      var total = daysInMonth(y, m);
      var startOffset = mondayIndex(new Date(y, m, 1));
      var today = new Date();

      var html = "";
      var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      html += '<div class="date-picker__head">';
      html += '<button type="button" class="date-picker__nav-btn date-picker__nav-btn--prev" aria-label="Предыдущий месяц"><svg class="icon"><use href="assets/icons/sprite.svg#angle-down"></use></svg></button>';
      html += '<p class="date-picker__month">' + MONTHS_NOMINATIVE[m] + "</p>";
      html += '<button type="button" class="date-picker__nav-btn date-picker__nav-btn--next" aria-label="Следующий месяц"><svg class="icon"><use href="assets/icons/sprite.svg#angle-down"></use></svg></button>';
      html += "</div>";

      html += '<div class="date-picker__grid"><div class="date-picker__row">';
      var cellsInRow = 0;
      for (var i = 0; i < startOffset; i++) {
        html += '<div class="date-picker__cell"></div>';
        cellsInRow++;
      }
      for (var day = 1; day <= total; day++) {
        if (cellsInRow === 7) {
          html += '</div><div class="date-picker__row">';
          cellsInRow = 0;
        }
        var cellDate = new Date(y, m, day);
        var isWeekend = mondayIndex(cellDate) >= 5;
        var isToday = isSameDay(cellDate, today);
        var isSelected = isSameDay(cellDate, selected);
        var isPast = cellDate < todayStart;
        var cls = "date-picker__day";
        // Past dates read as unavailable (can't schedule a visit
        // behind you) — muted for weekdays, the same dimmer weekend
        // red at 0.64 opacity. Upcoming dates are full-contrast:
        // regular text for weekdays, solid --color-critical for
        // weekends (a stronger warning since those are actually
        // bookable), per Figma.
        if (isSelected) cls += " is-selected";
        else if (isToday) cls += " date-picker__day--today";
        else if (isPast && isWeekend) cls += " date-picker__day--weekend-past";
        else if (isPast) cls += " date-picker__day--muted";
        else if (isWeekend) cls += " date-picker__day--weekend";
        html += '<div class="date-picker__cell"><button type="button" class="' + cls + '" data-day="' + day + '"' + (isPast ? " disabled" : "") + ">" + day + "</button></div>";
        cellsInRow++;
      }
      html += "</div></div>";

      html += '<div class="date-picker__label-row"><p class="date-picker__label">Укажите желаемое время</p></div>';
      html += '<div class="date-picker__form">';
      html += '<input type="text" class="date-picker__time" placeholder="__ : __" inputmode="numeric" maxlength="5" value="' + timeValue + '">';
      html += '<button type="button" class="btn btn-stroke rounded-pill date-picker__confirm"' + (selected ? "" : " disabled") + ">Подтвердить</button>";
      html += "</div>";

      popup.innerHTML = html;
      wireEvents();
    }

    function wireEvents() {
      popup.querySelector(".date-picker__nav-btn--prev").addEventListener("click", function (e) {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() - 1);
        render();
      });
      popup.querySelector(".date-picker__nav-btn--next").addEventListener("click", function (e) {
        e.stopPropagation();
        viewDate.setMonth(viewDate.getMonth() + 1);
        render();
      });

      Array.prototype.forEach.call(popup.querySelectorAll(".date-picker__day"), function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), parseInt(btn.dataset.day, 10));
          render();
        });
      });

      var timeInput = popup.querySelector(".date-picker__time");
      timeInput.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      timeInput.addEventListener("input", function () {
        var digits = timeInput.value.replace(/\D/g, "").slice(0, 4);
        timeValue = digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
        timeInput.value = timeValue;
      });

      popup.querySelector(".date-picker__confirm").addEventListener("click", function (e) {
        e.stopPropagation();
        if (!selected) return;
        var label = selected.getDate() + " " + MONTHS_GENITIVE[selected.getMonth()];
        if (timeValue.length === 5) label += ", " + timeValue;
        span.textContent = label;
        trigger.classList.add("is-filled");
        closePopup();
      });
    }

    function openPopup() {
      if (popup) return;
      popup = document.createElement("div");
      popup.className = "date-picker";
      popup.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      trigger.appendChild(popup);
      render();
      document.addEventListener("click", outsideClick);
      document.addEventListener("keydown", onEscape);
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (popup) closePopup();
      else openPopup();
    });
  }

  document.querySelectorAll(".input-field--select").forEach(initDateSelect);
})();

(function () {
  // Header's "Каталог" dropdown — desktop only (≥992px, matching the
  // trigger's own d-lg-inline-flex visibility). Built once and shared
  // across every page's identical header; the panel is fixed right
  // under it, positioned once on open (the header is itself
  // position:sticky top:0, so its own bottom edge never moves once
  // scrolled — no need to recompute on scroll, only on resize).
  var DESKTOP_QUERY = "(min-width: 992px)";

  var trigger = document.querySelector("[data-catalog-menu-trigger]");
  if (!trigger) return;

  var header = document.querySelector(".header");
  var panel = null;

  function build() {
    var el = document.createElement("div");
    el.className = "menu-catalog";
    el.innerHTML =
      '<div class="menu-catalog__inner">' +
      '<div class="menu-catalog__groups">' +
      '<div class="menu-catalog__group">' +
      '<p class="menu-catalog__group-title">Кухни под заказ</p>' +
      '<div class="menu-catalog__cols">' +
      '<div class="menu-catalog__col">' +
      '<a href="catalog.html">П-образные</a>' +
      '<a href="catalog.html">Прямые</a>' +
      '<a href="catalog.html">Паралельные</a>' +
      '<a href="catalog.html">С островом</a>' +
      '<a href="catalog.html">С барной стойкой</a>' +
      "</div>" +
      '<div class="menu-catalog__col">' +
      '<a href="catalog.html">Современные</a>' +
      '<a href="catalog.html">Модерн</a>' +
      '<a href="catalog.html">Классические</a>' +
      '<a href="catalog.html">Лофт</a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="menu-catalog__group">' +
      '<p class="menu-catalog__group-title">Мебель для хранения</p>' +
      '<div class="menu-catalog__cols">' +
      '<div class="menu-catalog__col">' +
      '<a href="catalog.html">Распашной шкаф</a>' +
      '<a href="catalog.html">Шкаф-купе</a>' +
      '<a href="catalog.html">Угловой шкаф</a>' +
      '<a href="catalog.html">Книжный шкаф</a>' +
      '<a href="catalog.html">Детский шкаф</a>' +
      "</div>" +
      '<div class="menu-catalog__col">' +
      '<a href="catalog.html">Стеллаж</a>' +
      '<a href="catalog.html">Тумба для ТВ</a>' +
      '<a href="catalog.html">Гардеробная система</a>' +
      '<a href="catalog.html">Прихожая</a>' +
      '<a href="catalog.html">Комод</a>' +
      '<a href="catalog.html">Тумба</a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<a href="catalog.html" class="menu-catalog__all">Смотреть весь каталог</a>' +
      "</div>";
    document.body.appendChild(el);
    return el;
  }

  function position() {
    panel.style.top = header.getBoundingClientRect().bottom + "px";
  }

  function open() {
    if (!panel) panel = build();
    position();
    panel.classList.add("is-open");
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("is-open");
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("keydown", onEscape);
  }

  function isOpen() {
    return !!panel && panel.classList.contains("is-open");
  }

  function onOutsideClick(e) {
    if (isOpen() && !panel.contains(e.target) && !trigger.contains(e.target)) close();
  }

  function onEscape(e) {
    if (e.key === "Escape") close();
  }

  trigger.addEventListener("click", function (e) {
    if (!window.matchMedia(DESKTOP_QUERY).matches) return;
    e.preventDefault();
    e.stopPropagation();
    if (isOpen()) close();
    else open();
  });

  window.addEventListener("resize", function () {
    if (!window.matchMedia(DESKTOP_QUERY).matches) close();
    else if (isOpen()) position();
  });
})();

// Shared by both the desktop/tablet search panel and the mobile
// hamburger menu's own inline search — same result list either way.
var SEARCH_INDEX = [
  { title: "П-образная кухня", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Прямая кухня", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Угловая кухня", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Кухня с островом", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Параллельная кухня", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Кухня с барной стойкой", href: "catalog.html", img: "assets/catalog-page/room-kitchen.jpg" },
  { title: "Каталог", href: "catalog.html" },
  { title: "Наши работы", href: "projects.html" },
  { title: "О компании", href: "about.html" },
  { title: "Контакты", href: "contacts.html" },
  { title: "Акции", href: "stocks.html" },
  { title: "Отзывы", href: "reviews.html" },
  { title: "Материалы и аксессуары", href: "materials.html" },
  { title: "Калькулятор", href: "calc.html" },
];

function renderSearchResults(container, query) {
  var q = query.trim().toLowerCase();
  var matches = SEARCH_INDEX.filter(function (item) {
    return !q || item.title.toLowerCase().indexOf(q) !== -1;
  });

  if (!matches.length) {
    container.innerHTML = '<p class="search-empty">Ничего не найдено</p>';
    return;
  }

  container.innerHTML = matches
    .map(function (item) {
      var img = item.img
        ? '<span class="search-item__img"><img src="' + item.img + '" alt="" loading="lazy"></span>'
        : "";
      return '<a href="' + item.href + '" class="search-item">' + img + '<span class="search-item__title">' + item.title + "</span></a>";
    })
    .join("");
}

(function () {
  // Hamburger menu (tablet/mobile, <1200px — the trigger is
  // .icon-btn--menu, d-flex d-xl-none). The real header stays exactly
  // as-is (sticky, on top, fully interactive) when this opens — no
  // duplicate header markup here anymore, just the trigger's own icon
  // swapping to a close cross. The panel itself is fixed right under
  // the header, same "measure header.getBoundingClientRect().bottom"
  // technique as .menu-catalog/.search-panel. Same content as the
  // footer's own Кухни/Шкафы/Разделы/Компания columns, just restyled
  // light — see .mobile-menu__col below for the accordion mechanics
  // (same grid-template-rows technique as .footer-col, new class
  // names since the color scheme is the opposite of the footer's
  // dark one).
  var trigger = document.querySelector(".icon-btn--menu");
  if (!trigger) return;

  var triggerIcon = trigger.querySelector("use");
  var header = document.querySelector(".header");
  var panel = null;

  function col(title, items, defaultOpen) {
    var body = items
      .map(function (item) {
        return '<a href="' + item[1] + '" class="mobile-menu__col-item">' + item[0] + "</a>";
      })
      .join("");
    return (
      '<div class="mobile-menu__col' + (defaultOpen ? " is-open" : "") + '" data-mobile-menu-col>' +
      '<button type="button" class="mobile-menu__col-head" aria-expanded="' + (defaultOpen ? "true" : "false") + '">' +
      "<span>" + title + "</span>" +
      '<svg class="icon mobile-menu__col-chevron"><use href="assets/icons/sprite.svg#angle-down"></use></svg>' +
      "</button>" +
      '<div class="mobile-menu__col-body"><div>' + body + "</div></div>" +
      "</div>"
    );
  }

  function build() {
    var el = document.createElement("div");
    el.className = "mobile-menu";
    el.innerHTML =
      '<div class="mobile-menu__search">' +
      '<input type="text" placeholder="Начните поиск">' +
      '<svg class="icon mobile-menu__search-icon"><use href="assets/icons/sprite.svg#search"></use></svg>' +
      '<button type="button" class="mobile-menu__search-clear" aria-label="Очистить поиск">' +
      '<svg class="icon"><use href="assets/icons/sprite.svg#close-thin"></use></svg>' +
      "</button>" +
      "</div>" +
      '<div class="mobile-menu__search-results search-results"></div>' +
      '<div class="mobile-menu__body">' +
      col("Кухни", [
        ["П-образные", "#"], ["Прямые", "#"], ["Угловые", "#"],
        ["С островом", "#"], ["Паралельные", "#"], ["С барной стойкой", "#"],
      ], true) +
      col("Шкафы", [
        ["В гостинную", "#"], ["В спальню", "#"], ["В прихожую", "#"], ["В санузел", "#"],
      ]) +
      col("Разделы", [
        ["Материалы и аксессуары", "materials.html"], ["Калькулятор", "calc.html"],
        ["Наши работы", "projects.html"], ["Акции", "stocks.html"],
        ["Кредит", "#"], ["Дизайнерам", "#"],
      ]) +
      col("Компания", [["О нас", "about.html"], ["Контакты", "contacts.html"]]) +
      "</div>" +
      '<div class="mobile-menu__contact">' +
      '<p class="mobile-menu__phone">+7 (927) 011-27-93</p>' +
      '<p class="mobile-menu__email">info@samara.kitchen</p>' +
      '<div class="mobile-menu__messengers">' +
      '<a href="#" aria-label="WhatsApp"><img src="assets/icons/whatsapp.svg" width="24" height="24" alt=""></a>' +
      '<a href="#" aria-label="MAX"><img src="assets/icons/max.svg" width="24" height="24" alt=""></a>' +
      '<a href="#" aria-label="Telegram"><img src="assets/icons/telegram.svg" width="24" height="24" alt=""></a>' +
      "</div>" +
      '<button type="button" class="btn btn-primary rounded-pill" data-call-popup-trigger>Бесплатный замер</button>' +
      "</div>";

    document.body.appendChild(el);

    var searchWrap = el.querySelector(".mobile-menu__search");
    var searchInput = searchWrap.querySelector("input");
    var searchResults = el.querySelector(".mobile-menu__search-results");
    searchInput.addEventListener("input", function () {
      var hasQuery = searchInput.value.trim().length > 0;
      searchWrap.classList.toggle("has-query", hasQuery);
      searchResults.classList.toggle("is-open", hasQuery);
      if (hasQuery) renderSearchResults(searchResults, searchInput.value);
    });

    searchWrap.querySelector(".mobile-menu__search-clear").addEventListener("click", function () {
      searchInput.value = "";
      searchWrap.classList.remove("has-query");
      searchResults.classList.remove("is-open");
      searchInput.focus();
    });

    Array.prototype.forEach.call(el.querySelectorAll("[data-mobile-menu-col]"), function (colEl) {
      var head = colEl.querySelector(".mobile-menu__col-head");
      head.addEventListener("click", function () {
        var isOpenCol = colEl.classList.toggle("is-open");
        head.setAttribute("aria-expanded", isOpenCol ? "true" : "false");
      });
    });

    return el;
  }

  function position() {
    if (panel) panel.style.top = header.getBoundingClientRect().bottom + "px";
  }

  function open() {
    if (!panel) panel = build();
    position();
    panel.classList.add("is-open");
    document.body.style.overflow = "hidden";
    triggerIcon.setAttribute("href", "assets/icons/sprite.svg#close-thin");
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("is-open");
    document.body.style.overflow = "";
    triggerIcon.setAttribute("href", "assets/icons/sprite.svg#hamburger");
  }

  trigger.addEventListener("click", function () {
    if (panel && panel.classList.contains("is-open")) close();
    else open();
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 1200px)").matches) close();
    else position();
  });
})();

(function () {
  // Header's "О компании" dropdown — the nav item itself is already
  // d-none d-xl-flex, so no breakpoint guard is needed here.
  var trigger = document.querySelector("[data-about-dropdown-trigger]");
  if (!trigger) return;

  var LINKS = [
    ["О нас", "about.html"],
    ["Отзывы", "reviews.html"],
    ["Акции", "stocks.html"],
    ["Кредит", "#"],
    ["Дизайнерам", "#"],
  ];

  var panel = document.createElement("div");
  panel.className = "about-dropdown";
  panel.innerHTML = LINKS.map(function (item) {
    return '<a href="' + item[1] + '">' + item[0] + "</a>";
  }).join("");
  trigger.appendChild(panel);

  function close() {
    panel.classList.remove("is-open");
    document.removeEventListener("click", onOutsideClick);
    document.removeEventListener("keydown", onEscape);
  }

  function onOutsideClick(e) {
    if (!trigger.contains(e.target)) close();
  }

  function onEscape(e) {
    if (e.key === "Escape") close();
  }

  trigger.addEventListener("click", function (e) {
    e.preventDefault();
    if (panel.classList.contains("is-open")) {
      close();
      return;
    }
    panel.classList.add("is-open");
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  });
})();

(function () {
  // Back-to-top button (desktop/tablet) + the mobile tapbar's own up
  // button share this same smooth-scroll behavior.
  function scrollToTop(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  var top = document.createElement("button");
  top.type = "button";
  top.className = "back-to-top";
  top.setAttribute("aria-label", "Наверх");
  top.innerHTML = '<svg class="icon"><use href="assets/icons/sprite.svg#angle-down"></use></svg>';
  top.querySelector(".icon").style.transform = "rotate(180deg)";
  top.addEventListener("click", scrollToTop);
  document.body.appendChild(top);

  var tapbar = document.createElement("div");
  tapbar.className = "tapbar";
  tapbar.innerHTML =
    '<button type="button" class="tapbar__up" aria-label="Наверх">' +
    '<svg class="icon"><use href="assets/icons/sprite.svg#angle-down"></use></svg>' +
    "</button>" +
    '<a href="tel:+79270112793" class="tapbar__call">+7 (927) 011-27-93</a>';
  tapbar.querySelector(".icon").style.transform = "rotate(180deg)";
  tapbar.querySelector(".tapbar__up").addEventListener("click", scrollToTop);
  document.body.appendChild(tapbar);

  // Both fade in (the tapbar also slides up) once scrolled past
  // whatever the page's first section is (the element right after the
  // header) and back out above it — .back-to-top on desktop/tablet,
  // .tapbar on real mobile. The tapbar gets a slightly earlier
  // threshold (80% of the way through that section) so it shows up a
  // beat sooner than .back-to-top would.
  var header = document.querySelector(".header");
  var firstSection = header && header.nextElementSibling;
  var threshold = 0;
  var tapbarThreshold = 0;

  function computeThreshold() {
    threshold = firstSection ? firstSection.offsetTop + firstSection.offsetHeight : 0;
    tapbarThreshold = firstSection ? firstSection.offsetTop + firstSection.offsetHeight * 0.8 : 0;
  }

  function onScroll() {
    top.classList.toggle("is-visible", window.scrollY > threshold);
    tapbar.classList.toggle("is-visible", window.scrollY > tapbarThreshold);
  }

  computeThreshold();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", computeThreshold);
})();

(function () {
  // "Заказать звонок" popup — opens off the header's "Бесплатный
  // замер" buttons (data-call-popup-trigger, both the tablet-actions
  // and desktop-actions instances on every page).
  var triggers = document.querySelectorAll("[data-call-popup-trigger]");
  if (!triggers.length) return;

  var overlay = document.createElement("div");
  overlay.className = "call-popup-overlay";
  overlay.innerHTML =
    '<div class="call-popup">' +
    '<button type="button" class="call-popup__close" aria-label="Закрыть">' +
    '<svg class="icon"><use href="assets/icons/sprite.svg#close-thin"></use></svg>' +
    "</button>" +
    '<div class="call-popup__head">' +
    '<h3 class="call-popup__title">Заказать звонок</h3>' +
    '<p class="call-popup__subtitle">Заполните форму и мы свяжемся с Вами в ближайшее время</p>' +
    "</div>" +
    '<form class="call-popup__form">' +
    '<div class="input-field">' +
    '<input type="text" placeholder="Ваше имя" aria-label="Ваше имя" required>' +
    '<svg class="icon"><use href="assets/icons/sprite.svg#user"></use></svg>' +
    "</div>" +
    '<div class="input-field">' +
    '<input type="tel" placeholder="Ваш телефон" aria-label="Ваш телефон" required>' +
    '<svg class="icon"><use href="assets/icons/sprite.svg#call"></use></svg>' +
    "</div>" +
    '<button type="submit" class="btn btn-primary call-popup__submit">Отправить заявку</button>' +
    "</form>" +
    '<label class="checkbox-field call-popup__consent">' +
    '<input type="checkbox" class="checkbox-field__input" required>' +
    '<span class="checkbox-field__box"><svg class="icon icon--16"><use href="assets/icons/sprite.svg#check"></use></svg></span>' +
    '<span class="call-popup__consent-text">Я даю с<a href="#">огласие на обработку своих персональных данных</a> в соответствии с <a href="#">Политикой защиты и обработки персональных данных</a></span>' +
    "</label>" +
    "</div>";
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.removeEventListener("keydown", onEscape);
  }

  function open() {
    overlay.classList.add("is-open");
    // Locking scroll removes the (desktop) scrollbar, which shrinks the
    // viewport and shifts the whole page right — pad body by exactly
    // that width so nothing jumps.
    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + "px";
    document.addEventListener("keydown", onEscape);
  }

  function onEscape(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".call-popup__close").addEventListener("click", close);

  // Delegated rather than bound directly to `triggers`: the mobile
  // menu's own two "Бесплатный замер" buttons carry this same
  // attribute but don't exist yet at this point (built lazily on the
  // hamburger's first open), so a one-time querySelectorAll would
  // miss them.
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-call-popup-trigger]");
    if (!trigger) return;
    e.preventDefault();
    open();
  });
})();

(function () {
  // Header search — desktop/tablet only (≥576px, [data-search-trigger]
  // covers both the tablet-actions icon button and the bottom-line's
  // text+icon link; real mobile uses .mobile-menu__search's own inline
  // input instead, wired up above). Fixed right under the header, same
  // positioning technique as .menu-catalog.
  var triggers = document.querySelectorAll("[data-search-trigger]");
  if (!triggers.length) return;

  var header = document.querySelector(".header");
  var panel = null;

  function build() {
    var el = document.createElement("div");
    el.className = "search-panel";
    el.innerHTML =
      '<div class="search-panel__head"><div class="search-panel__head-inner">' +
      '<input type="text" class="search-panel__input" placeholder="Начните поиск">' +
      '<button type="button" class="search-panel__close">' +
      "<span>Закрыть</span>" +
      '<svg class="icon"><use href="assets/icons/sprite.svg#close-thin"></use></svg>' +
      "</button>" +
      "</div></div>" +
      '<div class="search-panel__body"><div class="search-results"></div></div>';
    document.body.appendChild(el);

    var input = el.querySelector(".search-panel__input");
    var results = el.querySelector(".search-results");
    input.addEventListener("input", function () {
      renderSearchResults(results, input.value);
    });

    el.querySelector(".search-panel__close").addEventListener("click", close);

    return el;
  }

  function position() {
    panel.style.top = header.getBoundingClientRect().bottom + "px";
  }

  function open() {
    if (!panel) panel = build();
    position();
    renderSearchResults(panel.querySelector(".search-results"), "");
    panel.classList.add("is-open");
    panel.querySelector(".search-panel__input").focus();
    document.addEventListener("keydown", onEscape);
    document.addEventListener("click", onOutsideClick);
  }

  function close() {
    if (!panel) return;
    panel.classList.remove("is-open");
    document.removeEventListener("keydown", onEscape);
    document.removeEventListener("click", onOutsideClick);
  }

  function onEscape(e) {
    if (e.key === "Escape") close();
  }

  function onOutsideClick(e) {
    var isTrigger = Array.prototype.some.call(triggers, function (t) {
      return t.contains(e.target);
    });
    if (!isTrigger && !panel.contains(e.target)) close();
  }

  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (panel && panel.classList.contains("is-open")) close();
      else open();
    });
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(max-width: 575.98px)").matches) close();
    else if (panel && panel.classList.contains("is-open")) position();
  });
})();

// Fullscreen photo lightbox — every .gallery__grid (product.html/
// material.html/project.html) and .material-slider__track (material.html's
// own slider) opens the same shared overlay, built once and lazily
// appended to <body> on first click.
(function () {
  var grids = document.querySelectorAll(".gallery__grid");
  var sliders = document.querySelectorAll(".material-slider__track");
  if (!grids.length && !sliders.length) return;

  var overlay = null;
  var images = [];
  var index = 0;

  function build() {
    var el = document.createElement("div");
    el.className = "lightbox-overlay";
    el.innerHTML =
      '<div class="lightbox">' +
      '<img class="lightbox__image" src="" alt="">' +
      '<button type="button" class="lightbox__nav lightbox__prev" aria-label="Предыдущее фото"><svg class="icon"><use href="assets/icons/sprite.svg#angle-left"></use></svg></button>' +
      '<button type="button" class="lightbox__nav lightbox__next" aria-label="Следующее фото"><svg class="icon"><use href="assets/icons/sprite.svg#angle-right"></use></svg></button>' +
      '<span class="lightbox__counter"></span>' +
      "</div>" +
      // Sibling of .lightbox, not a child — pins to the screen's own
      // corner (16px top/right) regardless of the image's rendered size.
      '<button type="button" class="lightbox__close" aria-label="Закрыть"><svg class="icon"><use href="assets/icons/sprite.svg#close"></use></svg></button>';
    document.body.appendChild(el);

    el.querySelector(".lightbox__close").addEventListener("click", close);
    el.querySelector(".lightbox__prev").addEventListener("click", function (e) {
      e.stopPropagation();
      show(index - 1);
    });
    el.querySelector(".lightbox__next").addEventListener("click", function (e) {
      e.stopPropagation();
      show(index + 1);
    });
    el.querySelector(".lightbox").addEventListener("click", function (e) {
      e.stopPropagation();
    });
    el.addEventListener("click", close);

    return el;
  }

  function show(i) {
    index = (i + images.length) % images.length;
    var img = overlay.querySelector(".lightbox__image");
    img.src = images[index];
    overlay.querySelector(".lightbox__counter").textContent =
      images.length > 1 ? index + 1 + " / " + images.length : "";
    var multi = images.length > 1;
    overlay.querySelector(".lightbox__prev").hidden = !multi;
    overlay.querySelector(".lightbox__next").hidden = !multi;
  }

  function open(list, startIndex) {
    if (!overlay) overlay = build();
    images = list;
    show(startIndex);
    overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  }

  function bindGroup(container, itemSelector) {
    var items = container.querySelectorAll(itemSelector);
    var srcs = Array.prototype.map.call(items, function (item) {
      return item.querySelector("img").src;
    });

    Array.prototype.forEach.call(items, function (item, i) {
      item.addEventListener("click", function () {
        open(srcs, i);
      });
    });
  }

  Array.prototype.forEach.call(grids, function (grid) {
    bindGroup(grid, ".gallery__item");
  });

  Array.prototype.forEach.call(sliders, function (slider) {
    bindGroup(slider, ".material-slider__slide");
  });
})();

// Video lightbox — .image-video--video's photo+play button opens a
// fullscreen YouTube embed. Reuses .lightbox-overlay/.lightbox__close
// verbatim (see the photo lightbox above) so it looks/behaves the
// same, just with an iframe instead of an <img>.
(function () {
  var triggers = document.querySelectorAll(".image-video--video .image-video__media");
  if (!triggers.length) return;

  var VIDEO_ID = "dQw4w9WgXcQ";
  var overlay = null;

  function build() {
    var el = document.createElement("div");
    el.className = "lightbox-overlay";
    el.innerHTML =
      '<div class="video-lightbox"><iframe src="" title="Видео" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>' +
      '<button type="button" class="lightbox__close" aria-label="Закрыть"><svg class="icon"><use href="assets/icons/sprite.svg#close"></use></svg></button>';
    document.body.appendChild(el);

    el.querySelector(".lightbox__close").addEventListener("click", close);
    el.querySelector(".video-lightbox").addEventListener("click", function (e) {
      e.stopPropagation();
    });
    el.addEventListener("click", close);

    return el;
  }

  function open() {
    if (!overlay) overlay = build();
    overlay.querySelector("iframe").src = "https://www.youtube.com/embed/" + VIDEO_ID + "?autoplay=1";
    overlay.classList.add("is-open");
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.querySelector("iframe").src = "";
    document.removeEventListener("keydown", onKeydown);
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener("click", open);
  });
})();
