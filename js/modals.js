// ========== MODALS & HANDLERS ==========
import { 
  state, 
  defaultConfig, 
  currency, 
  showToast, 
  records, 
  genId, 
  now 
} from "./state.js";
import { dbSdk } from "./firebase.js";
import { render } from "./main.js";

// === 1. LÓGICA DE IMPRESIÓN DE CÓDIGOS DE BARRAS ===
window.printBarcode = (id) => {
  const prod = state.allRecords.find(r => r.id === id);
  if (!prod || !prod.code) {
    return showToast('Este producto no tiene código registrado', 'warn');
  }
  
  document.getElementById('barcode-prod-name').textContent = prod.name;
  document.getElementById('barcode-prod-price').textContent = currency(prod.sell_price);

  JsBarcode("#barcode-svg", prod.code, {
    format: "CODE128",
    lineColor: "#000",
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 16,
    margin: 10
  });
  
  const modal = document.getElementById('barcode-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

const btnPrintBarcode = document.getElementById('btn-print-barcode');
if (btnPrintBarcode) {
  btnPrintBarcode.onclick = () => {
    document.body.classList.add('printing-barcode');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-barcode'), 1000);
  };
}

const btnBarcodeClose = document.getElementById('barcode-close');
if (btnBarcodeClose) {
  btnBarcodeClose.onclick = () => {
    document.getElementById('barcode-modal').classList.add('hidden');
    document.getElementById('barcode-modal').classList.remove('flex');
  };
}

// === 2. LÓGICA DE VENTA A GRANEL ===
window.openBulkModal = () => {
  document.getElementById('bulk-name').value = '';
  document.getElementById('bulk-price').value = '';
  
  const bms = records('bulk_material').filter(b => b.stock > 0);
  const bmContainer = document.getElementById('bulk-materials-container');
  const bmList = document.getElementById('bulk-materials-list');

  if (bms.length > 0) {
     bmContainer.classList.remove('hidden');
     bmList.innerHTML = bms.map(b => `
        <label class="flex items-center gap-3 bg-card p-2.5 rounded-lg cursor-pointer border border-transparent hover:border-accent transition text-txt">
           <input type="radio" name="bulk_mat_check" value="${b.id}" class="w-5 h-5 text-accent bg-surface border-card focus:ring-accent">
           <span class="text-sm font-medium flex-1">${b.name}</span>
           <span class="text-xs bg-surface px-2 py-1 rounded-full text-muted">Stock: ${b.stock}</span>
        </label>
     `).join('');
  } else {
     bmContainer.classList.add('hidden');
     bmList.innerHTML = '';
  }

  const modal = document.getElementById('bulk-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('bulk-name').focus(), 100);
};

const btnBulkCancel = document.getElementById('bulk-cancel');
if (btnBulkCancel) {
  btnBulkCancel.onclick = () => {
    document.getElementById('bulk-modal').classList.add('hidden');
    document.getElementById('bulk-modal').classList.remove('flex');
  };
}

const formBulk = document.getElementById('bulk-form');
if (formBulk) {
  formBulk.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('bulk-name').value.trim();
    const price = parseFloat(document.getElementById('bulk-price').value);

    if (!name || isNaN(price) || price <= 0) return showToast('Ingresa datos válidos', 'warn');

    const checkedBms = document.querySelectorAll('input[name="bulk_mat_check"]:checked');
    if (checkedBms.length === 0) {
      return showToast('Debes seleccionar un empaque', 'error');
    }
    if (checkedBms.length > 1) {
      return showToast('Solo puedes seleccionar UN empaque por venta', 'warn');
    }

    state.cart.push({
      id: 'bulk_' + genId(),
      name: name + ' (Granel)',
      sell_price: price,
      buy_price: 0,
      qty: 1,
      maxStock: 999999 
    });

    checkedBms.forEach(chk => {
       const bm = state.allRecords.find(r => r.id === chk.value);
       if (bm) {
           const existing = state.cart.find(c => c.id === bm.id);
           if (existing) {
               existing.qty++;
           } else {
               state.cart.push({
                  id: bm.id,
                  name: `Empaque: ${bm.name}`,
                  sell_price: 0, 
                  buy_price: 0,
                  qty: 1,
                  maxStock: bm.stock
               });
           }
       }
    });

    showToast(`${name} y empaques agregados`, 'success');
    document.getElementById('bulk-modal').classList.add('hidden');
    document.getElementById('bulk-modal').classList.remove('flex');
    
    if (state.currentView === 'cashier-pos') render(); 
  };
}

// === 3. LÓGICA DE ENTRADAS Y SALIDAS DE STOCK ===
window.openStockModal = (id, type) => {
  const prod = state.allRecords.find(r => r.id === id);
  if (!prod) return;
  state.activeStockAction = { id, type, prod };
  
  document.getElementById('stock-prod-name').textContent = prod.name;
  document.getElementById('stock-qty').value = '';
  document.getElementById('stock-reason').value = '';
  
  const title = document.getElementById('stock-title');
  const btn = document.getElementById('stock-confirm');
  
  if (type === 'in') {
    title.textContent = 'Registrar ENTRADA (+)';
    title.className = 'text-xl font-bold mb-4 text-success';
    btn.className = 'px-5 py-2 rounded-lg text-bg font-bold transition bg-success hover:opacity-90';
  } else {
    title.textContent = 'Registrar SALIDA (-)';
    title.className = 'text-xl font-bold mb-4 text-danger';
    btn.className = 'px-5 py-2 rounded-lg text-white font-bold transition bg-danger hover:opacity-90';
  }
  
  const modal = document.getElementById('stock-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('stock-qty').focus(), 100);
};

const btnStockCancel = document.getElementById('stock-cancel');
if (btnStockCancel) {
  btnStockCancel.onclick = () => {
    document.getElementById('stock-modal').classList.add('hidden');
    document.getElementById('stock-modal').classList.remove('flex');
  };
}

const btnStockConfirm = document.getElementById('stock-confirm');
if (btnStockConfirm) {
  btnStockConfirm.onclick = () => {
    const qty = parseFloat(document.getElementById('stock-qty').value);
    const reason = document.getElementById('stock-reason').value.trim() || (state.activeStockAction.type === 'in' ? 'Entrada manual' : 'Salida manual / Merma');
    
    if (!qty || qty <= 0) return showToast('Ingresa una cantidad mayor a 0', 'warn');
    
    const prod = state.activeStockAction.prod;
    let newStock = Number(prod.stock);
    
    if (state.activeStockAction.type === 'in') {
      newStock += qty;
    } else {
      if (qty > prod.stock) return showToast(`Solo hay ${prod.stock} unidades disponibles`, 'error');
      newStock -= qty;
    }

    const btn = document.getElementById('stock-confirm');
    btn.disabled = true; btn.textContent = 'Guardando...';

    const idx = state.allRecords.findIndex(r => r.id === prod.id);
    if (idx > -1) state.allRecords[idx].stock = newStock;

    dbSdk.update({ ...prod, stock: newStock });
    dbSdk.create({
      type: 'movement', name: prod.name, code: prod.code, category: state.activeStockAction.type,
      quantity: qty, total: newStock, cashier: state.currentUser?.username || 'admin',
      description: reason, date: now(), buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, payment_method: '', status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0, amount: 0
    });

    showToast(`Stock actualizado a ${newStock} uds`);
    
    document.getElementById('stock-modal').classList.add('hidden');
    document.getElementById('stock-modal').classList.remove('flex');
    btn.disabled = false; btn.textContent = 'Confirmar';
    
    if (state.currentView === 'admin-inventory' && window.refreshInventoryViews) {
         window.refreshInventoryViews();
    }
  };
}

// === 4. LÓGICA DE DEVOLUCIONES Y EDICIÓN (CON PIN) ===
window.requestRefund = (saleId) => {
  state.activeRefundSaleId = saleId;
  state.activeAdminAction = 'refund';
  const modal = document.getElementById('pin-modal');
  const input = document.getElementById('admin-pin-input');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  input.value = '';
  setTimeout(() => input.focus(), 100);
};

window.requestEdit = (saleId) => {
  state.activeRefundSaleId = saleId;
  state.activeAdminAction = 'edit';
  const modal = document.getElementById('pin-modal');
  const input = document.getElementById('admin-pin-input');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  input.value = '';
  setTimeout(() => input.focus(), 100);
};

const btnPinCancel = document.getElementById('pin-cancel');
if (btnPinCancel) {
  btnPinCancel.onclick = () => {
    document.getElementById('pin-modal').classList.add('hidden');
    document.getElementById('pin-modal').classList.remove('flex');
    state.activeRefundSaleId = null;
    state.activeAdminAction = null;
  };
}

const btnPinConfirm = document.getElementById('pin-confirm');
if (btnPinConfirm) {
  btnPinConfirm.onclick = () => { 
    const input = document.getElementById('admin-pin-input');
    const btnConfirm = document.getElementById('pin-confirm');

    if (input.value === defaultConfig.admin_pin) {
      if (!state.activeRefundSaleId) return;
      
      const clickedSale = state.allRecords.find(r => r.id === state.activeRefundSaleId);
      if (!clickedSale) { showToast('Venta no encontrada', 'error'); return; }

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Procesando...';

      const salesToRefund = clickedSale.ticket_num 
        ? state.allRecords.filter(r => r.type === 'sale' && r.ticket_num === clickedSale.ticket_num)
        : [clickedSale];

      for (const s of salesToRefund) {
           const itemsList = s.items ? s.items : [s];
           
           for (const item of itemsList) {
             const record = state.allRecords.find(r => r.id === item.id || (r.type === 'product' && r.name === item.name));
             if (record && (record.type === 'product' || record.type === 'bulk_material')) {
               record.stock = Number(record.stock) + Number(item.quantity || 1);
               dbSdk.update(record);
             }
           }
           
           dbSdk.delete(s); 
           const saleIdx = state.allRecords.findIndex(r => r.id === s.id);
           if (saleIdx > -1) state.allRecords.splice(saleIdx, 1);
      }

      if (clickedSale.ticket_num) {
          const abonosToDelete = state.allRecords.filter(r => r.type === 'movement' && r.category === 'cash_in' && r.description && r.description.includes(`#${clickedSale.ticket_num}`));
          for (const abono of abonosToDelete) {
              dbSdk.delete(abono);
              const abIdx = state.allRecords.findIndex(x => x.id === abono.id);
              if (abIdx > -1) state.allRecords.splice(abIdx, 1);
          }
      }

      if (state.activeAdminAction === 'edit') {
         state.cart = []; 
         const itemsToLoad = clickedSale.items ? clickedSale.items : salesToRefund;
         
         itemsToLoad.forEach(item => {
            const record = state.allRecords.find(r => r.id === item.id || (r.type === 'product' && r.name === item.name));
            state.cart.push({
               id: item.id || genId(),
               name: item.name,
               sell_price: Number(item.sell_price) || (Number(item.total) / Number(item.quantity || 1)),
               buy_price: 0,
               qty: Number(item.quantity) || 1,
               maxStock: record ? Number(record.stock) : 999999 
            });
         });

         showToast('Ticket cargado. Edita y vuelve a cobrar.', 'info');
         state.currentView = 'cashier-pos';
         localStorage.setItem('pos_view', state.currentView);
      } else {
         showToast('Ticket cancelado. Stock restaurado.', 'success');
      }
      
      document.getElementById('pin-modal').classList.add('hidden');
      document.getElementById('pin-modal').classList.remove('flex');
      
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'Confirmar';
      state.activeRefundSaleId = null;
      state.activeAdminAction = null;

      render();
    } else {
      showToast('Clave incorrecta', 'error');
      input.value = ''; input.focus();
    }
  };
}

// === 5. LÓGICA DE DESCUENTOS ===
window.openDiscountModal = () => {
  const realItems = state.cart.filter(i => !String(i.id).startsWith('desc_'));
  if (realItems.length === 0) return showToast('Agrega productos antes de aplicar un descuento', 'warn');
  
  document.getElementById('desc-value').value = '';
  document.getElementById('discount-modal').classList.remove('hidden');
  document.getElementById('discount-modal').classList.add('flex');
  setTimeout(() => document.getElementById('desc-value').focus(), 100);
};

window.setDiscountType = (type) => {
  state.activeDiscountType = type;
  const btnPct = document.getElementById('desc-type-percent');
  const btnAmt = document.getElementById('desc-type-amount');
  const label = document.getElementById('desc-label');

  if (type === 'percent') {
    btnPct.className = 'flex-1 py-2 rounded-lg bg-accent text-white font-bold transition';
    btnAmt.className = 'flex-1 py-2 rounded-lg bg-card text-muted hover:bg-surface transition';
    label.textContent = 'Porcentaje a descontar (%)';
  } else {
    btnAmt.className = 'flex-1 py-2 rounded-lg bg-accent text-white font-bold transition';
    btnPct.className = 'flex-1 py-2 rounded-lg bg-card text-muted hover:bg-surface transition';
    label.textContent = 'Monto directo a descontar ($)';
  }
};

window.applyDiscount = () => {
  const val = parseFloat(document.getElementById('desc-value').value);
  
  if (isNaN(val) || val <= 0) {
    showToast('Ingresa un valor válido', 'warn');
    return;
  }

  state.cart = state.cart.filter(i => !String(i.id).startsWith('desc_'));
  const subtotal = state.cart.reduce((suma, item) => suma + (item.sell_price * item.qty), 0);
  let discountAmount = 0;

  if (state.activeDiscountType === 'percent') {
    if (val > 100) {
      showToast('No puedes descontar más del 100%', 'warn');
      return;
    }
    discountAmount = subtotal * (val / 100);
  } else {
    if (val > subtotal) {
      showToast('El descuento no puede superar el total a pagar', 'warn');
      return;
    }
    discountAmount = val;
  }

  state.cart.push({
    id: 'desc_' + genId(),
    name: `Descuento (${state.activeDiscountType === 'percent' ? val + '%' : '$' + val.toFixed(2)})`,
    sell_price: -discountAmount,
    buy_price: 0,
    qty: 1,
    maxStock: 999999
  });

  window.closeDiscountModal();
  showToast('Descuento aplicado', 'success');
  render(); 
};

window.closeDiscountModal = () => {
  const modal = document.getElementById('discount-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// === 6. LÓGICA DE MOVIMIENTOS EXTRA A CAJA ===
window.openCashMovementModal = (type) => {
  state.activeCashFlowType = type;
  const title = document.getElementById('cash-flow-title');
  const inputAmt = document.getElementById('cash-flow-amount');
  const inputReason = document.getElementById('cash-flow-reason');
  const btnConfirm = document.getElementById('cash-flow-confirm');

  inputAmt.value = '';
  inputReason.value = '';

  if (type === 'in') {
    title.innerHTML = '<i data-lucide="arrow-down-to-line" class="text-success w-6 h-6"></i> <span class="text-success">Entrada a Caja</span>';
    inputAmt.className = 'w-full bg-bg border border-success/30 rounded-xl px-4 py-3 text-3xl font-bold focus:border-success focus:outline-none text-center text-success';
    inputReason.className = 'w-full bg-bg border border-success/30 rounded-xl px-4 py-3 text-sm focus:border-success focus:outline-none';
    btnConfirm.className = 'flex-1 bg-success text-white font-bold py-3 rounded-xl hover:opacity-90 transition shadow-lg shadow-success/20';
  } else {
    title.innerHTML = '<i data-lucide="arrow-up-from-line" class="text-danger w-6 h-6"></i> <span class="text-danger">Salida de Caja</span>';
    inputAmt.className = 'w-full bg-bg border border-danger/30 rounded-xl px-4 py-3 text-3xl font-bold focus:border-danger focus:outline-none text-center text-danger';
    inputReason.className = 'w-full bg-bg border border-danger/30 rounded-xl px-4 py-3 text-sm focus:border-danger focus:outline-none';
    btnConfirm.className = 'flex-1 bg-danger text-white font-bold py-3 rounded-xl hover:opacity-90 transition shadow-lg shadow-danger/20';
  }

  lucide.createIcons();
  document.getElementById('cash-flow-modal').classList.remove('hidden');
  document.getElementById('cash-flow-modal').classList.add('flex');
  setTimeout(() => inputAmt.focus(), 100);
};

const btnCashFlowCancel = document.getElementById('cash-flow-cancel');
if (btnCashFlowCancel) {
  btnCashFlowCancel.onclick = () => {
    document.getElementById('cash-flow-modal').classList.add('hidden');
    document.getElementById('cash-flow-modal').classList.remove('flex');
  };
}

const formCashFlow = document.getElementById('cash-flow-form');
if (formCashFlow) {
  formCashFlow.onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('cash-flow-amount').value);
    const reason = document.getElementById('cash-flow-reason').value.trim();

    if (!amount || amount <= 0 || !reason) return showToast('Completa los campos', 'warn');

    const btn = document.getElementById('cash-flow-confirm');
    btn.disabled = true; btn.textContent = 'Guardando...';

    const newRecord = {
      type: 'movement',
      category: state.activeCashFlowType === 'in' ? 'cash_in' : 'cash_out',
      amount: amount,
      description: reason,
      date: now(),
      cashier: state.currentUser?.username || 'admin',
      name: state.activeCashFlowType === 'in' ? 'Entrada Extra a Caja' : 'Salida de Caja / Gasto',
      quantity: 0, total: 0, buy_price: 0, sell_price: 0, stock: 0, min_stock: 0, payment_method: 'Efectivo', status: 'active', initial_cash: 0, final_cash: 0, sales_total: 0
    };

    await dbSdk.create(newRecord);
    
    document.getElementById('cash-flow-modal').classList.add('hidden');
    document.getElementById('cash-flow-modal').classList.remove('flex');
    showToast(state.activeCashFlowType === 'in' ? 'Entrada registrada' : 'Salida registrada', 'success');
    
    btn.disabled = false;
    
    if (window.updateCashBadge) window.updateCashBadge();
    if (state.currentView === 'cashier-close') render(); 
  };
}

// === 7. LÓGICA PARA CAMBIAR PRECIOS MANUALMENTE ===
window.openCustomPriceModal = (index) => {
  state.activeCustomPriceIndex = index;
  const item = state.cart[index];
  
  document.getElementById('cp-original').textContent = currency(item.normal_price || item.sell_price);
  document.getElementById('cp-new-price').value = item.sell_price;
  
  const modal = document.getElementById('custom-price-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
  
  setTimeout(() => {
    const input = document.getElementById('cp-new-price');
    input.focus();
    input.select();
  }, 100);
};

const btnCpCancel = document.getElementById('cp-cancel');
if (btnCpCancel) {
  btnCpCancel.onclick = () => {
    document.getElementById('custom-price-modal').classList.add('hidden');
    document.getElementById('custom-price-modal').classList.remove('flex');
  };
}

const formCp = document.getElementById('custom-price-form');
if (formCp) {
  formCp.onsubmit = (e) => {
    e.preventDefault();
    const newPrice = parseFloat(document.getElementById('cp-new-price').value);
    
    if (isNaN(newPrice) || newPrice < 0) return showToast('Ingresa un precio válido', 'warn');
    
    state.cart[state.activeCustomPriceIndex].sell_price = newPrice;
    
    document.getElementById('custom-price-modal').classList.add('hidden');
    document.getElementById('custom-price-modal').classList.remove('flex');
    
    if (state.currentView === 'cashier-pos') render(); 
    showToast('Precio actualizado', 'success');
  };
}

// === 8. LÓGICA PARA AJUSTAR PESO/CANTIDAD MANUALMENTE ===
window.openCustomQtyModal = (index) => {
  state.activeCustomQtyIndex = index;
  const item = state.cart[index];
  
  document.getElementById('cq-original').textContent = item.qty;
  document.getElementById('cq-new-qty').value = item.qty;
  
  const modal = document.getElementById('custom-qty-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lucide.createIcons();
  
  setTimeout(() => {
    const input = document.getElementById('cq-new-qty');
    input.focus();
    input.select();
  }, 100);
};

const btnCqCancel = document.getElementById('cq-cancel');
if (btnCqCancel) {
  btnCqCancel.onclick = () => {
    document.getElementById('custom-qty-modal').classList.add('hidden');
    document.getElementById('custom-qty-modal').classList.remove('flex');
  };
}

const formCq = document.getElementById('custom-qty-form');
if (formCq) {
  formCq.onsubmit = (e) => {
    e.preventDefault();
    const newQty = parseFloat(document.getElementById('cq-new-qty').value);
    
    if (isNaN(newQty) || newQty <= 0) return showToast('Ingresa un peso válido', 'warn');
    
    if (state.cart[state.activeCustomQtyIndex].maxStock !== 999999 && newQty > state.cart[state.activeCustomQtyIndex].maxStock) {
        return showToast(`Stock insuficiente. Tienes ${state.cart[state.activeCustomQtyIndex].maxStock} kg disponibles`, 'error');
    }
    
    state.cart[state.activeCustomQtyIndex].qty = newQty;
    
    document.getElementById('custom-qty-modal').classList.add('hidden');
    document.getElementById('custom-qty-modal').classList.remove('flex');
    
    if (state.currentView === 'cashier-pos') render();
    showToast('Peso actualizado', 'success');
  };
}
