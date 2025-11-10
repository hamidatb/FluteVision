// applies background colors to feature cards from data attributes
document.addEventListener('DOMContentLoaded', () => {
  const featureCards = document.querySelectorAll('.feature-card[data-bg-color]');
  featureCards.forEach(card => {
    const bgColor = card.getAttribute('data-bg-color');
    if (bgColor) {
      card.style.background = bgColor;
    }
  });
});

