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
      var isMobileWidth = window.matchMedia("(max-width: 575.98px)").matches;
      panel._swiper = new Swiper(swiperEl, {
        slidesPerView: "auto",
        spaceBetween: isMobileWidth ? 12 : 16,
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
      });
    } else if (panel._accordionActivate) {
      panel._accordionActivate();
    }
  }

  function initCatalog(catalog) {
    var tabs = Array.prototype.slice.call(catalog.querySelectorAll(".catalog__tab"));
    var panels = Array.prototype.slice.call(catalog.querySelectorAll("[data-catalog-panel]"));
    var tabsRow = catalog.querySelector(".catalog__tabs");

    panels.forEach(setupAccordion);
    panels.forEach(refreshPanel);

    // Plain vertical mouse-wheel scroll does nothing on a horizontal-only
    // overflow container in standard browsers (needs Shift+wheel or a
    // trackpad) — redirect deltaY into scrollLeft so a normal mouse wheel
    // over the tabs actually pages through them.
    if (tabsRow) {
      tabsRow.addEventListener(
        "wheel",
        function (e) {
          if (tabsRow.scrollWidth <= tabsRow.clientWidth) return;
          var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (delta === 0) return;
          e.preventDefault();
          tabsRow.scrollLeft += delta;
        },
        { passive: false }
      );

      // Click-and-drag with the mouse, the same way the kitchen-card
      // slider can be dragged — plain overflow-x:auto only responds to
      // touch/trackpad swipes, not a held-down mouse button. Uses Pointer
      // Events (not mouse events) specifically so it can bail out on
      // pointerType !== "mouse": touch already gets native scroll + tap
      // for free, and touch's synthetic compatibility mousedown/click
      // pair was getting caught by this same logic, breaking tab taps
      // on real phones.
      // A trackpad/mouse click almost always has a pixel or two of jitter
      // between button-down and button-up — too low a threshold here
      // flags an ordinary click as a drag and swallows it, so tabs stop
      // responding to clicks entirely.
      var DRAG_THRESHOLD = 10;
      var dragActive = false;
      var dragMoved = false;
      var dragStartX = 0;
      var dragStartScrollLeft = 0;

      tabsRow.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse") return;
        if (tabsRow.scrollWidth <= tabsRow.clientWidth) return;
        dragActive = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartScrollLeft = tabsRow.scrollLeft;
        tabsRow.classList.add("is-dragging");
        e.preventDefault(); // avoid native text/label drag ghosting
      });

      window.addEventListener("pointermove", function (e) {
        if (!dragActive) return;
        var delta = e.clientX - dragStartX;
        if (Math.abs(delta) > DRAG_THRESHOLD) dragMoved = true;
        // Only actually scroll once past the threshold — otherwise the
        // few px of click jitter itself nudges scrollLeft before we've
        // even decided this is a drag.
        if (dragMoved) tabsRow.scrollLeft = dragStartScrollLeft - delta;
      });

      window.addEventListener("pointerup", function () {
        if (!dragActive) return;
        dragActive = false;
        tabsRow.classList.remove("is-dragging");
        if (dragMoved) {
          // swallow the click that follows a real drag so a tab doesn't
          // switch just because the drag happened to end over it
          var suppressClick = function (e) {
            e.stopPropagation();
            e.preventDefault();
          };
          tabsRow.addEventListener("click", suppressClick, { capture: true, once: true });
        }
      });
    }

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
