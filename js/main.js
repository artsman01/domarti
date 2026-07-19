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
