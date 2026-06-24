// ========== LOGIN VIEW ==========
import { state, getSystemLogo, bizName, authenticate } from "../state.js";
import { render } from "../main.js";

export function renderLogin() {
  const app = document.getElementById('app');
  const sysLogo = getSystemLogo();
  
  const logoHtml = sysLogo 
    ? `<img src="${sysLogo}" class="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-lg rounded-2xl bg-white/5 p-2">`
    : `<div class="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4"><i data-lucide="shopping-bag" class="w-8 h-8 text-accent"></i></div>`;
    
  app.innerHTML = `
  <div class="h-full w-full flex items-center justify-center p-4" style="background: radial-gradient(circle at center, #2a0000 0%, #050505 100%);">
    <div class="bg-surface rounded-2xl p-8 w-full max-w-md fade-in border border-card" style="box-shadow: 0 15px 35px -10px rgba(255,0,0,0.15), 0 0 15px rgba(0,0,0,0.5);">
      <div class="text-center mb-8">
        ${logoHtml}
        <h1 class="text-2xl font-bold">${bizName()}</h1>
        <p class="text-muted mt-1">Sistema Punto de Venta</p>
      </div>
      <div id="login-error" class="hidden bg-danger/20 text-danger rounded-lg p-3 mb-4 text-sm"></div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-muted mb-1">Usuario</label>
          <div class="relative">
            <i data-lucide="user" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
            <input id="login-user" type="text" class="w-full bg-card border border-card rounded-lg pl-10 pr-4 py-3 text-txt focus:border-accent focus:outline-none transition" placeholder="admin">
          </div>
        </div>
        <div>
          <label class="block text-sm text-muted mb-1">Contraseña</label>
          <div class="relative">
            <i data-lucide="lock" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
            <input id="login-pass" type="password" class="w-full bg-card border border-card rounded-lg pl-10 pr-10 py-3 text-txt focus:border-accent focus:outline-none transition" placeholder="••••••">
            <button type="button" id="toggle-pass" class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition"><i data-lucide="eye" class="w-4 h-4"></i></button>
          </div>
        </div>
        <button id="login-btn" class="w-full bg-accent text-bg font-semibold py-3 rounded-lg hover:opacity-90 transition mt-2">Iniciar Sesión</button>
      </div>
    </div>
  </div>`;
  
  lucide.createIcons();

  document.getElementById('toggle-pass').onclick = () => {
    const passInput = document.getElementById('login-pass');
    const toggleBtn = document.getElementById('toggle-pass');
    if (passInput.type === 'password') { 
      passInput.type = 'text'; 
      toggleBtn.innerHTML = '<i data-lucide="eye-off" class="w-4 h-4"></i>'; 
    } else { 
      passInput.type = 'password'; 
      toggleBtn.innerHTML = '<i data-lucide="eye" class="w-4 h-4"></i>'; 
    }
    lucide.createIcons();
  };
  
  document.getElementById('login-btn').onclick = () => {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const user = authenticate(u, p);
    if (!user) { 
      document.getElementById('login-error').classList.remove('hidden'); 
      document.getElementById('login-error').textContent = 'Usuario o contraseña incorrectos'; 
      return; 
    }
    
    state.currentUser = user; 
    localStorage.setItem('pos_user', JSON.stringify(user));
    state.cashRegisterOpen = localStorage.getItem(`pos_register_open_${user.username}`) === 'true';
    state.initialCash = parseFloat(localStorage.getItem(`pos_initial_cash_${user.username}`)) || 0;
    state.sessionStart = localStorage.getItem(`pos_session_start_${user.username}`) || null;
    
    if (user.role === 'admin') { 
        const perms = user.raw && user.raw.permissions ? user.raw.permissions : null;
        if (perms && perms.length > 0 && !perms.includes('admin-dashboard')) {
            state.currentView = perms[0]; 
        } else {
            state.currentView = 'admin-dashboard'; 
        }
    } else { 
        state.currentView = 'cashier-pos'; 
    }
    localStorage.setItem('pos_view', state.currentView); 
    render();
  };
}
