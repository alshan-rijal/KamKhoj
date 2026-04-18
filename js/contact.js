/* ========================================
   काम Khoj.com — Contact Page Logic
   Shows logged-in user details and support chat.
   ======================================== */

(function () {
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  renderCurrentUserCard(currentUser);
  renderChat(currentUser);

  function renderCurrentUserCard(user) {
    const wrap = document.getElementById('contact-current-user');
    if (!wrap) return;

    if (!user) {
      wrap.innerHTML = `
        <div class="contact-user-empty">
          <h3>Login required for support chat</h3>
          <p>Please login as a client or worker to send support queries.</p>
          <a class="btn btn-primary" href="../index.html#login">Go to Login</a>
        </div>
      `;
      return;
    }

    const roleLabel = user.type === 'worker' ? 'Worker' : 'Client';
    const avatar = typeof getAvatarSrc === 'function' ? getAvatarSrc(user) : '';

    wrap.innerHTML = `
      <div class="contact-user-profile">
        <img class="contact-user-avatar" src="${esc(avatar)}" alt="${esc(user.name)}">
        <div class="contact-user-meta">
          <div class="contact-user-role">${roleLabel}</div>
          <h3>${esc(user.name)}</h3>
          <div class="contact-user-grid">
            <span>📧 ${esc(user.email || '-')}</span>
            <span>📞 ${esc(user.phone || '-')}</span>
            <span>📍 ${esc(user.city || '-')}</span>
            <span>🆔 ${esc(user.id)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderChat(user) {
    const listEl = document.getElementById('contact-chat-list');
    const formEl = document.getElementById('contact-chat-form');
    const inputEl = document.getElementById('contact-chat-input');
    const topicEl = document.getElementById('contact-chat-topic');
    const helperEl = document.getElementById('contact-chat-helper');

    if (!listEl || !formEl || !inputEl || !helperEl || !topicEl) return;

    paintThread();

    if (!user) {
      formEl.classList.add('is-disabled');
      inputEl.disabled = true;
      topicEl.disabled = true;
      helperEl.textContent = 'Only existing logged-in users can send support messages.';
      return;
    }

    helperEl.textContent = `You are logged in as ${user.name} (${user.type}). Keep chatting here in the same support thread.`;
    startAutoRefresh();

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;
      const topic = topicEl.value;

      const result = createContactQuery({ senderId: user.id, message: text, topic });
      if (!result.success) {
        showToast(result.error, 'error');
        return;
      }

      inputEl.value = '';
      paintThread();
      showToast('Message sent in your support thread.', 'success');
    });

    function startAutoRefresh() {
      let lastSignature = getThreadSignature();

      const refreshTick = async (forcePaint) => {
        await syncContactQueriesFromFirestore();
        const currentSignature = getThreadSignature();
        if (forcePaint || currentSignature !== lastSignature) {
          lastSignature = currentSignature;
          paintThread();
        }
      };

      refreshTick(true);

      const intervalId = setInterval(() => {
        refreshTick(false);
      }, 1200);

      window.addEventListener('focus', () => refreshTick(true));
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshTick(true);
      });
      window.addEventListener('beforeunload', () => clearInterval(intervalId), { once: true });
    }

    function getThreadSignature() {
      const items = getContactQueriesForUser(user.id);
      return JSON.stringify(items.map((item) => ({
        id: item.id,
        status: item.status,
        updated: item.lastUpdatedAt || item.createdAt,
        replies: Array.isArray(item.replies) ? item.replies.length : 0,
        adminSeen: item.adminLastSeenAt || '',
        userSeen: item.userLastSeenAt || ''
      })));
    }

    function paintThread() {
      const items = user ? getContactQueriesForUser(user.id) : [];
      if (!items.length) {
        listEl.innerHTML = '<p class="contact-chat-empty">No support ticket yet. Start by sending your first message.</p>';
        return;
      }

      listEl.innerHTML = items
        .slice()
        .reverse()
        .map((item) => {
          const replies = Array.isArray(item.replies) ? item.replies : [];
          const status = normalizeTicketStatus(item.status);
          const topic = formatTopic(item.topic);
          const updatedAt = item.lastUpdatedAt || item.createdAt;
          const statusLabel = status === 'replied' ? 'replied' : 'not replied';
          return `
            <article class="contact-thread-item">
              <div class="contact-thread-head">
                <strong>Ticket #${esc(item.id.slice(0, 8))}</strong>
                <span class="ticket-topic">${esc(topic)}</span>
                <span class="ticket-status ticket-status-${esc(status)}">${esc(statusLabel)}</span>
              </div>
              <div class="chat-bubble chat-bubble-user">
                <div>${esc(item.message)}</div>
                <span>${formatTime(item.createdAt)}</span>
                <div class="chat-read-indicator">${getAdminSeenText(item)}</div>
              </div>
              ${replies
                .map(
                  (reply) => `
                    <div class="chat-bubble ${reply.senderType === 'admin' || reply.senderType === 'developer' ? 'chat-bubble-dev' : 'chat-bubble-user'}">
                      <div class="chat-bubble-author">${esc(reply.senderName || 'Support')}</div>
                      <div>${esc(reply.message)}</div>
                      <span>${formatTime(reply.createdAt)}</span>
                      <div class="chat-read-indicator">${getReplyReadText(item, reply)}</div>
                    </div>
                  `
                )
                .join('')}
              <div class="contact-thread-updated">Updated: ${formatTime(updatedAt)}</div>
            </article>
          `;
        })
        .join('');

      markUserReadIfNeeded(items);
    }

    function markUserReadIfNeeded(items) {
      const unread = items.filter(hasUnreadAdminReplyForUser);
      if (!unread.length) return;
      unread.forEach((item) => markContactQueryAsSeen(item.id, 'user'));
    }

    function hasUnreadAdminReplyForUser(item) {
      const replies = Array.isArray(item.replies) ? item.replies : [];
      const latestAdminReply = replies
        .filter((r) => r.senderType === 'admin' || r.senderType === 'developer')
        .map((r) => new Date(r.createdAt || 0).getTime())
        .reduce((max, t) => Math.max(max, t), 0);
      if (!latestAdminReply) return false;
      const seenAt = new Date(item.userLastSeenAt || 0).getTime();
      return seenAt < latestAdminReply;
    }

    function getAdminSeenText(item) {
      const seen = item.adminLastSeenAt;
      return seen ? `Seen by admin · ${formatTime(seen)}` : 'Sent';
    }

    function getUserReadText(item, reply) {
      const replyTs = new Date(reply.createdAt || 0).getTime();
      const seenTs = new Date(item.userLastSeenAt || 0).getTime();
      return seenTs >= replyTs ? 'Read' : 'Delivered';
    }

    function getReplyReadText(item, reply) {
      if (reply.senderType === 'admin' || reply.senderType === 'developer') {
        return getUserReadText(item, reply);
      }
      return getAdminSeenText(item);
    }

    function normalizeTicketStatus(status) {
      if (status === 'replied' || status === 'closed') return 'replied';
      return 'not_replied';
    }
  }

  async function syncContactQueriesFromFirestore() {
    if (!window._db || !window._fs || !window._fs.getDoc || !window._fs.doc) return;

    try {
      const snapshot = await window._fs.getDoc(window._fs.doc(window._db, 'config', 'contact_queries'));
      if (!snapshot.exists()) return;

      const latest = snapshot.data().queries || [];
      window._wfcContactQueriesCache = latest;
      localStorage.setItem('wfc_contact_queries', JSON.stringify(latest));
    } catch (_e) {
      // Keep silent; chat still works with local cache when network is unstable.
    }
  }

  function formatTopic(topic) {
    const map = {
      general: 'General Help',
      account: 'Account / Login',
      payment: 'Payments',
      assignment: 'Assignments',
      profile: 'Profile Update'
    };
    return map[topic] || 'General Help';
  }

  function formatTime(iso) {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });
  }

  function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }
})();
