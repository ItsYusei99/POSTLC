// ========== ADMIN VIEWS ==========
import { 
  state, 
  defaultConfig, 
  records, 
  currency, 
  bizName, 
  getSystemLogo, 
  getUsers, 
  showToast, 
  showConfirm, 
  compressImage, 
  compressLogo, 
  today, 
  now, 
  genId 
} from "../state.js";
import { dbSdk, cargarMesFirebase } from "../firebase.js";
import { render } from "../main.js";

export function renderAdminShell(contentFn) {
  const allNavItems = [
    { id: 'admin-dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'admin-inventory', icon: 'package', label: 'Inventario' },
    { id: 'admin-departments', icon: 'layers', label: 'Departamentos' }, 
    { id: 'admin-clients', icon: 'contact', label: 'Cartera de Clientes' },
    { id: 'admin-sales', icon: 'receipt', label: 'Ventas y Reportes' },
    { id: 'admin-finance', icon: 'wallet', label: 'Finanzas' },
    { id: 'admin-invoicing', icon: 'file-text', label: 'Facturación' }, 
    { id: 'admin-users', icon: 'users', label: 'Usuarios' },
    { id: 'admin-settings', icon: 'settings', label: 'Config' }
  ];

  let userPerms = (state.currentUser && state.currentUser.raw && state.currentUser.raw.permissions) 
    ? state.currentUser.raw.permissions 
    : allNavItems.map(n => n.id);

  if (state.currentUser && state.currentUser.username === 'admin') {
    userPerms = allNavItems.map(n => n.id);
  }

  const navItems = allNavItems.filter(n => userPerms.includes(n.id));

  if (navItems.length > 0 && !navItems.find(n => n.id === state.currentView)) {
    state.currentView = navItems[0].id;
    localStorage.setItem('pos_view', state.currentView);
    setTimeout(render, 0); 
    return; 
  }

  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full w-full flex flex-col overflow-hidden" style="min-height:100%;">
    <header class="bg-surface border-b border-card px-3 py-3 flex items-center justify-between shrink-0 w-full gap-2">
      <div class="flex items-center gap-1 sm:gap-3 min-w-0">
        <button id="menu-toggle" class="lg:hidden p-1 shrink-0"><i data-lucide="menu" class="w-5 h-5"></i></button>
        <i data-lucide="shopping-bag" class="w-5 h-5 text-accent hidden sm:block shrink-0"></i>
        <span class="font-bold text-base sm:text-lg truncate">${bizName()}</span>
        <span class="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full shrink-0 ml-1">Admin</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${records('product').filter(p => p.stock <= (p.min_stock || 5)).length > 0 ? `<span class="text-[10px] sm:text-xs bg-warn/20 text-warn px-2 py-1 rounded-full flex items-center gap-1 shrink-0"><i data-lucide="alert-triangle" class="w-3 h-3"></i>${records('product').filter(p => p.stock <= (p.min_stock || 5)).length} <span class="hidden sm:inline">bajo stock</span></span>` : ''}
        <button id="logout-btn" class="text-muted hover:text-danger transition flex items-center gap-1 text-sm shrink-0"><i data-lucide="log-out" class="w-4 h-4"></i><span class="hidden sm:inline">Salir</span></button>
      </div>
    </header>
    
    <div class="flex flex-1 overflow-hidden w-full">
      <nav id="sidebar" class="bg-surface border-r border-card w-56 shrink-0 overflow-y-auto hidden lg:block">
        <div class="p-3 space-y-1">
          ${navItems.map(n => `
            <button data-nav="${n.id}" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${state.currentView === n.id ? 'bg-accent/20 text-accent font-semibold' : 'text-muted hover:text-txt hover:bg-card'}">
              <i data-lucide="${n.icon}" class="w-4 h-4"></i>${n.label}
            </button>`).join('')}
        </div>
      </nav>
      
      <main id="admin-content" class="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 w-full max-w-full"></main>
    </div>
  </div>`;

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => { 
      state.currentView = btn.dataset.nav; 
      localStorage.setItem('pos_view', state.currentView);
      render(); 
    };
  });
  
  document.getElementById('logout-btn').onclick = () => { 
    state.currentUser = null; 
    state.currentView = 'login'; 
    state.cart = []; 
    localStorage.removeItem('pos_user'); 
    localStorage.setItem('pos_view', 'login');
    render(); 
  };
  
  document.getElementById('menu-toggle').onclick = () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('hidden');
  };

  contentFn(document.getElementById('admin-content'));
  lucide.createIcons();
}

export async function renderDashboard(container) {
  container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-muted fade-in"><i data-lucide="loader" class="w-8 h-8 animate-spin text-accent mb-4"></i><p class="font-semibold text-sm">Calculando estadísticas...</p></div>`;
  lucide.createIcons();

  const localToday = new Date();
  await cargarMesFirebase(localToday.getFullYear(), localToday.getMonth());

  const products = records('product');
  const sales = records('sale');
  const expenses = records('expense');

  const currentMonthSales = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getFullYear() === localToday.getFullYear() && d.getMonth() === localToday.getMonth();
  });

  const currentMonthExpenses = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === localToday.getFullYear() && d.getMonth() === localToday.getMonth();
  });

  const todaySales = currentMonthSales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date); 
    return d.getDate() === localToday.getDate();
  });

  const movements = records('movement');
  const abonosMes = movements.filter(m => {
    if (!m.date || m.category !== 'cash_in' || (m.name !== 'Cobro de Abono' && m.name !== 'Abono de Cliente')) return false;
    const d = new Date(m.date);
    return d.getFullYear() === localToday.getFullYear() && d.getMonth() === localToday.getMonth();
  }).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const abonosHoy = movements.filter(m => {
    if (!m.date || m.category !== 'cash_in' || (m.name !== 'Cobro de Abono' && m.name !== 'Abono de Cliente')) return false;
    const d = new Date(m.date);
    return d.getDate() === localToday.getDate() && d.getMonth() === localToday.getMonth() && d.getFullYear() === localToday.getFullYear();
  }).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  let totalRevenue = abonosMes; 
  let totalCOGS = 0; 
  
  currentMonthSales.forEach(s => {
    const pagado = s.cash_part !== undefined ? (Number(s.cash_part) + Number(s.transfer_part || 0)) : (Number(s.total) || 0);
    totalRevenue += pagado;

    const items = s.items ? s.items : [s];
    items.forEach(item => {
      let buyP = Number(item.buy_price || 0);
      if (buyP === 0) {
        const pRef = state.allRecords.find(r => r.type === 'product' && (r.id === item.id || r.name === item.name));
        if (pRef) buyP = Number(pRef.buy_price || 0);
      }
      totalCOGS += (buyP * Number(item.quantity || 1));
    });
  });

  const todayRevenue = todaySales.reduce((a, s) => {
    const pagado = s.cash_part !== undefined ? (Number(s.cash_part) + Number(s.transfer_part || 0)) : (Number(s.total) || 0);
    return a + pagado;
  }, 0) + abonosHoy;
  const totalExpenses = currentMonthExpenses.reduce((a, e) => a + (e.amount || 0), 0);
  const profit = totalRevenue - totalCOGS - totalExpenses; 
  const lowStock = products.filter(p => p.stock <= (p.min_stock || 5));

  const prodSales = {};
  todaySales.forEach(s => {
    const items = s.items ? s.items : [s];
    items.forEach(item => {
      if (item.name) prodSales[item.name] = (prodSales[item.name] || 0) + Number(item.quantity || 1);
    });
  });
  const topProducts = Object.entries(prodSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  let todayBulkTotal = 0;
  todaySales.forEach(s => {
    const items = s.items ? s.items : [s];
    items.forEach(item => {
      if ((item.id && String(item.id).startsWith('bulk_')) || (item.name && item.name.includes('(Granel)'))) {
        todayBulkTotal += (Number(item.total) || 0);
      }
    });
  });

  container.innerHTML = `
  <div class="fade-in space-y-6 w-full max-w-full min-w-0">
    <h2 class="text-xl font-bold">Dashboard</h2>
    
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 w-full">
      <div class="bg-surface rounded-xl p-4 border border-card min-w-0">
        <div class="flex items-center gap-2 text-muted text-sm mb-2"><i data-lucide="dollar-sign" class="w-4 h-4 text-success"></i>Ventas Hoy</div>
        <div class="text-2xl font-bold text-success truncate">${currency(todayRevenue)}</div>
        <div class="text-xs text-muted mt-1 truncate">${todaySales.length} transacciones</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card min-w-0">
        <div class="flex items-center gap-2 text-muted text-sm mb-2"><i data-lucide="trending-up" class="w-4 h-4 text-accent"></i>Ingresos Mes</div>
        <div class="text-2xl font-bold text-accent truncate">${currency(totalRevenue)}</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card min-w-0">
        <div class="flex items-center gap-2 text-muted text-sm mb-2"><i data-lucide="trending-down" class="w-4 h-4 text-danger"></i>Egresos</div>
        <div class="text-2xl font-bold text-danger truncate">${currency(totalExpenses)}</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card min-w-0">
        <div class="flex items-center gap-2 text-muted text-sm mb-2"><i data-lucide="wallet" class="w-4 h-4 ${profit >= 0 ? 'text-success' : 'text-danger'}"></i>Utilidad Mes</div>
        <div class="text-2xl font-bold truncate ${profit >= 0 ? 'text-success' : 'text-danger'}">${currency(profit)}</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card min-w-0">
        <div class="flex items-center gap-2 text-muted text-sm mb-2"><i data-lucide="scale" class="w-4 h-4 text-warn"></i>Granel Hoy</div>
        <div class="text-2xl font-bold text-warn truncate">${currency(todayBulkTotal)}</div>
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-4 w-full">
      <div class="bg-surface rounded-xl p-5 border border-card lg:col-span-2 shadow-sm flex flex-col min-w-0 w-full overflow-hidden">
        <h3 class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="bar-chart-2" class="w-4 h-4 text-accent"></i>Productos Más Vendidos</h3>
        
        <div class="grid md:grid-cols-2 gap-6 flex-1 items-center">
          <div class="flex flex-col space-y-1 w-full min-w-0">
            ${topProducts.length ? topProducts.map((tp, i) => `
              <div class="flex items-center justify-between py-2 ${i < topProducts.length - 1 ? 'border-b border-card/50' : ''}">
                <span class="text-sm truncate pr-2 flex-1">${tp[0]}</span>
                <span class="text-sm font-semibold text-accent whitespace-nowrap shrink-0">${tp[1]} uds</span>
              </div>`).join('') : '<p class="text-muted text-sm">Sin datos de ventas aún</p>'}
          </div>
          <div class="relative w-full h-48 flex justify-center items-center min-w-0">
            ${topProducts.length ? '<canvas id="topProductsChart"></canvas>' : '<div class="text-muted text-sm">Sin datos para graficar</div>'}
          </div>
        </div>
      </div>

      <div class="bg-surface rounded-xl p-5 border border-card shadow-sm flex flex-col min-w-0 w-full overflow-hidden">
        <h3 class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-warn"></i>Stock Bajo</h3>
        <div class="flex flex-col space-y-1 w-full min-w-0">
        ${lowStock.length ? lowStock.slice(0, 6).map(p => `
          <div class="flex items-center justify-between py-2 border-b border-card/50 last:border-0">
            <span class="text-sm truncate pr-2 flex-1">${p.name}</span>
            <span class="text-sm font-bold text-warn whitespace-nowrap shrink-0">${p.stock} uds</span>
          </div>`).join('') : '<p class="text-muted text-sm">Todo en orden ✓</p>'}
        </div>
      </div>
    </div>

    <div class="bg-surface rounded-xl p-4 md:p-5 border border-card shadow-sm w-full min-w-0 overflow-hidden mt-4">
      <h3 class="font-semibold mb-3 flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4 text-accent2"></i>Ventas Recientes</h3>
      
      <div class="w-full overflow-x-auto pb-2">
        <table class="w-full text-sm min-w-[550px]">
          <thead>
            <tr class="text-muted text-left border-b border-card">
              <th class="pb-2 font-medium">Producto</th>
              <th class="pb-2 font-medium">Cant</th>
              <th class="pb-2 font-medium">Total</th>
              <th class="pb-2 font-medium">Pago</th>
              <th class="pb-2 font-medium">Cajero</th>
              <th class="pb-2 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(s => {
              const itemList = s.items ? s.items : [s];
              const totalQty = itemList.reduce((sum, i) => sum + (Number(i.quantity) || Number(i.qty) || 1), 0);
              const prodName = itemList.length > 1 ? `Varios (${itemList.length} prods)` : (itemList[0].name || '-');
              
              let localDateStr = '-';
              if (s.date) {
                 const d = new Date(s.date);
                 localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              }
              
              return `
              <tr class="border-b border-card/50 hover:bg-card/30 transition">
                <td class="py-2.5 truncate max-w-[180px]" title="${prodName}">${prodName}</td>
                <td class="py-2.5 font-bold">${totalQty}</td>
                <td class="py-2.5 font-semibold text-txt">
                   ${s.is_credit ? currency(s.cash_part + (s.transfer_part || 0)) : currency(s.total)}
                </td>
                <td class="py-2.5">
                  <span class="text-[10px] sm:text-xs px-2 py-1 rounded-full whitespace-nowrap ${s.payment_method === 'Efectivo' ? 'bg-success/20 text-success' : s.payment_method === 'Transfer' ? 'bg-accent2/20 text-white' : 'bg-accent/20 text-accent'}">
                    ${s.payment_method || 'Efectivo'}
                  </span>
                </td>
                <td class="py-2.5 text-muted">${s.cashier || '-'}</td>
                <td class="py-2.5 text-muted whitespace-nowrap">${localDateStr}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="py-6 text-muted text-center">Sin ventas registradas</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  lucide.createIcons();

  if (topProducts.length > 0) {
    const ctxTop = document.getElementById('topProductsChart');
    if (ctxTop) {
      new Chart(ctxTop.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: topProducts.map(tp => tp[0]), 
          datasets: [{
            data: topProducts.map(tp => tp[1]), 
            backgroundColor: [
              '#ff0000', 
              '#f59e0b', 
              '#10b981', 
              '#cc0000', 
              '#990000'  
            ],
            borderWidth: 2,
            borderColor: '#111111', 
            hoverOffset: 6 
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%', 
          plugins: {
            legend: {
              position: 'right', 
              labels: {
                color: '#ffffff', 
                font: { family: "'DM Sans', sans-serif", size: 11 },
                usePointStyle: true, 
                boxWidth: 8
              }
            }
          }
        }
      });
    }
  }
}

