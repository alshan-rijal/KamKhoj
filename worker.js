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

  /* ══════════════════════════════════════
     EVENT LISTENERS — attached FIRST so
     they work even if renderAll() fails
     ══════════════════════════════════════ */

  /* ── Availability Toggle ── */
  availToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    worker = getCurrentUser();
    const newVal = !worker.availability;
    updateUser(worker.id, { availability: newVal });
    worker = getCurrentUser();
    updateAvailabilityUI(worker.availability);
    renderProfileCard();
    showToast(newVal ? 'You are now Available' : 'You are now Busy', 'info');
  });

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

  /* ── Task Tab Switching ── */
  document.querySelectorAll('#task-tabs .section-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#task-tabs .section-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTaskTab = tab.dataset.tab;
      renderTasks();
    });
  });

  /* ── Task Action Handlers (global) ── */
  window.handleAcceptTask = function(taskId) {
    updateAssignment(taskId, {
      status: 'not-started',
      acceptedAt: new Date().toISOString()
    });
    showToast('Task accepted! Status set to Not Started.', 'success');
    renderTasks();
  };

  window.handleRejectTask = function(taskId) {
    document.getElementById('reject-task-id').value = taskId;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-modal').classList.add('active');
  };

  window.handleProposeTime = function(taskId, clientEstimate) {
    document.getElementById('time-task-id').value = taskId;
    document.getElementById('time-client-estimate').textContent = clientEstimate || 'Not specified';
    document.getElementById('time-proposal').value = '';
    document.getElementById('time-modal').classList.add('active');
  };

  window.handleStatusChange = function(taskId, newStatus) {
    const updates = { status: newStatus };
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    updateAssignment(taskId, updates);
    const msgs = {
      ongoing: 'Task started! Status changed to Ongoing.',
      completed: 'Task marked as Completed! The client will be notified.'
    };
    showToast(msgs[newStatus] || 'Status updated.', 'success');
    renderAll();
  };

  /* ── Reject Modal ── */
  const rejectModal = document.getElementById('reject-modal');
  const rejectForm = document.getElementById('reject-form');
  document.getElementById('reject-modal-close').addEventListener('click', () => rejectModal.classList.remove('active'));
  rejectModal.addEventListener('click', (e) => { if (e.target === rejectModal) rejectModal.classList.remove('active'); });

  rejectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = document.getElementById('reject-reason').value.trim();
    if (reason.length < 10) {
      document.getElementById('reject-reason-error').classList.add('visible');
      document.getElementById('reject-reason').classList.add('error');
      return;
    }
    const taskId = document.getElementById('reject-task-id').value;
    updateAssignment(taskId, { status: 'rejected', rejectionReason: reason });
    rejectModal.classList.remove('active');
    showToast('Task rejected.', 'info');
    renderTasks();
  });

  document.getElementById('reject-reason').addEventListener('input', () => {
    document.getElementById('reject-reason-error').classList.remove('visible');
    document.getElementById('reject-reason').classList.remove('error');
  });

  /* ── Time Proposal Modal ── */
  const timeModal = document.getElementById('time-modal');
  const timeForm = document.getElementById('time-form');
  document.getElementById('time-modal-close').addEventListener('click', () => timeModal.classList.remove('active'));
  timeModal.addEventListener('click', (e) => { if (e.target === timeModal) timeModal.classList.remove('active'); });

  timeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const proposal = document.getElementById('time-proposal').value.trim();
    if (!proposal) {
      document.getElementById('time-proposal-error').classList.add('visible');
      document.getElementById('time-proposal').classList.add('error');
      return;
    }
    const taskId = document.getElementById('time-task-id').value;
    updateAssignment(taskId, { workerTimeEstimate: proposal });
    timeModal.classList.remove('active');
    showToast('Time estimate updated!', 'success');
    renderTasks();
  });

  document.getElementById('time-proposal').addEventListener('input', () => {
    document.getElementById('time-proposal-error').classList.remove('visible');
    document.getElementById('time-proposal').classList.remove('error');
  });

  /* ══════════════════════════════════════
     INITIALIZE — render after all
     listeners are attached
     ══════════════════════════════════════ */
  try { renderAll(); } catch (e) { console.error('renderAll error:', e); }

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

    // Tasks
    renderTasks();

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
    reviewsContainer.innerHTML = sorted.map((r, i) => {
      const assignmentInfo = r.assignmentId ? getAssignmentById(r.assignmentId) : null;
      return `
        <div class="review-item stagger-${Math.min(i + 1, 6)}" style="animation-delay:${i * 0.05}s;">
          <div class="review-item-header">
            <div class="review-author">
              <span class="review-author-name">${escapeHtml(r.clientName)}</span>
              <span class="badge badge-verified">Verified Client</span>
            </div>
            <span class="review-date">${formatDate(r.date)}</span>
          </div>
          ${assignmentInfo ? `<p style="font-size:0.8rem;color:var(--accent);margin-bottom:var(--sp-xs);">Task: ${escapeHtml(assignmentInfo.title)}</p>` : ''}
          <div style="margin-bottom:var(--sp-sm);">${renderStars(r.stars)}</div>
          <p class="review-comment">${escapeHtml(r.comment)}</p>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════════════
     TASK MANAGEMENT SYSTEM
     ══════════════════════════════════════ */

  let currentTaskTab = 'pending';

  function renderTasks() {
    const tasksContainer = document.getElementById('tasks-container');
    if (!tasksContainer) return;

    const allTasks = getAssignmentsByWorker(worker.id);
    const pending = allTasks.filter(t => t.status === 'pending');
    const active = allTasks.filter(t => ['accepted', 'not-started', 'ongoing'].includes(t.status));
    const completed = allTasks.filter(t => ['completed', 'confirmed'].includes(t.status));
    const rejected = allTasks.filter(t => t.status === 'rejected');
    const cancelled = allTasks.filter(t => t.status === 'cancelled');

    // Update tab counts
    const pendingCount = document.getElementById('tab-count-pending');
    const activeCount = document.getElementById('tab-count-active');
    const completedCount = document.getElementById('tab-count-completed');
    if (pendingCount) pendingCount.textContent = pending.length;
    if (activeCount) activeCount.textContent = active.length;
    if (completedCount) completedCount.textContent = completed.length;

    let tasks;
    switch (currentTaskTab) {
      case 'pending': tasks = pending; break;
      case 'active': tasks = active; break;
      case 'completed': tasks = completed; break;
      case 'rejected': tasks = rejected; break;
      case 'cancelled': tasks = cancelled; break;
      default: tasks = pending;
    }

    if (tasks.length === 0) {
      const emptyMsgs = {
        pending: 'No pending task requests.',
        active: 'No active tasks.',
        completed: 'No completed tasks yet.',
        rejected: 'No rejected tasks.',
        cancelled: 'No cancelled tasks.'
      };
      tasksContainer.innerHTML = `
        <div class="empty-state" style="padding:2rem;">
          <div class="empty-state-icon">📋</div>
          <p class="empty-state-text">${emptyMsgs[currentTaskTab]}</p>
        </div>
      `;
      return;
    }

    tasksContainer.innerHTML = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(task => {
      const client = getUserById(task.clientId);
      const clientName = client ? escapeHtml(client.name) : 'Unknown Client';
      const statusLabel = getStatusLabel(task.status);

      let actionsHtml = '';
      if (task.status === 'pending') {
        actionsHtml = `
          <div class="assignment-actions">
            <button class="btn btn-primary btn-sm" onclick="handleAcceptTask('${task.id}')">✅ Accept</button>
            <button class="btn btn-danger btn-sm" onclick="handleRejectTask('${task.id}')">✕ Reject</button>
            <button class="btn btn-ghost btn-sm" onclick="handleProposeTime('${task.id}', '${escapeHtml(task.clientTimeEstimate)}')">⏱ Propose Time</button>
          </div>
        `;
      } else if (['accepted', 'not-started'].includes(task.status)) {
        actionsHtml = `
          <div class="assignment-actions">
            <button class="btn btn-primary btn-sm" onclick="handleStatusChange('${task.id}', 'ongoing')">▶ Start Work</button>
            <button class="btn btn-ghost btn-sm" onclick="handleProposeTime('${task.id}', '${escapeHtml(task.clientTimeEstimate)}')">⏱ Change Time</button>
          </div>
        `;
      } else if (task.status === 'ongoing') {
        actionsHtml = `
          <div class="assignment-actions">
            <button class="btn btn-success btn-sm" onclick="handleStatusChange('${task.id}', 'completed')">✓ Mark Completed</button>
            <button class="btn btn-ghost btn-sm" onclick="handleProposeTime('${task.id}', '${escapeHtml(task.clientTimeEstimate)}')">⏱ Change Time</button>
          </div>
        `;
      }

      let timeHtml = '';
      if (task.clientTimeEstimate || task.workerTimeEstimate) {
        timeHtml = '<div class="time-estimates">';
        if (task.clientTimeEstimate) {
          timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Client Estimate</div><div class="time-estimate-value">${escapeHtml(task.clientTimeEstimate)}</div></div>`;
        }
        if (task.workerTimeEstimate) {
          timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Your Estimate</div><div class="time-estimate-value">${escapeHtml(task.workerTimeEstimate)}</div></div>`;
        }
        timeHtml += '</div>';
      }

      let rejectionHtml = '';
      if (task.status === 'rejected' && task.rejectionReason) {
        rejectionHtml = `<div class="rejection-reason">❌ Reason: ${escapeHtml(task.rejectionReason)}</div>`;
      }
      if (task.status === 'cancelled') {
        rejectionHtml = `<div class="rejection-reason" style="background:rgba(var(--secondary-rgb),0.1);border-color:rgba(var(--secondary-rgb),0.3);"><span style="color:var(--secondary);">🚫 Cancelled by client</span>${task.cancelledAt ? ` on ${formatDate(task.cancelledAt)}` : ''}</div>`;
      }

      return `
        <div class="assignment-card">
          <div class="assignment-card-header">
            <div>
              <div class="assignment-card-title">${escapeHtml(task.title)}</div>
              <div class="assignment-worker-info">
                <span style="font-size:0.85rem;color:var(--text-muted);">From: <strong style="color:var(--text-primary);">${clientName}</strong></span>
              </div>
            </div>
            <span class="status-badge status-${task.status}">${statusLabel}</span>
          </div>
          ${task.description ? `<div class="assignment-card-desc">${escapeHtml(task.description)}</div>` : ''}
          ${timeHtml}
          ${rejectionHtml}
          <div class="assignment-meta">
            <span class="assignment-meta-item">📅 Assigned: ${formatDate(task.createdAt)}</span>
            ${task.completedAt ? `<span class="assignment-meta-item">✅ Completed: ${formatDate(task.completedAt)}</span>` : ''}
          </div>
          ${actionsHtml}
        </div>
      `;
    }).join('');
  }

  function getStatusLabel(status) {
    const labels = {
      pending: '⏳ Pending',
      accepted: '✅ Accepted',
      rejected: '❌ Rejected',
      cancelled: '🚫 Cancelled',
      'not-started': '📋 Not Started',
      ongoing: '🔄 Ongoing',
      completed: '✓ Completed',
      confirmed: '🏆 Confirmed'
    };
    return labels[status] || status;
  }

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

  /* ── Escape HTML ── */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
