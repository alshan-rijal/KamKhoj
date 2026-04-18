/* ========================================
   काम Khoj.com — Static Pages Logic
   Renders About/Contact content from site settings.
   ======================================== */

(function () {
  const settings = typeof getSiteSettings === 'function' ? getSiteSettings() : null;
  if (!settings) return;

  applyBrand(settings.brand);
  renderAbout(settings);
  renderContact(settings);

  function applyBrand(brand) {
    document.querySelectorAll('[data-brand-nepali]').forEach((el) => {
      el.textContent = brand.nepali || brand.hindi || 'काम';
    });
    document.querySelectorAll('[data-brand-latin]').forEach((el) => {
      el.textContent = brand.latin;
    });
  }

  function renderAbout(site) {
    const title = document.getElementById('about-title');
    const description = document.getElementById('about-description');
    if (!title || !description) return;

    const staticAbout = typeof getStaticAboutContent === 'function' ? getStaticAboutContent() : site.about;
    title.textContent = staticAbout.title;
    description.textContent = staticAbout.description;

    const slides = document.getElementById('founder-slides');
    if (!slides) return;

    const founder = typeof getAboutDeveloper === 'function'
      ? getAboutDeveloper()
      : (Array.isArray(site.founders) ? site.founders[0] : null);
    if (!founder) {
      slides.innerHTML = '<p class="text-muted">Developer profile is coming soon.</p>';
      return;
    }

    slides.innerHTML = `
      <article class="founder-slide founder-single">
        <img class="founder-photo" src="${escapeHtml(founder.image)}" alt="${escapeHtml(founder.name)}">
        <div>
          <div class="founder-role">${escapeHtml(founder.role)}</div>
          <h2 class="founder-name">${escapeHtml(founder.name)}</h2>
          <p class="founder-title">${escapeHtml(founder.title)}</p>
          <p>${escapeHtml(founder.bio)}</p>
          <p style="margin-top:12px;"><a href="${escapeHtml(founder.linkedin)}" target="_blank" rel="noreferrer">View profile</a></p>
        </div>
      </article>
    `;
  }

  function renderContact(site) {
    const heading = document.getElementById('contact-title');
    if (!heading) return;

    heading.textContent = site.contact.heading;
    setText('contact-email', site.contact.email);
    setText('contact-phone', site.contact.phone);
    setText('contact-address', site.contact.address);
    setText('contact-hours', site.contact.supportHours);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function escapeHtml(str) {
    const value = str == null ? '' : String(str);
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
})();
