/* ============================================================
   AdVision AI — pricing.js  (Credits-based payment gateway)
   ============================================================ */
'use strict';

const PLANS = {
  starter: {
    name:     'Starter',
    credits:  150,
    price:    199,         // ₹199
    priceYr:  1590,        // ₹1590/yr (save 34%)
    label:    '150 Credits',
    features: ['150 ad video credits','Standard HD video','3D AI Presenter','Email support']
  },
  pro: {
    name:     'Pro',
    credits:  500,
    price:    499,
    priceYr:  3990,
    label:    '500 Credits',
    features: ['500 ad video credits','Full HD 1280×720','3D AI Presenter','Priority support','No watermark']
  },
  business: {
    name:     'Business',
    credits:  2000,
    price:    999,
    priceYr:  7990,
    label:    '2000 Credits (Unlimited)',
    features: ['2000 credits (~200 videos)','Full HD 1280×720','3D AI Presenter','Dedicated support','White-label option']
  }
};

let selectedPlan = null;
let billingYearly = false;

/* ── Render credits widget ──────────────────────────────────── */
function renderCreditWidget() {
  const widget = document.getElementById('credits-widget');
  if (!widget || !Auth.isLoggedIn()) return;
  const c   = Auth.getCredits();
  const max = 100;
  const pct = Math.max(0, Math.min((c/max)*100, 100));
  const col = c >= 30 ? '#10b981' : c >= 10 ? '#f59e0b' : '#ef4444';
  const vids = Math.floor(c / 10);
  widget.style.display = '';
  widget.innerHTML = `
    <div class="credit-widget-inner">
      <div class="cw-top">
        <div>
          <div class="cw-label">Your Credits</div>
          <div class="cw-number" style="color:${col}">${c} <span style="font-size:0.65em;color:var(--text-400);">remaining</span></div>
        </div>
        <div class="cw-icon" style="background:${col}20;color:${col};">⚡</div>
      </div>
      <div class="cw-bar-track">
        <div class="cw-bar-fill" style="width:${pct}%;background:${col};"></div>
      </div>
      <div class="cw-meta">${vids} video${vids!==1?'s':''} remaining · ${10} credits per video</div>
      ${c < 20 ? '<div class="cw-warning">⚠️ Running low — buy credits below</div>' : ''}
    </div>
  `;
}

/* ── Open payment modal ─────────────────────────────────────── */
function openPayment(planKey) {
  if (!Auth.isLoggedIn()) { window.location.href='auth.html?redirect=pricing.html'; return; }
  selectedPlan = planKey;
  const plan = PLANS[planKey];
  const price = billingYearly ? plan.priceYr : plan.price;
  const cycle = billingYearly ? 'per year' : 'per month';

  document.getElementById('modal-plan-name').textContent  = plan.name + ' Plan';
  document.getElementById('modal-plan-price').textContent = '₹' + price;
  document.getElementById('modal-plan-cycle').textContent = cycle;
  document.getElementById('modal-credits-note').textContent = `+ ${plan.credits} credits will be added to your account`;
  const ul = document.getElementById('modal-plan-features');
  ul.innerHTML = plan.features.map(f=>`<li>✓ ${f}</li>`).join('');

  // Pre-fill name from user
  const user = Auth.getUser();
  const nameEl = document.getElementById('card-name');
  if (nameEl && user?.name) nameEl.value = user.name;

  openModal('payment-modal');
}

