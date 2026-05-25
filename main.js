/* ============================================================
   AdVision AI — main.js  (v5 — Unified Auth + Auto-Migration)
   Fixes: old-format user migration, dual-hash login, session recovery
   ============================================================ */
'use strict';

/* ── Storage keys ───────────────────────────────────────────── */
const USERS_KEY   = 'advision_users_v3';   // new: object keyed by email
const SESSION_KEY = 'advision_session_v3'; // new session format
const OLD_USERS_KEY   = 'advision_users';  // legacy: JSON array
const OLD_SESSION_KEY = 'advision_user';   // legacy: JSON object

/* ── Constants ──────────────────────────────────────────────── */
const FREE_CREDITS      = 100;
const CREDITS_PER_VIDEO = 10;

/* ── Password encode (consistent across ALL versions) ──────── */
/* Using the same btoa approach as the original auth system     */
function encodePass(str) {
  try { return btoa(encodeURIComponent(str)); }
  catch (e) {
    // Fallback for special chars
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return 'h' + Math.abs(h).toString(36);
  }
}

/* ── DB helpers ──────────────────────────────────────────────── */
function getDB()    { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch { return {}; } }
function saveDB(db) { try { localStorage.setItem(USERS_KEY, JSON.stringify(db)); } catch(e) { console.error('saveDB:', e); } }

function getSession()  {
  // Try new session first
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s?.email) return s;
  } catch {}
  return null;
}
function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }

/* ── Auto-migration from old array format ────────────────────
   Runs ONCE on every page load — silently converts old accounts
   stored in 'advision_users' (array) → 'advision_users_v3' (object)
   Passwords stay identical (same btoa encoding) so login works instantly
   ──────────────────────────────────────────────────────────── */
