/* ========================================
   काम Khoj.com — Landing Animations
   ======================================== */

(function () {
  const numbers = Array.from(document.querySelectorAll('[data-count-to]'));
  numbers.forEach((el) => {
    const target = Number(el.getAttribute('data-count-to')) || 0;
    if (typeof animateCountUp === 'function') {
      animateCountUp(el, target, 1200, 0);
    } else {
      el.textContent = String(target);
    }
  });
})();
