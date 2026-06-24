// ========== CASHIER VIEWS ==========
import { 
  state, 
  defaultConfig, 
  records, 
  currency, 
  bizName, 
  getSystemLogo, 
  genId, 
  now, 
  showToast 
} from "../state.js";
import { dbSdk } from "../firebase.js";
import { render } from "../main.js";

export function renderCashierPOS() {
  const products = records('product');

  // === PRIORIDAD TOTAL A LA NUBE (Sincronización PC -> Celular) ===
  if (state.currentUser) {
    const liveUser = records('user').find(u => u.name === state.currentUser.username);
    if (liveUser && liveUser.session_open !== undefined) {
      state.cashRegisterOpen = (liveUser.session_open === true || liveUser.session_open === 'true');
      state.initialCash = parseFloat(liveUser.initial_cash) || 0;
      state.sessionStart = liveUser.session_start || null;
      
      // Actualizamos la memoria del celular para que coincida con la PC
      localStorage.setItem(`pos_register_open_${state.currentUser.username}`, state.cashRegisterOpen);
      localStorage.setItem(`pos_initial_cash_${state.currentUser.username}`, state.initialCash);
      if (state.sessionStart) localStorage.setItem(`pos_session_start_${state.currentUser.username}`, state.sessionStart);
    }
  }

  // === Proteger todas las pestañas ===
  if (!state.cashRegisterOpen && state.currentView.startsWith('cashier-')) {
    const app = document.getElementById('app');
    app.innerHTML = `
  <div class="h-full w-full flex items-center justify-center p-4" style="background: radial-gradient(circle at center, #2a0000 0%, #050505 100%);">
    <div class="bg-surface rounded-2xl p-8 w-full max-w-sm fade-in text-center border border-card" style="box-shadow: 0 15px 35px -10px rgba(255,0,0,0.15), 0 0 15px rgba(0,0,0,0.5);">
        <div class="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i data-lucide="unlock" class="w-7 h-7 text-accent"></i>
        </div>
        <h2 class="text-xl font-bold mb-1">Apertura de Caja</h2>
        <p class="text-muted text-sm mb-5">Hola, ${state.currentUser?.name || 'Cajero'}. Ingresa el monto inicial.</p>
        <input id="open-cash" type="number" step="0.01" class="w-full bg-card border border-card rounded-lg px-4 py-3 text-center text-2xl font-bold focus:border-accent focus:outline-none mb-4" value="${state.initialCash}" placeholder="0.00">
        <button id="open-btn" class="w-full bg-accent text-bg font-semibold py-3 rounded-lg hover:opacity-90 transition">Abrir Caja</button>
        <button id="back-login" class="mt-3 text-muted text-sm hover:text-danger transition">← Cerrar sesión</button>
      </div>
    </div>`;
    lucide.createIcons();
    
    document.getElementById('open-btn').onclick = async () => {
      state.initialCash = parseFloat(document.getElementById('open-cash').value) || 0;
      state.cashRegisterOpen = true;
      state.sessionStart = now();
      
      localStorage.setItem(`pos_register_open_${state.currentUser.username}`, 'true');
      localStorage.setItem(`pos_initial_cash_${state.currentUser.username}`, state.initialCash);
      localStorage.setItem(`pos_session_start_${state.currentUser.username}`, state.sessionStart);
      
      const liveUser = records('user').find(u => u.name === state.currentUser.username);
      if (liveUser) {
        await dbSdk.update({ 
          ...liveUser, 
          session_open: true, 
          session_start: state.sessionStart, 
          initial_cash: state.initialCash 
        });
      } else {
        await dbSdk.create({
          type: 'user',
          name: state.currentUser.username,
          code: state.currentUser.password || '1234',
          description: state.currentUser.name || 'Cajero',
          status: state.currentUser.role || 'cashier',
          session_open: true,
          session_start: state.sessionStart,
          initial_cash: state.initialCash
        });
      }
      render();
    };
    
    document.getElementById('back-login').onclick = () => { 
      state.currentUser = null; 
      state.currentView = 'login'; 
      localStorage.removeItem('pos_user'); 
      localStorage.setItem('pos_view', 'login');
      render(); 
    };
    return;
  }

  let searchTerm = '';
  let paymentMethod = 'Efectivo';
  let currentPosCategory = ''; 
  let showTab = state.currentView === 'cashier-history' ? 'history' : state.currentView === 'cashier-close' ? 'close' : 'pos';

  function cartTotal() { 
    return state.cart.reduce((a, i) => a + i.sell_price * i.qty, 0); 
  }

  // === CÁLCULO DE EFECTIVO EN CAJA ===
  const mySales = records('sale').filter(s => s.cashier === (state.currentUser?.username || '') && state.sessionStart && s.date >= state.sessionStart);
  const cashSales = mySales.filter(s => s.payment_method === 'Efectivo').reduce((a, s) => a + (s.total || 0), 0);
  const expectedCash = state.initialCash + cashSales;

  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="h-full w-full flex flex-col" style="min-height:100%;">
   <header class="bg-surface border-b border-card shadow-sm px-4 py-3 flex items-center justify-between shrink-0 overflow-x-auto" style="scrollbar-width: none;">
      <div class="flex items-center gap-2 sm:gap-3 shrink-0">
        <i data-lucide="shopping-bag" class="w-5 h-5 text-accent hidden sm:block"></i>
        <span class="font-bold text-txt">${bizName()}</span>
        <span class="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">${state.currentUser?.name || 'Cajero'}</span>
        
       <span id="top-cash-badge" class="text-xs bg-surface border border-card text-txt px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-sm" title="Efectivo en caja">
          <i data-lucide="wallet" class="w-3 h-3 text-accent"></i> ${currency(expectedCash)}
       </span>
      </div>
      <div class="flex items-center gap-2 shrink-0 ml-4">
        <button data-tab="pos" class="text-sm px-3 py-1.5 rounded-lg transition ${showTab === 'pos' ? 'bg-accent text-white font-semibold shadow-md' : 'text-txt hover:bg-surface/50'}">Venta</button>
        <button data-tab="history" class="text-sm px-3 py-1.5 rounded-lg transition ${showTab === 'history' ? 'bg-accent text-white font-semibold shadow-md' : 'text-txt hover:bg-surface/50'}">Historial</button>
        <button data-tab="close" class="text-sm px-3 py-1.5 rounded-lg transition ${showTab === 'close' ? 'bg-warn text-white font-semibold shadow-md' : 'text-txt hover:bg-surface/50'}">Cerrar Caja</button>
        <button id="cashier-logout" class="text-txt hover:text-danger transition ml-2 bg-surface/50 p-1.5 rounded-lg shadow-sm"><i data-lucide="log-out" class="w-4 h-4"></i></button>
      </div>
    </header>

    <div id="pos-content" class="flex-1 overflow-auto"></div>
  </div>`;
  
  const posContent = document.getElementById('pos-content');

  document.querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => {
      showTab = b.dataset.tab;
      state.currentView = showTab === 'history' ? 'cashier-history' : showTab === 'close' ? 'cashier-close' : 'cashier-pos';
      localStorage.setItem('pos_view', state.currentView);
      render(); 
    };
  });
  
  document.getElementById('cashier-logout').onclick = () => { 
    state.currentUser = null; 
    state.currentView = 'login'; 
    state.cart = []; 
    localStorage.removeItem('pos_user'); 
    localStorage.setItem('pos_view', 'login');
    render(); 
  };

  function renderTabContent() {
    if (showTab === 'history') renderCashierHistory();
    else if (showTab === 'close') renderCashierClose();
    else renderPOSView();
    lucide.createIcons();
  }

  function renderPOSView() {
    posContent.innerHTML = `
    <div class="pos-grid h-full">
      <div class="flex flex-col p-4 space-y-3 h-full overflow-hidden">
       <div class="flex gap-2 shrink-0 overflow-x-auto overflow-y-hidden pb-1" style="scrollbar-width: none;">
          <div class="relative flex-1 min-w-[140px]">
            <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"></i>
            <input id="pos-search" class="w-full bg-surface border-2 border-card rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-accent focus:outline-none shadow-sm" placeholder="Buscar / Escanear..." autocomplete="off">
          </div>
          
          <button type="button" onclick="window.openPosAbonosModal()" class="bg-warn/10 border-2 border-warn/30 text-warn px-3 rounded-lg hover:bg-warn/20 transition flex items-center gap-1 font-bold text-sm shrink-0 shadow-sm" title="Cobrar abonos de créditos activos">
            <i data-lucide="hand-coins" class="w-4 h-4 pointer-events-none"></i> <span class="hidden lg:inline">Abonos</span>
          </button>

          <button type="button" onclick="window.openCashMovementModal('in')" class="bg-surface border-2 border-card text-success px-3 rounded-lg hover:bg-success/10 transition flex items-center gap-1 font-semibold text-sm shrink-0 shadow-sm" title="Entrada a Caja (Ingreso extra)">
            <i data-lucide="arrow-down-to-line" class="w-4 h-4 pointer-events-none"></i> <span class="hidden xl:inline">Entrada</span>
          </button>
          <button type="button" onclick="window.openCashMovementModal('out')" class="bg-surface border-2 border-card text-danger px-3 rounded-lg hover:bg-danger/10 transition flex items-center gap-1 font-semibold text-sm shrink-0 shadow-sm" title="Salida de Caja (Gasto)">
            <i data-lucide="arrow-up-from-line" class="w-4 h-4 pointer-events-none"></i> <span class="hidden xl:inline">Salida</span>
          </button>
          <button type="button" onclick="window.openBulkModal()" class="bg-surface border-2 border-card text-accent px-3 rounded-lg hover:bg-card transition flex items-center gap-1 font-semibold text-sm shrink-0 shadow-sm" title="Venta a Granel Libre">
            <i data-lucide="scale" class="w-4 h-4 pointer-events-none"></i> <span class="hidden lg:inline">Granel</span>
          </button>
        </div>

        <div id="pos-categories" class="flex gap-2 overflow-x-auto pb-1 shrink-0" style="scrollbar-width: none;"></div>

        <div id="pos-products" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 overflow-y-auto content-start pr-1 pb-4"></div>
        ${!products.length ? '<p class="text-muted text-center mt-8">No hay productos en inventario.</p>' : ''}
      </div>

      <div class="bg-surface border-l border-card flex flex-col h-full overflow-hidden">
        <div class="p-4 border-b border-card">
          <h3 class="font-bold flex items-center gap-2"><i data-lucide="shopping-cart" class="w-4 h-4 text-accent"></i>Carrito <span class="text-sm text-muted font-normal">(${state.cart.length})</span></h3>
        </div>
        <div id="cart-items" class="flex-1 overflow-auto p-3 space-y-2"></div>
        <div class="p-4 border-t border-card space-y-3">
          <div class="flex justify-between items-center text-lg font-bold mb-2 border-b border-card pb-2">
            <button type="button" onclick="window.openDiscountModal()" class="text-xs bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-lg hover:bg-accent hover:text-bg transition flex items-center gap-1.5 shadow-sm" title="Aplicar descuento al carrito">
              <i data-lucide="tag" class="w-3.5 h-3.5 pointer-events-none"></i> Descuento
            </button>
            <div class="flex gap-2"><span>Total:</span><span class="text-success">${currency(cartTotal())}</span></div>
          </div>
         <div class="flex flex-wrap gap-2">
            <button data-pay="Efectivo" class="flex-1 min-w-[70px] py-2 rounded-lg text-sm font-semibold transition ${paymentMethod === 'Efectivo' ? 'bg-success text-white' : 'bg-card text-muted hover:bg-surface'}">Efectivo</button>
            <button data-pay="Transfer" class="flex-1 min-w-[70px] py-2 rounded-lg text-sm font-semibold transition ${paymentMethod === 'Transfer' ? 'bg-accent2 text-white' : 'bg-card text-muted hover:bg-surface'}">Transfer</button>
            <button data-pay="Mixto" class="flex-1 min-w-[70px] py-2 rounded-lg text-sm font-semibold transition ${paymentMethod === 'Mixto' ? 'bg-warn text-white' : 'bg-card text-muted hover:bg-surface'}">Mixto</button>
            <button data-pay="Crédito" class="flex-1 min-w-[70px] py-2 rounded-lg text-sm font-semibold transition ${paymentMethod === 'Crédito' ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-surface'}">Crédito</button>
          </div>
          
          <button id="checkout-btn" class="w-full bg-warn text-white font-bold py-3 rounded-lg hover:opacity-90 transition ${state.cart.length ? '' : 'opacity-50 cursor-not-allowed'}" ${state.cart.length ? '' : 'disabled'}>
            Cobrar ${currency(cartTotal())}
          </button>
          
          <button id="clear-cart" class="w-full text-muted text-sm hover:text-danger transition py-1 mt-2">Vaciar carrito</button>
        </div>
      </div>
    </div>`;

    renderPosCategories(); 
    renderProducts();
    renderCartItems();

    window.updateCashBadge = () => {
      if (!state.sessionStart) return;
      const liveSales = records('sale').filter(s => s.cashier === (state.currentUser?.username || '') && s.date >= state.sessionStart);
      
      const liveCash = liveSales.reduce((a, s) => {
          if (s.cash_part !== undefined) return a + s.cash_part;
          if (s.payment_method === 'Efectivo') return a + (s.total || 0);
          return a;
      }, 0);
      
      const liveFlows = records('movement').filter(m => m.cashier === (state.currentUser?.username || '') && state.sessionStart && m.date >= state.sessionStart && (m.category === 'cash_in' || m.category === 'cash_out'));
      const flowIn = liveFlows.filter(m => m.category === 'cash_in').reduce((a, m) => a + (m.amount || 0), 0);
      const flowOut = liveFlows.filter(m => m.category === 'cash_out').reduce((a, m) => a + (m.amount || 0), 0);

      const badge = document.getElementById('top-cash-badge');
      if (badge) {
        badge.innerHTML = `<i data-lucide="wallet" class="w-3 h-3"></i> ${currency(state.initialCash + liveCash + flowIn - flowOut)}`;
        lucide.createIcons();
      }
    };

    const posSearch = document.getElementById('pos-search');

    posSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = posSearch.value.trim();
        if (!code) return;

        const product = records('product').find(p => 
          p.code === code || p.code === code.toUpperCase() || p.code === code.toLowerCase()
        );

        if (product) {
          if (product.stock > 0) {
            const existing = state.cart.find(c => c.id === product.id);
            if (existing) {
              if (existing.qty < product.stock) {
                existing.qty++;
                showToast(`+1 ${product.name}`);
              } else {
                showToast('Sin stock suficiente', 'warn');
              }
            } else {
              state.cart.push({ id: product.id, name: product.name, sell_price: product.sell_price, normal_price: product.sell_price, buy_price: product.buy_price || 0, qty: 1, maxStock: product.stock });
              showToast(`${product.name} añadido`);
            }
            posSearch.value = ''; 
            renderPOSView(); 
          } else {
            showToast('Producto sin stock', 'error');
            posSearch.value = '';
          }
        } else {
          showToast('Producto no encontrado', 'warn');
          posSearch.select(); 
        }
      }
    });

    posSearch.addEventListener('input', () => { renderProducts(); });

    document.querySelectorAll('[data-pay]').forEach(b => {
      b.onclick = () => { paymentMethod = b.dataset.pay; renderPOSView(); };
    });
    document.getElementById('clear-cart').onclick = () => { state.cart = []; renderPOSView(); };
    document.getElementById('checkout-btn').onclick = openPaymentModal;
    
    posContent.onclick = (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        const search = document.getElementById('pos-search');
        if (search) search.focus();
      }
    };

    window.onkeydown = (e) => {
      if (state.currentView !== 'cashier-pos') return; 
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
        if (e.key.length === 1) { 
          const search = document.getElementById('pos-search');
          if (search) search.focus(); 
        }
      }
    };
    
    lucide.createIcons();
    setTimeout(() => {
      const search = document.getElementById('pos-search');
      if (search) search.focus();
    }, 100);
  }

  function renderPosCategories() {
    const container = document.getElementById('pos-categories');
    if (!container) return;

    const allCategories = records('category');
    const userAllowed = state.currentUser.raw?.allowedCategories || [];
    const categories = (state.currentUser.role === 'admin') 
      ? allCategories 
      : allCategories.filter(c => userAllowed.includes(c.name));

    const allCats = [{ id: 'all', name: 'Todas' }, ...categories];

    container.innerHTML = allCats.map(c => {
       const val = c.id === 'all' ? '' : c.name;
       const isSelected = currentPosCategory === val;
       const bgClass = isSelected ? 'bg-accent text-white font-bold shadow-md' : 'bg-surface text-txt hover:bg-card border border-card shadow-sm';
       return `<button data-cat-filter="${val}" class="whitespace-nowrap px-4 py-2 rounded-xl text-sm transition ${bgClass}">${c.name}</button>`;
    }).join('');

    container.querySelectorAll('[data-cat-filter]').forEach(btn => {
       btn.onclick = () => {
          currentPosCategory = btn.dataset.catFilter;
          renderPosCategories(); 
          renderProducts();      
          
          const searchInput = document.getElementById('pos-search');
          if (searchInput) {
            searchInput.focus();
          }
       };
    });
  }

  function renderProducts() {
    const container = document.getElementById('pos-products');
    if (!container) return;
    
    const searchInput = document.getElementById('pos-search');
    const term = searchInput ? searchInput.value.toLowerCase() : "";

    const filtered = records('product').filter(p => {
      const matchesSearch = !term || p.name.toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term);
      const matchesCat = !currentPosCategory || p.category === currentPosCategory;
      return p.stock > 0 && matchesSearch && matchesCat;
    });

    container.innerHTML = filtered.map(p => `
     <button data-add-prod="${p.id}" class="bg-surface hover:bg-card border-2 border-card/60 rounded-xl p-3 text-left transition group flex flex-col relative shadow-md h-full">
        ${!p.is_service && p.stock <= (p.min_stock || 5) ? `<div class="absolute top-0 right-0 bg-warn text-white text-[10px] px-2 py-1 font-bold rounded-tr-xl rounded-bl-lg z-10 shadow-sm">Bajo Stock</div>` : ''}
        
       <div class="w-full h-28 bg-card rounded-lg flex items-center justify-center shrink-0 mb-3 overflow-hidden border border-card/30">
          ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover">` : `<i data-lucide="image" class="text-muted/30 w-8 h-8"></i>`}
        </div>

        <div class="flex-1 flex flex-col w-full">
          <div class="text-sm font-bold text-txt group-hover:text-accent transition uppercase line-clamp-2 leading-tight mb-1">${p.name}</div>
          <div class="text-[11px] text-muted font-mono truncate mb-2">${p.code || '---'} · <span class="${!p.is_service && p.stock <= (p.min_stock || 5) ? 'text-warn font-bold' : 'font-bold'}">${p.is_service ? 'Servicio' : p.stock + ' uds'}</span></div>
          
          <div class="mt-auto text-base font-bold text-success">${currency(p.sell_price)}</div>
        </div>
      </button>`).join('') || `<div class="col-span-full text-center text-muted py-8 text-sm font-medium">No se encontraron productos en esta categoría</div>`;

    lucide.createIcons();
    container.querySelectorAll('[data-add-prod]').forEach(btn => {
      btn.onclick = () => {
        const prod = state.allRecords.find(p => p.id === btn.dataset.addProd);
        if (!prod) return;
        const existing = state.cart.find(c => c.id === prod.id);
        if (existing) {
          if (existing.qty < prod.stock) existing.qty++;
          else showToast('Stock insuficiente', 'warn');
        } else {
          state.cart.push({ id: prod.id, name: prod.name, sell_price: prod.sell_price, buy_price: prod.buy_price || 0, qty: 1, maxStock: prod.stock });
        }
        renderPOSView();
      };
    });
  }

  function renderCartItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    
    container.innerHTML = state.cart.length ? state.cart.map((item, i) => {
      const isCustomPrice = item.normal_price && item.sell_price !== item.normal_price;

      return `
      <div class="bg-card rounded-lg p-3 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold text-txt truncate">${item.name}</div>
            
            <div class="mt-1 flex flex-wrap gap-2">
              <button onclick="window.openCustomPriceModal(${i})" class="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition ${isCustomPrice ? 'bg-warn/20 text-warn border border-warn/30' : 'bg-surface border border-card text-accent hover:bg-accent/10'} shadow-sm font-semibold" title="Editar precio">
                <i data-lucide="edit-2" class="w-3 h-3 pointer-events-none"></i>
                ${currency(item.sell_price)} c/kg
              </button>
              
              <button onclick="window.openCustomQtyModal(${i})" class="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition bg-surface border border-success/30 text-success hover:bg-success/10 shadow-sm font-bold" title="Ajustar peso">
                <i data-lucide="scale" class="w-3 h-3 pointer-events-none"></i>
                ${item.qty} kg
              </button>
            </div>
            
          </div>
          <span class="font-black text-sm w-20 text-right text-success mt-0.5">${currency(item.sell_price * item.qty)}</span>
        </div>
        
        <div class="flex items-center justify-end gap-1">
          <div class="flex items-center gap-1 bg-surface border border-card rounded-lg p-1 shadow-sm">
            <button data-cart-minus="${i}" class="w-6 h-6 rounded flex items-center justify-center hover:bg-danger/20 transition text-sm text-muted hover:text-danger font-bold">−</button>
            
            <input type="number" step="0.001" data-cart-edit="${i}" value="${item.qty}" class="w-12 bg-transparent text-center font-bold text-sm focus:outline-none focus:text-accent" onclick="this.select()">
            
            <button data-cart-plus="${i}" class="w-6 h-6 rounded flex items-center justify-center hover:bg-success/20 transition text-sm text-muted hover:text-success font-bold">+</button>
          </div>
        </div>
      </div>`;
    }).join('') : '<p class="text-muted text-center text-sm mt-8">Carrito vacío</p>';

    container.querySelectorAll('[data-cart-minus]').forEach(b => {
      b.onclick = () => { 
        const i = parseInt(b.dataset.cartMinus); 
        if (state.cart[i].qty <= 1) {
            state.cart.splice(i, 1);
        } else {
            state.cart[i].qty--; 
        }
        renderPOSView(); 
      };
    });

    container.querySelectorAll('[data-cart-plus]').forEach(b => {
      b.onclick = () => { 
        const i = parseInt(b.dataset.cartPlus); 
        if (state.cart[i].qty < state.cart[i].maxStock) state.cart[i].qty++; 
        else showToast('Stock máximo superado', 'warn'); 
        renderPOSView(); 
      };
    });

    container.querySelectorAll('[data-cart-edit]').forEach(input => {
      input.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.cartEdit);
        let val = parseFloat(e.target.value);
        
        if (isNaN(val) || val <= 0) {
          state.cart.splice(i, 1); 
        } else if (val > state.cart[i].maxStock) {
          showToast('Stock máximo superado', 'warn');
          state.cart[i].qty = state.cart[i].maxStock; 
        } else {
          state.cart[i].qty = val;
        }
        renderPOSView();
      });
    });
  }

  let currentCashReceived = 0;
  let currentTransferReceived = 0;

  function openPaymentModal() {
    if (!state.cart.length) return;
    const total = cartTotal();
    
    document.getElementById('payment-total').textContent = currency(total);
    document.getElementById('payment-remaining').textContent = currency(total);
    document.getElementById('payment-paid').textContent = currency(0);
    document.getElementById('pay-amount-to-collect').value = total;
    
    const inputCash = document.getElementById('pay-cash-received');
    const inputTransfer = document.getElementById('pay-transfer-received');
    const cashContainer = document.getElementById('cash-input-container');
    const transferContainer = document.getElementById('transfer-input-container');
    
    const lblCash = cashContainer.querySelector('label');

    inputCash.value = ''; 
    inputTransfer.value = '';
    currentCashReceived = 0;
    currentTransferReceived = 0;

    document.getElementById('pay-tracking-number').value = '';
    document.getElementById('pay-change-returned').textContent = currency(0);

    const clientSelect = document.getElementById('pay-client-select');
    const clientes = records('client');
    clientSelect.innerHTML = '<option value="">-- Público en General --</option>' + 
      clientes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    clientSelect.value = ''; 

    document.querySelector('input[name="pay-invoiceable"][value="false"]').checked = true;

    if (paymentMethod === 'Efectivo') {
        cashContainer.style.display = 'block';
        transferContainer.style.display = 'none';
        if (lblCash) lblCash.textContent = 'Monto recibido en EFECTIVO';
        setTimeout(() => inputCash.focus(), 100);
    } else if (paymentMethod === 'Transfer') {
        cashContainer.style.display = 'none';
        transferContainer.style.display = 'block';
        setTimeout(() => inputTransfer.focus(), 100);
    } else if (paymentMethod === 'Mixto') {
        cashContainer.style.display = 'block';
        transferContainer.style.display = 'block';
        if (lblCash) lblCash.textContent = 'Monto recibido en EFECTIVO';
        setTimeout(() => inputTransfer.focus(), 100);
    } else if (paymentMethod === 'Crédito') {
        cashContainer.style.display = 'block';
        transferContainer.style.display = 'none';
        if (lblCash) lblCash.textContent = 'Abono Inicial en Efectivo (Opcional)';
        setTimeout(() => inputCash.focus(), 100);
    }

    const btnConfirm = document.getElementById('pay-confirm');
    btnConfirm.disabled = paymentMethod !== 'Crédito'; 
    
    const modal = document.getElementById('cash-payment-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const calculateTotals = () => {
      const valCash = parseFloat(inputCash.value) || 0;
      const valTransfer = parseFloat(inputTransfer.value) || 0;
      
      currentCashReceived = (paymentMethod === 'Transfer') ? 0 : valCash;
      currentTransferReceived = (paymentMethod === 'Efectivo' || paymentMethod === 'Crédito') ? 0 : valTransfer;
      
      const totalPaid = currentCashReceived + currentTransferReceived;
      document.getElementById('payment-paid').textContent = currency(totalPaid);
      
      if (totalPaid >= total || paymentMethod === 'Crédito') {
        document.getElementById('payment-remaining').textContent = currency(Math.max(0, total - totalPaid));
        document.getElementById('pay-change-returned').textContent = currency(Math.max(0, totalPaid - total));
        btnConfirm.disabled = false;
      } else {
        document.getElementById('payment-remaining').textContent = currency(total - totalPaid);
        document.getElementById('pay-change-returned').textContent = currency(0);
        btnConfirm.disabled = true;
      }
    };

    inputCash.oninput = calculateTotals;
    inputTransfer.oninput = calculateTotals;
    
    document.getElementById('pay-cancel').onclick = () => {
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    };
    
    btnConfirm.onclick = () => {
      if (paymentMethod === 'Crédito' && !document.getElementById('pay-client-select').value) {
        return showToast('Debes seleccionar un Cliente para ventas a Crédito', 'error');
      }

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Procesando...';
      processCheckoutAndShowReceipt(total, currentCashReceived, currentTransferReceived);
    };
  }

  async function processCheckoutAndShowReceipt(total, cashReceived, transferReceived) {
    try {
      const ticketNum = Math.floor(Math.random() * 9000) + 1000; 
      const dateOpts = { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
      const dateTime = new Date().toLocaleString('es-MX', dateOpts);

      for (const item of state.cart) {
        const prodRec = state.allRecords.find(r => r.id === item.id);
        if (prodRec && !prodRec.is_service) {
          prodRec.stock = Math.max(0, Number(prodRec.stock || 0) - Number(item.qty)); 
          dbSdk.update(prodRec);
        }
      }

      const trackingNumber = document.getElementById('pay-tracking-number').value.trim();
      const isInvoiceable = document.querySelector('input[name="pay-invoiceable"]:checked').value === 'true';

      const clientId = document.getElementById('pay-client-select').value;
      let clientName = 'Público General';
      if (clientId) {
          const cObj = state.allRecords.find(r => r.id === clientId && r.type === 'client');
          if (cObj) clientName = cObj.name;
      }

      const isCredit = paymentMethod === 'Crédito';
      const totalPaid = cashReceived + transferReceived;
      
      const debt = isCredit ? Math.max(0, total - totalPaid) : 0;
      const change = isCredit ? 0 : totalPaid - total;

      let cashPart = 0;
      let transferPart = 0;
      
      if (paymentMethod === 'Efectivo') cashPart = total; 
      else if (paymentMethod === 'Transfer') transferPart = total;
      else if (paymentMethod === 'Crédito') cashPart = cashReceived; 
      else {
          transferPart = transferReceived;
          cashPart = total - transferPart;
      }

      const newTicket = {
        type: 'sale',
        ticket_num: ticketNum,
        tracking_number: trackingNumber, 
        is_invoiceable: isInvoiceable,
        is_credit: isCredit,
        debt: debt,
        client_id: clientId || null,            
        client_name: clientName,                
        cashier: state.currentUser?.username || 'cajero',
        date: now(),
        total: total, 
        order_total: total,
        payment_method: paymentMethod,
        cash_received: cashReceived,
        transfer_received: transferReceived,
        cash_part: cashPart, 
        transfer_part: transferPart, 
        change_returned: change,
        status: 'completed',
        items: state.cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.qty,
          sell_price: item.sell_price,
          buy_price: item.buy_price || 0,
          total: item.sell_price * item.qty
        }))
      };

      dbSdk.create(newTicket);
      state.allRecords.push({ ...newTicket, id: 'temp_' + genId() });

      if (typeof renderProducts === 'function') renderProducts();

      const itemsHtml = state.cart.map(item => `
        <div class="flex justify-between items-start">
          <span class="w-8">${item.qty}x</span>
          <span class="flex-1 text-left uppercase truncate px-1">${item.name}</span>
          <span class="w-16 text-right">${currency(item.sell_price * item.qty)}</span>
        </div>
      `).join('');

      const sysLogo = getSystemLogo();
      const logoPrintHtml = sysLogo ? `<img src="${sysLogo}" style="max-width: 140px; max-height: 80px; margin: 0 auto 10px auto; display: block; object-fit: contain;">` : '';
      const trackingHtml = trackingNumber ? `<div class="font-bold mt-2 text-[14px] border border-black p-1 bg-gray-100">RASTREO:<br>${trackingNumber}</div>` : '';

      const ticketHtml = `
       <div class="text-center mb-3">
        ${logoPrintHtml}
        <div class="text-2xl font-bold tracking-tight uppercase">${bizName()}</div>
        <div class="text-xs mt-1">
         <div class="font-bold">TICKET DE VENTA ${isCredit ? '<br>(A CRÉDITO)' : ''}</div>
          <div class="font-bold">Sucursal Principal</div>
           <div class="font-bold">Av. primavera#40 Barrio Yalchivol</div>
         <div class="font-bold mt-1">${dateTime}</div>
         <div>TICKET #${ticketNum}</div>
         ${isCredit ? `<div>CLIENTE: ${clientName}</div>` : ''}
         ${trackingHtml}
        </div>
       </div>
       <div class="w-full border-t-2 border-dashed border-gray-400 mb-2"></div>
       <div class="w-full flex justify-between font-bold text-xs mb-1">
         <span>CANT</span>
         <span class="flex-1 ml-2">DESCRIPCIÓN</span>
         <span class="text-right w-16">IMPORTE</span>
       </div>
       <div class="w-full text-xs space-y-1">
         ${itemsHtml}
       </div>
       <div class="w-full border-t-2 border-dashed border-gray-400 mt-2 mb-2"></div>
       <div class="w-full flex justify-between items-center text-base font-bold mb-2">
         <span>TOTAL:</span>
         <span class="text-lg">${currency(total)}</span>
       </div>
       <div class="w-full border-t border-solid border-gray-300 mb-2"></div>
       <div class="w-full text-xs space-y-1">
        <div class="font-bold text-center mb-1">DETALLE DE PAGO</div>
        ${isCredit ? `
          <div class="flex justify-between"><span>ABONO INICIAL:</span><span>${currency(cashReceived)}</span></div>
          <div class="flex justify-between font-bold text-sm mt-1 text-danger"><span>RESTA:</span><span>${currency(debt)}</span></div>
        ` : paymentMethod === 'Mixto' ? `
          <div class="flex justify-between"><span>TRANSFERENCIA:</span><span>${currency(transferReceived)}</span></div>
          <div class="flex justify-between"><span>EFECTIVO:</span><span>${currency(cashReceived)}</span></div>
          <div class="flex justify-between font-bold text-sm mt-1"><span>SU CAMBIO:</span><span>${currency(change)}</span></div>
        ` : `
          <div class="flex justify-between"><span>PAGÓ CON (${paymentMethod}):</span><span>${currency(paymentMethod === 'Efectivo' ? cashReceived : transferReceived)}</span></div>
          <div class="flex justify-between font-bold text-sm mt-1"><span>SU CAMBIO:</span><span>${currency(change)}</span></div>
        `}
       </div>
       <div class="w-full border-t-2 border-dashed border-gray-400 mt-3 mb-2"></div>
       <div class="text-center text-xs space-y-1">
       <div class="font-bold">Cel 963-171-8780</div>
         <div class="font-bold">Cel 963-111-5533</div>
        <div>Vuelva pronto</div>
        <div class="text-[10px] mt-2 text-gray-500">Este documento no es un comprobante fiscal</div>
       </div>
      `;

      document.getElementById('printable-ticket').innerHTML = ticketHtml;

      document.getElementById('cash-payment-modal').classList.remove('flex');
      document.getElementById('cash-payment-modal').classList.add('hidden');
      
      document.getElementById('receipt-modal').classList.remove('hidden');
      document.getElementById('receipt-modal').classList.add('flex');
      
      const btnConfirm = document.getElementById('pay-confirm');
      btnConfirm.textContent = 'PAGAR';
      btnConfirm.disabled = false; 

      const btnWa = document.getElementById('btn-wa-ticket');
      const waContainer = document.getElementById('wa-input-container');
      const waInput = document.getElementById('wa-number-input');
      
      btnWa.style.display = 'flex'; 
      waContainer.style.display = 'block'; 
      waInput.value = ''; 

      document.getElementById('btn-print-ticket').classList.remove('col-span-2');
      const waTrackingText = trackingNumber ? `📦 *RASTREO:* ${trackingNumber}\n` : '';
      
      const waPaymentText = isCredit 
        ? `ABONO INICIAL: ${currency(cashReceived)}\nRESTA: ${currency(debt)}` 
        : paymentMethod === 'Mixto' 
        ? `TRANSFERENCIA: ${currency(transferReceived)}\nEFECTIVO: ${currency(cashReceived)}` 
        : `PAGÓ CON (${paymentMethod}): ${currency(paymentMethod === 'Efectivo' ? cashReceived : transferReceived)}`;

      const waText = `*${bizName()}*\n` +
        `TICKET DE VENTA ${isCredit ? '(A CRÉDITO)' : ''}\n` +
        `Fecha: ${dateTime}\n` +
        `Ticket #${ticketNum}\n` +
        `${isCredit ? `Cliente: ${clientName}\n` : ''}` +
        waTrackingText +
        `----------------------\n` +
        state.cart.map(i => `${i.qty}x ${i.name} = ${currency(i.sell_price * i.qty)}`).join('\n') + `\n` +
        `----------------------\n` +
        `*TOTAL: ${currency(total)}*\n` +
        waPaymentText + `\n` +
        (isCredit ? '' : `CAMBIO: ${currency(change)}\n`) +
        `----------------------\n` +
        `¡GRACIAS POR SU COMPRA!`;

      btnWa.onclick = () => {
        const cleanNumber = waInput.value.replace(/\D/g, '');
        const url = cleanNumber 
          ? `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(waText)}` 
          : `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
        window.open(url, '_blank');
      };
      
      document.getElementById('receipt-close').onclick = () => {
        document.getElementById('receipt-modal').classList.remove('flex');
        document.getElementById('receipt-modal').classList.add('hidden');
        state.cart = []; 
        render(); 
        showToast('Venta registrada con éxito ✓');
      };

    } catch (error) {
      console.error("Error procesando pago:", error);
      showToast('Error de conexión, intenta de nuevo', 'error');
      const btnConfirm = document.getElementById('pay-confirm');
      btnConfirm.textContent = 'Reintentar PAGO';
      btnConfirm.disabled = false; 
    }
  }

  function renderCashierHistory() {
    const mySales = records('sale').filter(s => s.cashier === (state.currentUser?.username || ''));
    const todayMySales = mySales.filter(s => state.sessionStart && s.date >= state.sessionStart);
    
    const myFlows = records('movement').filter(m => m.cashier === (state.currentUser?.username || '') && state.sessionStart && m.date >= state.sessionStart && m.category === 'cash_in');
    const abonosExtras = myFlows.filter(m => m.name === 'Cobro de Abono' || m.name === 'Abono de Cliente').reduce((a, m) => a + (m.amount || 0), 0);

    const ticketMap = new Map();
    todayMySales.forEach(s => { 
        const tId = s.ticket_num || s.id;
        if (!ticketMap.has(tId)) {
          ticketMap.set(tId, {
            id: s.id, 
            ticket_num: s.ticket_num,
            tracking_number: s.tracking_number, 
            is_invoiceable: s.is_invoiceable === true || String(s.is_invoiceable) === 'true', 
            is_credit: s.is_credit,
            debt: s.debt || 0,
            cash_part: s.cash_part !== undefined ? s.cash_part : (s.payment_method === 'Efectivo' ? s.total : 0),
            transfer_part: s.transfer_part !== undefined ? s.transfer_part : (s.payment_method === 'Transfer' ? s.total : 0),
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
    const ingresosTurno = groupedSales.reduce((sum, t) => sum + t.cash_part + t.transfer_part, 0) + abonosExtras;

    posContent.innerHTML = `
    <div class="p-4 fade-in space-y-4 max-w-5xl mx-auto">
      <h2 class="text-xl font-bold">Historial y Cobros del Turno</h2>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        
        <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
          <div class="text-muted text-sm font-semibold">Ingresos Reales (Turno)</div>
          <div class="text-2xl font-black text-success mt-1">${currency(ingresosTurno)}</div>
          <div class="text-[10px] text-muted leading-tight mt-1">Dinero recibido: Ventas pagadas + Abonos</div>
        </div>
        
        <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm hidden lg:block">
          <div class="text-muted text-sm font-semibold">Mercancía Entregada</div>
          <div class="text-2xl font-bold text-txt mt-1">${currency(todayMySales.reduce((a, s) => a + (s.total || 0), 0))}</div>
          <div class="text-[10px] text-muted leading-tight mt-1">Valor de todos los productos (Incluye deudas)</div>
        </div>

        <div class="bg-surface rounded-xl p-4 border border-card text-center shadow-sm">
          <div class="text-muted text-sm font-semibold">Tickets Generados</div>
          <div class="text-2xl font-bold text-accent mt-1">${groupedSales.length}</div>
          <div class="text-[10px] text-muted leading-tight mt-1">Operaciones en mostrador</div>
        </div>

      </div>
      <div class="bg-surface rounded-xl border border-card overflow-x-auto shadow-sm">
        <table class="w-full text-sm">
          <thead><tr class="text-muted text-left border-b border-card"><th class="p-3">Hora</th><th class="p-3">Ticket</th><th class="p-3">Artículos</th><th class="p-3">Cobrado / Total</th><th class="p-3">Pago</th><th class="p-3 text-center">Acciones</th></tr></thead>
          <tbody>
            ${groupedSales.map(t => `
              <tr class="border-b border-card/50 hover:bg-card/30 transition">
                <td class="p-3 text-muted">${t.date ? new Date(t.date).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td class="p-3 font-bold text-accent">#${t.ticket_num || 'S/N'}</td>
                <td class="p-3">
                  <div class="text-xs text-muted max-w-[250px] truncate" title="${t.raw_sales.map(i => `${i.quantity || 1}x ${i.name || 'Producto'}`).join('\n')}">
                    ${t.raw_sales.map(i => `<span class="font-bold">${i.quantity || 1}x</span> ${i.name || 'Producto'}`).join(', ')}
                  </div>
                </td>
                
                <td class="p-3">
                  ${t.is_credit ? `
                    <div class="font-black text-success">${currency(t.cash_part + t.transfer_part)} <span class="text-[10px] text-muted font-normal">Abono Inicial</span></div>
                    <div class="text-danger text-[11px] font-bold mt-0.5">Resta: ${currency(t.debt)}</div>
                    <div class="text-muted text-[10px] mt-0.5">Valor Total: ${currency(t.order_total)}</div>
                  ` : `
                    <div class="font-semibold text-txt">${currency(t.order_total)}</div>
                  `}
                </td>
                <td class="p-3"><span class="text-[10px] px-2 py-1 rounded-lg font-bold ${t.payment_method === 'Efectivo' ? 'bg-success/20 text-success' : t.payment_method === 'Crédito' ? 'bg-warn/20 text-warn' : 'bg-accent/20 text-accent'}">${t.payment_method || '-'}</span></td>

                <td class="p-3 text-center flex items-center justify-center gap-1 flex-wrap">
                
                ${t.is_invoiceable 
                  ? `<span class="text-[10px] px-2 py-1 bg-success/10 text-success border border-success/20 rounded-lg font-bold whitespace-nowrap" title="Requiere Factura">✅ Facturable</span>` 
                  : `<span class="text-[10px] px-2 py-1 bg-card text-muted border border-card rounded-lg font-bold whitespace-nowrap" title="Venta de mostrador">❌ No Facturable</span>`
                }

                <button type="button" data-view-ticket="${t.id}" class="p-2 bg-accent/10 hover:bg-accent/20 rounded-lg transition text-accent" title="Ver Ticket">
                  <i data-lucide="receipt" class="w-4 h-4 pointer-events-none"></i>
                </button>
                  
                  <button type="button" onclick="window.requestEdit('${t.id}')" class="p-2 bg-warn/10 text-warn rounded-lg hover:bg-warn/20 transition" title="Editar Ticket">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 pointer-events-none">
                      <line x1="18" y1="2" x2="22" y2="6"/>
                      <path d="M7.5 20.5 2 22l1.5-5.5L17 3l4 4L7.5 20.5z"/>
                    </svg>
                  </button>
                  <button type="button" onclick="window.requestRefund('${t.id}')" class="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition" title="Cancelar Ticket Completo">
                    <i data-lucide="rotate-ccw" class="w-4 h-4 pointer-events-none"></i>
                  </button>
                </td>
              </tr>`).join('') || '<tr><td colspan="6" class="p-8 text-center text-muted">Sin ventas en este turno</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

    posContent.querySelectorAll('[data-view-ticket]').forEach(btn => {
      btn.onclick = () => {
        showTicketFromHistory(btn.dataset.viewTicket);
      };
    });
  }

  function showTicketFromHistory(saleId) {
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
    const isCredit = clickedSale.is_credit;
    const currentDebt = clickedSale.debt || 0;
    
    const totalPaid = isCredit ? (orderTotal - currentDebt) : (clickedSale.cash_received || clickedSale.total);
    const change = clickedSale.change_returned || 0;
    const paymentMethod = clickedSale.payment_method || 'Efectivo';
    const clientName = clickedSale.client_name || '';

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
      <div class="text-xs mt-1">
       <div class="font-bold">TICKET DE VENTA (COPIA)</div>
       <div class="font-bold">Sucursal Principal</div>
       <div class="font-bold">Av. primavera#40 Barrio Yalchivol</div>
       <div class="font-bold mt-1">${dateTime}</div>
       <div>TICKET #${ticketNum}</div>
       ${isCredit && clientName ? `<div>CLIENTE: ${clientName}</div>` : ''}
       ${trackingHtml}
      </div>
     </div>
     <div class="w-full border-t-2 border-dashed border-gray-400 mb-2"></div>
     <div class="w-full flex justify-between font-bold text-xs mb-1 text-black">
       <span>CANT</span>
       <span class="flex-1 ml-2">DESCRIPCIÓN</span>
       <span class="text-right w-16">IMPORTE</span>
     </div>
     <div class="w-full text-xs space-y-1 text-black">
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
      ${isCredit ? `
        <div class="flex justify-between"><span>TOTAL PAGADO:</span><span>${currency(totalPaid)}</span></div>
        <div class="flex justify-between font-bold text-sm mt-1 text-danger"><span>RESTA:</span><span>${currency(currentDebt)}</span></div>
      ` : paymentMethod === 'Mixto' ? `
        <div class="flex justify-between"><span>TRANSFERENCIA:</span><span>${currency(clickedSale.transfer_received)}</span></div>
        <div class="flex justify-between"><span>EFECTIVO:</span><span>${currency(clickedSale.cash_received)}</span></div>
        <div class="flex justify-between font-bold text-sm mt-1"><span>SU CAMBIO:</span><span>${currency(change)}</span></div>
      ` : `
        <div class="flex justify-between"><span>PAGÓ CON (${paymentMethod}):</span><span>${currency(totalPaid)}</span></div>
        <div class="flex justify-between font-bold text-sm mt-1"><span>SU CAMBIO:</span><span>${currency(change)}</span></div>
      `}
     </div>
     <div class="w-full border-t-2 border-dashed border-gray-400 mt-3 mb-2"></div>
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

  function renderCashierClose() {
    const mySales = records('sale').filter(s => s.cashier === (state.currentUser?.username || '') && state.sessionStart && s.date >= state.sessionStart);
    const salesTotal = mySales.reduce((a, s) => a + (s.total || 0), 0);
    
    const cashSales = mySales.reduce((a, s) => {
        if (s.cash_part !== undefined) return a + s.cash_part;
        if (s.payment_method === 'Efectivo') return a + (s.total || 0);
        return a;
    }, 0);
    
    const transferSales = mySales.reduce((a, s) => {
        if (s.transfer_part !== undefined) return a + s.transfer_part;
        if (s.payment_method === 'Transfer') return a + (s.total || 0);
        return a;
    }, 0);
    
    const myFlows = records('movement').filter(m => m.cashier === (state.currentUser?.username || '') && state.sessionStart && m.date >= state.sessionStart && (m.category === 'cash_in' || m.category === 'cash_out'));
    const cashInItems = myFlows.filter(m => m.category === 'cash_in');
    const cashOutItems = myFlows.filter(m => m.category === 'cash_out');
    const totalCashIn = cashInItems.reduce((a, m) => a + (m.amount || 0), 0);
    const totalCashOut = cashOutItems.reduce((a, m) => a + (m.amount || 0), 0);

    const expectedCash = state.initialCash + cashSales + totalCashIn - totalCashOut;

    posContent.innerHTML = `
    <div class="p-4 fade-in space-y-4 max-w-lg mx-auto">
      <h2 class="text-xl font-bold text-center">Corte de Caja</h2>
      <div class="bg-surface rounded-xl p-5 border border-card space-y-4 shadow-md">
        <div class="flex justify-between"><span class="text-muted">Fondo inicial:</span><span class="font-semibold">${currency(state.initialCash)}</span></div>
        <div class="flex justify-between"><span class="text-muted">Ventas de este turno:</span><span class="font-semibold text-success">${currency(salesTotal)}</span></div>
        <div class="border-t border-card pt-3 space-y-2">
          <div class="flex justify-between text-sm"><span class="text-muted">Efectivo cobrado:</span><span>${currency(cashSales)}</span></div>
          <div class="flex justify-between text-sm"><span class="text-muted">Transferencias cobradas:</span><span>${currency(transferSales)}</span></div>
        </div>
        
        ${(totalCashIn > 0 || totalCashOut > 0) ? `
        <div class="border-t border-card pt-3 space-y-3">
          ${totalCashIn > 0 ? `
          <div>
            <div class="flex justify-between text-sm mb-1"><span class="font-semibold text-txt">Entradas Extras:</span><span class="font-bold text-success">+${currency(totalCashIn)}</span></div>
            <div class="space-y-1 pl-3 border-l-2 border-success/30">
              ${cashInItems.map(m => `<div class="flex justify-between text-xs"><span class="text-muted truncate max-w-[200px]" title="${m.description}">${m.description}</span><span class="text-success font-medium">+${currency(m.amount)}</span></div>`).join('')}
            </div>
          </div>` : ''}
          
          ${totalCashOut > 0 ? `
          <div>
            <div class="flex justify-between text-sm mb-1"><span class="font-semibold text-txt">Salidas / Gastos:</span><span class="font-bold text-danger">-${currency(totalCashOut)}</span></div>
            <div class="space-y-1 pl-3 border-l-2 border-danger/30">
              ${cashOutItems.map(m => `<div class="flex justify-between text-xs"><span class="text-muted truncate max-w-[200px]" title="${m.description}">${m.description}</span><span class="text-danger font-medium">-${currency(m.amount)}</span></div>`).join('')}
            </div>
          </div>` : ''}
        </div>` : ''}

        <div class="border-t border-card pt-3 flex justify-between text-lg font-bold">
          <span>Efectivo total en caja esperado:</span><span class="text-accent">${currency(expectedCash)}</span>
        </div>
        <div>
          <label class="block text-sm text-muted mb-1">Efectivo en caja REAL (billetes y monedas):</label>
          <input id="real-cash" type="number" step="0.01" class="w-full bg-bg border border-card rounded-lg px-4 py-3 text-center text-xl font-bold focus:border-accent focus:outline-none" value="${expectedCash.toFixed(2)}">
        </div>
        <div id="diff-display" class="text-center text-sm font-semibold"></div>
        <button id="close-register" class="w-full bg-warn text-bg font-bold py-3 rounded-lg hover:opacity-90 transition flex justify-center items-center gap-2 mt-4 shadow-lg">
          <i data-lucide="lock" class="w-5 h-5"></i> Cerrar y Enviar WhatsApp
        </button>
      </div>
    </div>`;

    const realInput = document.getElementById('real-cash');
    const diffDisplay = document.getElementById('diff-display');
    function updateDiff() {
      const real = parseFloat(realInput.value) || 0;
      const diff = real - expectedCash;
      if (Math.abs(diff) < 0.01) diffDisplay.innerHTML = '<span class="text-success">✓ Sin diferencia (Caja cuadrada)</span>';
      else if (diff > 0) diffDisplay.innerHTML = `<span class="text-accent">Sobrante en caja: ${currency(diff)}</span>`;
      else diffDisplay.innerHTML = `<span class="text-danger">Faltante en caja: ${currency(Math.abs(diff))}</span>`;
    }
    realInput.oninput = updateDiff;
    updateDiff();

    document.getElementById('close-register').onclick = async () => {
      const btn = document.getElementById('close-register');
      btn.disabled = true; btn.textContent = 'Cerrando Caja...';
      
      const realCash = parseFloat(realInput.value) || 0;
      const diff = realCash - expectedCash;
      const currentSessionStart = state.sessionStart; 
      const userToClean = state.currentUser.username;

      try {
        if (defaultConfig.whatsapp_number) {
          const cleanNumber = String(defaultConfig.whatsapp_number).replace(/\D/g, ''); 
          if (cleanNumber) {
            const waCashInDetails = cashInItems.length > 0 ? cashInItems.map(m => `  + ${currency(m.amount)} (${m.description})`).join('%0A') + '%0A' : '';
            const waCashOutDetails = cashOutItems.length > 0 ? cashOutItems.map(m => `  - ${currency(m.amount)} (${m.description})`).join('%0A') + '%0A' : '';

            const waText = `*CORTE DE CAJA - ${bizName()}*%0A` +
              `Cajero: ${userToClean}%0A` +
              `Apertura: ${new Date(currentSessionStart || now()).toLocaleString('es-MX')}%0A` +
              `Cierre: ${new Date().toLocaleString('es-MX')}%0A` +
              `-------------------%0A` +
              `Fondo inicial: ${currency(state.initialCash)}%0A` +
              `Ventas Efectivo: ${currency(cashSales)}%0A` +
              `Ventas Transferencia: ${currency(transferSales)}%0A` +
              `-------------------%0A` +
              `Entradas Extras: ${currency(totalCashIn)}%0A` +
              waCashInDetails +
              `Salidas / Gastos: ${currency(totalCashOut)}%0A` +
              waCashOutDetails +
              `*Total Mercancía Vendida: ${currency(salesTotal)}*%0A` +
              `-------------------%0A` +
              `Efectivo Esperado: ${currency(expectedCash)}%0A` +
              `Efectivo Real: ${currency(realCash)}%0A` +
              `*Diferencia: ${currency(diff)}* ${diff >= 0 ? '✅' : '⚠️'}`;

            window.open(`https://wa.me/${cleanNumber}?text=${waText}`, '_blank');
          }
        }
      } catch (err) {
        console.error('Error al generar WhatsApp:', err);
      }

      await dbSdk.create({
        type: 'cash_close', name: userToClean || 'cajero', code: '', category: '', buy_price: 0, sell_price: 0, stock: 0, min_stock: 0,
        quantity: mySales.length, total: salesTotal, payment_method: '', cashier: userToClean || '', date: now(), amount: diff,
        description: `Inicial: ${state.initialCash}, Ventas Efe: ${cashSales}, Entradas: ${totalCashIn}, Salidas: ${totalCashOut}, Real: ${realCash}`,
        status: 'closed', initial_cash: state.initialCash, final_cash: realCash, sales_total: salesTotal
      });
      
      const liveUser = records('user').find(u => u.name === userToClean);
      if (liveUser) {
        await dbSdk.update({ ...liveUser, session_open: false, session_start: null, initial_cash: 0 });
      }

      state.cashRegisterOpen = false; 
      state.cart = []; 
      state.currentView = 'login';
      
      localStorage.removeItem(`pos_register_open_${userToClean}`);
      localStorage.removeItem(`pos_initial_cash_${userToClean}`);
      localStorage.removeItem(`pos_session_start_${userToClean}`);
      localStorage.removeItem('pos_user'); 
      localStorage.setItem('pos_view', 'login');
      
      state.currentUser = null; 
      state.sessionStart = null;
      
      showToast('Caja cerrada correctamente');
      setTimeout(() => render(), 500);
    };
  }

  renderTabContent();
}
