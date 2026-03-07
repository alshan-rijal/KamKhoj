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
  const assignWorkWrapper = document.getElementById('assign-work-wrapper');
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
    renderAssignWorkForm();
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

  /* ── Assign Work Form (for clients) ── */
  function renderAssignWorkForm() {
    if (!isClient) {
      assignWorkWrapper.innerHTML = '';
      return;
    }

    // Block assignment if worker is busy
    if (!worker.availability) {
      assignWorkWrapper.innerHTML = `
        <div class="review-form-card" style="margin-bottom:var(--sp-lg);">
          <h3 style="margin-bottom:var(--sp-md);">📋 Assign Work to ${escapeHtml(worker.name)}</h3>
          <div style="text-align:center;padding:var(--sp-lg);">
            <div style="font-size:2rem;margin-bottom:var(--sp-sm);">🚫</div>
            <p style="color:var(--danger);font-weight:600;margin-bottom:var(--sp-xs);">Worker is Currently Busy</p>
            <p style="color:var(--text-muted);font-size:0.85rem;">This worker is not accepting new tasks right now. Please check back later or find another available worker.</p>
          </div>
        </div>
      `;
      return;
    }

    assignWorkWrapper.innerHTML = `
      <div class="review-form-card" style="margin-bottom:var(--sp-lg);">
        <h3 style="margin-bottom:var(--sp-md);">📋 Assign Work to ${escapeHtml(worker.name)}</h3>
        <form id="assign-work-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="assign-title">Task Title</label>
            <input class="form-input" type="text" id="assign-title" placeholder="e.g. Kitchen renovation, Garden cleanup..." maxlength="100">
            <div class="form-error" id="assign-title-error">Title is required</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="assign-desc">Task Description</label>
            <textarea class="form-textarea" id="assign-desc" rows="3" placeholder="Describe the work in detail..." maxlength="500"></textarea>
            <div class="char-counter" id="assign-desc-counter">0/500</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="assign-time">Time Estimate (e.g. "3 days", "2 weeks", "5 hours")</label>
            <input class="form-input" type="text" id="assign-time" placeholder="e.g. 3 days" maxlength="50">
            <div class="form-error" id="assign-time-error">Time estimate is required</div>
          </div>
          <button type="submit" class="btn btn-primary">
            <span class="spinner"></span>
            <span class="btn-text">Assign Work</span>
          </button>
        </form>
      </div>
    `;

    setupAssignWorkForm();
  }

  function setupAssignWorkForm() {
    const form = document.getElementById('assign-work-form');
    const descInput = document.getElementById('assign-desc');
    const descCounter = document.getElementById('assign-desc-counter');
    if (!form) return;

    descInput.addEventListener('input', () => {
      descCounter.textContent = `${descInput.value.length}/500`;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('assign-title').value.trim();
      const desc = descInput.value.trim();
      const time = document.getElementById('assign-time').value.trim();
      let valid = true;

      if (!title) {
        document.getElementById('assign-title-error').classList.add('visible');
        document.getElementById('assign-title').classList.add('error');
        valid = false;
      } else {
        document.getElementById('assign-title-error').classList.remove('visible');
        document.getElementById('assign-title').classList.remove('error');
      }
      if (!time) {
        document.getElementById('assign-time-error').classList.add('visible');
        document.getElementById('assign-time').classList.add('error');
        valid = false;
      } else {
        document.getElementById('assign-time-error').classList.remove('visible');
        document.getElementById('assign-time').classList.remove('error');
      }

      if (!valid) return;

      const btn = form.querySelector('.btn');
      btn.classList.add('loading');

      setTimeout(() => {
        btn.classList.remove('loading');
        createAssignment({
          clientId: session.userId,
          workerId: workerId,
          title: title,
          description: desc,
          clientTimeEstimate: time
        });
        showToast('Work assigned successfully! Waiting for worker response.', 'success');
        form.reset();
        descCounter.textContent = '0/500';
      }, 500);
    });

    // Clear errors on input
    ['assign-title', 'assign-time'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        document.getElementById(id).classList.remove('error');
        document.getElementById(id + '-error').classList.remove('visible');
      });
    });
  }

  /* ── Review Form — only for confirmed assignments ── */
  function renderReviewForm() {
    if (!isClient) {
      reviewFormWrapper.innerHTML = '';
      return;
    }

    // Get confirmed assignments that haven't been reviewed yet
    const reviewableAssignments = getConfirmedUnreviewedByClient(session.userId, workerId);

    if (reviewableAssignments.length === 0) {
      reviewFormWrapper.innerHTML = '';
      return;
    }

    // Show review form for the first reviewable assignment
    const assignment = reviewableAssignments[0];
    reviewFormWrapper.innerHTML = `
      <div class="review-form-card">
        <h3 style="margin-bottom:var(--sp-sm);">Leave a Review</h3>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:var(--sp-md);">
          For task: <strong style="color:var(--accent);">${escapeHtml(assignment.title)}</strong>
        </p>
        <form id="review-form" novalidate>
          <input type="hidden" id="review-assignment-id" value="${assignment.id}">
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

    if (reviewableAssignments.length > 1) {
      reviewFormWrapper.innerHTML += `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:var(--sp-sm);">You have ${reviewableAssignments.length - 1} more assignment(s) to review after this one.</p>`;
    }

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

        const assignmentId = document.getElementById('review-assignment-id').value;

        const rating = {
          clientId: session.userId,
          clientName: currentUser.name,
          stars: selectedStars,
          comment: comment,
          assignmentId: assignmentId,
          date: new Date().toISOString()
        };

        addRating(workerId, rating);
        // Mark assignment as reviewed
        updateAssignment(assignmentId, { reviewedAt: new Date().toISOString() });
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
