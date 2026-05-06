// Database setup with better error handling
let db;
const DB_NAME = 'DairyFarmDB';
const DB_VERSION = 3;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Hide splash screen after load
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
    }, 2000);
    
    // Set today's date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-KE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Initialize database
    initDB();
    
    // Setup event listeners
    setupNavigation();
    setupFormListeners();
    setupTouchGestures();
}

// Initialize IndexedDB
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
        db = event.target.result;
        
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('cows')) {
            const cowStore = db.createObjectStore('cows', { keyPath: 'id', autoIncrement: true });
            cowStore.createIndex('name', 'name', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('milkRecords')) {
            const milkStore = db.createObjectStore('milkRecords', { keyPath: 'id', autoIncrement: true });
            milkStore.createIndex('cowId', 'cowId', { unique: false });
            milkStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('sales')) {
            const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
            salesStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('feedInventory')) {
            const feedStore = db.createObjectStore('feedInventory', { keyPath: 'id', autoIncrement: true });
            feedStore.createIndex('type', 'type', { unique: false });
        }
    };
    
    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database initialized successfully');
        loadDashboardData();
        showToast('App ready! 📱');
    };
    
    request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        showToast('Error loading app. Please refresh.');
    };
}

// Navigation
function setupNavigation() {
    // Bottom navigation
    document.querySelectorAll('.bottom-nav .nav-item, .menu-items .nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            navigateTo(section);
            toggleMenu(false);
        });
    });
}

function navigateTo(section) {
    // Update active states
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll(`[data-section="${section}"]`).forEach(el => el.classList.add('active'));
    
    // Show section
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section)?.classList.add('active');
    
    // Load section data
    loadSectionData(section);
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'cows':
            loadCowsList();
            break;
        case 'milk-tracking':
            loadCowDropdown();
            loadMilkRecords();
            break;
        case 'feeds':
            loadFeeds();
            break;
        case 'sales':
            loadSales();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Menu Toggle
function toggleMenu(show = null) {
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    
    if (show === null) {
        menu.classList.toggle('open');
        overlay.classList.toggle('show');
    } else if (show) {
        menu.classList.add('open');
        overlay.classList.add('show');
    } else {
        menu.classList.remove('open');
        overlay.classList.remove('show');
    }
}

// Form Toggles
function showAddCowForm() {
    document.getElementById('addCowForm').style.display = 'block';
    window.scrollTo(0, 0);
}

function hideAddCowForm() {
    document.getElementById('addCowForm').style.display = 'none';
    document.getElementById('cowForm').reset();
}

function showAddMilkForm() {
    document.getElementById('addMilkForm').style.display = 'block';
    loadCowDropdown();
    window.scrollTo(0, 0);
}

function hideAddMilkForm() {
    document.getElementById('addMilkForm').style.display = 'none';
    document.getElementById('milkForm').reset();
}

function showAddFeedForm() {
    document.getElementById('addFeedForm').style.display = 'block';
    window.scrollTo(0, 0);
}

function hideAddFeedForm() {
    document.getElementById('addFeedForm').style.display = 'none';
    document.getElementById('feedForm').reset();
}

function showAddSaleForm() {
    document.getElementById('addSaleForm').style.display = 'block';
    window.scrollTo(0, 0);
}

function hideAddSaleForm() {
    document.getElementById('addSaleForm').style.display = 'none';
    document.getElementById('saleForm').reset();
}

// Photo Preview
function previewPhoto(input) {
    const preview = document.getElementById('photoPreview');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Cow photo">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Cow Management
function saveCow(event) {
    event.preventDefault();
    
    const photoInput = document.getElementById('cowPhoto');
    let photoData = null;
    
    if (photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            saveCowData(e.target.result);
        };
        reader.readAsDataURL(photoInput.files[0]);
    } else {
        saveCowData(null);
    }
}

