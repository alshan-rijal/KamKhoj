/* ========================================
   WorkForce Connect — Worker Dashboard (worker.js)
   ======================================== */

(function () {
  /* ── Auth Guard ── */
  const session = requireAuth('worker');
  if (!session) return;

  let worker = getCurrentUser();
  if (!worker) { clearSession(); window.location.href = 'index.html'; return; }

  /* ── DOM Refs ── */
  const navAvatar = document.getElementById('nav-avatar');
  const ddName = document.getElementById('dd-name');
  const ddEmail = document.getElementById('dd-email');
  const dropdown = document.getElementById('profile-dropdown');
  const availToggle = document.getElementById('avail-toggle');
  const availTrack = document.getElementById('avail-track');
  const availLabel = document.getElementById('avail-label');

  const statRating = document.getElementById('stat-rating');
  const statWorks = document.getElementById('stat-works');
  const statReviews = document.getElementById('stat-reviews');
  const profileCard = document.getElementById('my-profile-card');
  const reviewsContainer = document.getElementById('reviews-container');

  const editModal = document.getElementById('edit-modal');
  const editModalClose = document.getElementById('edit-modal-close');
  const editForm = document.getElementById('edit-profile-form');
  const editBioCounter = document.getElementById('edit-bio-counter');

  /* ── Initialize ── */
  renderAll();

  /* ── Render Everything ── */
  function renderAll() {
    worker = getCurrentUser();
    if (!worker) return;

    // Navbar
    navAvatar.src = getAvatarSrc(worker);
    ddName.textContent = worker.name;
    ddEmail.textContent = worker.email;

    // Availability
    updateAvailabilityUI(worker.availability);

    // Stats with count-up
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

    // Profile card
    renderProfileCard();

    // Reviews
    renderReviews();
  }

  function updateAvailabilityUI(available) {
    availTrack.classList.toggle('available', available);
    availLabel.textContent = available ? 'Available' : 'Busy';
    availLabel.style.color = available ? 'var(--success)' : 'var(--danger)';
  }

  /* ── Profile Card ── */
  function renderProfileCard() {
    const avg = getAverageRating(worker);
    const categoryInfo = CATEGORY_MAP[worker.category] || CATEGORY_MAP['Other'];
    profileCard.innerHTML = `
      <div class="my-profile-avatar-wrapper">
        <img class="my-profile-avatar" src="${getAvatarSrc(worker)}" alt="${worker.name}">
      </div>
      <div class="my-profile-info">
        <h2>${escapeHtml(worker.name)}</h2>
        <span class="${getCategoryBadgeClass(worker.category)}">${escapeHtml(worker.category)}</span>
        <div class="profile-meta">
          <span>📍 ${escapeHtml(worker.city)}</span>
          <span>📞 ${escapeHtml(worker.phone)}</span>
          <span>🛠️ ${worker.experience} yrs experience</span>
          <span>${worker.availability ? '<span class="badge badge-available">Available</span>' : '<span class="badge badge-busy">Busy</span>'}</span>
        </div>
        <p class="my-profile-bio">${escapeHtml(worker.bio || 'No bio provided.')}</p>
      </div>
    `;
  }

  /* ── Reviews List ── */
  function renderReviews() {
    const ratings = worker.ratings || [];
    if (ratings.length === 0) {
      reviewsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💬</div>
          <h4 class="empty-state-title">No Reviews Yet</h4>
          <p class="empty-state-text">When clients leave reviews, they will appear here.</p>
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

  /* ── Profile Dropdown Toggle ── */
  navAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
    document.getElementById('logout-confirm').classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== navAvatar) {
      dropdown.classList.remove('active');
    }
  });

  /* ── Availability Toggle ── */
  availToggle.addEventListener('click', () => {
    const newVal = !worker.availability;
    updateUser(worker.id, { availability: newVal });
    worker.availability = newVal;
    updateAvailabilityUI(newVal);
    renderProfileCard();
    showToast(newVal ? 'You are now Available' : 'You are now Busy', 'info');
  });

  /* ── Logout Flow ── */
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

  /* ── Update Profile Picture ── */
  document.getElementById('btn-update-picture').addEventListener('click', () => {
    document.getElementById('profile-pic-input').click();
  });

  document.getElementById('profile-pic-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateUser(worker.id, { profilePicture: ev.target.result });
      showToast('Profile picture updated!', 'success');
      renderAll();
    };
    reader.readAsDataURL(file);
  });

  /* ── Edit Profile Modal ── */
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    dropdown.classList.remove('active');
    openEditModal();
  });

  function openEditModal() {
    document.getElementById('edit-name').value = worker.name;
    document.getElementById('edit-phone').value = worker.phone;
    document.getElementById('edit-city').value = worker.city;
    document.getElementById('edit-category').value = worker.category;
    document.getElementById('edit-experience').value = worker.experience;
    document.getElementById('edit-availability').value = String(worker.availability);
    document.getElementById('edit-bio').value = worker.bio || '';
    editBioCounter.textContent = `${(worker.bio || '').length}/300`;
    editModal.classList.add('active');
  }

  editModalClose.addEventListener('click', () => editModal.classList.remove('active'));
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.remove('active');
  });

  document.getElementById('edit-bio').addEventListener('input', (e) => {
    const len = e.target.value.length;
    editBioCounter.textContent = `${len}/300`;
    editBioCounter.classList.toggle('warn', len > 300);
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const city = document.getElementById('edit-city').value.trim();
    const category = document.getElementById('edit-category').value;
    const experience = Number(document.getElementById('edit-experience').value) || 0;
    const availability = document.getElementById('edit-availability').value === 'true';
    const bio = document.getElementById('edit-bio').value.trim();

    if (!name || !phone || !city) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    if (bio.length > 300) {
      showToast('Bio must be under 300 characters', 'error');
      return;
    }

    const btn = editForm.querySelector('.btn');
    btn.classList.add('loading');

    setTimeout(() => {
      btn.classList.remove('loading');
      updateUser(worker.id, { name, phone, city, category, experience, availability, bio });
      editModal.classList.remove('active');
      showToast('Profile updated!', 'success');
      renderAll();
    }, 500);
  });

  /* ── Escape HTML ── */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
