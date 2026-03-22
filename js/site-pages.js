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

    title.textContent = site.about.title;
    description.textContent = site.about.description;

    const slides = document.getElementById('founder-slides');
    if (!slides) return;

    const founders = Array.isArray(site.founders) ? site.founders.slice(0, 2) : [];
    slides.innerHTML = founders.map((f) => `
      <article class="founder-slide">
        <img class="founder-photo" src="${escapeHtml(f.image)}" alt="${escapeHtml(f.name)}">
        <div>
          <div class="founder-role">${escapeHtml(f.role)}</div>
          <h2 class="founder-name">${escapeHtml(f.name)}</h2>
          <p class="founder-title">${escapeHtml(f.title)}</p>
          <p>${escapeHtml(f.bio)}</p>
          <p style="margin-top:12px;"><a href="${escapeHtml(f.linkedin)}" target="_blank" rel="noreferrer">View profile</a></p>
        </div>
      </article>
    `).join('');

    setupSlider(founders.length);
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

  function setupSlider(total) {
    if (total <= 1) return;

    const slidesEl = document.getElementById('founder-slides');
    const dotsEl = document.getElementById('slider-dots');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    if (!slidesEl || !dotsEl || !prevBtn || !nextBtn) return;

    let index = 0;
    dotsEl.innerHTML = Array.from({ length: total }).map((_, i) =>
      `<button class="slider-dot ${i === 0 ? 'active' : ''}" type="button" data-slide="${i}" aria-label="Go to slide ${i + 1}"></button>`
    ).join('');

    const dots = Array.from(dotsEl.querySelectorAll('.slider-dot'));

    function paint() {
      slidesEl.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    prevBtn.addEventListener('click', () => {
      index = (index - 1 + total) % total;
      paint();
    });

    nextBtn.addEventListener('click', () => {
      index = (index + 1) % total;
      paint();
    });

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        index = Number(dot.dataset.slide);
        paint();
      });
    });
  }

  function escapeHtml(str) {
    const value = str == null ? '' : String(str);
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
})();
