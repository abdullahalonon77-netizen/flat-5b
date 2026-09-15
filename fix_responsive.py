import re

with open('style.css', 'r') as f:
    lines = f.readlines()

# Find the exact line index for "/* --------------------------------------------------------------------------"
# followed by "26. Responsive Design (Mobile & Tablet)"
start_idx = -1
for i, line in enumerate(lines):
    if "26. Responsive Design" in line:
        # The actual block starts one line before
        if i > 0 and "/* --------------------------------------------------------------------------" in lines[i-1]:
            start_idx = i - 1
        else:
            start_idx = i
        break

if start_idx != -1:
    lines = lines[:start_idx]

new_css = """/* --------------------------------------------------------------------------
   26. Responsive Design (Mobile & Tablet)
   -------------------------------------------------------------------------- */
@media (max-width: 1024px) {
    .dashboard-main-area { grid-template-columns: 1fr; }
}

@media (max-width: 768px) {
    .app-wrapper { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: relative; z-index: 100; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); }
    .brand-section { padding: 15px 20px; }
    .important-contact { padding: 10px 15px; }
    .contact-card { padding: 10px 15px; }
    .nav-list { flex-direction: row; overflow-x: auto; padding: 10px 15px; gap: 10px; -ms-overflow-style: none; scrollbar-width: none; }
    .nav-list::-webkit-scrollbar { display: none; }
    .nav-item { white-space: nowrap; padding: 10px 15px; font-size: 14px; }
    .admin-auth-section { padding: 15px; }
    .main-content { margin-left: 0; padding: 15px; width: 100%; background-attachment: scroll; }
    .top-header { flex-direction: column; gap: 20px; }
    .motivation-card { max-width: 100%; }
    .stats-grid { grid-template-columns: 1fr; }
    .next-meal-header { flex-direction: column; gap: 15px; align-items: flex-start; }
    .next-meal-banner-large { padding: 25px 20px; }
    .next-meal-count { font-size: 40px; padding: 5px 25px; }
    .permanent-meal-settings { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 480px) {
    .page-title { font-size: 26px; }
    .khala-actions { flex-direction: column; }
    .btn-khala { height: 50px; font-size: 18px; }
    .guest-input-group, .guest-checkbox-group { flex-direction: column; gap: 10px; }
    .modal-box { width: 95%; }
    .live-board-grid { grid-template-columns: 1fr; }
}

/* ==========================================================================
   FIX FOR CUSTOM CONFIRM MODAL (POPUP)
   ========================================================================== */
.custom-confirm-box { text-align: center; padding: 40px 30px; background: #fff; border-top: 5px solid var(--primary-color); }
.warning-icon-wrapper { width: 80px; height: 80px; background: var(--warning-light); color: var(--warning-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 0 20px rgba(243, 156, 18, 0.2); }
.warning-svg { width: 45px; height: 45px; }
.confirm-title { font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px; }
.confirm-message-text { font-size: 16px; color: var(--text-muted); margin-bottom: 30px; line-height: 1.5; }
.confirm-btn-group { display: flex; gap: 15px; justify-content: center; }
.btn-cancel-confirm { background: #e9ecef; color: var(--text-primary); flex: 1; padding: 14px; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.3s; }
.btn-cancel-confirm:hover { background: #dee2e6; }
.btn-ok-confirm { background: var(--primary-color); color: #fff; flex: 1; padding: 14px; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(67, 97, 238, 0.3); transition: 0.3s; }
.btn-ok-confirm:hover { background: var(--secondary-color); transform: translateY(-2px); }

/* ==========================================================================
   FUTURE / UPCOMING MEAL STYLES
   ========================================================================== */
.meal-status.upcoming-on { background: #e3f2fd !important; color: #0288d1 !important; border: 1px dashed #29b6f6; }
.meal-status.upcoming-half { background: #fff8e1 !important; color: #f57c00 !important; border: 1px dashed #ffa726; }
.meal-status.upcoming-off { background: #fce4ec !important; color: #d32f2f !important; border: 1px dashed #ef5350; }

/* ==========================================================================
   LOGIN MODAL ENHANCEMENTS & PERMANENT MEAL SETTINGS
   ========================================================================== */
.login-select { font-size: 20px !important; height: 60px !important; padding: 10px 20px !important; }
.login-select option { font-size: 18px; padding: 10px; }

.permanent-meal-settings { background: #fff; padding: 20px 25px; border-radius: var(--border-radius-md); margin-bottom: 25px; box-shadow: var(--shadow-sm); border: 1px solid #edf2f9; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
.permanent-toggle-group { display: flex; gap: 25px; align-items: center; }
.perm-toggle-wrapper { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 18px; color: var(--text-primary); }
.small-switch { transform: scale(0.85); margin: 0; }

/* Login Page UI Fixes */
.login-modal-box { max-width: 420px !important; width: 90%; }
.btn-enter-website { width: 100%; padding: 15px; font-size: 20px; border-radius: 30px; background: var(--grad-green); color: #111c43; font-weight: 800; box-shadow: 0 10px 25px rgba(56, 249, 215, 0.4); display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px; height: auto; }
.btn-enter-website:hover { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(56, 249, 215, 0.6); }
.btn-icon-right { width: 24px !important; height: 24px !important; flex-shrink: 0; }
"""

lines.append(new_css)

with open('style.css', 'w') as f:
    f.writelines(lines)