function migrateOldUsers() {
  try {
    const raw = localStorage.getItem(OLD_USERS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return;
    const db = getDB();
    let count = 0;
    arr.forEach(u => {
      if (!u?.email) return;
      const em = u.email.toLowerCase().trim();
      if (!db[em]) {
        db[em] = {
          name:   u.name  || 'User',
          email:  em,
          pwd:    u.password || '',   // already btoa-encoded — reuse directly
          credits: u.credits != null ? u.credits : FREE_CREDITS,
          plan:   u.plan   || 'free',
          joined: u.created ? new Date(u.created).getTime() : Date.now(),
          videos: u.videosCreated || 0,
          txns:   []
        };
        count++;
      }
    });
    if (count > 0) {
      saveDB(db);
      console.log('[AdVision] Migrated', count, 'legacy account(s) to new format.');
    }
  } catch (e) { console.warn('[AdVision] Migration error:', e); }
}

/* ── Auto-migrate old session ───────────────────────────────── */
function migrateOldSession() {
  if (getSession()) return; // already have a valid new session
  try {
    const raw = localStorage.getItem(OLD_SESSION_KEY);
    if (!raw) return;
    const old = JSON.parse(raw);
    if (!old?.email) return;
    // Run user migration first so DB is populated
    migrateOldUsers();
    const db = getDB();
    const user = db[old.email.toLowerCase().trim()];
    if (user) {
      saveSession({
        name:    user.name,
        email:   user.email,
        credits: user.credits ?? FREE_CREDITS,
        plan:    user.plan ?? 'free',
        videos:  user.videos ?? 0
      });
      console.log('[AdVision] Migrated legacy session for', user.email);
    }
    // Don't remove old session key — let studio.js handle that after login check
  } catch (e) { console.warn('[AdVision] Session migration error:', e); }
}

/* ── Auth ────────────────────────────────────────────────────── */
const Auth = {

  register(name, email, password) {
    if (!name || !email || !password) return { error: 'All fields are required.' };
    if (password.length < 6)          return { error: 'Password must be at least 6 characters.' };
    email = email.toLowerCase().trim();
    const db = getDB();
    if (db[email]) return { error: 'An account with this email already exists.' };
    // Also check old-format array to prevent duplicate signups
    try {
      const old = JSON.parse(localStorage.getItem(OLD_USERS_KEY) || '[]');
      if (Array.isArray(old) && old.find(u => u.email === email)) {
        // Migrate their old account first, then reject duplicate
        migrateOldUsers();
        return { error: 'An account with this email already exists. Please sign in.' };
      }
    } catch {}
    const newUser = {
      name:    name.trim(),
      email,
      pwd:     encodePass(password),
      credits: FREE_CREDITS,
      plan:    'free',
      joined:  Date.now(),
      videos:  0,
      txns:    []
    };
    db[email] = newUser;
    saveDB(db);
    localStorage.setItem('advision_remembered_email', email);
    this._startSession(newUser);
    return { success: true };
  },

  login(email, password) {
    email = (email || '').toLowerCase().trim();
    // Demo account shortcut
    if (email === 'demo@advision.ai' && password === 'demo1234') {
      const db = getDB();
      if (!db[email]) {
        db[email] = { name:'Demo User', email, pwd:encodePass('demo1234'), credits:100, plan:'pro', joined:Date.now(), videos:0, txns:[] };
        saveDB(db);
      }
      localStorage.setItem('advision_remembered_email', email);
      this._startSession(db[email]); return { success: true };
    }
    // Run migration first so old-format users are accessible
    migrateOldUsers();
    const db = getDB();
    let user = db[email];
    if (!user) return { error: 'No account found with this email. Please sign up first.' };
    
    // Check multiple encodings to seamlessly handle all historical hashes
    const fnvHash = (() => {
      const salted = password + '|adv_9x72k_salt|' + password.length;
      let h = 0x811c9dc5;
      for (let i = 0; i < salted.length; i++) { h ^= salted.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      return h.toString(16).padStart(8, '0') + salted.length.toString(16);
    })();
    const btoaPass = (() => { try { return btoa(password); } catch { return null; } })();
    
    const candidateEncodings = [
      encodePass(password), // standard
      btoaPass,             // legacy base64
      password,             // legacy plain text
      fnvHash               // legacy interim hash
    ];
    
    if (!candidateEncodings.includes(user.pwd)) {
      return { error: 'Incorrect password. Please try again.' };
    }
    
    // Upgrade password silently if they logged in with a legacy hash
    if (user.pwd !== encodePass(password)) {
      user.pwd = encodePass(password);
      db[email] = user; 
      saveDB(db);
    }
    
    localStorage.setItem('advision_remembered_email', email);
    this._startSession(user); 
    return { success: true };
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(OLD_SESSION_KEY);
    Toast.show('Signed out successfully.', 'info');
    setTimeout(() => { window.location.href = 'auth.html'; }, 700);
  },

  isLoggedIn()  { return !!getSession(); },
  getUser()     { return getSession(); },
  getCredits()  { return getSession()?.credits ?? 0; },
  hasCredits()  { return this.getCredits() >= CREDITS_PER_VIDEO; },

  deductCredits() {
    const s = getSession(); if (!s) return false;
    if (s.credits < CREDITS_PER_VIDEO) return false;
    s.credits -= CREDITS_PER_VIDEO; s.videos = (s.videos||0) + 1;
    saveSession(s);
    const db = getDB();
    if (db[s.email]) { db[s.email].credits = s.credits; db[s.email].videos = s.videos; saveDB(db); }
    return true;
  },

  addCredits(amount, planName) {
    const s = getSession(); if (!s) return false;
    s.credits += amount; if (planName) s.plan = planName;
    saveSession(s);
    const db = getDB();
    const email = (s.email || '').toLowerCase().trim();
    if (db[email]) {
      db[email].credits = s.credits; if (planName) db[email].plan = planName;
      db[email].txns = db[email].txns || [];
      db[email].txns.push({ date: Date.now(), credits: amount, plan: planName });
      saveDB(db);
    }
    return true;
  },

  _startSession(user) {
    saveSession({
      name:    user.name,
      email:   user.email,
      credits: user.credits ?? FREE_CREDITS,
      plan:    user.plan    ?? 'free',
      videos:  user.videos  ?? 0
    });
  }
};

/* ── Toast ───────────────────────────────────────────────────── */
const Toast = {
  container: null,
  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 3500) {
    if (!this.container) this.init();
    const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]||icons.info}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

/* ── Credits badge in nav ────────────────────────────────────── */
function renderCredits() {
  const badge = document.getElementById('nav-credits-badge');
  if (!badge || !Auth.isLoggedIn()) return;
  const c = Auth.getCredits();
  const pct = Math.max(0, Math.min((c / FREE_CREDITS) * 100, 100));
  const col = c >= 30 ? '#10b981' : c >= 10 ? '#f59e0b' : '#ef4444';
  badge.style.display = 'flex';
  badge.innerHTML = `
    <span style="font-size:0.72rem;font-weight:700;color:${col};">⚡ ${c} credits</span>
    <div style="width:50px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:${col};border-radius:2px;transition:width 0.5s;"></div>
    </div>
  `;
  badge.onclick = () => { window.location.href = 'pricing.html'; };
}

/* ── Navigation ──────────────────────────────────────────────── */
function initNav() {
  const nav       = document.getElementById('main-nav');
  const toggle    = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');
  const authBtn   = document.getElementById('nav-auth-btn');
  const userMenu  = document.getElementById('nav-user-menu');
  const logoutBtn = document.getElementById('nav-logout');
  const avatarEl  = document.getElementById('nav-avatar');

  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });

  const user = Auth.getUser();
  if (user) {
    if (authBtn)  authBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : 'U';
    renderCredits();
  } else {
    if (authBtn)  authBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'none';
  }

  if (toggle) toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  if (logoutBtn) logoutBtn.addEventListener('click', e => { e.preventDefault(); Auth.logout(); });

  window.addEventListener('scroll', () => {
    if (!nav) return;
    nav.style.background = window.scrollY > 20 ? 'rgba(5,8,15,0.96)' : 'rgba(5,8,15,0.82)';
  }, { passive: true });
}