export function renderInventory(container) {
  const products = records('product');
  const categories = records('category'); 
  let searchTerm = '';
  let editingProduct = null;
  
  let editingCategoryId = null;
  let editingCategoryOldName = '';

  function renderList() {
    const currentProducts = records('product');
    const filtered = currentProducts.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()));
    
    const list = document.getElementById('inv-list');
    if (!list) return;
    
    list.innerHTML = filtered.length ? filtered.map(p => `
      <tr class="border-b border-card/50 hover:bg-card/30 transition">
        <td class="py-3"><span class="text-xs text-muted bg-card px-2 py-0.5 rounded">${p.code || '-'}</span></td>
        <td class="py-3 font-medium">${p.name}</td>
        <td class="py-3"><span class="text-xs bg-accent2/20 text-accent2 px-2 py-0.5 rounded-full">${p.category || 'Sin categoría'}</span></td>
        <td class="py-3">${currency(p.buy_price)}</td>
        <td class="py-3 font-semibold">${currency(p.sell_price)}</td>
       
        <td class="py-3">
          <div class="flex items-center gap-2">
            ${p.is_service ? 
              `<span class="text-accent font-bold w-16 text-center" title="Sin límite">Servicio</span>` : 
              `<span class="${p.stock <= (p.min_stock || 5) ? 'text-warn font-bold' : ''} w-6 text-center">${p.stock}</span>
               <button type="button" onclick="window.openStockModal('${p.id}', 'in')" class="w-7 h-7 bg-success/20 text-success rounded flex items-center justify-center hover:bg-success/40 transition" title="Entrada"><i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i></button>
               <button type="button" onclick="window.openStockModal('${p.id}', 'out')" class="w-7 h-7 bg-danger/20 text-danger rounded flex items-center justify-center hover:bg-danger/40 transition" title="Salida"><i data-lucide="minus" class="w-4 h-4 pointer-events-none"></i></button>`
            }
          </div>
        </td>
        <td class="py-3 print:hidden">
          <div class="flex gap-2">
            <button type="button" onclick="window.printBarcode('${p.id}')" class="flex items-center justify-center bg-success/10 border border-success/20 text-success w-8 h-8 rounded-lg hover:bg-success hover:text-white transition shadow-sm" title="Imprimir Etiqueta">
              <i data-lucide="printer" class="w-4 h-4 pointer-events-none"></i>
            </button>
            <button type="button" onclick="window.editProduct('${p.id}')" class="flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-lg hover:bg-accent hover:text-bg transition font-semibold text-xs shadow-sm">
              <i data-lucide="edit" class="w-3.5 h-3.5 pointer-events-none"></i> Editar
            </button>
            <button type="button" onclick="window.deleteProduct('${p.id}')" class="flex items-center justify-center bg-danger/10 border border-danger/20 text-danger w-8 h-8 rounded-lg hover:bg-danger hover:text-white transition shadow-sm">
              <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
            </button>
          </div>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="py-8 text-center text-muted">No hay productos.</td></tr>';
    lucide.createIcons();
  }

  function renderBMList() {
    const containerBM = document.getElementById('bm-list-container');
    if (!containerBM) return;
    
    containerBM.innerHTML = records('bulk_material').map(b => `
      <div class="flex flex-col bg-card/40 p-3 rounded-lg border border-card gap-2">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium truncate pr-2">${b.name}</span>
          <span class="text-xs font-bold ${b.stock <= 5 ? 'text-danger' : 'text-warn'}">${b.stock || 0} uds</span>
        </div>
        <div class="flex items-center justify-between mt-1">
          <div class="flex items-center gap-1">
             <button type="button" onclick="window.openStockModal('${b.id}', 'in')" class="w-7 h-7 bg-success/20 text-success rounded flex items-center justify-center hover:bg-success/40 transition" title="Entrada"><i data-lucide="plus" class="w-3.5 h-3.5 pointer-events-none"></i></button>
             <button type="button" onclick="window.openStockModal('${b.id}', 'out')" class="w-7 h-7 bg-danger/20 text-danger rounded flex items-center justify-center hover:bg-danger/40 transition" title="Salida"><i data-lucide="minus" class="w-3.5 h-3.5 pointer-events-none"></i></button>
          </div>
          <div class="flex items-center gap-1">
             <button type="button" onclick="window.editBM('${b.id}')" class="w-7 h-7 bg-accent/10 text-accent rounded flex items-center justify-center hover:bg-accent/20 transition"><i data-lucide="edit-2" class="w-3.5 h-3.5 pointer-events-none"></i></button>
             <button type="button" onclick="window.deleteBM('${b.id}', '${b.name}')" class="w-7 h-7 bg-danger/10 text-danger rounded flex items-center justify-center hover:bg-danger/20 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i></button>
          </div>
        </div>
      </div>
    `).join('') || '<p class="text-xs text-muted text-center py-4">No hay empaques registrados</p>';
    lucide.createIcons();
  }

  container.innerHTML = `
  <div class="fade-in space-y-6 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Inventario</h2>
      <div class="flex gap-2 items-center">
        <button id="export-excel" class="bg-success/10 border border-success/20 text-success px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-success/20 transition"><i data-lucide="file-spreadsheet" class="w-4 h-4"></i> Excel</button>
        <div class="relative ml-2">
          <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
          <input id="inv-search" class="bg-card border border-card rounded-lg pl-9 pr-4 py-2 text-sm focus:border-accent focus:outline-none w-48" placeholder="Buscar...">
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-surface rounded-xl p-5 border border-card shadow-sm">
        <h3 id="prod-form-title" class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="package-plus" class="w-4 h-4 text-accent"></i> Agregar Producto</h3>
        
        <form id="prod-form" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start w-full">
          <div class="col-span-1 sm:col-span-2 md:col-span-4 flex gap-4 mb-2">
            <label class="flex items-center gap-2 cursor-pointer bg-card/50 px-4 py-2 rounded-lg border border-card hover:bg-card transition w-full justify-center">
              <input type="radio" name="prod-is-service" value="false" class="w-4 h-4 text-accent" checked onchange="document.getElementById('stock-wrapper').classList.remove('hidden')">
              <span class="text-sm font-semibold">📦 Producto Físico</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer bg-card/50 px-4 py-2 rounded-lg border border-card hover:bg-card transition w-full justify-center">
              <input type="radio" name="prod-is-service" value="true" class="w-4 h-4 text-accent" onchange="document.getElementById('stock-wrapper').classList.add('hidden')">
              <span class="text-sm font-semibold">🛠️ Servicio</span>
            </label>
          </div>

          <div class="flex flex-col gap-1 md:col-span-1">
            <label class="text-xs text-muted">Imagen</label>
            <input id="prod-img-file" type="file" accept="image/*" class="text-[10px] text-muted bg-card p-1 rounded border border-card w-full">
            <input id="prod-img-base64" type="hidden"> 
          </div>
          <div class="flex flex-col gap-1 md:col-span-1">
            <label class="text-xs text-muted">Código</label>
            <input id="prod-code" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Escanear...">
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2 md:col-span-2">
            <label class="text-xs text-muted">Nombre *</label>
            <input id="prod-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Nombre del producto" required>
          </div>
          
          <div class="flex flex-col gap-1 sm:col-span-1 md:col-span-1">
            <label class="text-xs text-muted">Categoría *</label>
            <select id="prod-cat" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" required>
              <option value="">Seleccionar...</option>
              ${categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
              ${categories.length === 0 ? '<option value="General">General</option>' : ''}
            </select>
          </div>

          <div class="flex flex-col gap-1 sm:col-span-1 md:col-span-1">
            <label class="text-xs text-muted">P. Compra</label>
            <input id="prod-buy" type="number" step="0.01" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="0.00">
          </div>
          <div class="flex flex-col gap-1 sm:col-span-1 md:col-span-1">
            <label class="text-xs text-muted">P. Venta *</label>
            <input id="prod-sell" type="number" step="0.01" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="0.00" required>
          </div>
          <div id="stock-wrapper" class="flex flex-col gap-1 sm:col-span-1 md:col-span-1">
            <label class="text-xs text-muted">Stock Inicial (kg/uds)</label>
            <input id="prod-stock" type="number" step="0.001" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" value="0">
          </div>
          
          <div class="flex gap-2 col-span-1 sm:col-span-2 md:col-span-4 mt-2">
            <button id="prod-submit" type="submit" class="bg-accent text-white font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm flex-1">Guardar Producto</button>
            <button id="prod-cancel" type="button" class="bg-card text-muted px-4 py-2.5 rounded-lg hover:bg-surface transition text-sm hidden">Cancelar</button>
          </div>
        </form>
      </div>

      <div class="flex flex-col gap-6 lg:col-span-1">
        <div class="bg-surface rounded-xl p-5 border border-card shadow-sm flex flex-col max-h-[350px]">
          <h3 id="cat-form-title" class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="tags" class="w-4 h-4 text-accent2"></i> Categorías</h3>
          <div class="flex gap-2 mb-4 shrink-0">
            <input id="new-cat-name" class="flex-1 bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent2 focus:outline-none" placeholder="Nueva categoría...">
            <button id="add-cat-btn" class="bg-accent2 text-white px-3 py-2 rounded-lg hover:opacity-90 transition" title="Guardar"><i data-lucide="plus" class="w-5 h-5"></i></button>
            <button id="cancel-cat-btn" class="bg-card text-muted p-2 rounded-lg hover:bg-bg transition hidden" title="Cancelar Edición"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          <div class="space-y-2 overflow-auto pr-2 flex-1">
            ${categories.map(c => `
              <div class="flex flex-col xl:flex-row xl:items-center justify-between bg-card/40 p-3 rounded-lg border border-card gap-2">
                <span class="text-sm font-medium truncate pr-2">${c.name}</span>
                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" onclick="window.editCategory('${c.id}')" class="flex items-center gap-1 bg-accent/10 border border-accent/20 text-accent px-2.5 py-1.5 rounded hover:bg-accent hover:text-bg transition font-semibold text-xs">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5 pointer-events-none"></i> Editar
                  </button>
                  <button type="button" onclick="window.deleteCategory('${c.id}', '${c.name}')" class="flex items-center justify-center bg-danger/10 border border-danger/20 text-danger w-7 h-7 rounded hover:bg-danger hover:text-white transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
                  </button>
                </div>
              </div>
            `).join('') || '<p class="text-xs text-muted text-center py-4">No hay categorías creadas</p>'}
          </div>
        </div>

        <div class="bg-surface rounded-xl p-5 border border-card shadow-sm flex flex-col max-h-[350px]">
          <h3 class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="package-open" class="w-4 h-4 text-warn"></i> Empaques A Granel</h3>
          <div class="flex gap-2 mb-4 shrink-0">
            <input id="new-bm-name" class="flex-1 bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-warn focus:outline-none" placeholder="Ej: Vasos, Bolsas...">
            <button id="add-bm-btn" class="bg-warn text-bg px-3 py-2 rounded-lg hover:opacity-90 transition" title="Guardar"><i data-lucide="plus" class="w-5 h-5"></i></button>
            <button id="cancel-bm-btn" class="bg-card text-muted p-2 rounded-lg hover:bg-bg transition hidden" title="Cancelar"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          <div id="bm-list-container" class="space-y-2 overflow-auto pr-2 flex-1"></div>
        </div>
      </div>
    </div>

    <div class="bg-surface rounded-xl border border-card overflow-x-auto p-1 shadow-sm mt-4">
      <table class="w-full text-sm">
        <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Código</th><th class="p-3">Nombre</th><th class="p-3">Categoría</th><th class="p-3">P.Compra</th><th class="p-3">P.Venta</th><th class="p-3">Stock</th><th class="p-3 print:hidden">Acciones</th></tr></thead>
        <tbody id="inv-list"></tbody>
      </table>
    </div>
  </div>`;

  let editingBMId = null;
  document.getElementById('add-bm-btn').onclick = async () => {
    const name = document.getElementById('new-bm-name').value.trim();
    if (!name) return showToast('Escribe un nombre', 'warn');
    const btn = document.getElementById('add-bm-btn');
    btn.disabled = true;

    if (editingBMId) {
      await dbSdk.update({ type: 'bulk_material', id: editingBMId, name: name });
      showToast('Empaque actualizado', 'success');
    } else {
      await dbSdk.create({ type: 'bulk_material', name, stock: 0, date: now() });
      showToast('Empaque creado');
    }
    editingBMId = null;
    renderInventory(container);
  };

  window.editBM = (id) => {
    const bm = records('bulk_material').find(b => b.id === id);
    if (bm) {
       editingBMId = bm.id;
       document.getElementById('new-bm-name').value = bm.name;
       document.getElementById('new-bm-name').focus();
       document.getElementById('cancel-bm-btn').classList.remove('hidden');
       const btn = document.getElementById('add-bm-btn');
       btn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i>';
       btn.classList.replace('bg-warn', 'bg-success');
       lucide.createIcons();
    }
  };

  document.getElementById('cancel-bm-btn').onclick = () => {
     editingBMId = null; renderInventory(container);
  };

  window.deleteBM = (id, name) => {
     showConfirm(`¿Borrar el empaque "${name}"?`, async () => {
       await dbSdk.delete({ type: 'bulk_material', id });
       showToast('Empaque eliminado');
       renderInventory(container);
     });
  };

  document.getElementById('add-cat-btn').onclick = async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) return showToast('Escribe un nombre', 'warn');
    
    const btn = document.getElementById('add-cat-btn');
    btn.disabled = true;

    try {
      if (editingCategoryId) {
        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategoryId)) {
          showToast('Esta categoría ya existe', 'warn');
          btn.disabled = false;
          return;
        }
        
        await dbSdk.update({ type: 'category', id: editingCategoryId, name: name });
        
        const productsToUpdate = products.filter(p => p.category === editingCategoryOldName);
        for (const p of productsToUpdate) {
          await dbSdk.update({ ...p, category: name });
        }

        showToast('Categoría y productos actualizados', 'success');
      } else {
        if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
          showToast('Esta categoría ya existe', 'warn');
          btn.disabled = false;
          return;
        }
        await dbSdk.create({ type: 'category', name, date: now() });
        showToast('Categoría creada');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión', 'error');
    }

    editingCategoryId = null;
    editingCategoryOldName = '';
    renderInventory(container); 
  };

  window.editCategory = (id) => {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      editingCategoryId = cat.id;
      editingCategoryOldName = cat.name;
      
      document.getElementById('new-cat-name').value = cat.name;
      document.getElementById('new-cat-name').focus();
      
      const btn = document.getElementById('add-cat-btn');
      btn.innerHTML = '<i data-lucide="check" class="w-5 h-5"></i> Guardar';
      btn.classList.replace('bg-accent2', 'bg-success');
      btn.classList.add('px-4', 'font-bold');
      
      document.getElementById('cancel-cat-btn').classList.remove('hidden');
      document.getElementById('cat-form-title').innerHTML = '<i data-lucide="edit-3" class="w-4 h-4 text-warn"></i> Editar Categoría';
      lucide.createIcons();
    }
  };

  document.getElementById('cancel-cat-btn').onclick = () => {
    editingCategoryId = null;
    editingCategoryOldName = '';
    renderInventory(container);
  };

  window.deleteCategory = (id, name) => {
    showConfirm(`¿Borrar categoría "${name}"? Los productos que la usan se quedarán "Sin categoría".`, async () => {
      await dbSdk.delete({ type: 'category', id });
      showToast('Categoría eliminada');
      renderInventory(container);
    });
  };

  window.editProduct = (id) => {
    editingProduct = state.allRecords.find(r => r.id === id);
    if (editingProduct) {
      document.getElementById('prod-name').value = editingProduct.name;
      document.getElementById('prod-code').value = editingProduct.code || '';
      document.getElementById('prod-cat').value = editingProduct.category || '';
      document.getElementById('prod-buy').value = editingProduct.buy_price || ''; 
      document.getElementById('prod-sell').value = editingProduct.sell_price;
      
      const isService = editingProduct.is_service === true;
      document.querySelector(`input[name="prod-is-service"][value="${isService}"]`).checked = true;
      
      if (isService) {
          document.getElementById('stock-wrapper').classList.add('hidden');
      } else {
          document.getElementById('stock-wrapper').classList.remove('hidden');
          document.getElementById('prod-stock').value = editingProduct.stock;
      }
      
      document.getElementById('prod-submit').textContent = 'Actualizar Producto';
      document.getElementById('prod-cancel').classList.remove('hidden');
      document.getElementById('prod-form-title').innerHTML = '<i data-lucide="edit" class="w-4 h-4 text-warn"></i> Editar Producto';
      
      const adminContent = document.getElementById('admin-content');
      if (adminContent) {
          adminContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  window.deleteProduct = (id) => {
    const prodToDel = records('product').find(p => p.id === id);
    if (prodToDel) {
      showConfirm(`¿Estás seguro de eliminar el producto "${prodToDel.name}" permanentemente?`, () => {
        const idx = state.allRecords.findIndex(r => r.id === id);
        if (idx > -1) state.allRecords.splice(idx, 1);
        
        dbSdk.delete({ type: 'product', id });
        showToast('Producto eliminado correctamente', 'success');
        
        editingProduct = null;
        document.getElementById('prod-form').reset();
        document.getElementById('prod-submit').textContent = 'Guardar Producto';
        document.getElementById('prod-cancel').classList.add('hidden');
        document.getElementById('prod-form-title').innerHTML = '<i data-lucide="package-plus" class="w-4 h-4 text-accent"></i> Agregar Producto';
        
        const invSearch = document.getElementById('inv-search');
        if (invSearch) invSearch.dispatchEvent(new Event('input'));
      });
    }
  };

  document.getElementById('prod-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('prod-submit');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const newName = document.getElementById('prod-name').value.trim();
    const isService = document.querySelector('input[name="prod-is-service"]:checked').value === 'true';

    const data = {
      type: 'product',
      name: newName,
      code: document.getElementById('prod-code').value.trim() || genId().slice(0, 8).toUpperCase(),
      category: document.getElementById('prod-cat').value,
      buy_price: parseFloat(document.getElementById('prod-buy').value) || 0,
      sell_price: parseFloat(document.getElementById('prod-sell').value),
      is_service: isService, 
      stock: isService ? 999999 : (parseFloat(document.getElementById('prod-stock').value) || 0),
      min_stock: 5,
      image: document.getElementById('prod-img-base64').value || (editingProduct ? editingProduct.image : '')
    };

    if (editingProduct) {
      const oldName = editingProduct.name;
      
      await dbSdk.update({ ...editingProduct, ...data });
      
      if (oldName !== newName) {
        const movementsToUpdate = records('movement').filter(m => m.name === oldName);
        for (const m of movementsToUpdate) {
          await dbSdk.update({ ...m, name: newName });
        }
        
        const salesToUpdate = records('sale').filter(s => s.name === oldName);
        for (const s of salesToUpdate) {
          await dbSdk.update({ ...s, name: newName });
        }
      }
      
      showToast('Producto actualizado en todo el sistema');
    } else {
      await dbSdk.create({ ...data, date: now(), status: 'active' });
      showToast('Producto agregado');
    }

    editingProduct = null;
    renderInventory(container);
  };

  document.getElementById('export-excel').onclick = () => {
    if (!products.length) return showToast('No hay datos', 'warn');
    const data = products.map(p => ({
      'Código': p.code || 'N/A', 'Producto': p.name, 'Categoría': p.category || 'General',
      'P. Venta': p.sell_price, 'Stock': p.stock
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_${bizName()}_${today()}.xlsx`);
  };

  document.getElementById('inv-search').oninput = (e) => { searchTerm = e.target.value; renderList(); };
  
  document.getElementById('prod-img-file').onchange = async (e) => {
    if (e.target.files[0]) {
      const compressed = await compressImage(e.target.files[0]);
      document.getElementById('prod-img-base64').value = compressed;
      showToast('Imagen lista');
    }
  };

  document.getElementById('prod-cancel').onclick = () => {
    editingProduct = null;
    renderInventory(container);
  };

  renderList();
  renderBMList();
  
  window.refreshInventoryViews = () => {
      renderList();
      renderBMList();
  };

  lucide.createIcons();
}

