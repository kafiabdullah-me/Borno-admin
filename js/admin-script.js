/**
 * Borno Admin Panel - Pro Logic (UX Optimized)
 */

const firebaseConfig = {
    apiKey: "AIzaSyBlQhB3ZcsRWq7evEPntrpNVyyE2Pl7gkk",
    authDomain: "borno-8c445.firebaseapp.com",
    projectId: "borno-8c445",
    storageBucket: "borno-8c445.firebasestorage.app",
    messagingSenderId: "842315974308",
    appId: "1:842315974308:web:748ba8da2700c578284831",
    measurementId: "G-F0CCKD6B12"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// --- DOM ELEMENTS ---
const authOverlay = document.getElementById('authOverlay');
const adminApp = document.getElementById('adminApp');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const adminSidebar = document.getElementById('adminSidebar');
const menuToggle = document.getElementById('menuToggle');
const prodModal = document.getElementById('prodModal');
const prodForm = document.getElementById('prodForm');

// --- AUTHENTICATION ---
googleLoginBtn.addEventListener('click', () => {
    auth.signInWithPopup(provider)
        .then(() => {
            authOverlay.style.display = 'none';
            adminApp.style.display = 'flex';
            initAdmin();
        })
        .catch(err => alert("Access Denied: " + err.message));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut().then(() => location.reload());
});

auth.onAuthStateChanged(user => {
    if (user) {
        authOverlay.style.display = 'none';
        adminApp.style.display = 'flex';
        document.getElementById('adminName').innerText = user.displayName;
        document.getElementById('adminAvatar').src = user.photoURL;
        initAdmin();
    }
});

// --- RESPONSIVE MENU LOGIC ---
menuToggle.addEventListener('click', () => {
    adminSidebar.classList.toggle('open');
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 &&
        !adminSidebar.contains(e.target) &&
        !menuToggle.contains(e.target)) {
        adminSidebar.classList.remove('open');
    }
});

// --- NAVIGATION ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');

        // UI Update
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');

        document.getElementById('currentPageTitle').innerText = item.innerText.trim();

        // Auto-close sidebar on mobile after selection
        if (window.innerWidth <= 1024) adminSidebar.classList.remove('open');
    });
});

// --- OVERVIEW STATS ---
async function updateOverview() {
    try {
        const pSnap = await db.collection('products').get();
        const oSnap = await db.collection('orders').get();
        const cSnap = await db.collection('categories').get();
        const uSnap = await db.collection('users').get();

        document.getElementById('statProducts').innerText = pSnap.size;
        document.getElementById('statOrders').innerText = oSnap.size;
        document.getElementById('statCats').innerText = cSnap.size;
        document.getElementById('statUsers').innerText = uSnap.size;

        let revenue = 0;
        oSnap.forEach(doc => revenue += Number(doc.data().total || 0));
        document.getElementById('statRevenue').innerText = revenue + " Tk";
    } catch (e) { console.error("Stats error:", e); }
}

// --- PRODUCT MANAGEMENT ---
async function loadProducts(filter = '') {
    try {
        const snapshot = await db.collection('products').get();
        const tbody = document.getElementById('prodTableBody');
        tbody.innerHTML = '';

        snapshot.forEach(doc => {
            const p = doc.data();
            if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${p.image || 'assets/placeholder.jpg'}"></td>
                <td><strong style="color:#1e293b">${p.name}</strong></td>
                <td>${p.category}</td>
                <td>${p.price} Tk</td>
                <td>${p.stock || 'N/A'}</td>
                <td class="action-btns">
                    <i class="fa fa-edit btn-edit" style="color:#3b82f6; cursor:pointer; margin-right:10px" onclick="editProduct('${doc.id}')"></i>
                    <i class="fa fa-trash btn-delete" style="color:#ef4444; cursor:pointer" onclick="deleteProduct('${doc.id}')"></i>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

document.getElementById('prodSearch').addEventListener('input', (e) => {
    loadProducts(e.target.value);
});

document.getElementById('addProdBtn').addEventListener('click', () => {
    prodForm.reset();
    document.getElementById('prodId').value = '';
    document.getElementById('modalTitle').innerText = 'Add New Product';
    prodModal.style.display = 'flex';
});

document.querySelector('.close-modal').addEventListener('click', () => {
    prodModal.style.display = 'none';
});

prodForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const data = {
        name: document.getElementById('fName').value,
        writer: document.getElementById('fWriter').value,
        category: document.getElementById('fCat').value,
        price: Number(document.getElementById('fPrice').value),
        image: document.getElementById('fImg').value || 'assets/placeholder.jpg'
    };
    try {
        if (id) await db.collection('products').doc(id).update(data);
        else await db.collection('products').add(data);
        prodModal.style.display = 'none';
        loadProducts();
        updateOverview();
    } catch (err) { alert(err.message); }
});

window.editProduct = async function(id) {
    const doc = await db.collection('products').doc(id).get();
    const p = doc.data();
    document.getElementById('prodId').value = id;
    document.getElementById('fName').value = p.name;
    document.getElementById('fWriter').value = p.writer;
    document.getElementById('fCat').value = p.category;
    document.getElementById('fPrice').value = p.price;
    document.getElementById('fImg').value = p.image;
    document.getElementById('modalTitle').innerText = 'Edit Product';
    prodModal.style.display = 'flex';
};

window.deleteProduct = async function(id) {
    if (confirm("Delete product?")) {
        await db.collection('products').doc(id).delete();
        loadProducts();
        updateOverview();
    }
};

// --- ORDERS MANAGEMENT ---
async function loadOrders() {
    try {
        const snapshot = await db.collection('orders').get();
        const tbody = document.getElementById('orderTableBody');
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const o = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${doc.id.slice(0,6)}</td>
                <td>${o.customerName}</td>
                <td>${o.total} Tk</td>
                <td>COD</td>
                <td><span class="status-badge" style="background:#e2e8f0; padding:4px 8px; border-radius:12px; font-size:12px">${o.status}</span></td>
                <td><button class="btn-sm" style="padding:5px 10px; border:none; border-radius:5px; cursor:pointer" onclick="updateStatus('${doc.id}')">Update</button></td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

window.updateStatus = async function(id) {
    const s = prompt("Status (Pending, Shipped, Delivered):");
    if (s) {
        await db.collection('orders').doc(id).update({ status: s });
        loadOrders();
    }
};

function initAdmin() {
    updateOverview();
    loadProducts();
    loadOrders();
}
