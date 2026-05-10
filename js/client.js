/* ========================================
   काम Khoj.com — Client Dashboard (client.js)
   ======================================== */

(function () {
  /* ── Auth Guard ── */
  const session = requireAuth('client');
  if (!session) return;

  let client = getCurrentUser();
  if (!client) { clearSession(); window.location.href = '../index.html'; return; }

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

  if (typeof onWfcDataUpdate === 'function') {
    onWfcDataUpdate(['users', 'assignments', 'payment_settings'], () => {
      const latest = getCurrentUser();
      if (!latest) {
        clearSession();
        window.location.href = '../index.html';
        return;
      }
      client = latest;
      renderNav();
      renderNotifications();
      renderAssignments();
      if (workersGrid && workersGrid.style.display !== 'none') {
        renderWorkers();
      }
    });
  }

  /* ── Render Nav ── */
  function renderNav() {
    navAvatar.src = getAvatarSrc(client);
    ddName.textContent = client.name;
    ddEmail.textContent = client.email;
  }

  /* ── Notifications ── */
  function renderNotifications() {
    const container = document.getElementById('notifications-container');
    if (!container) return;

    const allAssignments = getAssignmentsByClient(client.id);
    const completedTasks = allAssignments.filter(a => a.status === 'completed');
    const acceptedTasks = allAssignments.filter(a => ['accepted', 'not-started'].includes(a.status));
    const verifiedPayments = allAssignments.filter(a => a.paymentStatus === 'verified' && ['accepted', 'not-started', 'ongoing'].includes(a.status));

    const items = [];

    completedTasks.forEach(task => {
      const worker = getUserById(task.workerId);
      const workerName = worker ? escapeHtml(worker.name) : 'A worker';
      items.push(`
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
      `);
    });

    acceptedTasks.forEach(task => {
      const worker = getUserById(task.workerId);
      const workerName = worker ? escapeHtml(worker.name) : 'A worker';
      items.push(`
        <div class="notification-banner anim-fade-in-up">
          <div class="notification-banner-icon">✅</div>
          <div class="notification-banner-text">
            <strong>${workerName}</strong> accepted your task "<strong>${escapeHtml(task.title)}</strong>".
            You can coordinate the start time now.
          </div>
        </div>
      `);
    });

    verifiedPayments.forEach(task => {
      items.push(`
        <div class="notification-banner anim-fade-in-up">
          <div class="notification-banner-icon">💳</div>
          <div class="notification-banner-text">
            Payment for "<strong>${escapeHtml(task.title)}</strong>" has been verified.
            The worker can start the work.
          </div>
        </div>
      `);
    });

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:1.5rem;">
          <div class="empty-state-icon">✅</div>
          <p class="empty-state-text">You're all caught up. No new notifications.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.join('');
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

  // Cancel task handler
  window.handleCancelTask = function(taskId) {
    const task = getAssignmentById(taskId);
    if (!task) return;
    document.getElementById('cancel-task-id').value = taskId;
    document.getElementById('cancel-task-msg').innerHTML = `Are you sure you want to cancel the task "<strong style="color:var(--accent);">${escapeHtml(task.title)}</strong>"? This cannot be undone.`;
    document.getElementById('cancel-modal').classList.add('active');
  };

  // Cancel modal listeners
  const cancelModal = document.getElementById('cancel-modal');
  document.getElementById('cancel-modal-close').addEventListener('click', () => cancelModal.classList.remove('active'));
  cancelModal.addEventListener('click', (e) => { if (e.target === cancelModal) cancelModal.classList.remove('active'); });
  document.getElementById('cancel-modal-no').addEventListener('click', () => cancelModal.classList.remove('active'));
  document.getElementById('cancel-modal-yes').addEventListener('click', () => {
    const taskId = document.getElementById('cancel-task-id').value;
    updateAssignment(taskId, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    cancelModal.classList.remove('active');
    showToast('Task cancelled.', 'info');
    renderAssignments();
  });

  // Respond to worker's time proposal
  window.handleRespondToTime = function(taskId) {
    const task = getAssignmentById(taskId);
    if (!task) return;
    document.getElementById('counter-time-task-id').value = taskId;
    document.getElementById('counter-time-client').textContent = task.clientTimeEstimate || 'Not set';
    document.getElementById('counter-time-worker').textContent = task.workerTimeEstimate || 'Not set';
    document.getElementById('counter-time-value').value = '';
    document.getElementById('counter-time-error').classList.remove('visible');
    document.getElementById('counter-time-value').classList.remove('error');
    document.getElementById('counter-time-modal').classList.add('active');
  };

  // Counter time modal listeners
  const counterTimeModal = document.getElementById('counter-time-modal');
  document.getElementById('counter-time-modal-close').addEventListener('click', () => counterTimeModal.classList.remove('active'));
  counterTimeModal.addEventListener('click', (e) => { if (e.target === counterTimeModal) counterTimeModal.classList.remove('active'); });

  // Accept worker's proposed time
  document.getElementById('counter-time-accept').addEventListener('click', () => {
    const taskId = document.getElementById('counter-time-task-id').value;
    const task = getAssignmentById(taskId);
    if (task) {
      updateAssignment(taskId, { clientTimeEstimate: task.workerTimeEstimate });
    }
    counterTimeModal.classList.remove('active');
    showToast('Worker\'s time estimate accepted!', 'success');
    renderAssignments();
  });

  // Send a different time
  document.getElementById('counter-time-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newTime = document.getElementById('counter-time-value').value.trim();
    if (!newTime) {
      document.getElementById('counter-time-error').classList.add('visible');
      document.getElementById('counter-time-value').classList.add('error');
      return;
    }
    const taskId = document.getElementById('counter-time-task-id').value;
    updateAssignment(taskId, { clientTimeEstimate: newTime, workerTimeEstimate: '' });
    counterTimeModal.classList.remove('active');
    showToast('New time estimate sent to worker.', 'success');
    renderAssignments();
  });

  document.getElementById('counter-time-value').addEventListener('input', () => {
    document.getElementById('counter-time-error').classList.remove('visible');
    document.getElementById('counter-time-value').classList.remove('error');
  });

  // ═══ PRICE BARGAINING ═══

  // Respond to worker's price proposal
  window.handleRespondToPrice = function(taskId) {
    const task = getAssignmentById(taskId);
    if (!task) return;
    document.getElementById('counter-price-task-id').value = taskId;
    document.getElementById('counter-price-client').textContent = task.clientPriceEstimate || 'Not set';
    document.getElementById('counter-price-worker').textContent = task.workerPriceEstimate || 'Not set';
    document.getElementById('counter-price-value').value = '';
    document.getElementById('counter-price-error').classList.remove('visible');
    document.getElementById('counter-price-value').classList.remove('error');
    document.getElementById('counter-price-modal').classList.add('active');
  };

  // Counter price modal listeners
  const counterPriceModal = document.getElementById('counter-price-modal');
  document.getElementById('counter-price-modal-close').addEventListener('click', () => counterPriceModal.classList.remove('active'));
  counterPriceModal.addEventListener('click', (e) => { if (e.target === counterPriceModal) counterPriceModal.classList.remove('active'); });

  // Accept worker's proposed price
  document.getElementById('counter-price-accept').addEventListener('click', () => {
    const taskId = document.getElementById('counter-price-task-id').value;
    const task = getAssignmentById(taskId);
    if (task) {
      updateAssignment(taskId, { clientPriceEstimate: task.workerPriceEstimate });
    }
    counterPriceModal.classList.remove('active');
    showToast('Worker\'s price accepted!', 'success');
    renderAssignments();
  });

  // Send a different price
  document.getElementById('counter-price-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newPrice = document.getElementById('counter-price-value').value.trim();
    if (!newPrice) {
      document.getElementById('counter-price-error').classList.add('visible');
      document.getElementById('counter-price-value').classList.add('error');
      return;
    }
    const taskId = document.getElementById('counter-price-task-id').value;
    updateAssignment(taskId, { clientPriceEstimate: newPrice, workerPriceEstimate: '' });
    counterPriceModal.classList.remove('active');
    showToast('New price sent to worker.', 'success');
    renderAssignments();
  });

  document.getElementById('counter-price-value').addEventListener('input', () => {
    document.getElementById('counter-price-error').classList.remove('visible');
    document.getElementById('counter-price-value').classList.remove('error');
  });

  // ═══ PAYMENT FLOW ═══

  // Proceed to pay - open payment method selector
  window.handleProceedToPay = function(taskId) {
    document.getElementById('pay-task-id').value = taskId;
    document.getElementById('payment-method-modal').classList.add('active');
    // Reset selection
    document.querySelectorAll('.payment-method-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('pay-method-next').disabled = true;
  };

  // Payment method modal
  const payMethodModal = document.getElementById('payment-method-modal');
  document.getElementById('pay-method-modal-close').addEventListener('click', () => payMethodModal.classList.remove('active'));
  payMethodModal.addEventListener('click', (e) => { if (e.target === payMethodModal) payMethodModal.classList.remove('active'); });

  let selectedPayMethod = '';
  document.querySelectorAll('.payment-method-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-method-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedPayMethod = opt.dataset.method;
      document.getElementById('pay-method-next').disabled = false;
    });
  });

  // Next: show QR code for selected method
  document.getElementById('pay-method-next').addEventListener('click', () => {
    const taskId = document.getElementById('pay-task-id').value;
    payMethodModal.classList.remove('active');
    showQRCode(taskId, selectedPayMethod);
  });

  function showQRCode(taskId, method) {
    const settings = getPaymentSettings();
    let qrSrc = '';
    let methodLabel = '';
    let accountInfo = '';

    if (method === 'esewa') {
      qrSrc = settings.esewaQR;
      methodLabel = 'eSewa';
      accountInfo = settings.esewaName ? `Account: ${escapeHtml(settings.esewaName)}` : '';
    } else if (method === 'khalti') {
      qrSrc = settings.khaltiQR;
      methodLabel = 'Khalti';
      accountInfo = settings.khaltiName ? `Account: ${escapeHtml(settings.khaltiName)}` : '';
    } else if (method === 'bank') {
      qrSrc = settings.bankQR;
      methodLabel = 'Bank Transfer';
      accountInfo = '';
      if (settings.bankName) accountInfo += `Bank: ${escapeHtml(settings.bankName)}`;
      if (settings.bankAccountNumber) accountInfo += `<br>Account #: ${escapeHtml(settings.bankAccountNumber)}`;
    }

    document.getElementById('qr-method-label').textContent = methodLabel;
    const qrImg = document.getElementById('qr-code-image');
    if (qrSrc) {
      qrImg.src = qrSrc;
      qrImg.style.display = 'block';
      document.getElementById('qr-no-code').style.display = 'none';
    } else {
      qrImg.style.display = 'none';
      document.getElementById('qr-no-code').style.display = 'block';
    }
    document.getElementById('qr-account-info').innerHTML = accountInfo;
    document.getElementById('qr-task-id').value = taskId;
    document.getElementById('qr-method-value').value = method;
    document.getElementById('qr-code-modal').classList.add('active');
  }

  // QR code modal
  const qrModal = document.getElementById('qr-code-modal');
  document.getElementById('qr-modal-close').addEventListener('click', () => qrModal.classList.remove('active'));
  qrModal.addEventListener('click', (e) => { if (e.target === qrModal) qrModal.classList.remove('active'); });

  // Upload screenshot button
  document.getElementById('qr-upload-btn').addEventListener('click', () => {
    qrModal.classList.remove('active');
    const taskId = document.getElementById('qr-task-id').value;
    const method = document.getElementById('qr-method-value').value;
    document.getElementById('screenshot-task-id').value = taskId;
    document.getElementById('screenshot-method').value = method;
    document.getElementById('screenshot-preview').style.display = 'none';
    document.getElementById('screenshot-input').value = '';
    document.getElementById('screenshot-submit').disabled = true;
    document.getElementById('screenshot-modal').classList.add('active');
  });

  // Screenshot modal
  const ssModal = document.getElementById('screenshot-modal');
  document.getElementById('screenshot-modal-close').addEventListener('click', () => ssModal.classList.remove('active'));
  ssModal.addEventListener('click', (e) => { if (e.target === ssModal) ssModal.classList.remove('active'); });

  document.getElementById('screenshot-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Screenshot must be under 3MB', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, 800, 0.6);
      const preview = document.getElementById('screenshot-preview');
      preview.src = compressed;
      preview.style.display = 'block';
      document.getElementById('screenshot-submit').disabled = false;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('screenshot-submit').addEventListener('click', () => {
    const taskId = document.getElementById('screenshot-task-id').value;
    const method = document.getElementById('screenshot-method').value;
    const preview = document.getElementById('screenshot-preview');
    if (!preview.src || preview.style.display === 'none') {
      showToast('Please upload a screenshot first', 'error');
      return;
    }
    updateAssignment(taskId, {
      paymentMethod: method,
      paymentScreenshot: preview.src,
      paymentStatus: 'submitted',
      paymentSubmittedAt: new Date().toISOString()
    });
    ssModal.classList.remove('active');
    showToast('Payment screenshot submitted for verification!', 'success');
    renderAssignments();
  });

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
    const cancelled = allAssignments.filter(a => a.status === 'cancelled');

    section.innerHTML = `
      <div class="card anim-fade-in-up" style="margin-bottom:var(--sp-lg);">
        <h3 style="margin-bottom:var(--sp-md);">📋 My Assignments</h3>
        <div class="section-tabs" id="client-task-tabs">
          <button class="section-tab active" data-tab="c-active">Active <span class="tab-count">${active.length}</span></button>
          <button class="section-tab" data-tab="c-completed">Completed <span class="tab-count">${completed.length}</span></button>
          <button class="section-tab" data-tab="c-rejected">Rejected <span class="tab-count">${rejected.length}</span></button>
          <button class="section-tab" data-tab="c-cancelled">Cancelled <span class="tab-count">${cancelled.length}</span></button>
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
        case 'c-cancelled': tasks = cancelled; break;
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
          cancelled: '🚫 Cancelled',
          'not-started': '📋 Not Started',
          ongoing: '🔄 Ongoing',
          completed: '✓ Completed',
          confirmed: '🏆 Confirmed'
        };

        let timeHtml = '';
        if (task.clientTimeEstimate || task.workerTimeEstimate) {
          timeHtml = '<div class="time-estimates">';
          if (task.clientTimeEstimate) {
            timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Your Time Estimate</div><div class="time-estimate-value">${escapeHtml(task.clientTimeEstimate)}</div></div>`;
          }
          if (task.workerTimeEstimate) {
            timeHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Worker's Time Estimate</div><div class="time-estimate-value">${escapeHtml(task.workerTimeEstimate)}</div></div>`;
          }
          timeHtml += '</div>';
        }

        let priceHtml = '';
        if (task.clientPriceEstimate || task.workerPriceEstimate) {
          priceHtml = '<div class="time-estimates">';
          if (task.clientPriceEstimate) {
            priceHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Your Price</div><div class="time-estimate-value">${escapeHtml(task.clientPriceEstimate)}</div></div>`;
          }
          if (task.workerPriceEstimate) {
            priceHtml += `<div class="time-estimate-item"><div class="time-estimate-label">Worker's Price</div><div class="time-estimate-value">${escapeHtml(task.workerPriceEstimate)}</div></div>`;
          }
          priceHtml += '</div>';
        }

        // Payment status display
        let paymentHtml = '';
        if (task.paymentStatus) {
          const payStatusLabels = {
            submitted: '⏳ Payment Under Review',
            verified: '✅ Payment Verified',
            rejected: '❌ Payment Rejected'
          };
          const payStatusClass = task.paymentStatus === 'verified' ? 'payment-verified' : task.paymentStatus === 'rejected' ? 'payment-rejected' : 'payment-pending';
          paymentHtml = `<div class="payment-status-badge ${payStatusClass}">${payStatusLabels[task.paymentStatus] || task.paymentStatus}</div>`;
        }

        let rejectionHtml = '';
        if (task.status === 'rejected' && task.rejectionReason) {
          rejectionHtml = `<div class="rejection-reason">❌ Reason: ${escapeHtml(task.rejectionReason)}</div>`;
        }

        let actionHtml = '';
        // Cancel button for tasks not yet started (pending, accepted, not-started)
        const canCancel = ['pending', 'accepted', 'not-started'].includes(task.status);
        // Time negotiation: worker proposed a different time
        const hasWorkerTimeProposal = task.workerTimeEstimate && task.workerTimeEstimate !== task.clientTimeEstimate;
        // Price negotiation: worker proposed a different price
        const hasWorkerPriceProposal = task.workerPriceEstimate && task.workerPriceEstimate !== task.clientPriceEstimate;
        // Ready for payment check
        const readyForPay = isReadyForPayment(task);

        if (task.status === 'confirmed' && !task.reviewedAt) {
          actionHtml = `<div class="assignment-actions"><a href="worker-profile.html?id=${task.workerId}" class="btn btn-primary btn-sm">⭐ Leave Review</a></div>`;
        } else if (task.status === 'completed') {
          actionHtml = `<div class="assignment-actions"><button class="btn btn-primary btn-sm" onclick="handleConfirmTask('${task.id}')">✅ Confirm Done</button></div>`;
        }

        // Proceed to Pay button
        if (readyForPay) {
          actionHtml += `<div class="assignment-actions" style="margin-top:6px;"><button class="btn btn-success btn-sm" onclick="handleProceedToPay('${task.id}')">💳 Proceed to Pay</button></div>`;
        }

        // Re-upload if payment was rejected
        if (task.paymentStatus === 'rejected' && ['not-started', 'accepted'].includes(task.status)) {
          actionHtml += `<div class="assignment-actions" style="margin-top:6px;"><button class="btn btn-primary btn-sm" onclick="handleProceedToPay('${task.id}')">💳 Re-submit Payment</button></div>`;
        }

        // Add cancel + time/price response buttons for active tasks
        if (canCancel || (hasWorkerTimeProposal && ['pending', 'accepted', 'not-started', 'ongoing'].includes(task.status)) || (hasWorkerPriceProposal && ['pending', 'accepted', 'not-started', 'ongoing'].includes(task.status))) {
          actionHtml += '<div class="assignment-actions" style="margin-top:6px;">';
          if (hasWorkerTimeProposal && ['pending', 'accepted', 'not-started', 'ongoing'].includes(task.status)) {
            actionHtml += `<button class="btn btn-secondary btn-sm" onclick="handleRespondToTime('${task.id}')">⏱ Respond to Time</button>`;
          }
          if (hasWorkerPriceProposal && ['pending', 'accepted', 'not-started', 'ongoing'].includes(task.status)) {
            actionHtml += `<button class="btn btn-secondary btn-sm" onclick="handleRespondToPrice('${task.id}')">💰 Respond to Price</button>`;
          }
          if (canCancel) {
            actionHtml += `<button class="btn btn-danger btn-sm" onclick="handleCancelTask('${task.id}')">🚫 Cancel Task</button>`;
          }
          actionHtml += '</div>';
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
            ${priceHtml}
            ${paymentHtml}
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
    window.location.href = '../index.html';
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
