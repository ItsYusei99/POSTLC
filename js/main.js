// ========== MAIN ROUTER & SYNC CONTROLLER ==========
import { state, defaultConfig, showToast } from "./state.js";
import { db, collection, onSnapshot, query, where } from "./firebase.js";
import { renderLogin } from "./views/login.js";
import { renderCashierPOS } from "./views/cashier.js";
import { 
  renderAdminShell, 
  renderDashboard, 
  renderInventory, 
  renderDepartments, 
  renderClients, 
  renderSalesReport, 
  renderFinance, 
  renderInvoicing, 
  renderUsersAdmin, 
  renderSettings 
} from "./views/admin.js";
import "./modals.js";

export function render() {
  if (!state.currentUser && state.currentView !== 'login') {
    state.currentView = 'login';
  }

  switch(state.currentView) {
    case 'login': renderLogin(); break;
    case 'admin-dashboard': renderAdminShell(renderDashboard); break;
    case 'admin-inventory': renderAdminShell(renderInventory); break;
    case 'admin-departments': renderAdminShell(renderDepartments); break;
    case 'admin-clients': renderAdminShell(renderClients); break; 
    case 'admin-sales': renderAdminShell(renderSalesReport); break;
    case 'admin-finance': renderAdminShell(renderFinance); break;
    case 'admin-invoicing': renderAdminShell(renderInvoicing); break; 
    case 'admin-users': renderAdminShell(renderUsersAdmin); break;
    case 'admin-settings': renderAdminShell(renderSettings); break;
    case 'cashier-pos': renderCashierPOS(); break;
    case 'cashier-history': renderCashierPOS(); break;
    case 'cashier-close': renderCashierPOS(); break;
    default: renderLogin();
  }
  lucide.createIcons();
}

// Expose rendering to the global scope
window.render = render;

// ========== REAL-TIME MULTI-BOX SYNCHRONIZATION ==========
const coleccionesCatalogos = ['productos', 'usuarios', 'categorias', 'configuracion', 'archivos_sistema', 'insumos_granel', 'clientes'];

coleccionesCatalogos.forEach(colName => {
  onSnapshot(collection(db, colName), procesarSnapshot);
});

// Download records from today at 00:00 onwards
const coleccionesHistoricas = ['ventas', 'egresos', 'movimientos', 'cortes_caja', 'creditos', 'abonos'];
const hoy = new Date();
hoy.setHours(0, 0, 0, 0); 
const fechaInicioHoy = hoy.toISOString();

coleccionesHistoricas.forEach(colName => {
  const q = query(collection(db, colName), where("date", ">=", fechaInicioHoy));
  onSnapshot(q, procesarSnapshot);
});

let snapshotTimer = null;

function procesarSnapshot(snapshot) {
  let hasChanges = false;
  
  snapshot.docChanges().forEach((change) => {
    hasChanges = true;
    const docData = { id: change.doc.id, ...change.doc.data() };
    
    // Ghost prevention for Sales
    if (docData.ticket_num) {
      const fantasmaIdx = state.allRecords.findIndex(r => r.id.startsWith('temp_') && r.ticket_num === docData.ticket_num);
      if (fantasmaIdx > -1) state.allRecords.splice(fantasmaIdx, 1);
    }

    // Ghost prevention for Cash Ins/Outs
    if (docData.temp_id) {
      const fantasmaIdx = state.allRecords.findIndex(r => r.id === docData.temp_id);
      if (fantasmaIdx > -1) state.allRecords.splice(fantasmaIdx, 1);
    }

    const index = state.allRecords.findIndex(r => r.id === change.doc.id);
    if (change.type === "added" || change.type === "modified") {
      if (index !== -1) state.allRecords[index] = docData; 
      else state.allRecords.push(docData); 
    }
    if (change.type === "removed") {
      if (index !== -1) state.allRecords.splice(index, 1);
    }
  });

  if (hasChanges) {
    const cloudLogo = state.allRecords.find(r => r.type === 'sys_file' && r.name === 'main_logo');
    if (cloudLogo && cloudLogo.image) localStorage.setItem('pos_system_logo', cloudLogo.image); 

    const cloudConfig = state.allRecords.find(r => r.type === 'config');
    if (cloudConfig) {
      defaultConfig.business_name = cloudConfig.business_name || 'Mi Negocio';
      defaultConfig.currency_symbol = cloudConfig.currency_symbol || '$';
      defaultConfig.whatsapp_number = cloudConfig.whatsapp_number || '';
      defaultConfig.admin_pin = cloudConfig.admin_pin || '790208'; 
      
      localStorage.setItem('pos_biz_name', defaultConfig.business_name);
      localStorage.setItem('pos_currency', defaultConfig.currency_symbol);
      localStorage.setItem('pos_wa_number', defaultConfig.whatsapp_number);
      localStorage.setItem('pos_admin_pin', defaultConfig.admin_pin); 

      const headers = document.querySelectorAll('header span.font-bold, h1.text-2xl.font-bold');
      headers.forEach(h => h.textContent = defaultConfig.business_name);
    }

    // Live view updates
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(() => {
      if (state.currentView.startsWith('cashier-')) {
        const posSearch = document.getElementById('pos-search');
        if (!posSearch) {
          render(); 
        } else {
          if (posSearch) posSearch.dispatchEvent(new Event('input')); 
          if (window.updateCashBadge) window.updateCashBadge();
        }
      } else if (state.currentView === 'admin-inventory') {
        if (window.refreshInventoryViews) window.refreshInventoryViews();
      } else if (['login', 'admin-dashboard', 'admin-sales', 'admin-finance', 'admin-clients'].includes(state.currentView)) {
        render(); 
      }
    }, 100);
  }
}

// ========== NETWORK STATUS INDICATOR ==========
window.updateNetworkStatus = () => {
  const isOnline = navigator.onLine;
  if (!isOnline) showToast('Se perdió la conexión. Entrando en Modo Offline.', 'warn');
  else if (isOnline && state.currentUser) showToast('Conexión restaurada. Sincronizando...', 'success');
};

window.addEventListener('online', window.updateNetworkStatus);
window.addEventListener('offline', window.updateNetworkStatus);

// Boot the application
render();
