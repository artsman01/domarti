(function () {
  var TEMPLATE = "+7 (___) ___-__-__";

  function initPhoneMask(input) {
    var digitPositions = [];
    for (var i = 0; i < TEMPLATE.length; i++) {
      if (TEMPLATE[i] === "_") digitPositions.push(i);
    }

    function extractDigits(raw) {
      var digits = raw.replace(/\D/g, "");
      if (digits.charAt(0) === "7" || digits.charAt(0) === "8") {
        digits = digits.slice(1);
      }
      return digits.slice(0, digitPositions.length).split("");
    }

    function render(digitsArr) {
      var chars = TEMPLATE.split("");
      for (var i = 0; i < digitPositions.length; i++) {
        chars[digitPositions[i]] = digitsArr[i] !== undefined ? digitsArr[i] : "_";
      }
      return chars.join("");
    }

    function cursorForCount(count) {
      return count >= digitPositions.length ? TEMPLATE.length : digitPositions[count];
    }

    function setDigits(digitsArr) {
      input.value = render(digitsArr);
    }

    input.addEventListener("focus", function () {
      if (!input.value) setDigits([]);
      var pos = cursorForCount(extractDigits(input.value).length);
      requestAnimationFrame(function () {
        input.setSelectionRange(pos, pos);
      });
    });

    input.addEventListener("input", function () {
      var digits = extractDigits(input.value);
      setDigits(digits);
      var pos = cursorForCount(digits.length);
      input.setSelectionRange(pos, pos);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Backspace") {
        e.preventDefault();
        var digits = extractDigits(input.value);
        digits.pop();
        setDigits(digits);
        var pos = cursorForCount(digits.length);
        input.setSelectionRange(pos, pos);
      }
    });

    input.addEventListener("click", function () {
      var pos = cursorForCount(extractDigits(input.value).length);
      if (input.selectionStart > pos) input.setSelectionRange(pos, pos);
    });

    input.addEventListener("blur", function () {
      if (extractDigits(input.value).length === 0) input.value = "";
    });
  }

  document.querySelectorAll('input[type="tel"]').forEach(initPhoneMask);
})();
