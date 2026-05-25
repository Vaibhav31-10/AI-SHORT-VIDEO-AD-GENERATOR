/* ============================================================
   AdVision AI — contact.js  (Contact form + EmailJS)
   ============================================================ */

'use strict';

// ── EmailJS Config (optional — degrades gracefully) ───────────
const EMAIL_CONFIG = {
  serviceId:  localStorage.getItem('advision_emailjs_service')   || '',
  templateId: localStorage.getItem('advision_emailjs_template')  || '',
  publicKey:  localStorage.getItem('advision_emailjs_key')       || ''
};

// ── Contact Form ──────────────────────────────────────────────
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Character counter for message
  const msgArea  = document.getElementById('contact-message');
  const charCount = document.getElementById('char-count');
  if (msgArea && charCount) {
    msgArea.addEventListener('input', () => {
      charCount.textContent = msgArea.value.length;
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearFormErrors(form);

    const name    = form.querySelector('#contact-name').value.trim();
    const email   = form.querySelector('#contact-email').value.trim().toLowerCase();
    const subject = form.querySelector('#contact-subject').value.trim();
    const message = form.querySelector('#contact-message').value.trim();

    let valid = true;
    if (!name)           { showFieldError('contact-name',    'Please enter your name');    valid = false; }
    if (!isValidEmail(email)) { showFieldError('contact-email', 'Enter a valid email address'); valid = false; }
    if (!subject)        { showFieldError('contact-subject', 'Please enter a subject');    valid = false; }
    if (message.length < 20) { showFieldError('contact-message', 'Message must be at least 20 characters'); valid = false; }
    if (!valid) return;

    // Show loading state
    const submitBtn = document.getElementById('contact-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Sending...';

    const success = await sendEmail({ name, email, subject, message });

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Send Message 🚀';

    if (success) {
      form.reset();
      if (charCount) charCount.textContent = '0';
      showSuccessState();
      Toast.show('Message sent! We\'ll get back to you within 24 hours.', 'success', 5000);
    } else {
      Toast.show('Message logged locally. (Configure EmailJS for real delivery)', 'info', 5000);
      form.reset();
      if (charCount) charCount.textContent = '0';
      showSuccessState();
    }
  });
}

async function sendEmail(data) {
  // Try EmailJS if configured
  if (EMAIL_CONFIG.serviceId && EMAIL_CONFIG.templateId && EMAIL_CONFIG.publicKey) {
    try {
      if (typeof emailjs === 'undefined') return false;
      await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, {
        from_name: data.name,
        from_email: data.email,
        subject: data.subject,
        message: data.message,
        reply_to: data.email
      });
      return true;
    } catch (err) {
      console.warn('EmailJS error:', err);
      return false;
    }
  }

  // Fallback: save to localStorage
  const messages = JSON.parse(localStorage.getItem('advision_contact_messages') || '[]');
  messages.push({ ...data, timestamp: new Date().toISOString(), id: Date.now() });
  localStorage.setItem('advision_contact_messages', JSON.stringify(messages));
  return false;
}

function showSuccessState() {
  const form    = document.getElementById('contact-form-wrapper');
  const success = document.getElementById('contact-success');
  if (form)    form.style.display    = 'none';
  if (success) success.style.display = '';
}

// ── Contact back button ───────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.id === 'contact-try-again') {
    const form    = document.getElementById('contact-form-wrapper');
    const success = document.getElementById('contact-success');
    if (form)    form.style.display    = '';
    if (success) success.style.display = 'none';
  }
});

// ── EmailJS Settings ──────────────────────────────────────────
function initEmailJSSettings() {
  const saveBtn = document.getElementById('save-emailjs');
  if (!saveBtn) return;

  const fields = {
    service:  document.getElementById('emailjs-service'),
    template: document.getElementById('emailjs-template'),
    key:      document.getElementById('emailjs-key')
  };

  // Pre-fill
  if (fields.service)  fields.service.value  = EMAIL_CONFIG.serviceId;
  if (fields.template) fields.template.value = EMAIL_CONFIG.templateId;
  if (fields.key)      fields.key.value      = EMAIL_CONFIG.publicKey;

  saveBtn.addEventListener('click', () => {
    if (fields.service)  localStorage.setItem('advision_emailjs_service',  fields.service.value.trim());
    if (fields.template) localStorage.setItem('advision_emailjs_template', fields.template.value.trim());
    if (fields.key)      localStorage.setItem('advision_emailjs_key',      fields.key.value.trim());
    Toast.show('EmailJS config saved!', 'success');
    closeModal('emailjs-modal');
  });
}

// ── Map embed ─────────────────────────────────────────────────
function initMap() {
  const mapEl = document.getElementById('contact-map');
  if (!mapEl) return;
  // Google Maps embed (no API key needed for embed iframes)
  mapEl.src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3502.083955!2d77.208!3d28.635!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjjCsDM4JzA2LjAiTiA3N8KwMTInMjguOCJF!5e0!3m2!1sen!2sin!4v1234567890";
}

// ── FAQ ───────────────────────────────────────────────────────
function initContactFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        const ans = i.querySelector('.faq-a');
        if (ans) ans.style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const group = el.closest('.form-group');
  if (group) {
    group.classList.add('has-error');
    const err = group.querySelector('.form-error');
    if (err) err.textContent = msg;
  }
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
}

// ── Spinner style ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const s = document.createElement('style');
  s.textContent = `.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}`;
  document.head.appendChild(s);

  initContactForm();
  initEmailJSSettings();
  initMap();
  initContactFAQ();
});
