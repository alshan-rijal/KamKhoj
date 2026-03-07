/* ========================================
   WorkForce Connect — Client Dashboard (client.js)
   ======================================== */

(function () {
  /* ── Auth Guard ── */
  const session = requireAuth('client');
  if (!session) return;

  let client = getCurrentUser();
  if (!client) { clearSession(); window.location.href = 'index.html'; return; }

  /* ── DOM Refs ── */
  const navAvatar = document.getElementById('nav-avatar');
  const ddName = document.getElementById('dd-name');
  const ddEmail = document.getElementById('dd-email');
  const dropdown = document.getElementById('profile-dropdown');

  const searchInput = document.getElementById('search-input');
  const filterCategory = document.getElementById('filter-category');
  const filterAvailability = document.getElementById('filter-availability');
  const filterSort = document.getElementById('filter-sort');

  const skeletonGrid = document.getElementById('skeleton-grid');
  const workersGrid = document.getElementById('workers-grid');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-state-title');
  const emptyText = document.getElementById('empty-state-text');

  const editModal = document.getElementById('edit-modal');
  const editModalClose = document.getElementById('edit-modal-close');
  const editForm = document.getElementById('edit-profile-form');

  /* ── Initialize ── */
  renderNav();
  renderNotifications();
  renderAssignments();

  // Show skeleton for a brief moment, then render
  setTimeout(() => {
    skeletonGrid.style.display = 'none';
    workersGrid.style.display = '';
    renderWorkers();
  }, 600);

  /* ── Render Nav ── */
  function renderNav() {
    navAvatar.src = getAvatarSrc(client);
    ddName.textContent = client.name;
    ddEmail.textContent = client.email;
  }

  /* ── Notifications for completed tasks ── */
  function renderNotifications() {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    const completedTasks = getCompletedUnconfirmedByClient(client.id);

    if (completedTasks.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = completedTasks.map(task => {
      const worker = getUserById(task.workerId);
      const workerName = worker ? escapeHtml(worker.name) : 'A worker';
      return `
        <div class="notification-banner anim-fade-in-up">
          <div class="notification-banner-icon">🔔</div>
          <div class="notification-banner-text">
            <strong>${workerName}</strong> has completed the task "<strong>${escapeHtml(task.title)}</strong>".
            Is the work done satisfactorily?
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button class="btn btn-primary btn-sm" onclick="handleConfirmTask('${task.id}')">✅ Confirm Done</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Confirm task handler
  window.handleConfirmTask = function(taskId) {
    const task = getAssignmentById(taskId);
    updateAssignment(taskId, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString()
    });
    // Increment worker's worksCompleted only after client approval
    if (task) {
      const worker = getUserById(task.workerId);
      if (worker) {
        updateUser(worker.id, { worksCompleted: (worker.worksCompleted || 0) + 1 });
      }
    }
    showToast('Task confirmed! You can now leave a review for this worker.', 'success');
    renderNotifications();
    renderAssignments();
  };

  /* ── My Assignments Section ── */
  function renderAssignments() {
    const section = document.getElementById('assignments-section');
    if (!section) return;

    const allAssignments = getAssignmentsByClient(client.id);
    if (allAssignments.length === 0) {
      section.innerHTML = '';
      return;
    }

    const active = allAssignments.filter(a => ['pending', 'accepted', 'not-started', 'ongoing'].includes(a.status));
    const completed = allAssignments.filter(a => ['completed', 'confirmed'].includes(a.status));
    const rejected = allAssignments.filter(a => a.status === 'rejected');

    section.innerHTML = `
      <div class="card anim-fade-in-up" style="margin-bottom:var(--sp-lg);">
        <h3 style="margin-bottom:var(--sp-md);">📋 My Assignments</h3>
        <div class="section-tabs" id="client-task-tabs">
          <button class="section-tab active" data-tab="c-active">Active <span class="tab-count">${active.length}</span></button>
          <button class="section-tab" data-tab="c-completed">Completed <span class="tab-count">${completed.length}</span></button>
          <button class="section-tab" data-tab="c-rejected">Rejected <span class="tab-count">${rejected.length}</span></button>
        </div>
        <div id="client-tasks-container"></div>
      </div>
    `;

    let currentTab = 'c-active';

    function renderClientTasks() {
      const container = document.getElementById('client-tasks-container');
      let tasks;
      switch (currentTab) {
        case 'c-active': tasks = active; break;
        case 'c-completed': tasks = completed; break;
        case 'c-rejected': tasks = rejected; break;
        default: tasks = active;
      }

      if (tasks.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:2rem;"><p class="empty-state-text">No tasks in this category.</p></div>`;
        return;
      }

      container.innerHTML = tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(task => {
        const worker = getUserById(task.workerId);
        const workerName = worker ? escapeHtml(worker.name) : 'Unknown Worker';
        const statusLabels = {
          pending: '⏳ Pending',
          accepted: '✅ Accepted',
          rejected: '❌ Rejected',
          'not-started': '📋 Not Started',
          ongoing: '🔄 Ongoing',
          completed: '✓ Completed',
          confirmed: '🏆 Confirmed'
        };

        let timeHtml = '';
        if (task.clientTimeEstimate || task.workerTimeEstimate) {
          timeHtml = '<div class="time-estimates">';
          if (task.clientTimeEstimate) {
            timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Your Estimate</div><div class="time-estimate-value">${escapeHtml(task.clientTimeEstimate)}</div></div>`;
          }
          if (task.workerTimeEstimate) {
            timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Worker's Estimate</div><div class="time-estimate-value">${escapeHtml(task.workerTimeEstimate)}</div></div>`;
          }
          timeHtml += '</div>';
        }

        let rejectionHtml = '';
        if (task.status === 'rejected' && task.rejectionReason) {
          rejectionHtml = `<div class="rejection-reason">❌ Reason: ${escapeHtml(task.rejectionReason)}</div>`;
        }

        let actionHtml = '';
        if (task.status === 'confirmed' && !task.reviewedAt) {
          actionHtml = `<div class="assignment-actions"><a href="worker-profile.html?id=${task.workerId}" class="btn btn-primary btn-sm">⭐ Leave Review</a></div>`;
        } else if (task.status === 'completed') {
          actionHtml = `<div class="assignment-actions"><button class="btn btn-primary btn-sm" onclick="handleConfirmTask('${task.id}')">✅ Confirm Done</button></div>`;
        }

        return `
          <div class="assignment-card">
            <div class="assignment-card-header">
              <div>
                <div class="assignment-card-title">${escapeHtml(task.title)}</div>
                <div class="assignment-worker-info">
                  ${worker ? `<img class="assignment-avatar" src="${getAvatarSrc(worker)}" alt="${workerName}">` : ''}
                  <span style="font-size:0.85rem;color:var(--text-muted);">Worker: <strong style="color:var(--text-primary);">${workerName}</strong></span>
                </div>
              </div>
              <span class="status-badge status-${task.status}">${statusLabels[task.status] || task.status}</span>
            </div>
            ${task.description ? `<div class="assignment-card-desc">${escapeHtml(task.description)}</div>` : ''}
            ${timeHtml}
            ${rejectionHtml}
            <div class="assignment-meta">
              <span class="assignment-meta-item">📅 Assigned: ${formatDate(task.createdAt)}</span>
              ${task.completedAt ? `<span class="assignment-meta-item">✅ Completed: ${formatDate(task.completedAt)}</span>` : ''}
              ${task.confirmedAt ? `<span class="assignment-meta-item">🏆 Confirmed: ${formatDate(task.confirmedAt)}</span>` : ''}
            </div>
            ${actionHtml}
          </div>
        `;
      }).join('');
    }

    renderClientTasks();

    // Tab switching
    document.querySelectorAll('#client-task-tabs .section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#client-task-tabs .section-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        renderClientTasks();
      });
    });
  }

  /* ── Render Workers ── */
  function renderWorkers() {
    let workers = getWorkers();

    // Search
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      workers = workers.filter(w =>
        w.name.toLowerCase().includes(query) ||
        w.category.toLowerCase().includes(query) ||
        w.bio.toLowerCase().includes(query) ||
        w.city.toLowerCase().includes(query)
      );
    }

    // Filter category
    const cat = filterCategory.value;
    if (cat) {
      workers = workers.filter(w => w.category === cat);
    }

    // Filter availability
    if (filterAvailability.value === 'available') {
      workers = workers.filter(w => w.availability);
    }

    // Sort
    const sort = filterSort.value;
    if (sort === 'highest-rated') {
      workers.sort((a, b) => getAverageRating(b) - getAverageRating(a));
    } else if (sort === 'most-reviews') {
      workers.sort((a, b) => (b.ratings?.length || 0) - (a.ratings?.length || 0));
    } else if (sort === 'most-experience') {
      workers.sort((a, b) => b.experience - a.experience);
    }

    // Empty state
    if (workers.length === 0) {
      workersGrid.style.display = 'none';
      emptyState.style.display = '';
      if (getWorkers().length === 0) {
        emptyTitle.textContent = 'No Workers Found';
        emptyText.textContent = 'No workers found. Be the first to join!';
      } else {
        emptyTitle.textContent = 'No Matches';
        emptyText.textContent = 'No workers match your search criteria. Try adjusting your filters.';
      }
      return;
    }

    emptyState.style.display = 'none';
    workersGrid.style.display = '';

    workersGrid.innerHTML = workers.map((w, i) => {
      const avg = getAverageRating(w);
      const reviewCount = w.ratings ? w.ratings.length : 0;
      return `
        <div class="worker-card stagger-${Math.min(i + 1, 6)}" style="animation-delay:${i * 0.07}s;">
          <div class="worker-card-header">
            <img class="worker-card-avatar" src="${getAvatarSrc(w)}" alt="${escapeHtml(w.name)}">
            <div class="worker-card-info">
              <div class="worker-card-name">${escapeHtml(w.name)}</div>
              <span class="${getCategoryBadgeClass(w.category)}">${escapeHtml(w.category)}</span>
              <div class="worker-card-city">📍 ${escapeHtml(w.city)}</div>
            </div>
          </div>
          <div class="worker-card-meta">
            <span class="${w.availability ? 'badge badge-available' : 'badge badge-busy'}">
              ${w.availability ? 'Available' : 'Busy'}
            </span>
            <span class="worker-card-meta-item">
              ${renderStars(avg)} <strong style="color:var(--accent);margin-left:4px;">${avg > 0 ? avg.toFixed(1) : 'N/A'}</strong>
            </span>
          </div>
          <div class="worker-card-meta">
            <span class="worker-card-meta-item"><span class="icon">✅</span> ${w.worksCompleted} jobs</span>
            <span class="worker-card-meta-item"><span class="icon">💬</span> ${reviewCount} reviews</span>
          </div>
          <p class="worker-card-bio">${escapeHtml(w.bio || 'No bio provided.')}</p>
          <div class="worker-card-footer">
            <a href="worker-profile.html?id=${w.id}" class="btn btn-primary btn-sm btn-block">View Full Profile</a>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ── Filter Event Listeners ── */
  searchInput.addEventListener('input', renderWorkers);
  filterCategory.addEventListener('change', renderWorkers);
  filterAvailability.addEventListener('change', renderWorkers);
  filterSort.addEventListener('change', renderWorkers);

  /* ── Profile Dropdown ── */
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

  /* ── Edit Profile Modal ── */
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    dropdown.classList.remove('active');
    document.getElementById('edit-name').value = client.name;
    document.getElementById('edit-phone').value = client.phone;
    document.getElementById('edit-city').value = client.city;
    editModal.classList.add('active');
  });

  editModalClose.addEventListener('click', () => editModal.classList.remove('active'));
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) editModal.classList.remove('active');
  });

  /* Profile picture in edit modal */
  document.getElementById('edit-picture').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateUser(client.id, { profilePicture: ev.target.result });
      client = getCurrentUser();
      renderNav();
      showToast('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);
  });

  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const city = document.getElementById('edit-city').value.trim();

    if (!name || !phone || !city) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    const btn = editForm.querySelector('.btn');
    btn.classList.add('loading');

    setTimeout(() => {
      btn.classList.remove('loading');
      updateUser(client.id, { name, phone, city });
      client = getCurrentUser();
      editModal.classList.remove('active');
      renderNav();
      showToast('Profile updated!', 'success');
    }, 500);
  });

  /* ── Escape HTML ── */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
