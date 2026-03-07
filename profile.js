/* ========================================
   WorkForce Connect — Worker Profile Page (profile.js)
   ======================================== */

(function () {
  /* ── Get Worker ID from URL ── */
  const params = new URLSearchParams(window.location.search);
  const workerId = params.get('id');

  if (!workerId) {
    window.location.href = 'index.html';
    return;
  }

  let worker = getUserById(workerId);
  if (!worker || worker.type !== 'worker') {
    window.location.href = 'index.html';
    return;
  }

  /* ── Session (optional — review form only for clients) ── */
  const session = getSession();
  let currentUser = session ? getCurrentUser() : null;
  const isClient = session && session.userType === 'client';

  /* ── DOM Refs ── */
  const navAvatar = document.getElementById('nav-avatar');
  const ddName = document.getElementById('dd-name');
  const ddEmail = document.getElementById('dd-email');
  const dropdown = document.getElementById('profile-dropdown');

  const profileHero = document.getElementById('profile-hero');
  const statRating = document.getElementById('stat-rating');
  const statWorks = document.getElementById('stat-works');
  const statReviews = document.getElementById('stat-reviews');
  const reviewFormWrapper = document.getElementById('review-form-wrapper');
  const reviewsContainer = document.getElementById('reviews-container');

  /* ── Nav ── */
  if (currentUser) {
    navAvatar.src = getAvatarSrc(currentUser);
    ddName.textContent = currentUser.name;
    ddEmail.textContent = currentUser.email;
  } else {
    navAvatar.style.display = 'none';
  }

  /* ── Initialize ── */
  renderAll();

  /* ── Render Everything ── */
  function renderAll() {
    worker = getUserById(workerId);
    if (!worker) return;

    renderProfileHero();
    renderStats();
    renderReviewForm();
    renderReviews();
  }

  /* ── Profile Hero ── */
  function renderProfileHero() {
    const avg = getAverageRating(worker);
    profileHero.innerHTML = `
      <img class="profile-avatar-large" src="${getAvatarSrc(worker)}" alt="${escapeHtml(worker.name)}">
      <h1 class="profile-name">${escapeHtml(worker.name)}</h1>
      <span class="${getCategoryBadgeClass(worker.category)}" style="font-size:0.9rem;padding:4px 14px;">${escapeHtml(worker.category)}</span>
      <span class="${worker.availability ? 'badge badge-available' : 'badge badge-busy'}" style="margin-left:8px;font-size:0.9rem;padding:4px 14px;">
        ${worker.availability ? 'Available' : 'Busy'}
      </span>
      <div class="profile-details">
        <span class="profile-detail-item">📍 ${escapeHtml(worker.city)}</span>
        <span class="profile-detail-item">📞 ${escapeHtml(worker.phone)}</span>
        <span class="profile-detail-item">🛠️ ${worker.experience} years experience</span>
      </div>
      <p class="profile-bio">${escapeHtml(worker.bio || 'No bio provided.')}</p>
    `;
  }

  /* ── Stats ── */
  function renderStats() {
    const avg = getAverageRating(worker);
    const reviewCount = worker.ratings ? worker.ratings.length : 0;

    if (avg > 0) {
      animateCountUp(statRating, avg, 1000, 1);
    } else {
      statRating.textContent = 'N/A';
      statRating.style.fontSize = '1.2rem';
    }
    animateCountUp(statWorks, worker.worksCompleted || 0, 1000);
    animateCountUp(statReviews, reviewCount, 1000);
  }

  /* ── Review Form ── */
  function renderReviewForm() {
    if (!isClient) {
      reviewFormWrapper.innerHTML = '';
      return;
    }

    if (hasClientReviewed(workerId, session.userId)) {
      reviewFormWrapper.innerHTML = `
        <div class="review-form-card" style="text-align:center;">
          <p style="color:var(--text-muted);">✅ You have already reviewed this worker.</p>
        </div>
      `;
      return;
    }

    reviewFormWrapper.innerHTML = `
      <div class="review-form-card">
        <h3 style="margin-bottom:var(--sp-md);">Leave a Review</h3>
        <form id="review-form" novalidate>
          <div class="form-group">
            <label class="form-label">Your Rating</label>
            <div class="star-rating-input" id="star-input">
              <span class="star" data-value="1">☆</span>
              <span class="star" data-value="2">☆</span>
              <span class="star" data-value="3">☆</span>
              <span class="star" data-value="4">☆</span>
              <span class="star" data-value="5">☆</span>
            </div>
            <div class="form-error" id="star-error">Please select a rating</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="review-comment">Your Review</label>
            <textarea class="form-textarea" id="review-comment" rows="4" placeholder="Share your experience working with this person (min 10 characters)..." minlength="10" maxlength="500"></textarea>
            <div class="char-counter" id="review-char-counter">0/500</div>
            <div class="form-error" id="comment-error">Error</div>
          </div>
          <button type="submit" class="btn btn-primary">
            <span class="spinner"></span>
            <span class="btn-text">Submit Review</span>
          </button>
        </form>
      </div>
    `;

    setupStarInput();
    setupReviewForm();
  }

  let selectedStars = 0;

  function setupStarInput() {
    const starInput = document.getElementById('star-input');
    if (!starInput) return;
    const stars = starInput.querySelectorAll('.star');

    stars.forEach(star => {
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.value);
        stars.forEach(s => {
          s.classList.toggle('hovered', parseInt(s.dataset.value) <= val);
        });
      });

      star.addEventListener('mouseleave', () => {
        stars.forEach(s => s.classList.remove('hovered'));
      });

      star.addEventListener('click', () => {
        selectedStars = parseInt(star.dataset.value);
        stars.forEach(s => {
          const v = parseInt(s.dataset.value);
          s.classList.toggle('selected', v <= selectedStars);
          s.textContent = v <= selectedStars ? '★' : '☆';
          if (v === selectedStars) {
            s.classList.add('bounce');
            setTimeout(() => s.classList.remove('bounce'), 300);
          }
        });
        document.getElementById('star-error').classList.remove('visible');
      });
    });
  }

  function setupReviewForm() {
    const form = document.getElementById('review-form');
    const commentInput = document.getElementById('review-comment');
    const charCounter = document.getElementById('review-char-counter');

    if (!form || !commentInput) return;

    commentInput.addEventListener('input', () => {
      const len = commentInput.value.length;
      charCounter.textContent = `${len}/500`;
      charCounter.classList.toggle('warn', len > 500);
      document.getElementById('comment-error').classList.remove('visible');
      commentInput.classList.remove('error');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      if (selectedStars === 0) {
        document.getElementById('star-error').classList.add('visible');
        valid = false;
      }

      const comment = commentInput.value.trim();
      if (comment.length < 10) {
        commentInput.classList.add('error');
        const errEl = document.getElementById('comment-error');
        errEl.textContent = 'Review must be at least 10 characters';
        errEl.classList.add('visible');
        valid = false;
      } else if (comment.length > 500) {
        commentInput.classList.add('error');
        const errEl = document.getElementById('comment-error');
        errEl.textContent = 'Review must be under 500 characters';
        errEl.classList.add('visible');
        valid = false;
      }

      if (!valid) return;

      const btn = form.querySelector('.btn');
      btn.classList.add('loading');

      setTimeout(() => {
        btn.classList.remove('loading');

        const rating = {
          clientId: session.userId,
          clientName: currentUser.name,
          stars: selectedStars,
          comment: comment,
          date: new Date().toISOString()
        };

        addRating(workerId, rating);
        showToast('Review submitted successfully!', 'success');
        selectedStars = 0;
        renderAll();
      }, 500);
    });
  }

  /* ── Reviews List ── */
  function renderReviews() {
    const ratings = worker.ratings || [];

    if (ratings.length === 0) {
      reviewsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <h4 class="empty-state-title">No Reviews Yet</h4>
          <p class="empty-state-text">Be the first to leave a review for this worker!</p>
        </div>
      `;
      return;
    }

    const sorted = [...ratings].sort((a, b) => new Date(b.date) - new Date(a.date));
    reviewsContainer.innerHTML = sorted.map((r, i) => `
      <div class="review-item stagger-${Math.min(i + 1, 6)}" style="animation-delay:${i * 0.05}s;">
        <div class="review-item-header">
          <div class="review-author">
            <span class="review-author-name">${escapeHtml(r.clientName)}</span>
            <span class="badge badge-verified">Verified Client</span>
          </div>
          <span class="review-date">${formatDate(r.date)}</span>
        </div>
        <div style="margin-bottom:var(--sp-sm);">${renderStars(r.stars)}</div>
        <p class="review-comment">${escapeHtml(r.comment)}</p>
      </div>
    `).join('');
  }

  /* ── Back Button ── */
  document.getElementById('back-btn').addEventListener('click', () => {
    if (isClient) {
      window.location.href = 'client-dashboard.html';
    } else {
      window.history.back();
    }
  });

  /* ── Profile Dropdown ── */
  if (navAvatar.style.display !== 'none') {
    navAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
      document.getElementById('logout-confirm').classList.remove('active');
    });
  }

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== navAvatar) {
      dropdown.classList.remove('active');
    }
  });

  /* ── Logout ── */
  document.getElementById('btn-logout-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('logout-confirm').classList.toggle('active');
  });
  document.getElementById('btn-logout-yes').addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
  });
  document.getElementById('btn-logout-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('logout-confirm').classList.remove('active');
  });

  /* ── Escape HTML ── */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