/* ── Simulate payment (demo gateway) ───────────────────────── */
function initPaymentForm() {
  const form = document.getElementById('payment-form');
  if (!form) return;

  // Card number formatting
  const cardNum = document.getElementById('card-number');
  if (cardNum) cardNum.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g,'').substring(0,16);
    e.target.value = v.replace(/(.{4})/g,'$1 ').trim();
  });
  // Expiry formatting
  const exp = document.getElementById('card-expiry');
  if (exp) exp.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g,'').substring(0,4);
    if (v.length >= 2) v = v.substring(0,2)+'/'+v.substring(2);
    e.target.value = v;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!selectedPlan) return;
    const plan = PLANS[selectedPlan];

    const name  = (document.getElementById('card-name')?.value   || '').trim();
    const num   = (document.getElementById('card-number')?.value || '').replace(/\s/g,'');
    const expv  = (document.getElementById('card-expiry')?.value || '').trim();
    const cvv   = (document.getElementById('card-cvv')?.value    || '').trim();

    // Basic validation
    if (!name)          { Toast.show('Enter cardholder name','error'); return; }
    if (num.length < 13){ Toast.show('Enter a valid card number','error'); return; }
    if (!expv.match(/^\d{2}\/\d{2}$/)) { Toast.show('Enter expiry as MM/YY','error'); return; }
    if (cvv.length < 3) { Toast.show('Enter CVV','error'); return; }

    const btn = document.getElementById('pay-submit-btn');
    if(btn){ btn.disabled=true; btn.innerHTML='<span class="pay-spinner"></span> Processing…'; }

    // Simulate payment gateway (2s processing)
    await new Promise(r => setTimeout(r, 2000));

    // Add credits
    Auth.addCredits(plan.credits, selectedPlan);

    if(btn){ btn.disabled=false; btn.innerHTML='Complete Payment 🔒'; }
    closeModal('payment-modal');

    // Show success
    document.getElementById('success-plan').textContent  = plan.name + ' Plan';
    document.getElementById('success-credits').textContent = plan.credits;
    document.getElementById('success-total').textContent  = '₹' + (billingYearly ? plan.priceYr : plan.price);
    openModal('success-modal');

    // Re-render credits widget
    renderCreditWidget();
    Toast.show(`🎉 ${plan.credits} credits added to your account!`, 'success', 5000);
  });
}

/* ── Billing toggle ─────────────────────────────────────────── */
function initBillingToggle() {
  const toggle = document.getElementById('billing-toggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    billingYearly = toggle.checked;
    document.getElementById('billing-monthly').classList.toggle('active', !billingYearly);
    document.getElementById('billing-yearly').classList.toggle('active',  billingYearly);
    updatePrices();
  });
}

function updatePrices() {
  Object.entries(PLANS).forEach(([key, plan]) => {
    const el = document.getElementById('price-' + key);
    if (el) el.textContent = '₹' + (billingYearly ? plan.priceYr : plan.price);
    const per = document.getElementById('period-' + key);
    if (per) per.textContent = billingYearly ? '/year' : '/month';
  });
}

/* ── FAQ accordion ──────────────────────────────────────────── */
function initFAQ() {
  document.querySelectorAll('.faq-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const body = item.querySelector('.faq-body');
      const open = item.classList.toggle('open');
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
    });
  });
}

/* ── Plan buttons ───────────────────────────────────────────── */
function initPlanButtons() {
  document.querySelectorAll('[data-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.dataset.plan;
      if (plan === 'free') {
        if (Auth.isLoggedIn()) window.location.href = 'studio.html';
        else window.location.href = 'auth.html?tab=signup';
        return;
      }
      if (PLANS[plan]) openPayment(plan);
    });
  });
}

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Add spinner style
  const s = document.createElement('style');
  s.textContent = `
    .pay-spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .credit-widget-inner{background:linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.08));border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:22px 24px;}
    .cw-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
    .cw-label{font-size:0.78rem;color:var(--text-400);font-weight:500;margin-bottom:4px;}
    .cw-number{font-family:'Outfit',sans-serif;font-size:2.2rem;font-weight:800;line-height:1;}
    .cw-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;}
    .cw-bar-track{height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:8px;}
    .cw-bar-fill{height:100%;border-radius:4px;transition:width 0.8s ease;}
    .cw-meta{font-size:0.78rem;color:var(--text-400);}
    .cw-warning{margin-top:10px;font-size:0.78rem;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:6px 12px;}
  `;
  document.head.appendChild(s);

  renderCreditWidget();
  initBillingToggle();
  updatePrices();
  initPlanButtons();
  initPaymentForm();
  initFAQ();

  // Show logged-in user plan button states
  if (Auth.isLoggedIn()) {
    document.getElementById('btn-free-cta')?.setAttribute('href','studio.html');
  }
});
