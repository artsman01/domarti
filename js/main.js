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
