// ========== FIREBASE SETUP & SDK ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { showToast, state } from "./state.js";

const firebaseConfig = {
  apiKey: "AIzaSyDfIuutWzdYTItGVVek2NM1JkQeeCfaLLs",
  authDomain: "tolucapos-e16fd.firebaseapp.com",
  projectId: "tolucapos-e16fd",
  storageBucket: "tolucapos-e16fd.firebasestorage.app",
  messagingSenderId: "968534499689",
  appId: "1:968534499689:web:6744f913a6e40bd9d8ddf8",
  measurementId: "G-842S9DFRDD"
};

const firebaseApp = initializeApp(firebaseConfig);
const analytics = getAnalytics(firebaseApp);

const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Función para enrutar a las colecciones correctas en Firestore
function getColeccion(tipo) {
  const map = {
    'product': 'productos',
    'sale': 'ventas',
    'expense': 'egresos',
    'user': 'usuarios',
    'movement': 'movimientos',
    'cash_close': 'cortes_caja',
    'category': 'categorias',
    'config': 'configuracion',
    'sys_file': 'archivos_sistema',
    'bulk_material': 'insumos_granel',
    'client': 'clientes' 
  };
  return map[tipo] || 'registros_generales';
}

const dbSdk = {
  async create(data) {
    try {
      const promesa = addDoc(collection(db, getColeccion(data.type)), data);
      if (!navigator.onLine) {
        showToast('Guardado localmente', 'warn');
        return { isOk: true }; 
      }
      await promesa;
      return { isOk: true };
    } catch (e) {
      console.error("Error creando doc: ", e);
      return { isOk: false };
    }
  },
  async update(data) {
    try {
      const d = { ...data };
      const id = d.id;
      delete d.id;
      const promesa = updateDoc(doc(db, getColeccion(d.type), id), d);
      if (!navigator.onLine) return { isOk: true };
      await promesa;
      return { isOk: true };
    } catch (e) {
      console.error("Error actualizando doc: ", e);
      return { isOk: false };
    }
  },
  async delete(data) {
    try {
      const promesa = deleteDoc(doc(db, getColeccion(data.type), data.id));
      if (!navigator.onLine) return { isOk: true };
      await promesa;
      return { isOk: true };
    } catch (e) {
      console.error("Error borrando doc: ", e);
      return { isOk: false };
    }
  }
};

async function cargarMesFirebase(y, m) {
  const monthKey = `${y}-${m}`;
  if (state.loadedMonthsCache.has(monthKey)) return;

  try {
    const startStr = new Date(y, m, 1).toISOString();
    const endStr = new Date(y, m + 1, 1).toISOString();
    
    const qS = query(collection(db, 'ventas'), where('date', '>=', startStr), where('date', '<', endStr));
    const qE = query(collection(db, 'egresos'), where('date', '>=', startStr), where('date', '<', endStr));
    const qM = query(collection(db, 'movimientos'), where('date', '>=', startStr), where('date', '<', endStr));

    const [snapS, snapE, snapM] = await Promise.all([getDocs(qS), getDocs(qE), getDocs(qM)]);

    [...snapS.docs, ...snapE.docs, ...snapM.docs].forEach(docSnap => {
      const docData = { id: docSnap.id, ...docSnap.data() };
      if (docData.ticket_num) {
        const fIdx = state.allRecords.findIndex(r => r.id.startsWith('temp_') && r.ticket_num === docData.ticket_num);
        if (fIdx > -1) state.allRecords.splice(fIdx, 1);
      }
      if (!state.allRecords.find(r => r.id === docData.id)) state.allRecords.push(docData);
    });
    state.loadedMonthsCache.add(monthKey);
  } catch (err) {
    console.error("Error descargando historial:", err);
  }
}

export { 
  db, 
  dbSdk, 
  getColeccion, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  cargarMesFirebase
};