/* ── Modals ──────────────────────────────────────────────────── */
function openModal(id)  { const m=document.getElementById(id); if(m){m.classList.add('open');document.body.style.overflow='hidden';} }
function closeModal(id) { const m=document.getElementById(id); if(m){m.classList.remove('open');document.body.style.overflow='';} }
function initModals() {
  document.querySelectorAll('[data-modal-open]').forEach(b  => b.addEventListener('click', () => openModal(b.dataset.modalOpen)));
  document.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.modalClose)));
  document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => {
    if (e.target === o) { o.classList.remove('open'); document.body.style.overflow = ''; }
  }));
}

/* ── Scroll Reveal ───────────────────────────────────────────── */
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity='1'; e.target.style.transform='translateY(0)'; obs.unobserve(e.target); }
  }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach(el => {
    el.style.opacity = '0'; el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    obs.observe(el);
  });
}

/* ── Particles ───────────────────────────────────────────────── */
function initParticles(canvasId) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const ctx = canvas.getContext('2d'); let W, H, particles = [];
  function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
  function mkP() {
    particles = [];
    const c = Math.min(Math.floor(W * H / 12000), 80);
    for (let i = 0; i < c; i++) particles.push({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.5+0.3,
      dx: (Math.random()-0.5)*0.4, dy: (Math.random()-0.5)*0.4,
      color: Math.random()>.5 ? `rgba(124,58,237,${Math.random()*.5+.1})` : `rgba(6,182,212,${Math.random()*.4+.1})`
    });
  }
  function draw() {
    ctx.clearRect(0,0,W,H);
    particles.forEach(p => {
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<0||p.x>W) p.dx*=-1; if(p.y<0||p.y>H) p.dy*=-1;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill();
      particles.forEach(p2 => {
        const d = Math.hypot(p.x-p2.x, p.y-p2.y);
        if (d < 120) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p2.x,p2.y); ctx.strokeStyle=`rgba(124,58,237,${.08*(1-d/120)})`; ctx.lineWidth=.5; ctx.stroke(); }
      });
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', () => { resize(); mkP(); }); resize(); mkP(); draw();
}

/* ── DOM Ready ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Run migration FIRST before anything else
  migrateOldUsers();
  migrateOldSession();
  Toast.init(); initNav(); initModals(); initScrollReveal();
});
