/**
 * PaySwift embeddable "Pay with M-Pesa" popup helper.
 *
 * Enhances any element carrying a `data-payswift-url` attribute so that clicking
 * it opens the PaySwift-hosted checkout in a centered popup window instead of
 * navigating away. If the popup is blocked, it falls back to a normal
 * navigation. Safe to include once per page; re-running is idempotent.
 *
 * Usage:
 *   <a href="https://app/pay/SLUG" data-payswift-url="https://app/pay/SLUG">Pay with M-Pesa</a>
 *   <script src="https://app/pay-button.js" async></script>
 */
(function () {
  function openPopup(url) {
    var w = 480;
    var h = 720;
    var left = Math.max(0, (window.screen.width - w) / 2);
    var top = Math.max(0, (window.screen.height - h) / 2);
    var popup = window.open(
      url,
      'payswift_checkout',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes'
    );
    if (!popup) {
      // Popup blocked — fall back to navigating the current tab.
      window.location.href = url;
    }
  }

  function enhance() {
    var els = document.querySelectorAll('[data-payswift-url]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__payswiftBound) continue;
      el.__payswiftBound = true;
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openPopup(this.getAttribute('data-payswift-url') || this.getAttribute('href'));
      });
    }
  }

  if (document.readyState !== 'loading') {
    enhance();
  } else {
    document.addEventListener('DOMContentLoaded', enhance);
  }

  window.PaySwift = window.PaySwift || {};
  window.PaySwift.open = openPopup;
  window.PaySwift.refresh = enhance;
})();
