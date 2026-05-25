/* ============================================================
   AdVision AI — auth.js  (v4 — Real Email Signup + Credits)
   Handles Sign In / Sign Up tabs + password strength
   ============================================================ */
'use strict';

/* ── Password strength ─────────────────────────────────────── */
function checkStrength(pwd) {
  let s = 0;
  if (pwd.length >= 8)            s++;
  if (pwd.length >= 12)           s++;
  if (/[A-Z]/.test(pwd))         s++;
  if (/[0-9]/.test(pwd))         s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}
function updateStrengthBar(pwd) {
  const bar = document.getElementById('strength-bar');
  const lbl = document.getElementById('strength-label');
  if (!bar || !lbl) return;
  const s = checkStrength(pwd);
  const cols  = ['#ef4444','#f97316','#f59e0b','#10b981','#6366f1'];
  const names = ['Very Weak','Weak','Fair','Good','Strong'];
  bar.style.width      = (s/5*100)+'%';
  bar.style.background = cols[s-1] || cols[0];
  lbl.textContent      = pwd ? (names[s-1] || names[0]) : '';
  lbl.style.color      = cols[s-1] || '';
}

/* ── Helpers ───────────────────────────────────────────────── */
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  const g = el.closest('.form-group');
  if (g) { g.classList.add('has-error'); const e=g.querySelector('.form-error'); if(e)e.textContent=msg; }
}
function clearErrors(form) { form.querySelectorAll('.form-group').forEach(g=>g.classList.remove('has-error')); }

/* ── Tabs ──────────────────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('panel-' + tab.dataset.tab);
      if (panel) panel.classList.add('active');
      // Update heading
      const h = document.getElementById('auth-heading');
      const s = document.getElementById('auth-subheading');
      if (tab.dataset.tab === 'signup') {
        if(h) h.textContent = 'Create your account';
        if(s) s.textContent = 'Sign up free — get 100 credits instantly!';
      } else {
        if(h) h.textContent = 'Welcome back';
        if(s) s.textContent = 'Sign in to continue creating amazing ads';
      }
    });
  });
  // URL tab param
  const tp = new URLSearchParams(window.location.search).get('tab');
  if (tp) { const btn = document.querySelector(`[data-tab="${tp}"]`); if(btn) btn.click(); }
}

/* ── Sign Up ───────────────────────────────────────────────── */
function initSignUp() {
  const form = document.getElementById('signup-form'); if(!form) return;
  const pwdEl = document.getElementById('signup-password');
  if (pwdEl) pwdEl.addEventListener('input', ()=>updateStrengthBar(pwdEl.value));

  form.addEventListener('submit', e => {
    e.preventDefault(); clearErrors(form);
    const name    = (document.getElementById('signup-name')?.value    || '').trim();
    const email   = (document.getElementById('signup-email')?.value   || '').trim().toLowerCase();
    const pass    = (document.getElementById('signup-password')?.value || '');
    const confirm = (document.getElementById('signup-confirm')?.value  || '');
    let valid = true;
    if (!name)               { showError('signup-name',    'Name is required');                       valid=false; }
    if (!validateEmail(email)){ showError('signup-email',   'Enter a valid email address');            valid=false; }
    if (pass.length < 6)     { showError('signup-password','Password must be at least 6 characters'); valid=false; }
    if (pass !== confirm)    { showError('signup-confirm', 'Passwords do not match');                  valid=false; }
    if (!valid) return;

    const btn = document.getElementById('signup-submit-btn');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="btn-spinner"></span> Creating account...'; }

    const result = Auth.register(name, email, pass);
    if (result.error) {
      if(btn){ btn.disabled=false; btn.innerHTML='Create Free Account 🚀'; }
      showError('signup-email', result.error);
      Toast.show(result.error, 'error');
      return;
    }
    Toast.show(`🎉 Welcome, ${name}! You have 100 free credits!`, 'success', 4000);
    const redirect = new URLSearchParams(window.location.search).get('redirect') || 'studio.html';
    setTimeout(() => { window.location.href = redirect; }, 1200);
  });
}

/* ── Sign In ───────────────────────────────────────────────── */
function initSignIn() {
  const form = document.getElementById('signin-form'); if(!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault(); clearErrors(form);
    const email = (document.getElementById('signin-email')?.value    || '').trim().toLowerCase();
    const pass  = (document.getElementById('signin-password')?.value || '');
    let valid = true;
    if (!validateEmail(email)) { showError('signin-email',    'Enter a valid email address'); valid=false; }
    if (!pass)                 { showError('signin-password', 'Password is required');        valid=false; }
    if (!valid) return;

    const btn = document.getElementById('signin-submit-btn');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="btn-spinner"></span> Signing in...'; }

    const result = Auth.login(email, pass);
    if (result.error) {
      if(btn){ btn.disabled=false; btn.innerHTML='Sign In →'; }
      showError('signin-email', result.error);
      showError('signin-password', result.error);
      Toast.show(result.error, 'error');
      return;
    }
    const user = Auth.getUser();
    Toast.show(`👋 Welcome back, ${user?.name || 'there'}! You have ${Auth.getCredits()} credits.`, 'success', 3000);
    const redirect = new URLSearchParams(window.location.search).get('redirect') || 'studio.html';
    setTimeout(() => { window.location.href = redirect; }, 1200);
  });
}

/* ── Password toggles ──────────────────────────────────────── */
function initPasswordToggles() {
  document.querySelectorAll('.pwd-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target); if(!inp)return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.textContent = show ? '🙈' : '👁️';
    });
  });
}

/* ── Social (placeholder) ──────────────────────────────────── */
function initSocialAuth() {
  document.querySelectorAll('.social-auth-btn').forEach(btn=>{
    btn.addEventListener('click',()=>Toast.show('Social login coming soon! Use email for now.','info'));
  });
}

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (Auth?.isLoggedIn() && !window.location.search.includes('force')) {
    window.location.href = 'studio.html'; return;
  }
  initTabs(); initSignUp(); initSignIn(); initPasswordToggles(); initSocialAuth();

  // Pre-fill remembered email and autofocus password if it exists
  const remembered = localStorage.getItem('advision_remembered_email');
  if (remembered) {
    const signinEmail = document.getElementById('signin-email');
    if (signinEmail) {
      signinEmail.value = remembered;
      const signinPwd = document.getElementById('signin-password');
      if (signinPwd) setTimeout(() => signinPwd.focus(), 50);
    }
  }

  // Add spinner style
  if (!document.getElementById('auth-spin-style')) {
    const s = document.createElement('style'); s.id='auth-spin-style';
    s.textContent=`.btn-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:4px;}`;
    document.head.appendChild(s);
  }
});