export async function renderSalesReport(container) {
  container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-muted fade-in"><i data-lucide="loader" class="w-8 h-8 animate-spin text-accent mb-4"></i><p class="font-semibold text-sm">Descargando historial...</p></div>`;
  lucide.createIcons();

  if (!state.reportSpecificDate) {
    const d = new Date();
    state.reportSpecificDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const y = state.reportDate.getFullYear();
  const m = state.reportDate.getMonth();
  
  await cargarMesFirebase(y, m);

  const sales = records('sale');
  const movements = records('movement');
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthName = monthNames[m];

  const formatLocalTime = (utcStr) => {
      if (!utcStr) return '-';
      const d = new Date(utcStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const filteredSales = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const filteredMovements = movements.filter(mov => {
    if (!mov.date) return false;
    const d = new Date(mov.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const ticketMap = new Map();
  filteredSales.forEach(s => {
    const tId = s.ticket_num || s.id;
    if (!ticketMap.has(tId)) {
      if (s.evidence_image && s.evidence_delete_at) {
        if (new Date().getTime() > new Date(s.evidence_delete_at).getTime()) {
          s.evidence_image = null; 
          s.evidence_delete_at = null;
          dbSdk.update({ ...s, evidence_image: null, evidence_delete_at: null }); 
        }
      }

      ticketMap.set(tId, {
        id: s.id, 
        ticket_num: s.ticket_num,
        tracking_number: s.tracking_number, 
        evidence_image: s.evidence_image, 
        is_invoiceable: s.is_invoiceable === true || String(s.is_invoiceable) === 'true', 
        client_name: s.client_name, 
        date: s.date,
        payment_method: s.payment_method,
        cashier: s.cashier,
        order_total: s.order_total || s.total,
        raw_sales: [] 
      });
    }
    if (s.items && Array.isArray(s.items)) {
      ticketMap.get(tId).raw_sales.push(...s.items);
    } else {
      ticketMap.get(tId).raw_sales.push(s);
    }
  });
  const groupedSales = Array.from(ticketMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const abonosMesReporte = filteredMovements.filter(m => m.category === 'cash_in' && (m.name === 'Cobro de Abono' || m.name === 'Abono de Cliente')).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const monthTotal = filteredSales.reduce((a, s) => {
      const pagado = s.cash_part !== undefined ? (Number(s.cash_part) + Number(s.transfer_part || 0)) : (Number(s.total) || 0);
      return a + pagado;
  }, 0) + abonosMesReporte;

  const avgTicket = groupedSales.length ? monthTotal / groupedSales.length : 0;

  const specificDaySales = filteredSales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    const localDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDateString === state.reportSpecificDate;
  });

  const abonosDiaReporte = filteredMovements.filter(m => {
      if (m.category !== 'cash_in' || (m.name !== 'Cobro de Abono' && m.name !== 'Abono de Cliente')) return false;
      const d = new Date(m.date);
      const localDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return localDateString === state.reportSpecificDate;
  }).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const specificDayTickets = new Set(specificDaySales.map(s => s.ticket_num || s.id)).size;

  const specificDayTotal = specificDaySales.reduce((a, s) => {
      const pagado = s.cash_part !== undefined ? (Number(s.cash_part) + Number(s.transfer_part || 0)) : (Number(s.total) || 0);
      return a + pagado;
  }, 0) + abonosDiaReporte;

  let monthBulkTotal = 0;
  let monthCOGS = 0; 

  filteredSales.forEach(s => {
    const items = s.items ? s.items : [s];
    items.forEach(item => {
      if ((item.id && String(item.id).startsWith('bulk_')) || (item.name && item.name.includes('(Granel)'))) {
        monthBulkTotal += (Number(item.total) || 0);
      }
      
      let buyP = Number(item.buy_price || 0);
      if (buyP === 0) {
          const prodRef = state.allRecords.find(r => r.type === 'product' && (r.id === item.id || r.name === item.name));
          if (prodRef && prodRef.buy_price) buyP = Number(prodRef.buy_price);
      }
      monthCOGS += (buyP * Number(item.quantity || 1));
    });
  });

  const monthExpenses = records('expense').filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const totalMonthExpense = monthExpenses.reduce((a, e) => a + (e.amount || 0), 0);
  const monthNetProfit = monthTotal - monthCOGS - totalMonthExpense;

  let specificDayCOGS = 0;
  specificDaySales.forEach(s => {
    const items = s.items ? s.items : [s];
    items.forEach(item => {
      let cost = Number(item.buy_price || 0);
      if (cost === 0) {
          const prodRef = state.allRecords.find(r => r.type === 'product' && (r.id === item.id || r.name === item.name));
          if (prodRef && prodRef.buy_price) cost = Number(prodRef.buy_price);
      }
      specificDayCOGS += (cost * Number(item.quantity || 1));
    });
  });
  
  const specificDayProfit = specificDayTotal - specificDayCOGS;

  const specificDayGroupedSales = groupedSales.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date);
    const localDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return localDateString === state.reportSpecificDate;
  });

  container.innerHTML = `
  <div class="fade-in space-y-6 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Ventas y Reportes</h2>
      
      <div class="flex items-center gap-1 bg-surface border border-card rounded-lg p-1 shadow-sm">
        <button type="button" id="rep-prev" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
        <div class="text-sm font-bold w-36 text-center uppercase tracking-wider text-accent">${monthName} ${y}</div>
        <button type="button" id="rep-next" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
      </div>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div class="bg-surface rounded-xl p-4 border border-card text-center relative shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-2 mb-1">
           <i data-lucide="calendar" class="w-4 h-4 text-accent"></i>
           <input type="date" id="rep-specific-date" class="bg-card border border-surface rounded px-2 py-1 text-xs text-accent font-bold focus:border-accent focus:outline-none cursor-pointer" value="${state.reportSpecificDate}">
        </div>
        <div class="text-2xl font-bold text-success mt-1">${currency(specificDayTotal)}</div>
        <div class="text-xs text-muted">${specificDayTickets} tickets</div>
      </div>

      <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="wallet" class="w-4 h-4 text-success"></i> Utilidad Día</div>
        <div class="text-2xl font-bold text-success mt-1">${currency(specificDayProfit)}</div>
        <div class="text-xs text-muted">Ingreso menos costo</div>
      </div>

      <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="bar-chart-2" class="w-4 h-4 text-accent"></i> Total ${monthName}</div>
        <div class="text-2xl font-bold text-accent mt-1">${currency(monthTotal)}</div>
        <div class="text-xs text-muted">${groupedSales.length} tickets</div>
      </div>
      
      <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="piggy-bank" class="w-4 h-4 ${monthNetProfit >= 0 ? 'text-success' : 'text-danger'}"></i> Utilidad Mes</div>
        <div class="text-2xl font-bold ${monthNetProfit >= 0 ? 'text-success' : 'text-danger'} mt-1">${currency(monthNetProfit)}</div>
        <div class="text-xs text-muted">Total - Costos - Egresos</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="receipt" class="w-4 h-4 text-accent2"></i> Promedio</div>
        <div class="text-2xl font-bold text-accent2 mt-1">${currency(avgTicket)}</div>
        <div class="text-xs text-muted">Ticket medio</div>
      </div>

      <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="scale" class="w-4 h-4 text-warn"></i> Granel Mes</div>
        <div class="text-2xl font-bold text-warn mt-1">${currency(monthBulkTotal)}</div>
        <div class="text-xs text-muted">Ventas libres</div>
      </div>
    </div>
    <div class="bg-surface rounded-xl border border-card overflow-x-auto shadow-sm">
      <div class="p-4 border-b border-card font-bold text-sm text-muted flex justify-between items-center">
          <span>Historial de Tickets del Día (${state.reportSpecificDate})</span>
          <button id="export-sales-btn" class="bg-success/10 text-success text-[10px] px-2 py-1 rounded border border-success/20 hover:bg-success/20 uppercase font-bold transition">Exportar Excel del Día</button>
      </div>
      <table class="w-full text-sm">
        <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Fecha</th><th class="p-3">Ticket</th><th class="p-3">Artículos</th><th class="p-3">Total</th><th class="p-3">Pago</th><th class="p-3">Cajero</th><th class="p-3 text-center">Acciones</th></tr></thead>
        <tbody>
            ${specificDayGroupedSales.map(t => `
              <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
                <td class="p-3 text-muted whitespace-nowrap">${formatLocalTime(t.date)}</td>
                <td class="p-3">
                  <div class="font-bold text-accent text-base">#${t.ticket_num || 'S/N'}</div>
                  ${t.tracking_number ? `<div class="text-xs text-txt flex items-center gap-1 mt-1"><i data-lucide="package" class="w-3.5 h-3.5 text-muted"></i> ${t.tracking_number}</div>` : ''}
                  <div class="flex items-center gap-2 mt-1.5">
                    <label class="flex items-center gap-1 cursor-pointer text-[10.5px] ${t.is_invoiceable ? 'text-accent font-bold' : 'text-muted'}">
                      <input type="radio" name="inv_${t.id}" value="true" data-update-inv="${t.id}" class="w-3 h-3 cursor-pointer" ${t.is_invoiceable ? 'checked' : ''}> Facturable
                    </label>
                    <label class="flex items-center gap-1 cursor-pointer text-[10.5px] ${!t.is_invoiceable ? 'text-warn font-bold' : 'text-muted'}">
                      <input type="radio" name="inv_${t.id}" value="false" data-update-inv="${t.id}" class="w-3 h-3 cursor-pointer" ${!t.is_invoiceable ? 'checked' : ''}> No Facturable
                    </label>
                  </div>
                </td>
               <td class="p-3">
                  <div class="text-xs text-muted max-w-[250px] truncate" title="${t.raw_sales.map(i => `${i.quantity}x ${i.name}`).join('\n')}">
                    ${t.raw_sales.map(i => `<span class="font-bold">${i.quantity}x</span> ${i.name}`).join(', ')}
                  </div>
                </td>
               <td class="p-3">
                  ${t.is_credit ? `
                    <div class="font-black text-success">${currency(t.order_total - t.debt)} <span class="text-[10px] text-muted font-normal">Total Pagado</span></div>
                    <div class="text-danger text-[11px] font-bold mt-0.5">Resta: ${currency(t.debt)}</div>
                    <div class="text-muted text-[10px] mt-0.5">Valor Total: ${currency(t.order_total)}</div>
                  ` : `
                    <div class="font-semibold text-txt">${currency(t.order_total)}</div>
                  `}
                </td>
                <td class="p-3"><span class="text-[10px] px-2 py-1 rounded-lg font-bold ${t.payment_method === 'Efectivo' ? 'bg-success/20 text-success' : t.payment_method === 'Crédito' ? 'bg-warn/20 text-warn' : 'bg-accent/20 text-accent'}">${t.payment_method || '-'}</span></td>
                <td class="p-3 text-muted">${t.cashier || '-'}</td>
                <td class="p-3 text-center flex items-center justify-center gap-2">
                  ${t.evidence_image ? `
                  <button type="button" onclick="window.showEvidence('${t.id}')" class="p-2 bg-success/10 hover:bg-success/20 rounded-lg transition text-success flex items-center justify-center" title="Ver Evidencia">
                    <i data-lucide="image" class="w-4 h-4 pointer-events-none"></i>
                  </button>` : ''}
                  <button type="button" data-view-ticket="${t.id}" class="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent flex items-center justify-center" title="Ver Ticket">
                    <i data-lucide="receipt" class="w-4 h-4 pointer-events-none"></i>
                  </button>
                  <button type="button" data-del-sale="${t.id}" class="p-2 hover:bg-danger/20 rounded-lg transition text-danger flex items-center justify-center" title="Eliminar Ticket Completo">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                  </button>
                </td>
              </tr>`).join('') || `<tr><td colspan="7" class="p-10 text-center text-muted">No hubo ventas el ${state.reportSpecificDate}</td></tr>`}
          </tbody>
      </table>
    </div>

    <div class="bg-surface rounded-xl border border-card overflow-x-auto shadow-sm">
      <div class="p-4 border-b border-card font-bold text-sm text-muted">
          Movimientos de Stock - ${monthName}
      </div>
      <table class="w-full text-sm">
        <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Fecha</th><th class="p-3">Tipo</th><th class="p-3">Producto</th><th class="p-3">Cantidad</th><th class="p-3">Motivo</th><th class="p-3">Usuario</th><th class="p-3 text-center">Acciones</th></tr></thead>
        <tbody>
         ${filteredMovements.filter(mov => mov.category === 'in' || mov.category === 'out').slice().reverse().map(m => `
            <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
              <td class="p-3 text-muted">${formatLocalTime(m.date)}</td>
              <td class="p-3">
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${m.category === 'in' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}">
                  ${m.category === 'in' ? 'ENTRADA (+)' : 'SALIDA (-)'}
                </span>
              </td>
              <td class="p-3 font-medium">${m.name || '-'}</td>
              <td class="p-3 font-bold ${m.category === 'in' ? 'text-success' : 'text-danger'}">${m.category === 'in' ? '+' : '-'}${m.quantity || 0}</td>
              <td class="p-3 text-muted truncate max-w-xs">${m.description || '-'}</td>
              <td class="p-3 text-muted">${m.cashier || '-'}</td>
              <td class="p-3 text-center">
                <button type="button" data-del-mov="${m.id}" class="p-2 hover:bg-danger/20 rounded-lg transition text-danger" title="Revertir Movimiento y Restaurar Stock">
                  <i data-lucide="rotate-ccw" class="w-4 h-4 pointer-events-none"></i>
                </button>
              </td>
            </tr>`).join('') || `<tr><td colspan="7" class="p-10 text-center text-muted">Sin movimientos en ${monthName}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;

  lucide.createIcons();

  document.getElementById('rep-specific-date').onchange = (e) => {
      const newDate = e.target.value;
      if (!newDate) return;
      state.reportSpecificDate = newDate;
      const [ny, nm] = newDate.split('-');
      state.reportDate = new Date(parseInt(ny), parseInt(nm) - 1, 1);
      renderSalesReport(container);
  };

  document.getElementById('rep-prev').onclick = () => {
    state.reportDate.setMonth(state.reportDate.getMonth() - 1);
    renderSalesReport(container);
  };
  document.getElementById('rep-next').onclick = () => {
    state.reportDate.setMonth(state.reportDate.getMonth() + 1);
    renderSalesReport(container);
  };

  document.getElementById('export-sales-btn').onclick = () => {
      if (!specificDayGroupedSales.length) return showToast('No hay datos para exportar en este día', 'warn');
      
      const data = [];
      specificDayGroupedSales.forEach(t => {
         t.raw_sales.forEach(item => {
            data.push({
              'Ticket': t.ticket_num || 'S/N',
              'Fecha': formatLocalTime(t.date),
              'Producto': item.name,
              'Cantidad': item.quantity || 1,
              'Total': item.total || (item.sell_price * (item.quantity || 1)),
              'Pago': t.payment_method || 'Efectivo',
              'Cajero': t.cashier
            });
         });
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas");
      XLSX.writeFile(wb, `Reporte_Ventas_${state.reportSpecificDate}.xlsx`);
      showToast('Excel del día descargado');
  };

  container.onclick = (e) => {
    const viewBtn = e.target.closest('[data-view-ticket]');
    if (viewBtn) openAdminTicketModal(viewBtn.dataset.viewTicket);

    const delSaleBtn = e.target.closest('[data-del-sale]');
    if (delSaleBtn) {
      const ticketId = delSaleBtn.dataset.delSale;
      const s = sales.find(r => r.id === ticketId);
      
      if (s) {
        const salesToRefund = s.ticket_num ? sales.filter(r => r.ticket_num === s.ticket_num) : [s];
        
        showConfirm(`¿Eliminar el ticket #${s.ticket_num || 'S/N'} completo y restaurar el stock?`, () => { 
          for (const venta of salesToRefund) {
            const itemsList = venta.items ? venta.items : [venta]; 
            
            for (const item of itemsList) {
              const record = state.allRecords.find(r => r.id === item.id || (r.type === 'product' && r.name === item.name));
              
              if (record && (record.type === 'product' || record.type === 'bulk_material')) {
                const qtyToRestore = Number(item.quantity || 1);
                record.stock = Number(record.stock) + qtyToRestore;
                dbSdk.update(record); 

                dbSdk.create({
                  type: 'movement', 
                  name: record.name, 
                  code: record.code || '', 
                  category: 'in',
                  quantity: qtyToRestore, 
                  total: record.stock, 
                  cashier: state.currentUser?.username || 'admin',
                  description: `Devolución por ticket #${s.ticket_num || 'S/N'} eliminado`, 
                  date: now(), 
                  buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, payment_method: '', status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0, amount: 0
                });
              }
            }

            dbSdk.delete(venta); 
            const saleIdx = state.allRecords.findIndex(r => r.id === venta.id);
            if (saleIdx > -1) state.allRecords.splice(saleIdx, 1);
          }
          
          if (s.ticket_num) {
              const abonosToDelete = state.allRecords.filter(m => m.type === 'movement' && m.category === 'cash_in' && m.description && m.description.includes(`#${s.ticket_num}`));
              for (const abono of abonosToDelete) {
                  dbSdk.delete(abono);
                  const abIdx = state.allRecords.findIndex(x => x.id === abono.id);
                  if (abIdx > -1) state.allRecords.splice(abIdx, 1);
              }
          }

          showToast('Ticket y abonos eliminados. Stock restaurado', 'success');
          renderSalesReport(container);
        });
      }
    }

    const delMovBtn = e.target.closest('[data-del-mov]');
    if (delMovBtn) {
      const m = movements.find(r => r.id === delMovBtn.dataset.delMov);
      if (m) {
        const isEntrada = m.category === 'in';
        const actionText = isEntrada ? 'restar' : 'sumar';
        
        showConfirm(`¿Revertir este movimiento y ${actionText} ${m.quantity} uds al stock?`, () => { 
          const product = state.allRecords.find(p => p.type === 'product' && p.name === m.name);
          if (product) {
            const qty = Number(m.quantity || 0);
            let newStock = Number(product.stock);
            if (isEntrada) {
              newStock -= qty;
              if (newStock < 0) newStock = 0;
            } else newStock += qty;
            
            product.stock = newStock;
            dbSdk.update(product);
          }
          dbSdk.delete(m);
          const movIdx = state.allRecords.findIndex(r => r.id === m.id);
          if (movIdx > -1) state.allRecords.splice(movIdx, 1);

          showToast('Movimiento revertido correctamente', 'success');
          renderSalesReport(container);
        });
      }
    }
  };

  container.addEventListener('change', async (e) => {
    if (e.target.matches('[data-update-inv]')) {
      const ticketId = e.target.dataset.updateInv;
      const isInvoiceable = e.target.value === 'true';
      
      const s = sales.find(r => r.id === ticketId);
      if (s) {
        const salesToUpdate = s.ticket_num ? sales.filter(r => r.ticket_num === s.ticket_num) : [s];
        e.target.disabled = true; 
        
        for (const venta of salesToUpdate) {
          venta.is_invoiceable = isInvoiceable;
          await dbSdk.update(venta);
        }
        
        showToast('Estatus de facturación actualizado', 'success');
        renderSalesReport(container); 
      }
    }
  });
}

export function openAdminTicketModal(saleId) {
  const clickedSale = state.allRecords.find(r => r.id === saleId);
  if (!clickedSale) return;

  const relatedSales = clickedSale.ticket_num 
    ? state.allRecords.filter(r => r.type === 'sale' && r.ticket_num === clickedSale.ticket_num)
    : [clickedSale]; 

  const ticketNum = clickedSale.ticket_num || new Date(clickedSale.date || Date.now()).getTime().toString().slice(-4); 
  const dateOpts = { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
  const saleDate = clickedSale.date ? new Date(clickedSale.date) : new Date();
  const dateTime = saleDate.toLocaleString('es-MX', dateOpts);

  const orderTotal = clickedSale.order_total || clickedSale.total;
  const cashPaid = clickedSale.cash_received || clickedSale.total;
  const change = clickedSale.change_returned || 0;

  const itemsToPrint = clickedSale.items ? clickedSale.items : relatedSales;

  const itemsHtml = itemsToPrint.map(item => `
    <div class="flex justify-between items-start text-black">
      <span class="w-8">${item.quantity || 1}x</span>
      <span class="flex-1 text-left uppercase truncate px-1">${item.name}</span>
      <span class="w-16 text-right">${currency(item.total)}</span>
    </div>
  `).join('');

  const sysLogo = getSystemLogo();
  const logoPrintHtml = sysLogo ? `<img src="${sysLogo}" style="max-width: 140px; max-height: 80px; margin: 0 auto 10px auto; display: block; object-fit: contain;">` : '';
  const trackingHtml = clickedSale.tracking_number ? `<div class="font-bold mt-2 text-[14px] border border-black p-1 bg-gray-100">RASTREO:<br>${clickedSale.tracking_number}</div>` : '';

  const ticketHtml = `
   <div class="text-center mb-3 text-black">
    ${logoPrintHtml}
    <div class="text-2xl font-bold tracking-tight uppercase">${bizName()}</div>
    <div class="text-xs mt-1 text-black">
     <div class="font-bold">TICKET DE VENTA (COPIA)</div>
      <div class="font-bold">Sucursal Principal</div>
       <div class="font-bold">Av. primavera#40 Barrio Yalchivol</div>
     <div class="font-bold mt-1">${dateTime}</div>
     <div>TICKET #${ticketNum}</div>
     ${trackingHtml}
    </div>
   </div>
   <div class="w-full border-t-2 border-dashed border-gray-400 mb-2"></div>
   <div class="w-full flex justify-between font-bold text-xs mb-1 text-black">
     <span>CANT</span>
     <span class="flex-1 ml-2">DESCRIPCIÓN</span>
     <span class="text-right w-16">IMPORTE</span>
   </div>
   <div class="w-full text-xs space-y-1 text-black font-mono">
     ${itemsHtml}
   </div>
   <div class="w-full border-t-2 border-dashed border-gray-400 mt-2 mb-2"></div>
   <div class="w-full flex justify-between items-center text-base font-bold mb-2 text-black">
     <span>TOTAL:</span>
     <span class="text-lg">${currency(orderTotal)}</span>
   </div>
   <div class="w-full border-t border-solid border-gray-300 mb-2"></div>
   <div class="w-full text-xs space-y-1 text-black">
    <div class="font-bold text-center mb-1">DETALLE DE PAGO</div>
    <div class="flex justify-between"><span>PAGÓ CON (${clickedSale.payment_method || 'Efectivo'}):</span><span>${currency(cashPaid)}</span></div>
    <div class="flex justify-between font-bold text-sm mt-1"><span>SU CAMBIO:</span><span>${currency(change)}</span></div>
   </div>
   <div class="w-full border-t-2 border-dashed border-gray-400 mt-3 mb-2 text-black"></div>
   <div class="text-center text-xs space-y-1 text-black">
    <div class="font-bold">Cel 963-171-8780</div>
    <div class="font-bold">Cel 963-111-5533</div>
    <div>Vuelva pronto</div>
    <div class="text-[10px] mt-2 text-gray-500">Este documento no es un comprobante fiscal</div>
   </div>
  `;

  document.getElementById('printable-ticket').innerHTML = ticketHtml;
  document.getElementById('receipt-modal').classList.remove('hidden');
  document.getElementById('receipt-modal').classList.add('flex');

  document.getElementById('btn-wa-ticket').style.display = 'none';
  const waContainer = document.getElementById('wa-input-container');
  if (waContainer) waContainer.style.display = 'none';
  
  document.getElementById('btn-print-ticket').classList.add('col-span-2');

  document.getElementById('receipt-close').onclick = () => {
    document.getElementById('receipt-modal').classList.remove('flex');
    document.getElementById('receipt-modal').classList.add('hidden');
  };
}

export async function renderFinance(container) {
  container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-muted fade-in"><i data-lucide="loader" class="w-8 h-8 animate-spin text-accent mb-4"></i><p class="font-semibold text-sm">Generando reporte de finanzas...</p></div>`;
  lucide.createIcons();

  const y = state.financeDate.getFullYear();
  const m = state.financeDate.getMonth();

  await cargarMesFirebase(y, m);

  const sales = records('sale');
  const expenses = records('expense');

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthName = monthNames[m];

  const monthSales = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  
  const monthExpenses = expenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const movements = records('movement');
  const monthMovements = movements.filter(mov => {
    if (!mov.date) return false;
    const d = new Date(mov.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const abonosMesFinanzas = monthMovements.filter(mov => mov.category === 'cash_in' && (mov.name === 'Cobro de Abono' || mov.name === 'Abono de Cliente')).reduce((sum, mov) => sum + (Number(mov.amount) || 0), 0);

  let totalIncome = abonosMesFinanzas; 
  let monthCOGS = 0; 

  monthSales.forEach(s => {
    let pagado = 0;
    if (s.cash_part !== undefined) {
        pagado = Number(s.cash_part) + Number(s.transfer_part || 0);
    } else {
        pagado = s.is_credit ? 0 : (Number(s.total) || 0); 
    }
    
    totalIncome += Math.max(0, pagado);

    const items = s.items ? s.items : [s];
    items.forEach(item => {
      let buyP = Number(item.buy_price || 0);
      if (buyP === 0) {
        const pRef = state.allRecords.find(r => r.type === 'product' && (r.id === item.id || r.name === item.name));
        if (pRef) buyP = Number(pRef.buy_price || 0);
      }
      monthCOGS += (buyP * Number(item.quantity || 1));
    });
  });

  const totalExpense = monthExpenses.reduce((a, e) => a + (e.amount || 0), 0);
  const profit = totalIncome - monthCOGS - totalExpense; 

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dailySales = Array(daysInMonth).fill(0);

  monthSales.forEach(s => {
    const d = new Date(s.date).getDate();
    let pagado = 0;
    if (s.cash_part !== undefined) {
        pagado = Number(s.cash_part) + Number(s.transfer_part || 0);
    } else {
        pagado = s.is_credit ? 0 : (Number(s.total) || 0);
    }
    dailySales[d - 1] += Math.max(0, pagado); 
  });

  monthMovements.forEach(mov => {
    if (mov.category === 'cash_in' && (mov.name === 'Cobro de Abono' || mov.name === 'Abono de Cliente')) {
       const d = new Date(mov.date).getDate();
       dailySales[d - 1] += (Number(mov.amount) || 0);
    }
  });

  container.innerHTML = `
  <div class="fade-in space-y-5 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Finanzas y Estadísticas</h2>
      
      <div class="flex items-center gap-1 bg-surface border border-card rounded-lg p-1 shadow-sm">
        <button type="button" id="fin-prev" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
        <div class="text-sm font-bold w-36 text-center uppercase tracking-wider text-accent">${monthName} ${y}</div>
        <button type="button" id="fin-next" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-surface rounded-xl p-4 border border-card text-center">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="trending-up" class="w-4 h-4 text-success"></i>Ingresos (${monthName})</div>
        <div class="text-3xl font-bold text-success mt-1">${currency(totalIncome)}</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card text-center">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="trending-down" class="w-4 h-4 text-danger"></i>Egresos (${monthName})</div>
        <div class="text-3xl font-bold text-danger mt-1">${currency(totalExpense)}</div>
      </div>
      <div class="bg-surface rounded-xl p-4 border border-card text-center">
        <div class="text-muted text-sm flex items-center justify-center gap-1"><i data-lucide="wallet" class="w-4 h-4"></i>Utilidad Neta</div>
        <div class="text-3xl font-bold ${profit >= 0 ? 'text-success' : 'text-danger'} mt-1">${currency(profit)}</div>
      </div>
    </div>

   <div class="bg-surface rounded-xl p-5 border border-card shadow-sm w-full">
      <h3 class="font-semibold mb-4 text-sm text-muted flex items-center gap-2">
        <i data-lucide="trending-up" class="w-4 h-4 text-success"></i> Tendencia de Ingresos - ${monthName}
      </h3>
      <div class="w-full relative" style="height: 300px;">
        <canvas id="financeChart"></canvas>
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-4 items-start mt-4">
      <div class="bg-surface rounded-xl p-5 border border-card lg:col-span-1 shadow-sm">
        <h3 class="font-semibold mb-4">Registrar Egreso</h3>
        <form id="expense-form" class="flex flex-col gap-3">
          <div>
            <label class="text-xs text-muted mb-1 block">Descripción</label>
            <input id="exp-desc" class="bg-card border border-card rounded-lg px-3 py-2.5 text-sm focus:border-accent focus:outline-none w-full" placeholder="Ej: Pago de Luz" required>
          </div>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="text-xs text-muted mb-1 block">Monto</label>
              <input id="exp-amount" type="number" step="0.01" class="bg-card border border-card rounded-lg px-3 py-2.5 text-sm focus:border-accent focus:outline-none w-full" placeholder="0.00" required>
            </div>
            <div class="flex-1">
              <label class="text-xs text-muted mb-1 block">Categoría</label>
              <select id="exp-cat" class="bg-card border border-card rounded-lg px-3 py-2.5 text-sm focus:border-accent focus:outline-none w-full">
                <option>Mercancía</option><option>Servicios</option><option>Renta</option><option>Nómina</option><option>Otro</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-xs text-muted mb-1 block">Fecha de gasto</label>
            <input id="exp-date" type="date" class="bg-card border border-card rounded-lg px-3 py-2.5 text-sm focus:border-accent focus:outline-none w-full" required>
          </div>
          <button type="submit" id="exp-btn" class="bg-danger text-white font-bold px-4 py-3 rounded-lg hover:opacity-90 transition text-sm w-full mt-2">Registrar Egreso</button>
        </form>
      </div>

      <div class="bg-surface rounded-xl border border-card overflow-x-auto lg:col-span-2 shadow-sm">
        <div class="p-4 border-b border-card font-semibold text-sm text-muted flex items-center justify-between">
          <span>Historial de Egresos - ${monthName}</span>
        </div>
        <table class="w-full text-sm">
          <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Fecha</th><th class="p-3">Descripción</th><th class="p-3">Categoría</th><th class="p-3">Monto</th><th class="p-3 text-center"></th></tr></thead>
          <tbody>
            ${monthExpenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
              <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
                <td class="p-3 text-muted">${e.date ? e.date.slice(0, 10) : '-'}</td>
                <td class="p-3 font-medium">${e.description || e.name || '-'}</td>
                <td class="p-3"><span class="text-[10px] bg-card border border-surface px-2 py-1 rounded">${e.category || '-'}</span></td>
                <td class="p-3 font-semibold text-danger">${currency(e.amount)}</td>
                <td class="p-3 text-center"><button type="button" data-del-exp="${e.id}" class="p-2 hover:bg-danger/20 rounded-lg transition text-danger"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button></td>
              </tr>`).join('') || `<tr><td colspan="5" class="p-8 text-center text-muted">Sin egresos en ${monthName}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.getElementById('exp-date').value = today();

  const ctx = document.getElementById('financeChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)'); 
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ingresos Diarios',
        data: dailySales,
        borderColor: '#10b981', 
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#10b981',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, 
        tooltip: {
          backgroundColor: '#1e293b',
          callbacks: {
            label: function(context) {
              return ' Ingresos: ' + currency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) { return currency(value); },
            font: { family: "'DM Sans', sans-serif", size: 11 }
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          border: { display: false }
        },
        x: {
          ticks: { font: { family: "'DM Sans', sans-serif", size: 11 } },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  });

  document.getElementById('fin-prev').onclick = () => {
    state.financeDate.setMonth(state.financeDate.getMonth() - 1);
    renderFinance(container);
  };
  document.getElementById('fin-next').onclick = () => {
    state.financeDate.setMonth(state.financeDate.getMonth() + 1);
    renderFinance(container);
  };

  document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    const desc = document.getElementById('exp-desc').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const customDateStr = document.getElementById('exp-date').value; 
    
    if (!desc || !amount || !customDateStr) { showToast('Completa los campos', 'warn'); return; }
    
    const btn = document.getElementById('exp-btn');
    btn.disabled = true; btn.textContent = 'Guardando...';
    
    let finalDate = now();
    if (customDateStr !== today()) {
       finalDate = customDateStr + 'T12:00:00.000Z'; 
    }

    const res = await dbSdk.create({
      type: 'expense', name: desc, code: '', category: document.getElementById('exp-cat').value,
      buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, quantity: 0, total: 0,
      payment_method: '', cashier: state.currentUser?.username || '', date: finalDate,
      amount, description: desc, status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0
    });
    
    btn.disabled = false; btn.textContent = 'Registrar Egreso';
    if (res.isOk) { showToast('Egreso registrado'); }
    else showToast('Error al registrar', 'error');
  };

  container.querySelectorAll('[data-del-exp]').forEach(btn => {
    btn.onclick = () => {
      const rec = state.allRecords.find(r => r.id === btn.dataset.delExp);
      if (rec) showConfirm('¿Eliminar este egreso permanentemente?', async () => {
        await dbSdk.delete(rec);
        showToast('Egreso eliminado');
      });
    };
  });

  lucide.createIcons();
}

export async function renderInvoicing(container) {
  container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-muted fade-in"><i data-lucide="loader" class="w-8 h-8 animate-spin text-accent mb-4"></i><p class="font-semibold text-sm">Cargando módulo de facturación...</p></div>`;
  lucide.createIcons();

  const y = state.invoiceDate.getFullYear();
  const m = state.invoiceDate.getMonth();
  
  await cargarMesFirebase(y, m);

  const sales = records('sale');
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthName = monthNames[m];

  const formatLocalTime = (utcStr) => {
      if (!utcStr) return '-';
      const d = new Date(utcStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const filteredSales = sales.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const ticketMap = new Map();
  filteredSales.forEach(s => {
    const tId = s.ticket_num || s.id;
    if (!ticketMap.has(tId)) {
      ticketMap.set(tId, {
        id: s.id, 
        ticket_num: s.ticket_num,
        date: s.date,
        payment_method: s.payment_method,
        cashier: s.cashier,
        order_total: s.order_total || s.total,
        is_invoiceable: s.is_invoiceable === true || String(s.is_invoiceable) === 'true',
        raw_sales: [] 
      });
    }
    if (s.items && Array.isArray(s.items)) {
      ticketMap.get(tId).raw_sales.push(...s.items);
    } else {
      ticketMap.get(tId).raw_sales.push(s);
    }
  });
  
  const groupedSales = Array.from(ticketMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));

  const facturables = groupedSales.filter(t => t.is_invoiceable);
  const noFacturables = groupedSales.filter(t => !t.is_invoiceable);

  const totalFacturable = facturables.reduce((a, t) => a + (t.order_total || 0), 0);
  const totalNoFacturable = noFacturables.reduce((a, t) => a + (t.order_total || 0), 0);

  const activeList = state.invoiceTab === 'facturables' ? facturables : noFacturables;

  container.innerHTML = `
  <div class="fade-in space-y-5 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Panel de Facturación</h2>
      
      <div class="flex items-center gap-1 bg-surface border border-card rounded-lg p-1 shadow-sm">
        <button type="button" id="inv-prev" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
        <div class="text-sm font-bold w-36 text-center uppercase tracking-wider text-accent">${monthName} ${y}</div>
        <button type="button" id="inv-next" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="bg-surface rounded-xl p-5 border border-card text-center shadow-sm relative overflow-hidden">
        <div class="absolute inset-0 bg-success/5 pointer-events-none"></div>
        <div class="text-muted text-sm flex items-center justify-center gap-1 relative z-10"><i data-lucide="file-check" class="w-4 h-4 text-success"></i> Total Facturable del Mes</div>
        <div class="text-3xl font-bold text-success mt-2 relative z-10">${currency(totalFacturable)}</div>
        <div class="text-xs text-muted mt-1 relative z-10">${facturables.length} tickets requieren factura</div>
      </div>
      <div class="bg-surface rounded-xl p-5 border border-card text-center shadow-sm relative overflow-hidden">
        <div class="absolute inset-0 bg-warn/5 pointer-events-none"></div>
        <div class="text-muted text-sm flex items-center justify-center gap-1 relative z-10"><i data-lucide="file-x" class="w-4 h-4 text-warn"></i> Total No Facturable del Mes</div>
        <div class="text-3xl font-bold text-warn mt-2 relative z-10">${currency(totalNoFacturable)}</div>
        <div class="text-xs text-muted mt-1 relative z-10">${noFacturables.length} tickets de venta libre</div>
      </div>
    </div>

    <div class="bg-surface rounded-xl border border-card shadow-sm overflow-hidden flex flex-col">
      <div class="flex border-b border-card bg-card/20">
        <button id="tab-facturables" class="flex-1 py-3 text-sm font-bold transition ${state.invoiceTab === 'facturables' ? 'bg-surface text-accent border-b-2 border-accent' : 'text-muted hover:text-txt'}">
          TICKETS FACTURABLES (${facturables.length})
        </button>
        <button id="tab-nofacturables" class="flex-1 py-3 text-sm font-bold transition ${state.invoiceTab === 'no_facturables' ? 'bg-surface text-warn border-b-2 border-warn' : 'text-muted hover:text-txt'}">
          TICKETS NO FACTURABLES (${noFacturables.length})
        </button>
      </div>

      <div class="p-4 flex justify-between items-center bg-surface">
        <span class="font-semibold text-sm text-muted">Ventas de ${monthName}</span>
        <button id="export-invoice-btn" class="bg-success/10 text-success text-[10px] px-3 py-1.5 rounded border border-success/20 hover:bg-success/20 uppercase font-bold transition flex items-center gap-1">
          <i data-lucide="file-spreadsheet" class="w-3 h-3"></i> Exportar Lista Actual
        </button>
      </div>

      <div class="overflow-x-auto">
       <table class="w-full text-sm">
          <thead>
            <tr class="text-muted text-left border-b border-card bg-surface">
              <th class="p-3">Fecha</th>
              <th class="p-3">Ticket</th>
              <th class="p-3">Artículos</th>
              <th class="p-3">Total</th>
              <th class="p-3">Método Pago</th>
              <th class="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${activeList.map(t => `
              <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
                <td class="p-3 text-muted">${formatLocalTime(t.date)}</td>
                <td class="p-3 font-bold text-accent">#${t.ticket_num || 'S/N'}</td>
                <td class="p-3">
                  <div class="text-xs text-muted max-w-[250px] truncate" title="${t.raw_sales.map(i => `${i.quantity}x ${i.name}`).join('\n')}">
                    ${t.raw_sales.map(i => `<span class="font-bold">${i.quantity}x</span> ${i.name}`).join(', ')}
                  </div>
                </td>
             
                <td class="p-3">
                  ${t.is_credit ? `
                    <div class="font-black text-success">${currency(t.order_total - t.debt)} <span class="text-[10px] text-muted font-normal">Total Pagado</span></div>
                    <div class="text-danger text-[11px] font-bold mt-0.5">Resta: ${currency(t.debt)}</div>
                    <div class="text-muted text-[10px] mt-0.5">Valor Total: ${currency(t.order_total)}</div>
                  ` : `
                    <div class="font-semibold text-txt">${currency(t.order_total)}</div>
                  `}
                </td>
                <td class="p-3"><span class="text-[10px] px-2 py-1 rounded-lg font-bold ${t.payment_method === 'Efectivo' ? 'bg-success/20 text-success' : t.payment_method === 'Crédito' ? 'bg-warn/20 text-warn' : 'bg-accent/20 text-accent'}">${t.payment_method || '-'}</span></td>
                <td class="p-3 text-center flex justify-center gap-2">
                  ${t.evidence_image ? `
                  <button type="button" onclick="window.showEvidence('${t.id}')" class="p-2 bg-success/10 hover:bg-success/20 rounded-lg transition text-success" title="Ver Evidencia">
                    <i data-lucide="image" class="w-4 h-4 pointer-events-none"></i>
                  </button>` : ''}
                  <button type="button" data-view-ticket="${t.id}" class="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent" title="Ver Ticket">
                    <i data-lucide="receipt" class="w-4 h-4 pointer-events-none"></i>
                  </button>
                </td>
              </tr>
            `).join('') || `<tr><td colspan="6" class="p-10 text-center text-muted">No hay registros en esta categoría</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  lucide.createIcons();

  document.getElementById('inv-prev').onclick = () => {
    state.invoiceDate.setMonth(state.invoiceDate.getMonth() - 1);
    renderInvoicing(container);
  };
  document.getElementById('inv-next').onclick = () => {
    state.invoiceDate.setMonth(state.invoiceDate.getMonth() + 1);
    renderInvoicing(container);
  };

  document.getElementById('tab-facturables').onclick = () => {
    state.invoiceTab = 'facturables';
    renderInvoicing(container);
  };
  document.getElementById('tab-nofacturables').onclick = () => {
    state.invoiceTab = 'no_facturables';
    renderInvoicing(container);
  };

  document.getElementById('export-invoice-btn').onclick = () => {
    if (!activeList.length) return showToast('No hay datos para exportar', 'warn');
    const data = activeList.map(s => ({
        'Ticket': s.ticket_num || 'S/N',
        'Fecha': formatLocalTime(s.date),
        'Tipo': s.is_invoiceable ? 'FACTURABLE' : 'NO FACTURABLE',
        'Artículos': s.raw_sales.map(i => `${i.quantity}x ${i.name}`).join(', '),
        'Total': s.order_total,
        'Método de Pago': s.payment_method || 'Efectivo',
        'Cajero': s.cashier
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturacion");
    XLSX.writeFile(wb, `Reporte_${state.invoiceTab}_${monthName}_${y}.xlsx`);
    showToast('Excel descargado con éxito', 'success');
  };

  container.onclick = (e) => {
    const viewBtn = e.target.closest('[data-view-ticket]');
    if (viewBtn) openAdminTicketModal(viewBtn.dataset.viewTicket);
  };
}

export function renderClients(container) {
  let searchTerm = '';
  let editingClient = null;

  function renderList() {
    const currentClients = records('client');
    const filtered = currentClients.filter(c => 
      !searchTerm || 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone || '').includes(searchTerm)
    );

    const list = document.getElementById('client-list');
    if (!list) return;

    list.innerHTML = filtered.length ? filtered.map(c => `
      <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
        <td class="p-3 font-medium">
          <button type="button" onclick="window.viewClientHistory('${c.id}')" class="text-accent hover:underline font-bold text-left flex items-center gap-1" title="Ver compras del mes">
            <i data-lucide="shopping-cart" class="w-4 h-4 pointer-events-none"></i> ${c.name}
          </button>
        </td>
        <td class="p-3 text-muted font-mono">${c.phone || '-'}</td>
        <td class="p-3 text-muted truncate max-w-xs" title="${c.address || ''}">${c.address || '-'}</td>
        <td class="p-3 print:hidden">
          <div class="flex gap-2 justify-end">
            <button type="button" onclick="window.editClient('${c.id}')" class="flex items-center gap-1.5 bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-lg hover:bg-accent hover:text-bg transition font-semibold text-xs shadow-sm">
              <i data-lucide="edit" class="w-3.5 h-3.5 pointer-events-none"></i> Editar
            </button>
            <button type="button" onclick="window.deleteClient('${c.id}')" class="flex items-center justify-center bg-danger/10 border border-danger/20 text-danger w-8 h-8 rounded-lg hover:bg-danger hover:text-white transition shadow-sm">
              <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
            </button>
          </div>
        </td>
      </tr>`).join('') : '<tr><td colspan="4" class="py-8 text-center text-muted">No hay clientes registrados en la cartera.</td></tr>';
    lucide.createIcons();
  }

  container.innerHTML = `
  <div class="fade-in space-y-6 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Cartera de Clientes</h2>
      <div class="relative">
        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
        <input id="client-search" class="bg-card border border-card rounded-lg pl-9 pr-4 py-2 text-sm focus:border-accent focus:outline-none w-48" placeholder="Buscar cliente...">
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1 bg-surface rounded-xl p-5 border border-card shadow-sm h-fit">
        <h3 id="client-form-title" class="font-semibold mb-4 flex items-center gap-2"><i data-lucide="user-plus" class="w-4 h-4 text-accent"></i> Registrar Cliente</h3>
        <form id="client-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Nombre Completo *</label>
            <input id="cli-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Nombre del cliente" required>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Número de Teléfono</label>
            <input id="cli-phone" type="number" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Ej. 9631234567">
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted">Dirección</label>
            <input id="cli-address" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Calle, Número, Colonia...">
          </div>
          <div class="flex gap-2 mt-2">
            <button id="client-submit" type="submit" class="bg-accent text-white font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition text-sm flex-1">Guardar Cliente</button>
            <button id="client-cancel" type="button" class="bg-card text-muted px-4 py-2.5 rounded-lg hover:bg-surface transition text-sm hidden">Cancelar</button>
          </div>
        </form>
      </div>

      <div class="lg:col-span-2 bg-surface rounded-xl border border-card overflow-x-auto p-1 shadow-sm">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-muted text-left border-b border-card bg-surface">
              <th class="p-3">Nombre</th>
              <th class="p-3">Teléfono</th>
              <th class="p-3">Dirección</th>
              <th class="p-3 text-right print:hidden">Acciones</th>
            </tr>
          </thead>
          <tbody id="client-list"></tbody>
        </table>
      </div>
    </div>
  </div>`;

  document.getElementById('client-search').oninput = (e) => { searchTerm = e.target.value; renderList(); };

  window.editClient = (id) => {
    editingClient = state.allRecords.find(r => r.id === id);
    if (editingClient) {
      document.getElementById('cli-name').value = editingClient.name;
      document.getElementById('cli-phone').value = editingClient.phone || '';
      document.getElementById('cli-address').value = editingClient.address || '';
      
      document.getElementById('client-submit').textContent = 'Actualizar Cliente';
      document.getElementById('client-cancel').classList.remove('hidden');
      document.getElementById('client-form-title').innerHTML = '<i data-lucide="edit" class="w-4 h-4 text-warn"></i> Editar Cliente';
      
      const adminContent = document.getElementById('admin-content');
      if (adminContent) adminContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.deleteClient = (id) => {
    const cli = records('client').find(c => c.id === id);
    if (cli) {
      showConfirm(`¿Eliminar al cliente "${cli.name}" de la cartera?`, () => {
        const idx = state.allRecords.findIndex(r => r.id === id);
        if (idx > -1) state.allRecords.splice(idx, 1);
        dbSdk.delete({ type: 'client', id });
        showToast('Cliente eliminado correctamente', 'success');
        document.getElementById('client-cancel').click();
        renderList();
      });
    }
  };

  document.getElementById('client-cancel').onclick = () => {
    editingClient = null;
    document.getElementById('client-form').reset();
    document.getElementById('client-submit').textContent = 'Guardar Cliente';
    document.getElementById('client-cancel').classList.add('hidden');
    document.getElementById('client-form-title').innerHTML = '<i data-lucide="user-plus" class="w-4 h-4 text-accent"></i> Registrar Cliente';
  };

  document.getElementById('client-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('client-submit');
    btn.disabled = true; btn.textContent = 'Guardando...';

    const data = {
      type: 'client',
      name: document.getElementById('cli-name').value.trim(),
      phone: document.getElementById('cli-phone').value.trim(),
      address: document.getElementById('cli-address').value.trim(),
      date: now()
    };

    if (editingClient) {
      await dbSdk.update({ ...editingClient, ...data });
      showToast('Cliente actualizado correctamente', 'success');
    } else {
      await dbSdk.create(data);
      showToast('Cliente registrado en la cartera', 'success');
    }

    document.getElementById('client-cancel').click();
    renderClients(container);
  };

  renderList();
}

// LÓGICA DE HISTORIAL DEL CLIENTE
window.viewClientHistory = async (clientId) => {
    const cli = records('client').find(c => c.id === clientId);
    if (!cli) return;

    const cliSales = records('sale').filter(s => s.client_id === clientId);
    const d = new Date();
    const ventasMes = cliSales.filter(s => new Date(s.date).getMonth() === d.getMonth() && new Date(s.date).getFullYear() === d.getFullYear());
    const totalCompradoMes = ventasMes.reduce((sum, s) => sum + (s.order_total || s.total || 0), 0);
    const deudaTotalActiva = cliSales.reduce((sum, s) => sum + (s.debt || 0), 0);

    let modal = document.getElementById('client-history-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'client-history-modal';
        modal.className = 'fixed inset-0 z-[10005] hidden items-center justify-center p-4';
        modal.style.background = 'rgba(0,0,0,.8)';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div class="bg-surface rounded-2xl p-6 max-w-2xl w-full mx-auto modal-show flex flex-col border border-card shadow-2xl max-h-[90vh]">
      <div class="flex justify-between items-start sm:items-center mb-5 border-b border-card pb-4 gap-2 flex-col sm:flex-row">
        <div>
            <h2 class="text-xl font-bold flex items-center gap-2 text-txt"><i data-lucide="user" class="text-accent w-6 h-6"></i> ${cli.name}</h2>
            <p class="text-sm text-muted mt-1 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${cli.phone || 'Sin teléfono'}</p>
        </div>
        <div class="flex gap-2 w-full sm:w-auto">
            <div class="flex-1 sm:flex-none text-right bg-warn/10 border border-warn/20 px-3 py-2 rounded-xl">
                <p class="text-[9px] uppercase font-bold text-warn">Deuda Total</p>
                <p class="text-xl font-black text-warn">${currency(deudaTotalActiva)}</p>
            </div>
            <div class="flex-1 sm:flex-none text-right bg-success/10 border border-success/20 px-3 py-2 rounded-xl">
                <p class="text-[9px] uppercase font-bold text-success">Comprado (Mes)</p>
                <p class="text-xl font-black text-success">${currency(totalCompradoMes)}</p>
            </div>
        </div>
      </div>
      
      <div class="overflow-y-auto flex-1 pr-2 space-y-4 mb-2">
         ${cliSales.length ? cliSales.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
            <div class="bg-card p-4 rounded-xl border border-card flex flex-col gap-2 hover:border-accent/50 transition shadow-sm">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-sm text-txt flex items-center gap-1">
                          <i data-lucide="receipt" class="w-4 h-4 text-muted"></i> Ticket #${s.ticket_num || 'S/N'}
                        </p>
                        <p class="text-xs text-muted mt-0.5">${new Date(s.date).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            ${s.is_credit ? `
                                <p class="text-xs text-muted font-semibold">Valor Ticket: <span class="line-through">${currency(s.order_total || s.total)}</span></p>
                                <p class="font-black text-success text-base" title="Dinero ya pagado">Abonado: ${currency((s.order_total || s.total) - (s.debt || 0))}</p>
                                <p class="text-[10px] bg-warn/20 text-warn border border-warn/30 px-2 py-0.5 rounded mt-1 font-bold inline-block uppercase tracking-wider">Crédito</p>
                            ` : `
                                <p class="font-black text-accent text-lg">${currency(s.order_total || s.total)}</p>
                                <p class="text-[10px] bg-surface border border-card px-2 py-0.5 rounded shadow-sm text-muted mt-1 inline-block font-semibold">${s.payment_method || 'Efectivo'}</p>
                            `}
                        </div>
                        
                        <button type="button" onclick="window.openAdminTicketModal('${s.id}')" class="p-2.5 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent shadow-sm" title="Ver copia del ticket">
                            <i data-lucide="receipt" class="w-5 h-5 pointer-events-none"></i>
                        </button>
                    </div>
                </div>
                
                ${s.is_credit && s.debt > 0 ? `
                <div class="bg-surface border border-card rounded-lg p-3 flex justify-between items-center mt-2">
                    <div>
                        <p class="text-[10px] text-warn font-bold uppercase tracking-wider">Resta por pagar</p>
                        <p class="text-lg font-black text-warn">${currency(s.debt)}</p>
                    </div>
                    <button type="button" onclick="window.abonarTicket('${s.id}', ${s.debt}, '${s.ticket_num}')" class="bg-warn text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md hover:opacity-90 transition flex items-center gap-1">
                        <i data-lucide="badge-dollar-sign" class="w-4 h-4"></i> Abonar
                    </button>
                </div>
                ` : s.is_credit && s.debt <= 0 ? `
                <div class="bg-success/10 border border-success/20 rounded-lg p-2 text-center mt-2">
                    <p class="text-xs text-success font-bold uppercase tracking-wider">✓ Crédito Liquidado Totalmente</p>
                </div>
                ` : ''}
            </div>
         `).join('') : '<div class="text-center py-10"><i data-lucide="shopping-cart" class="w-12 h-12 text-muted/30 mx-auto mb-3"></i><p class="text-muted font-medium">No hay compras registradas de este cliente.</p></div>'}
      </div>

      <div class="mt-4 pt-4 border-t border-card text-right">
        <button type="button" onclick="document.getElementById('client-history-modal').classList.add('hidden')" class="bg-card text-txt font-bold py-3 px-8 rounded-xl hover:bg-surface transition border border-card shadow-sm">Cerrar Historial</button>
      </div>
    </div>`;
    
    lucide.createIcons();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.abonarTicket = async (saleId, currentDebt, ticketNum) => {
    const sale = state.allRecords.find(r => r.id === saleId);
    if (!sale) return;

    const monto = await window.openAbonoInputModal(ticketNum, currentDebt, sale.client_name);
    if (monto === null) return; 
    
    if (isNaN(monto) || monto <= 0) return showToast('Ingresa una cantidad válida', 'warn');
    if (monto > currentDebt) return showToast('El abono no puede ser mayor a la deuda actual', 'error');

    sale.debt = Number((sale.debt - monto).toFixed(2));
    dbSdk.update(sale);

    dbSdk.create({
        type: 'movement',
        category: 'cash_in',
        amount: monto,
        description: `Abono a Crédito - Ticket #${ticketNum} (${sale.client_name})`,
        name: 'Abono de Cliente',
        date: now(),
        cashier: state.currentUser?.username || 'admin',
        quantity: 0, total: 0, buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, payment_method: 'Efectivo', status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0
    });

    showToast(`Abono de ${currency(monto)} registrado correctamente`, 'success');
    
    document.getElementById('client-history-modal').classList.add('hidden');
    setTimeout(() => window.viewClientHistory(sale.client_id), 300);
    
    if (window.updateCashBadge) window.updateCashBadge();
};

window.openAbonoInputModal = (ticketNum, currentDebt, cliente) => {
  return new Promise((resolve) => {
    let modal = document.getElementById('custom-abono-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-abono-modal';
        modal.className = 'fixed inset-0 z-[10020] hidden items-center justify-center p-4';
        modal.style.background = 'rgba(0,0,0,.8)';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div class="bg-surface rounded-2xl p-6 max-w-sm w-full mx-auto modal-show flex flex-col border border-card shadow-2xl">
      <div class="text-center mb-4">
        <div class="w-14 h-14 bg-warn/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-warn/20 shadow-sm">
          <i data-lucide="badge-dollar-sign" class="w-7 h-7 text-warn"></i>
        </div>
        <h2 class="text-xl font-bold text-txt">Registrar Abono</h2>
        <p class="text-xs text-muted mt-1">Ticket #${ticketNum} ${cliente ? '· ' + cliente : ''}</p>
      </div>
      
      <div class="bg-warn/10 border border-warn/30 rounded-xl p-3 text-center mb-5 shadow-inner">
        <p class="text-[10px] text-warn font-bold uppercase tracking-wider">Deuda Pendiente</p>
        <p class="text-3xl font-black text-warn">${currency(currentDebt)}</p>
      </div>

      <div class="mb-6">
        <label class="block text-xs text-muted font-bold mb-2 text-center uppercase tracking-wide">Monto a abonar en EFECTIVO ($)</label>
        <input id="custom-abono-input" type="number" step="0.01" min="0.01" max="${currentDebt}" class="w-full bg-bg border-2 border-success/40 rounded-xl px-4 py-3 text-3xl font-black focus:border-success focus:outline-none text-center text-success shadow-sm" placeholder="0.00">
      </div>

      <div class="flex gap-3">
        <button type="button" id="custom-abono-cancel" class="flex-1 bg-card text-txt font-bold py-3 rounded-xl hover:bg-surface transition border border-card shadow-sm">Cancelar</button>
        <button type="button" id="custom-abono-confirm" class="flex-1 bg-accent text-white font-bold py-3 rounded-xl hover:opacity-90 transition shadow-md">Confirmar Pago</button>
      </div>
    </div>
    `;
    
    lucide.createIcons();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const input = document.getElementById('custom-abono-input');
    setTimeout(() => { input.focus(); }, 100);

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    document.getElementById('custom-abono-cancel').onclick = () => {
        closeModal();
        resolve(null);
    };

    document.getElementById('custom-abono-confirm').onclick = () => {
        const val = parseFloat(input.value);
        closeModal();
        resolve(val);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('custom-abono-confirm').click();
        }
    });
  });
};

window.openPosAbonosModal = () => {
  const creditosActivos = state.allRecords.filter(r => r.type === 'sale' && r.is_credit === true && r.debt > 0);

  let modal = document.getElementById('pos-abonos-modal');
  if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pos-abonos-modal';
      modal.className = 'fixed inset-0 z-[10006] hidden items-center justify-center p-4';
      modal.style.background = 'rgba(0,0,0,.8)';
      document.body.appendChild(modal);
  }

  modal.innerHTML = `
  <div class="bg-surface rounded-2xl p-6 max-w-xl w-full mx-auto modal-show flex flex-col border border-card shadow-2xl max-h-[85vh]">
    <div class="flex justify-between items-center mb-4 border-b border-card pb-3 shrink-0">
      <div>
        <h2 class="text-lg font-bold text-txt flex items-center gap-2"><i data-lucide="hand-coins" class="text-warn w-5 h-5"></i> Cuentas por Cobrar (Créditos)</h2>
        <p class="text-xs text-muted mt-0.5">Los pedidos desaparecerán automáticamente al ser liquidados.</p>
      </div>
      <button type="button" onclick="document.getElementById('pos-abonos-modal').classList.add('hidden')" class="text-muted hover:text-danger"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>

    <div class="overflow-y-auto flex-1 pr-1 space-y-2.5 my-2">
      ${creditosActivos.length ? creditosActivos.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
        <div class="bg-card/30 p-3 rounded-xl border border-card flex flex-col sm:flex-row justify-between sm:items-center gap-2 hover:border-warn/40 transition">
          <div>
            <div class="font-bold text-sm text-txt uppercase tracking-wide truncate max-w-[280px]">${s.client_name || 'Cliente sin nombre'}</div>
            <div class="text-xs text-muted flex items-center gap-1.5 mt-1">
              <span class="font-bold text-accent">#${s.ticket_num || 'S/N'}</span> · 
              <span>Total: ${currency(s.order_total || s.total)}</span> ·
              <span>${new Date(s.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
            </div>
          </div>
          
          <div class="flex items-center justify-between sm:justify-end gap-4 bg-surface sm:bg-transparent p-2 sm:p-0 rounded-lg border border-card/40 sm:border-0">
            <div class="text-left sm:text-right">
              <p class="text-[10px] text-muted uppercase font-bold tracking-wider">Resta por pagar</p>
              <p class="font-black text-danger text-base">${currency(s.debt)}</p>
            </div>
            <button type="button" onclick="window.procesarAbonoDesdePos('${s.id}', ${s.debt}, '${s.ticket_num}', '${s.client_name}')" class="bg-success text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md hover:opacity-90 transition flex items-center gap-1">
              <i data-lucide="badge-dollar-sign" class="w-3.5 h-3.5"></i> Cobrar Abono
            </button>
          </div>
        </div>
      `).join('') : `
        <div class="text-center py-12 text-muted">
          <i data-lucide="shield-check" class="w-12 h-12 mx-auto mb-2 text-success/30"></i>
          <p class="font-medium text-sm">Felicidades, ¡no hay deudas pendientes en el sistema! ✓</p>
        </div>
      `}
    </div>

    <div class="mt-3 pt-3 border-t border-card text-right shrink-0">
      <button type="button" onclick="document.getElementById('pos-abonos-modal').classList.add('hidden')" class="bg-card text-txt text-xs font-bold py-2.5 px-6 rounded-xl hover:bg-surface transition border border-card">Cerrar Ventana</button>
    </div>
  </div>`;

  lucide.createIcons();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

window.procesarAbonoDesdePos = async (saleId, deudaActual, ticketNum, cliente) => {
  const monto = await window.openAbonoInputModal(ticketNum, deudaActual, cliente);
  if (monto === null) return; 

  if (isNaN(monto) || monto <= 0) return showToast('Monto inválido', 'warn');
  if (monto > deudaActual) return showToast('El abono no puede superar la deuda pendiente', 'error');

  const sale = state.allRecords.find(r => r.id === saleId);
  if (!sale) return;

  sale.debt = Number((sale.debt - monto).toFixed(2));
  dbSdk.update(sale);

  dbSdk.create({
    type: 'movement',
    category: 'cash_in',
    amount: monto,
    description: `Abono de Cliente - Ticket #${ticketNum} (${cliente})`,
    name: 'Cobro de Abono',
    date: now(),
    cashier: state.currentUser?.username || 'admin',
    quantity: 0, total: 0, buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, payment_method: 'Efectivo', status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0
  });

  showToast(`Abono de ${currency(monto)} aplicado con éxito`, 'success');
  
  document.getElementById('pos-abonos-modal').classList.add('hidden');
  setTimeout(window.openPosAbonosModal, 250);

  if (window.updateCashBadge) window.updateCashBadge();
};

export function renderUsersAdmin(container) {
  const allUsers = getUsers();
  let editingUser = null;

  container.innerHTML = `
  <div class="fade-in space-y-4 pb-10">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xl font-bold">Usuarios</h2>
    </div>
    <div class="bg-surface rounded-xl p-5 border border-card shadow-sm">
      <h3 id="u-form-title" class="font-semibold mb-3">Agregar Cajero</h3>
      <form id="user-form" class="flex flex-wrap gap-3 items-end">
        <div>
          <label class="block text-xs text-muted mb-1">Nombre Real</label>
          <input id="u-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Nombre completo" required>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">Usuario (Para iniciar sesión)</label>
          <input id="u-user" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Ej: cajero2" required>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">Contraseña</label>
          <input id="u-pass" type="text" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder="Contraseña *" required>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">Rol</label>
          <select id="u-role" class="bg-card border border-card rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none">
            <option value="">Selecciona el rol...</option>
            <option value="cashier">Cajero</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button type="submit" id="u-btn" class="bg-accent text-bg font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition text-sm">Agregar</button>
          <button type="button" id="u-cancel" class="bg-card text-muted px-3 py-2 rounded-lg hover:bg-bg transition text-sm hidden">Cancelar</button>
        </div>
        
        <div class="w-full mt-2 hidden border-t border-card pt-3" id="permissions-container">
          <label class="block text-xs text-muted mb-2 font-bold uppercase">Permisos de Administrador (Pestañas Visibles)</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-card/30 p-3 rounded-xl border border-card">
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-departments" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Departamentos</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-clients" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Clientes</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-dashboard" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Dashboard</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-inventory" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Inventario</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-sales" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Ventas/Reportes</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-finance" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Finanzas</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-invoicing" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Facturación</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-users" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Usuarios</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="u-perm" value="admin-settings" class="w-4 h-4 text-accent" checked> <span class="text-sm font-medium">Configuración</span></label>
          </div>
        </div>

        <div id="category-perms-container" class="w-full mt-4 border-t border-card pt-3 hidden">
          <label class="block text-xs text-muted mb-2 font-bold uppercase">Categorías Permitidas para el Cajero</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-card/30 p-3 rounded-xl border border-card">
            ${records('category').map(c => `
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="u-cat-perm" value="${c.name}" class="w-4 h-4 text-accent"> 
                <span class="text-sm">${c.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    </div>
    <div class="bg-surface rounded-xl border border-card overflow-x-auto shadow-sm">
      <table class="w-full text-sm">
        <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Nombre</th><th class="p-3">Usuario</th><th class="p-3">Contraseña</th><th class="p-3">Rol</th><th class="p-3 text-center">Acciones</th></tr></thead>
        <tbody>
          ${allUsers.map(u => `
            <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
              <td class="p-3 font-medium">${u.name}</td>
              <td class="p-3 text-muted">${u.username}</td>
              <td class="p-3 text-muted">${u.password}</td>
              <td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-accent2/20 text-accent2'}">${u.role === 'admin' ? 'Admin' : 'Cajero'}</span></td>
              <td class="p-3 flex justify-center gap-2">
                <button type="button" onclick="window.editUser('${u.username}')" class="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent" title="Editar">
                  <i data-lucide="edit" class="w-4 h-4 pointer-events-none"></i>
                </button>
                ${u.isDefault && !u.raw ? '<span class="text-xs text-muted font-bold p-2">Fijo</span>' :
                `<button type="button" onclick="window.deleteUser('${u.username}')" class="p-2 bg-danger/10 hover:bg-danger/20 rounded-lg transition text-danger" title="Eliminar">
                  <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('u-role').onchange = (e) => {
    const permContainer = document.getElementById('permissions-container');
    const catContainer = document.getElementById('category-perms-container');
    
    const rol = e.target.value;
    if (rol === 'admin') {
        permContainer.classList.remove('hidden');
        catContainer.classList.add('hidden');
    } else if (rol === 'cashier') {
        permContainer.classList.add('hidden');
        catContainer.classList.remove('hidden');
    } else {
        permContainer.classList.add('hidden');
        catContainer.classList.add('hidden');
    }
  };

  window.editUser = (username) => {
    editingUser = getUsers().find(u => u.username === username);
    if (editingUser) {
      document.getElementById('u-name').value = editingUser.name;
      document.getElementById('u-user').value = editingUser.username;
      document.getElementById('u-pass').value = editingUser.password;
      document.getElementById('u-role').value = editingUser.role;
      document.getElementById('u-role').dispatchEvent(new Event('change'));
      
      const allPerms = ['admin-departments', 'admin-clients', 'admin-dashboard', 'admin-inventory', 'admin-sales', 'admin-finance', 'admin-invoicing', 'admin-users', 'admin-settings'];
      const userPerms = editingUser.raw && editingUser.raw.permissions ? editingUser.raw.permissions : allPerms;
      document.querySelectorAll('input[name="u-perm"]').forEach(cb => {
          cb.checked = userPerms.includes(cb.value);
      });

      const userCats = editingUser.raw && editingUser.raw.allowedCategories ? editingUser.raw.allowedCategories : [];
      document.querySelectorAll('input[name="u-cat-perm"]').forEach(cb => {
          cb.checked = userCats.includes(cb.value);
      });

      document.getElementById('u-form-title').textContent = 'Editar Usuario';
      document.getElementById('u-btn').textContent = 'Guardar';
      document.getElementById('u-cancel').classList.remove('hidden');
      document.getElementById('u-user').readOnly = true;
      document.getElementById('u-user').classList.add('opacity-50', 'cursor-not-allowed');
      
      const adminContent = document.getElementById('admin-content');
      if (adminContent) adminContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.deleteUser = (username) => {
    const uToDel = getUsers().find(r => r.username === username);
    if (uToDel && uToDel.raw) {
      showConfirm(`¿Eliminar al usuario ${uToDel.name}?`, async () => {
        await dbSdk.delete(uToDel.raw);
        showToast('Usuario eliminado');
      });
    }
  };

  document.getElementById('u-cancel').onclick = () => {
    editingUser = null;
    document.getElementById('user-form').reset();
    document.getElementById('u-role').value = 'cashier';
    document.getElementById('u-role').dispatchEvent(new Event('change'));
    document.querySelectorAll('input[name="u-perm"]').forEach(cb => cb.checked = true);
    
    document.getElementById('u-form-title').textContent = 'Agregar Cajero';
    document.getElementById('u-btn').textContent = 'Agregar';
    document.getElementById('u-cancel').classList.add('hidden');
    document.getElementById('u-user').readOnly = false;
    document.getElementById('u-user').classList.remove('opacity-50', 'cursor-not-allowed');
  };

  document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('u-name').value.trim();
    const username = document.getElementById('u-user').value.trim();
    const pass = document.getElementById('u-pass').value;
    const role = document.getElementById('u-role').value;
    
    if (!name || !username || !pass) { showToast('Completa todos los campos', 'warn'); return; }
    
    const freshUsers = getUsers();
    if (!editingUser) {
      if (freshUsers.find(u => u.username === username)) { 
        showToast('Ese ID de Usuario ya existe', 'warn'); 
        return; 
      }
    }

    const btn = document.getElementById('u-btn');
    btn.disabled = true; btn.textContent = 'Guardando...';

    const permissions = role === 'admin' 
        ? Array.from(document.querySelectorAll('input[name="u-perm"]:checked')).map(cb => cb.value)
        : [];

    const allowedCategories = Array.from(document.querySelectorAll('input[name="u-cat-perm"]:checked')).map(cb => cb.value);

    const data = {
      type: 'user', 
      name: username, 
      code: pass, 
      category: '', 
      buy_price: 0, 
      sell_price: 0,
      stock: 0, 
      min_stock: 0, 
      quantity: 0, 
      total: 0, 
      payment_method: '', 
      cashier: '',
      date: now(), 
      amount: 0, 
      description: name, 
      status: role,
      initial_cash: 0, 
      final_cash: 0, 
      sales_total: 0,
      permissions: permissions,
      allowedCategories: allowedCategories 
    };

    if (editingUser) {
      if (editingUser.raw) {
        await dbSdk.update({ ...editingUser.raw, ...data });
      } else {
        await dbSdk.create(data);
      }
      showToast('Usuario actualizado correctamente');
    } else {
      await dbSdk.create(data);
      showToast('Usuario creado exitosamente');
    }
    
    document.getElementById('u-cancel').click(); 
    btn.disabled = false;
  };
}

export function renderSettings(container) {
  const cloudConfig = records('config')[0] || {};
  const currentName = cloudConfig.business_name || defaultConfig.business_name;
  const currentCurrency = cloudConfig.currency_symbol || defaultConfig.currency_symbol;
  const currentWa = cloudConfig.whatsapp_number || defaultConfig.whatsapp_number;
  const currentPin = cloudConfig.admin_pin || defaultConfig.admin_pin; 
  
  const savedLogoRecord = records('sys_file').find(f => f.name === 'main_logo');
  const currentLogo = savedLogoRecord ? savedLogoRecord.image : '';

  container.innerHTML = `
  <div class="fade-in space-y-4 pb-10">
    <h2 class="text-xl font-bold">Configuración Global (Nube)</h2>
    
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="bg-surface rounded-xl p-5 border border-card space-y-4 shadow-sm">
        <h3 class="font-semibold text-accent flex items-center gap-2"><i data-lucide="settings" class="w-4 h-4"></i> Datos del Negocio</h3>
        <div>
          <label class="block text-sm text-muted mb-1">Nombre del Negocio</label>
          <input id="set-name" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-full focus:border-accent focus:outline-none" value="${currentName}">
        </div>
        <div>
          <label class="block text-sm text-muted mb-1">Símbolo de Moneda</label>
          <input id="set-currency" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-20 focus:border-accent focus:outline-none" value="${currentCurrency}">
        </div>
        <div>
          <label class="block text-sm text-muted mb-1">WhatsApp del Dueño (Con cód. país)</label>
          <input id="set-wa" type="number" class="bg-card border border-card rounded-lg px-3 py-2 text-sm w-full focus:border-accent focus:outline-none" value="${currentWa}" placeholder="52...">
        </div>
        <div class="pt-3 mt-1 border-t border-card">
          <label class="block text-sm font-bold text-accent mb-1"><i data-lucide="shield-alert" class="w-4 h-4 inline-block mr-1"></i>PIN de Autorización</label>
          <p class="text-xs text-muted mb-2">Clave requerida para cancelar o editar tickets.</p>
          <input id="set-pin" type="text" class="bg-card border border-card rounded-lg px-3 py-2 text-lg font-bold tracking-[0.3em] w-full focus:border-accent focus:outline-none text-center" value="${currentPin}" placeholder="Ej. 790208">
        </div>
      </div>

      <div class="bg-surface rounded-xl p-5 border border-card space-y-4 shadow-sm">
        <h3 class="font-semibold text-accent2 flex items-center gap-2"><i data-lucide="image" class="w-4 h-4"></i> Logotipo del Sistema</h3>
        <p class="text-xs text-muted mb-3">Este logo aparecerá en el sistema y en los tickets impresos.</p>
        
        <div class="flex items-center gap-4">
          <div class="w-24 h-24 bg-card border border-dashed border-muted rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            ${currentLogo ? `<img id="preview-logo" src="${currentLogo}" class="w-full h-full object-contain">` : `<i id="preview-icon" data-lucide="image" class="w-8 h-8 text-muted"></i><img id="preview-logo" class="hidden w-full h-full object-contain">`}
          </div>
          <div class="flex-1 space-y-2">
            <input id="logo-file" type="file" accept="image/*" class="text-xs text-muted bg-card p-2 rounded border border-card w-full cursor-pointer">
            <input id="logo-base64" type="hidden" value="${currentLogo}">
            <button type="button" id="upload-logo-btn" class="bg-accent2 text-white text-xs font-bold px-3 py-2 rounded shadow hover:opacity-90 transition disabled:opacity-50">Guardar Logo Independiente</button>
          </div>
        </div>
      </div>
    </div>

    <button id="set-save" class="bg-accent text-bg font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm flex items-center gap-2 shadow-lg mt-4">
      <i data-lucide="cloud-upload" class="w-5 h-5"></i> Guardar Configuración Principal
    </button>
  </div>`;

  document.getElementById('logo-file').onchange = async (e) => {
    if (e.target.files[0]) {
      showToast('Procesando imagen...', 'info');
      const base64Logo = await compressLogo(e.target.files[0]);
      document.getElementById('logo-base64').value = base64Logo;
      
      const previewImg = document.getElementById('preview-logo');
      const previewIcon = document.getElementById('preview-icon');
      
      previewImg.src = base64Logo;
      previewImg.classList.remove('hidden');
      if (previewIcon) previewIcon.classList.add('hidden');
      
      showToast('Logo listo para guardar', 'success');
    }
  };

  document.getElementById('upload-logo-btn').onclick = async () => {
    const base64 = document.getElementById('logo-base64').value;
    if (!base64) return showToast('Selecciona una imagen primero', 'warn');
    
    const btn = document.getElementById('upload-logo-btn');
    btn.disabled = true; btn.textContent = 'Subiendo...';

    const existingLogo = records('sys_file').find(f => f.name === 'main_logo');
    const logoData = { type: 'sys_file', name: 'main_logo', image: base64, date: now() };

    if (existingLogo) {
      await dbSdk.update({ ...existingLogo, ...logoData });
    } else {
      await dbSdk.create(logoData);
    }

    showToast('Logo actualizado en la nube', 'success');
    btn.disabled = false; btn.textContent = 'Guardar Logo Independiente';
  };

  document.getElementById('set-save').onclick = async () => {
    const btn = document.getElementById('set-save');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Sincronizando...';

    const configData = {
      type: 'config',
      business_name: document.getElementById('set-name').value.trim() || 'Mi Negocio',
      currency_symbol: document.getElementById('set-currency').value.trim() || '$',
      whatsapp_number: document.getElementById('set-wa').value.trim(),
      admin_pin: document.getElementById('set-pin').value.trim() || '790208' 
    };

    const existingConfig = records('config')[0];
    
    if (existingConfig) await dbSdk.update({ ...existingConfig, ...configData });
    else await dbSdk.create(configData);
    
    showToast('Configuración sincronizada en todos los dispositivos', 'success');
    
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="cloud-upload" class="w-5 h-5"></i> Guardar Configuración Principal';
      render(); 
    }, 500);
  };

  lucide.createIcons();
}

export async function renderDepartments(container) {
    container.innerHTML = `<div class="flex flex-col items-center justify-center h-64 text-muted fade-in"><i data-lucide="loader" class="w-8 h-8 animate-spin text-accent mb-4"></i><p class="font-semibold text-sm">Calculando ingresos por departamento...</p></div>`;
    lucide.createIcons();

    const [yStr, mStr, dStr] = state.deptSpecificDate.split('-');
    const y = parseInt(yStr);
    const m = parseInt(mStr) - 1;

    await cargarMesFirebase(y, m);

    const sales = records('sale');
    const products = records('product');
    const categories = records('category');

    const specificDaySales = sales.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        const localDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateString === state.deptSpecificDate;
    });

    const movements = records('movement');
    const specificDayAbonos = movements.filter(m => {
        if (m.category !== 'cash_in' || (m.name !== 'Cobro de Abono' && m.name !== 'Abono de Cliente')) return false;
        if (!m.date) return false;
        const d = new Date(m.date);
        const localDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localDateString === state.deptSpecificDate;
    }).reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

    const categoryTotals = {};

    categories.forEach(c => categoryTotals[c.name] = 0);
    categoryTotals['Granel'] = 0; 
    categoryTotals['Sin Categoría'] = 0;
    categoryTotals['Descuentos'] = 0;
    categoryTotals['Abonos de Créditos'] = 0; 

    if (specificDayAbonos > 0) {
        categoryTotals['Abonos de Créditos'] += specificDayAbonos;
    }

    specificDaySales.forEach(s => {
        let pagado = 0;
        if (s.cash_part !== undefined) {
            pagado = Number(s.cash_part) + Number(s.transfer_part || 0);
        } else {
            pagado = s.is_credit ? 0 : (Number(s.total) || 0); 
        }

        const ticketTotal = Number(s.order_total || s.total) || 1; 
        const ratio = pagado / ticketTotal; 

        const items = s.items ? s.items : [s];
        items.forEach(item => {
            let catName = 'Sin Categoría';
            const itemBaseTotal = Number(item.total) || (Number(item.sell_price) * Number(item.quantity || 1)) || 0;
            const itemRealIncome = itemBaseTotal * ratio; 

            if (String(item.id).startsWith('bulk_') || (item.name && item.name.includes('(Granel)'))) {
                catName = 'Granel';
            } else if (String(item.id).startsWith('desc_') || (item.name && item.name.toLowerCase().includes('descuento'))) {
                catName = 'Descuentos'; 
            } else {
                const prodRef = products.find(p => p.id === item.id || p.name === item.name);
                if (prodRef && prodRef.category) catName = prodRef.category;
            }
            if (categoryTotals[catName] === undefined) categoryTotals[catName] = 0;
            categoryTotals[catName] += itemRealIncome;
        });
    });

    const sortedCats = Object.entries(categoryTotals)
        .filter(([name, total]) => total !== 0 || categories.find(c => c.name === name) || name === 'Granel')
        .sort((a, b) => b[1] - a[1]); 

    const dateObj = new Date(y, m, parseInt(dStr));
    const dateDisplay = dateObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    
    const todayStr = (function() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
    const isToday = state.deptSpecificDate === todayStr;

    container.innerHTML = `
    <div class="fade-in space-y-6 pb-10 max-w-5xl mx-auto">
       <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-xl font-bold text-txt">Departamentos</h2>
            
            <div class="flex items-center gap-1 bg-surface border border-card rounded-lg p-1 shadow-sm">
                <button type="button" id="dept-prev" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt z-10 relative" title="Día anterior"><i data-lucide="chevron-left" class="w-4 h-4 pointer-events-none"></i></button>
                
                <div class="text-sm font-bold text-center uppercase tracking-wider text-accent w-40 flex justify-center items-center gap-1.5 relative">
                    <input type="date" id="dept-date-picker" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value="${state.deptSpecificDate}">
                    ${dateDisplay} ${isToday ? '<span class="bg-success/10 text-success border border-success/20 text-[10px] px-2 py-0.5 rounded-md ml-1">HOY</span>' : ''}
                </div>
                
                <button type="button" id="dept-next" class="p-1.5 hover:bg-card rounded transition text-muted hover:text-txt z-10 relative ${isToday ? 'opacity-30 cursor-not-allowed' : ''}" title="Día siguiente"><i data-lucide="chevron-right" class="w-4 h-4 pointer-events-none"></i></button>
            </div>
        </div>

        <div class="bg-surface rounded-xl border border-card shadow-sm overflow-hidden flex flex-col">
            <div class="p-5 border-b border-card font-bold text-sm text-txt flex items-center gap-2 bg-bg/40">
                <i data-lucide="tags" class="w-4 h-4 text-accent"></i> Ingresos Diarios por Categoría
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="text-muted text-left border-b border-card bg-surface">
                            <th class="p-4 font-semibold w-2/3">Categoría</th>
                            <th class="p-4 font-semibold text-right">Total Vendido</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedCats.length > 0 ? sortedCats.map(([catName, total]) => `
                            <tr class="border-b border-card/50 hover:bg-card/30 transition bg-surface">
                                <td class="p-4 font-bold flex items-center gap-3">
                                    <i data-lucide="${catName === 'Descuentos' ? 'tag-minus' : 'tag'}" class="w-4 h-4 text-muted"></i> 
                                    <span class="text-txt uppercase text-xs tracking-wider">${catName}</span>
                                </td>
                                <td class="p-4 font-black text-right ${total > 0 ? 'text-success' : total < 0 ? 'text-danger' : 'text-muted/50'} text-base tracking-wide">
                                    ${currency(total)}
                                </td>
                            </tr>
                        `).join('') : `
                            <tr><td colspan="2" class="p-10 text-center text-muted">No hay datos para esta fecha</td></tr>
                        `}
                    </tbody>
                    <tfoot class="bg-bg/40 border-t border-card">
                        <tr>
                            <td class="p-5 font-bold text-right text-muted uppercase tracking-wider text-xs">Total del Día:</td>
                            <td class="p-5 font-black text-right text-success text-2xl tracking-wide">${currency(Object.values(categoryTotals).reduce((a, b) => a + b, 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>`;

    lucide.createIcons();

    const updateDate = (newDateStr) => {
        state.deptSpecificDate = newDateStr;
        renderDepartments(container);
    };

    document.getElementById('dept-date-picker').onchange = (e) => {
        if (e.target.value) updateDate(e.target.value);
    };

    document.getElementById('dept-prev').onclick = () => {
        const d = new Date(y, m, parseInt(dStr));
        d.setDate(d.getDate() - 1);
        updateDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };

    document.getElementById('dept-next').onclick = () => {
        if (state.deptSpecificDate === todayStr) return; 
        const d = new Date(y, m, parseInt(dStr));
        d.setDate(d.getDate() + 1);
        updateDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };
}
