// ========== STATE & UTILITIES ==========

export const defaultConfig = {
  business_name: localStorage.getItem('pos_biz_name') || 'Mi Negocio',
  currency_symbol: localStorage.getItem('pos_currency') || '$',
  whatsapp_number: localStorage.getItem('pos_wa_number') || '', 
  admin_pin: localStorage.getItem('pos_admin_pin') || '790208',
  bg_color: '#050505',
  surface_color: '#1e293b',
  text_color: '#e2e8f0',
  accent_color: '#38bdf8',
  secondary_color: '#818cf8',
  font_family: 'DM Sans',
  font_size: 14
};

const user = JSON.parse(localStorage.getItem('pos_user')) || null;

export const state = {
  allRecords: [],
  currentUser: user,
  currentView: localStorage.getItem('pos_view') || 'login',
  cashRegisterOpen: user ? localStorage.getItem(`pos_register_open_${user.username}`) === 'true' : false,
  initialCash: user ? parseFloat(localStorage.getItem(`pos_initial_cash_${user.username}`)) || 0 : 0,
  sessionStart: user ? localStorage.getItem(`pos_session_start_${user.username}`) || null : null,
  cart: [],
  loadedMonthsCache: new Set(),
  deptSpecificDate: (function(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })(),
  reportDate: new Date(),
  reportSpecificDate: null,
  financeDate: new Date(),
  invoiceDate: new Date(),
  invoiceTab: 'facturables',
  activeDiscountType: 'percent',
  activeStockAction: { id: null, type: null, prod: null },
  activeRefundSaleId: null,
  activeAdminAction: null,
  activeCashFlowType: 'in',
  activeCustomPriceIndex: null,
  activeCustomQtyIndex: null
};

export const DEFAULT_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' },
  { username: 'cajero1', password: '1234', role: 'cashier', name: 'Cajero 1' }
];

// ========== UTILITY FUNCTIONS ==========

export function currency(n) {
  const number = Number(n || 0);
  return defaultConfig.currency_symbol + number.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function bizName() {
  return defaultConfig.business_name;
}

export function getSystemLogo() {
  const cachedLogo = localStorage.getItem('pos_system_logo');
  if (cachedLogo) return cachedLogo;

  const logoRec = state.allRecords.find(r => r.type === 'sys_file' && r.name === 'main_logo');
  return logoRec ? logoRec.image : null;
}

export function records(type) { 
  return state.allRecords.filter(r => r.type === type); 
}

export function genId() { 
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); 
}

export function today() { 
  return new Date().toISOString().slice(0, 10); 
}

export function now() { 
  return new Date().toISOString(); 
}

export function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const d = document.createElement('div');
  const colors = { success: 'bg-success', error: 'bg-danger', warn: 'bg-warn', info: 'bg-accent' };
  d.className = `${colors[type] || 'bg-accent'} text-bg px-4 py-3 rounded-lg shadow-lg toast-show font-medium text-sm max-w-xs`;
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

let confirmCb = null;
export function showConfirm(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCb = cb;
}

// Bindeos automáticos de confirmación cuando se monta el módulo
document.getElementById('confirm-cancel').onclick = () => { 
  document.getElementById('confirm-modal').style.display = 'none'; 
  confirmCb = null; 
};
document.getElementById('confirm-ok').onclick = () => { 
  document.getElementById('confirm-modal').style.display = 'none'; 
  if (confirmCb) confirmCb(); 
  confirmCb = null; 
};

export function getUsers() {
  const sdkUsers = records('user');
  const merged = DEFAULT_USERS.map(u => ({ ...u, isDefault: true }));
  
  sdkUsers.forEach(u => {
    const idx = merged.findIndex(m => m.username === u.name);
    const mappedUser = { 
      id: u.id, 
      username: u.name, 
      password: u.code, 
      role: u.status || 'cashier', 
      name: u.description || u.name, 
      raw: u, 
      isDefault: idx !== -1 
    };
    if (idx === -1) merged.push(mappedUser);
    else merged[idx] = { ...merged[idx], ...mappedUser };
  });
  return merged;
}

export function authenticate(username, password) {
  const users = getUsers();
  return users.find(u => u.username === username && u.password === password) || null;
}

export async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/webp', 0.6); 
        resolve(dataUrl);
      };
    };
  });
}

export async function compressLogo(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; 
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/png', 0.8); 
        resolve(dataUrl);
      };
    };
  });
}
