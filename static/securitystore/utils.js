// Client-side utility functions for formatting prices according to the user's localle.

// Format a number as a price.  E.g. '1234.5' -> '$1,234.50'
function formattedPrice(number) {
  return Number(number).toLocaleString('en', {
    style: 'currency',
    currency: 'USD'
  });
}

// Find all '<span class="price">123</span>' and format them as prices.
function renderPrices() {
  var priceSpans = document.getElementsByClassName('price');
  for (var i = 0, priceSpan; (priceSpan = priceSpans[i]); i++) {
    priceSpan.textContent = formattedPrice(priceSpan.textContent);
  }
}
window.addEventListener('DOMContentLoaded', renderPrices);