function saveCowData(photoData) {
    const cowData = {
        name: document.getElementById('cowName').value,
        breed: document.getElementById('cowBreed').value,
        weight: parseFloat(document.getElementById('cowWeight').value) || 0,
        dateOfBirth: document.getElementById('cowDOB').value,
        aiDate: document.getElementById('aiDate').value,
        checkupDays: parseInt(document.getElementById('checkupDays').value) || 0,
        diseases: document.getElementById('diseases').value,
        photo: photoData,
        createdAt: new Date().toISOString()
    };
    
    const transaction = db.transaction(['cows'], 'readwrite');
    const store = transaction.objectStore('cows');
    const request = store.add(cowData);
    
    request.onsuccess = () => {
        showToast('✅ Cow registered successfully!');
        hideAddCowForm();
        loadCowsList();
    };
    
    request.onerror = () => {
        showToast('❌ Error saving cow. Please try again.');
    };
}

function loadCowsList() {
    const transaction = db.transaction(['cows'], 'readonly');
    const store = transaction.objectStore('cows');
    const request = store.getAll();
    
    request.onsuccess = () => {
        displayCowsList(request.result);
    };
}

function displayCowsList(cows) {
    const container = document.getElementById('cowsList');
    
    if (cows.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 4rem;">🐄</div>
                <h3>No cows registered</h3>
                <p>Tap + to add your first cow</p>
            </div>`;
        return;
    }
    
    container.innerHTML = cows.map(cow => `
        <div class="cow-card">
            <div class="cow-photo-container">
                ${cow.photo ? 
                    `<img src="${cow.photo}" alt="${cow.name}" class="cow-image">` :
                    '<div class="cow-placeholder">🐄</div>'
                }
            </div>
            <div class="cow-details">
                <h3>${cow.name}</h3>
                <p>🐾 ${cow.breed || 'Unknown breed'}</p>
                <p>⚖️ ${cow.weight} kg</p>
                ${cow.aiDate ? `<p>🔬 AI: ${formatDate(cow.aiDate)}</p>` : ''}
                ${cow.diseases ? `<p class="warning">⚠️ ${cow.diseases}</p>` : ''}
            </div>
            <div class="cow-actions">
                <button onclick="viewCowChart(${cow.id})" class="btn-icon">📊</button>
                <button onclick="deleteCow(${cow.id})" class="btn-icon">🗑️</button>
            </div>
        </div>
    `).join('');
}

// Milk Recording
function recordMilk(event) {
    event.preventDefault();
    
    const milkData = {
        cowId: parseInt(document.getElementById('milkCowSelect').value),
        date: document.getElementById('milkingDate').value,
        time: document.getElementById('milkingTime').value || '',
        session: document.getElementById('milkingSession').value,
        quantity: parseFloat(document.getElementById('milkQuantity').value),
        feedGiven: document.getElementById('feedGiven').value,
        feedQuantity: parseFloat(document.getElementById('feedQuantity').value) || 0,
        notes: document.getElementById('milkingNotes').value,
        createdAt: new Date().toISOString()
    };
    
    const transaction = db.transaction(['milkRecords'], 'readwrite');
    const store = transaction.objectStore('milkRecords');
    const request = store.add(milkData);
    
    request.onsuccess = () => {
        showToast('✅ Milk record saved!');
        hideAddMilkForm();
        loadMilkRecords();
        loadDashboardData();
    };
}

// Sales Recording
function recordSale(event) {
    event.preventDefault();
    
    const quantity = parseFloat(document.getElementById('saleQuantity').value);
    const price = parseFloat(document.getElementById('salePricePerLiter').value);
    
    const saleData = {
        date: document.getElementById('saleDate').value,
        quantity: quantity,
        pricePerLiter: price,
        totalAmount: quantity * price,
        buyer: document.getElementById('saleBuyer').value,
        createdAt: new Date().toISOString()
    };
    
    const transaction = db.transaction(['sales'], 'readwrite');
    const store = transaction.objectStore('sales');
    const request = store.add(saleData);
    
    request.onsuccess = () => {
        showToast('✅ Sale recorded!');
        hideAddSaleForm();
        loadSales();
        loadDashboardData();
    };
}

function updateSaleTotal() {
    const quantity = parseFloat(document.getElementById('saleQuantity').value) || 0;
    const price = parseFloat(document.getElementById('salePricePerLiter').value) || 0;
    const total = quantity * price;
    document.getElementById('saleTotal').textContent = `KSH ${total.toFixed(2)}`;
}

// Feed Management
function saveFeed(event) {
    event.preventDefault();
    
    const feedData = {
        type: document.getElementById('feedType').value,
        customType: document.getElementById('customFeedType').value,
        ingredients: document.getElementById('feedIngredients').value,
        additives: document.getElementById('feedAdditives').value,
        energyContent: parseFloat(document.getElementById('feedEnergyContent').value) || 0,
        quantity: parseFloat(document.getElementById('feedQuantityInventory').value) || 0,
        unitCost: parseFloat(document.getElementById('feedUnitCost').value) || 0,
        datePurchased: document.getElementById('feedDatePurchased').value,
        createdAt: new Date().toISOString()
    };
    
    const transaction = db.transaction(['feedInventory'], 'readwrite');
    const store = transaction.objectStore('feedInventory');
    const request = store.add(feedData);
    
    request.onsuccess = () => {
        showToast('✅ Feed saved!');
        hideAddFeedForm();
        loadFeeds();
    };
}

function calculateEnergyContent() {
    const feedType = document.getElementById('feedType').value;
    const additives = document.getElementById('feedAdditives').value;
    const quantity = parseFloat(document.getElementById('feedQuantityInventory').value) || 0;
    
    let energyPerKg = 0;
    
    switch(feedType) {
        case 'dairy_meal': energyPerKg = 12.5; break;
        case 'silage': energyPerKg = 4.5; break;
        case 'hay': energyPerKg = 8.0; break;
        case 'bran': energyPerKg = 10.0; break;
        case 'pollard': energyPerKg = 9.5; break;
        case 'custom': energyPerKg = 10.0; break;
    }
    
    if (additives.includes('molasses')) energyPerKg += 1.0;
    if (additives.includes('minerals')) energyPerKg += 0.5;
    
    const totalEnergy = energyPerKg * quantity;
    document.getElementById('feedEnergyContent').value = totalEnergy.toFixed(2);
    showToast(`Energy: ${totalEnergy.toFixed(2)} MJ`);
}

function toggleCustomFeed() {
    const type = document.getElementById('feedType').value;
    document.getElementById('customFeedGroup').style.display = type === 'custom' ? 'block' : 'none';
}

// Dashboard
function loadDashboardData() {
    // Load cows count
    const cowTransaction = db.transaction(['cows'], 'readonly');
    cowTransaction.objectStore('cows').getAll().onsuccess = (e) => {
        document.getElementById('totalCows').textContent = e.target.result.length;
    };
    
    // Load today's milk
    const milkTransaction = db.transaction(['milkRecords'], 'readonly');
    milkTransaction.objectStore('milkRecords').getAll().onsuccess = (e) => {
        const today = new Date().toISOString().split('T')[0];
        const todayMilk = e.target.result
            .filter(r => r.date === today)
            .reduce((sum, r) => sum + r.quantity, 0);
        document.getElementById('todayMilk').textContent = `${todayMilk.toFixed(1)} L`;
    };
    
    // Load today's sales
    const salesTransaction = db.transaction(['sales'], 'readonly');
    salesTransaction.objectStore('sales').getAll().onsuccess = (e) => {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = e.target.result
            .filter(s => s.date === today)
            .reduce((sum, s) => sum + s.totalAmount, 0);
        document.getElementById('todaySales').textContent = `KSH ${todaySales.toFixed(2)}`;
    };
    
    // Load recent activity
    loadRecentActivity();
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    const milkTransaction = db.transaction(['milkRecords'], 'readonly');
    milkTransaction.objectStore('milkRecords').getAll().onsuccess = (e) => {
        const records = e.target.result.slice(-5).reverse();
        
        if (records.length === 0) {
            container.innerHTML = '<p class="no-data">No recent activity</p>';
            return;
        }
        
        container.innerHTML = records.map(record => `
            <div class="activity-item">
                <span class="activity-icon">🥛</span>
                <div class="activity-details">
                    <strong>Milk recorded</strong>
                    <p>${record.quantity}L on ${formatDate(record.date)}</p>
                    <small>${timeAgo(record.createdAt)}</small>
                </div>
            </div>
        `).join('');
    };
}

// Utility Functions
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function deleteCow(id) {
    if (confirm('Delete this cow? This cannot be undone.')) {
        const transaction = db.transaction(['cows'], 'readwrite');
        transaction.objectStore('cows').delete(id);
        transaction.oncomplete = () => {
            showToast('Cow deleted');
            loadCowsList();
            loadDashboardData();
        };
    }
}

function viewCowChart(cowId) {
    navigateTo('analytics');
    // Load chart for specific cow
}

// Touch Gestures
function setupTouchGestures() {
    let touchStartX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });
    
    document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        // Swipe right to open menu
        if (diff < -50 && touchStartX < 30) {
            toggleMenu(true);
        }
        
        // Swipe left to close menu
        if (diff > 50) {
            toggleMenu(false);
        }
    });
}

// Export/Import Data
function exportData() {
    const data = {};
    
    const stores = ['cows', 'milkRecords', 'sales', 'feedInventory'];
    let completed = 0;
    
    stores.forEach(storeName => {
        const transaction = db.transaction([storeName], 'readonly');
        transaction.objectStore(storeName).getAll().onsuccess = (e) => {
            data[storeName] = e.target.result;
            completed++;
            
            if (completed === stores.length) {
                const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dairy-farm-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                showToast('✅ Data exported!');
            }
        };
    });
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            
            Object.keys(data).forEach(storeName => {
                const transaction = db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                data[storeName].forEach(item => store.add(item));
            });
            
            showToast('✅ Data imported!');
            loadDashboardData();
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function clearAllData() {
    if (confirm('⚠️ Delete ALL data? This cannot be undone!')) {
        const stores = ['cows', 'milkRecords', 'sales', 'feedInventory'];
        stores.forEach(storeName => {
            db.transaction([storeName], 'readwrite')
              .objectStore(storeName).clear();
        });
        showToast('All data cleared');
        loadDashboardData();
    }
}

function showQuickAction() {
    const actions = [
        { label: 'Record Milk', action: () => { navigateTo('milk-tracking'); showAddMilkForm(); } },
        { label: 'Add Cow', action: () => { navigateTo('cows'); showAddCowForm(); } },
        { label: 'Record Sale', action: () => { navigateTo('sales'); showAddSaleForm(); } },
        { label: 'Add Feed', action: () => { navigateTo('feeds'); showAddFeedForm(); } }
    ];
    
    // Simple action sheet
    const message = actions.map((a, i) => `${i + 1}. ${a.label}`).join('\n');
    const choice = prompt(`Quick Action:\n\n${message}\n\nEnter number:`);
    
    if (choice && actions[parseInt(choice) - 1]) {
        actions[parseInt(choice) - 1].action();
    }
}

function showSyncStatus() {
    if (navigator.onLine) {
        showToast('🟢 Online - Data is saved locally');
    } else {
        showToast('🟡 Offline - Data will sync when online');
    }
}

// Set up form listeners
function setupFormListeners() {
    document.getElementById('cowForm')?.addEventListener('submit', saveCow);
    document.getElementById('milkForm')?.addEventListener('submit', recordMilk);
    document.getElementById('feedForm')?.addEventListener('submit', saveFeed);
    document.getElementById('saleForm')?.addEventListener('submit', recordSale);
    
    // Show/hide custom time for milking
    document.getElementById('milkingSession')?.addEventListener('change', function() {
        document.getElementById('customTimeGroup').style.display = 
            this.value === 'custom' ? 'block' : 'none';
    });
}

// Online/Offline detection
window.addEventListener('online', () => showToast('🟢 Back online!'));
window.addEventListener('offline', () => showToast('🟡 You are offline'));