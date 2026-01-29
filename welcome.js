(function () {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const navDropdown = document.getElementById('navDropdown');

  if (!hamburgerBtn || !navDropdown) return;

  // Toggle dropdown on hamburger click
  hamburgerBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    navDropdown.classList.toggle('open');
  });

  // Close dropdown when clicking a link
  navDropdown.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navDropdown.classList.remove('open');
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!navDropdown.contains(e.target) && !hamburgerBtn.contains(e.target)) {
      navDropdown.classList.remove('open');
    }
  });

  // Scroll indicator logic
  const scrollIndicator = document.getElementById('scrollIndicator');

  if (scrollIndicator) {
    function updateScrollIndicator() {
      // Temporarily hide the indicator so it doesn't affect scrollHeight
      scrollIndicator.classList.add('hidden');

      // Add a small buffer (2px) to account for subpixel rendering
      const isScrollable = navDropdown.scrollHeight > navDropdown.clientHeight + 2;
      const isAtBottom =
        navDropdown.scrollTop + navDropdown.clientHeight >= navDropdown.scrollHeight - 10;

      // Only show if content necessitates scrolling and we aren't at the bottom
      if (isScrollable && !isAtBottom) {
        scrollIndicator.classList.remove('hidden');
      }
    }

    navDropdown.addEventListener('scroll', updateScrollIndicator);

    navDropdown.addEventListener('transitionend', function (e) {
      // Only trigger if the transition happened on the dropdown itself (not a child)
      // and check if it's open (to avoid unnecessary checks when closing)
      if (e.target === navDropdown && navDropdown.classList.contains('open')) {
        updateScrollIndicator();
      }
    });

    // Check on menu open (immediate check as fallback/start)
    hamburgerBtn.addEventListener('click', function () {
      // We rely on transitionend for the final state, but we can clear any stale state here
    });

    // Check on window resize
    window.addEventListener('resize', updateScrollIndicator);
  }
})();
