(() => {
    'use strict';

    window.addEventListener('load', async () => {
        if (!window.fb) {
            console.error("Firebase config missing");
            return;
        }

        const { auth, db, onAuthChange } = window.fb;
        const { collection, addDoc, getDocs, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } = window.fb.firestore;

        // --- 1. Navigation & Sidebar Logic ---
        const openNavBtn = document.getElementById('openNav');
        const closeNavBtn = document.getElementById('closeNav');
        const adminNav = document.getElementById('adminNav');
        const navItems = document.querySelectorAll('.nav-item');
        const pages = document.querySelectorAll('.admin-page');
        const pageTitle = document.getElementById('pageTitle');

        if (openNavBtn) {
            openNavBtn.addEventListener('click', () => adminNav.classList.add('open'));
        }
        if (closeNavBtn) {
            closeNavBtn.addEventListener('click', () => adminNav.classList.remove('open'));
        }

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');

                // Update active link
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Show page
                pages.forEach(p => p.classList.remove('active'));
                document.getElementById(`page-${pageId}`).classList.add('active');

                // Update title
                pageTitle.textContent = item.textContent;

                // Close nav on mobile
                if (window.innerWidth < 768) adminNav.classList.remove('open');
            });
        });

        // --- 2. Theme Management ---
        const themeDots = document.querySelectorAll('.theme-dot');

        async function applyTheme(theme) {
            document.body.classList.remove('light-mode');
            if (theme === 'light') {
                document.body.classList.add('light-mode');
            } else if (theme === 'system') {
                if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                    document.body.classList.add('light-mode');
                }
            }
            localStorage.setItem('admin-theme', theme);

            themeDots.forEach(dot => {
                dot.classList.remove('active');
                if (dot.getAttribute('data-theme') === theme) dot.classList.add('active');
            });
        }

        themeDots.forEach(dot => {
            dot.addEventListener('click', () => applyTheme(dot.getAttribute('data-theme')));
        });

        const savedTheme = localStorage.getItem('admin-theme') || 'dark';
        applyTheme(savedTheme);

        // --- 3. Authentication ---
        onAuthChange(user => {
            if (user) {
                document.getElementById('userName').textContent = user.displayName || 'Admin';
            } else {
                window.fb.signInWithGoogle().catch(err => console.error("Auth Error:", err));
            }
        });

        document.getElementById('adminLogout').addEventListener('click', () => {
            window.fb.signOut().then(() => window.location.reload());
        });

        // --- 4. Dashboard & Stats ---
        async function updateDashboard() {
            const prodSnap = await getDocs(collection(db, "products"));
            const orderSnap = await getDocs(collection(db, "orders"));

            document.getElementById('statProducts').textContent = prodSnap.size;
            document.getElementById('statOrders').textContent = orderSnap.size;

            let revenue = 0;
            orderSnap.forEach(doc => revenue += (doc.data().total || 0));
            document.getElementById('statRevenue').textContent = `Tk ${revenue}`;

            // Recent Orders
            const recentTbody = document.getElementById('recentOrdersTable');
            recentTbody.innerHTML = '';

            // Take last 5 orders
            const sortedOrders = orderSnap.docs
                .map(d => ({id: d.id, ...d.data()}))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);

            sortedOrders.forEach(o => {
                const row = `<tr><td>${o.id.slice(0,5)}...</td><td>${o.customer?.name || 'Guest'}</td><td>Tk ${o.total}</td><td>${o.status}</td></tr>`;
                recentTbody.innerHTML += row;
            });
        }

        // --- 5. Product Management (CRUD) ---
        const prodModal = document.getElementById('productModal');
        const prodForm = document.getElementById('productForm');

        document.getElementById('openProductModal').addEventListener('click', () => {
            prodForm.reset();
            document.getElementById('prodId').value = '';
            document.getElementById('modalTitle').textContent = 'Add Product';
            prodModal.classList.add('active');
        });

        document.getElementById('closeProductModal').addEventListener('click', () => prodModal.classList.remove('active'));

        prodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('prodId').value;
            const data = {
                name: document.getElementById('prodName').value,
                category: document.getElementById('prodCat').value,
                price: parseFloat(document.getElementById('prodPrice').value),
                stock: parseInt(document.getElementById('prodStock').value),
                image: document.getElementById('prodImg').value,
                description: document.getElementById('prodDesc').value,
                updatedAt: new Date().toISOString()
            };

            try {
                if (id) {
                    await updateDoc(doc(db, "products", id), data);
                } else {
                    data.createdAt = new Date().toISOString();
                    await addDoc(collection(db, "products"), data);
                }
                prodModal.classList.remove('active');
                loadProducts();
            } catch (err) { alert("Error saving product!"); }
        });

        function loadProducts() {
            onSnapshot(collection(db, "products"), snap => {
                const tbody = document.getElementById('productsTable');
                tbody.innerHTML = '';
                snap.forEach(d => {
                    const p = d.data();
                    tbody.innerHTML += `
                        <tr>
                            <td><div class="ph" style="width:40px; height:40px; background:url('${p.image}') center/cover"></div></td>
                            <td>${p.name}</td>
                            <td>Tk ${p.price}</td>
                            <td>${p.stock}</td>
                            <td>
                                <button class="qty-btn" onclick="editProd('${d.id}')">Edit</button>
                                <button class="qty-btn" onclick="delProd('${d.id}')" style="color:var(--admin-accent)">Del</button>
                            </td>
                        </tr>`;
                });
            });
        }

        window.editProd = async (id) => {
            const snap = await getDocs(query(collection(db, "products"), where("__name__", "==", id)));
            if (snap.empty) return;
            const p = snap.docs[0].data();
            document.getElementById('prodId').value = id;
            document.getElementById('prodName').value = p.name;
            document.getElementById('prodCat').value = p.category;
            document.getElementById('prodPrice').value = p.price;
            document.getElementById('prodStock').value = p.stock;
            document.getElementById('prodImg').value = p.image;
            document.getElementById('prodDesc').value = p.description;
            document.getElementById('modalTitle').textContent = 'Edit Product';
            prodModal.classList.add('active');
        };

        window.delProd = async (id) => {
            if (confirm("Delete product?")) await deleteDoc(doc(db, "products", id));
        };

        // --- 6. Category Management ---
        const catModal = document.getElementById('categoryModal');
        document.getElementById('openCatModal').addEventListener('click', () => catModal.classList.add('active'));
        document.getElementById('closeCatModal').addEventListener('click', () => catModal.classList.remove('active'));

        document.getElementById('categoryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await addDoc(collection(db, "categories"), {
                name: document.getElementById('catName').value,
                createdAt: new Date().toISOString()
            });
            catModal.classList.remove('active');
            document.getElementById('categoryForm').reset();
        });

        function loadCategories() {
            onSnapshot(collection(db, "categories"), snap => {
                const tbody = document.getElementById('categoriesTable');
                tbody.innerHTML = '';
                snap.forEach(d => {
                    tbody.innerHTML += `<tr><td>${d.data().name}</td><td>0</td><td><button class="qty-btn" onclick="delCat('${d.id}')" style="color:var(--admin-accent)">Del</button></td></tr>`;
                });
            });
        }

        window.delCat = async (id) => {
            if (confirm("Delete category?")) await deleteDoc(doc(db, "categories", id));
        };

        // --- 7. Customers & Orders ---
        function loadCustomers() {
            onSnapshot(collection(db, "customers"), snap => {
                const tbody = document.getElementById('customersTable');
                tbody.innerHTML = '';
                snap.forEach(d => {
                    const c = d.data();
                    tbody.innerHTML += `<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.district}</td><td>${new Date(c.joinedDate).toLocaleDateString()}</td></tr>`;
                });
            });
        }

        function loadOrders() {
            onSnapshot(collection(db, "orders"), snap => {
                const tbody = document.getElementById('allOrdersTable');
                tbody.innerHTML = '';
                snap.forEach(d => {
                    const o = d.data();
                    tbody.innerHTML += `<tr><td>${d.id.slice(0,5)}</td><td>${o.customer?.name}</td><td>Tk ${o.total}</td><td>${o.status}</td><td><button class="qty-btn" onclick="updateOrder('${d.id}')">Status</button></td></tr>`;
                });
            });
        }

        window.updateOrder = async (id) => {
            const s = prompt("New Status (Pending/Shipped/Delivered):");
            if (s) await updateDoc(doc(db, "orders", id), { status: s });
        };

        // --- 8. Settings ---
        async function loadSettings() {
            const snap = await getDocs(query(collection(db, "settings"), where("id", "==", "global")));
            if (!snap.empty) {
                const s = snap.docs[0].data();
                document.getElementById('setSiteName').value = s.siteName || '';
                document.getElementById('setDeliveryCharge').value = s.deliveryCharge || '';
            }
        }

        document.getElementById('saveSettings').addEventListener('click', async () => {
            await setDoc(doc(db, "settings", "global"), {
                id: "global",
                siteName: document.getElementById('setSiteName').value,
                deliveryCharge: document.getElementById('setDeliveryCharge').value,
                updatedAt: new Date().toISOString()
            });
            alert("Saved!");
        });

        // Initial Init
        updateDashboard();
        loadProducts();
        loadCategories();
        loadCustomers();
        loadOrders();
        loadSettings();
    });
})();
