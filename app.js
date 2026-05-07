// Database setup
let db;
const DB_NAME = 'DairyFarmDB';
const DB_VERSION = 3;
const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyVxvLrsrrbbKT9FZt-zn9-nBVx9XT2sWxLsAZhCSlKmASoZaqsLgUyC0vxithw1u1qAw/exec';
const FARM_ID = 'YOBRAE_FARM';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
    }, 2000);
    
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-KE', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    initDB();
    setupNavigation();
    setupFormListeners();
    setupTouchGestures();
}

// Initialize IndexedDB
function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = ({ target: { result: database } }) => {
        db = database;
        const { objectStoreNames } = db;
        
        if (!objectStoreNames.contains('cows')) {
            const cowStore = db.createObjectStore('cows', { keyPath: 'id', autoIncrement: true });
            cowStore.createIndex('name', 'name', { unique: false });
        }
        
        if (!objectStoreNames.contains('milkRecords')) {
            const milkStore = db.createObjectStore('milkRecords', { keyPath: 'id', autoIncrement: true });
            milkStore.createIndex('cowId', 'cowId', { unique: false });
            milkStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!objectStoreNames.contains('sales')) {
            const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
            salesStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!objectStoreNames.contains('feedInventory')) {
            const feedStore = db.createObjectStore('feedInventory', { keyPath: 'id', autoIncrement: true });
            feedStore.createIndex('type', 'type', { unique: false });
        }
        
        if (!objectStoreNames.contains('syncQueue')) {
            db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
    };
    
    request.onsuccess = ({ target: { result: database } }) => {
        db = database;
        console.log('Database initialized');
        loadDashboardData();
        processSyncQueue();
        showToast('App ready! 📱');
    };
    
    request.onerror = ({ target: { error } }) => {
        console.error('Database error:', error);
        showToast('Error loading app');
    };
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.bottom-nav .nav-item, .menu-items .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const { section } = item.dataset;
            navigateTo(section);
            toggleMenu(false);
        });
    });
}

function navigateTo(section) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll(`[data-section="${section}"]`).forEach(el => el.classList.add('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section)?.classList.add('active');
    loadSectionData(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadSectionData(section) {
    const loaders = {
        dashboard: loadDashboardData,
        cows: loadCowsList,
        'milk-tracking': () => { loadCowDropdown(); loadMilkRecords(); },
        feeds: loadFeeds,
        sales: loadSales,
        analytics: loadAnalytics
    };
    loaders[section]?.();
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
function previewPhoto({ files }) {
    const preview = document.getElementById('photoPreview');
    if (files?.[0]) {
        const reader = new FileReader();
        reader.onload = ({ target: { result } }) => {
            preview.innerHTML = `<img src="${result}" alt="Cow photo">`;
        };
        reader.readAsDataURL(files[0]);
    }
}

// ============ COW MANAGEMENT ============
function saveCow(event) {
    event.preventDefault();
    
    const photoInput = document.getElementById('cowPhoto');
    if (photoInput.files?.[0]) {
        const reader = new FileReader();
        reader.onload = ({ target: { result } }) => saveCowData(result);
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
        // 🔥 SYNC TO CLOUD
        syncToCloud({
            timestamp: new Date().toISOString(),
            type: 'cow_added',
            cowName: cowData.name,
            quantity: '',
            date: new Date().toISOString().split('T')[0],
            amount: '',
            feedType: '',
            notes: 'Breed: ' + (cowData.breed || 'N/A') + ', Weight: ' + cowData.weight + 'kg'
        });
        
        showToast('✅ Cow registered successfully!');
        hideAddCowForm();
        loadCowsList();
    };
}

function loadCowsList() {
    const transaction = db.transaction(['cows'], 'readonly');
    const store = transaction.objectStore('cows');
    const request = store.getAll();
    
    request.onsuccess = ({ target: { result: cows } }) => {
        displayCowsList(cows);
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
    
    container.innerHTML = cows.map(({ id, name, photo, breed, weight, aiDate, diseases }) => `
        <div class="cow-card">
            <div class="cow-photo-container">
                ${photo ? `<img src="${photo}" alt="${name}" class="cow-image">` : '<div class="cow-placeholder">🐄</div>'}
            </div>
            <div class="cow-details">
                <h3>${name}</h3>
                <p>🐾 ${breed || 'Unknown breed'}</p>
                <p>⚖️ ${weight} kg</p>
                ${aiDate ? `<p>🔬 AI: ${formatDate(aiDate)}</p>` : ''}
                ${diseases ? `<p class="warning">⚠️ ${diseases}</p>` : ''}
            </div>
            <div class="cow-actions">
                <button onclick="viewCowChart(${id})" class="btn-icon">📊</button>
                <button onclick="deleteCow(${id})" class="btn-icon">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============ MILK RECORDING ============
function recordMilk(event) {
    event.preventDefault();
    
    const cowId = parseInt(document.getElementById('milkCowSelect').value);
    const date = document.getElementById('milkingDate').value;
    const session = document.getElementById('milkingSession').value;
    const time = document.getElementById('milkingTime').value;
    const quantity = parseFloat(document.getElementById('milkQuantity').value);
    const feedGiven = document.getElementById('feedGiven').value;
    const feedQuantity = parseFloat(document.getElementById('feedQuantity').value) || 0;
    const notes = document.getElementById('milkingNotes').value;
    
    const milkData = {
        cowId: cowId,
        date: date,
        time: time || '',
        session: session,
        quantity: quantity,
        feedGiven: feedGiven,
        feedQuantity: feedQuantity,
        notes: notes,
        createdAt: new Date().toISOString()
    };
    
    // Save locally
    const transaction = db.transaction(['milkRecords'], 'readwrite');
    const store = transaction.objectStore('milkRecords');
    const request = store.add(milkData);
    
    request.onsuccess = () => {
        // 🔥 SYNC TO CLOUD - Get cow name first
        getCowName(cowId, (cowName) => {
            syncToCloud({
                timestamp: new Date().toISOString(),
                type: 'milk_recorded',
                cowName: cowName,
                quantity: quantity.toString(),
                date: date,
                amount: '',
                feedType: feedGiven,
                notes: notes + (feedQuantity > 0 ? ' | Feed: ' + feedQuantity + 'kg' : '')
            });
        });
        
        showToast('✅ Milk record saved!');
        hideAddMilkForm();
        loadMilkRecords();
        loadDashboardData();
    };
}

function getCowName(cowId, callback) {
    const transaction = db.transaction(['cows'], 'readonly');
    const store = transaction.objectStore('cows');
    const request = store.get(cowId);
    
    request.onsuccess = ({ target: { result } }) => {
        callback(result?.name || 'Unknown');
    };
}

// ============ SALES RECORDING ============
function recordSale(event) {
    event.preventDefault();
    
    const date = document.getElementById('saleDate').value;
    const quantity = parseFloat(document.getElementById('saleQuantity').value) || 0;
    const pricePerLiter = parseFloat(document.getElementById('salePricePerLiter').value) || 0;
    const totalAmount = quantity * pricePerLiter;
    const buyer = document.getElementById('saleBuyer').value;
    
    const saleData = {
        date: date,
        quantity: quantity,
        pricePerLiter: pricePerLiter,
        totalAmount: totalAmount,
        buyer: buyer,
        createdAt: new Date().toISOString()
    };
    
    // Save locally
    const transaction = db.transaction(['sales'], 'readwrite');
    const store = transaction.objectStore('sales');
    const request = store.add(saleData);
    
    request.onsuccess = () => {
        // 🔥 SYNC TO CLOUD
        syncToCloud({
            timestamp: new Date().toISOString(),
            type: 'sale_recorded',
            cowName: '',
            quantity: quantity.toString(),
            date: date,
            totalAmount: totalAmount.toString(),
            feedType: '',
            notes: 'Buyer: ' + (buyer || 'N/A') + ' | Price: KSH ' + pricePerLiter + '/L'
        });
        
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
    document.getElementById('saleTotal').textContent = 'KSH ' + total.toFixed(2);
}

// ============ FEED MANAGEMENT ============
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
        // 🔥 SYNC TO CLOUD
        syncToCloud({
            timestamp: new Date().toISOString(),
            type: 'feed_added',
            cowName: '',
            quantity: feedData.quantity.toString(),
            date: feedData.datePurchased,
            amount: (feedData.quantity * feedData.unitCost).toString(),
            feedType: feedData.type === 'custom' ? feedData.customType : feedData.type,
            notes: 'Energy: ' + feedData.energyContent + ' MJ | Cost: KSH ' + feedData.unitCost + '/kg'
        });
        
        showToast('✅ Feed saved!');
        hideAddFeedForm();
        loadFeeds();
    };
}

function calculateEnergyContent() {
    const feedType = document.getElementById('feedType').value;
    const additives = document.getElementById('feedAdditives').value;
    const quantity = parseFloat(document.getElementById('feedQuantityInventory').value) || 0;
    
    const energyMap = { dairy_meal: 12.5, silage: 4.5, hay: 8.0, bran: 10.0, pollard: 9.5, custom: 10.0 };
    let energyPerKg = energyMap[feedType] || 8.0;
    if (additives?.includes('molasses')) energyPerKg += 1.0;
    if (additives?.includes('minerals')) energyPerKg += 0.5;
    
    const totalEnergy = energyPerKg * quantity;
    document.getElementById('feedEnergyContent').value = totalEnergy.toFixed(2);
    showToast('Energy: ' + totalEnergy.toFixed(2) + ' MJ');
}

function toggleCustomFeed() {
    const type = document.getElementById('feedType').value;
    document.getElementById('customFeedGroup').style.display = type === 'custom' ? 'block' : 'none';
}

// ============ CLOUD SYNC ============
async function syncToCloud(data) {
    console.log('Syncing to cloud:', data);
    
    if (navigator.onLine) {
        try {
            const response = await fetch(SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            console.log('Sync result:', result);
            
            if (result.success) {
                console.log('✅ Synced successfully!');
                return true;
            } else {
                console.error('Sync failed:', result.error);
                saveToLocalSyncQueue(data);
            }
        } catch (error) {
            console.error('Sync error:', error);
            saveToLocalSyncQueue(data);
        }
    } else {
        console.log('Offline - queuing data');
        saveToLocalSyncQueue(data);
    }
}

function saveToLocalSyncQueue(data) {
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    store.add({ ...data, queuedAt: new Date().toISOString() });
    console.log('Saved to sync queue');
}

async function processSyncQueue() {
    const transaction = db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    const request = store.getAll();
    
    request.onsuccess = async ({ target: { result: queue } }) => {
        if (queue.length > 0 && navigator.onLine) {
            console.log('Processing sync queue:', queue.length, 'items');
            for (const { id, ...data } of queue) {
                const synced = await syncToCloud(data);
                if (synced) {
                    const deleteTx = db.transaction(['syncQueue'], 'readwrite');
                    deleteTx.objectStore('syncQueue').delete(id);
                }
            }
        }
    };
}

// ============ DASHBOARD ============
function loadDashboardData() {
    const cowsTx = db.transaction(['cows'], 'readonly');
    cowsTx.objectStore('cows').getAll().onsuccess = ({ target: { result: cows } }) => {
        document.getElementById('totalCows').textContent = cows.length;
    };
    
    const milkTx = db.transaction(['milkRecords'], 'readonly');
    milkTx.objectStore('milkRecords').getAll().onsuccess = ({ target: { result: records } }) => {
        const today = new Date().toISOString().split('T')[0];
        const todayMilk = records
            .filter(({ date }) => date === today)
            .reduce((sum, { quantity }) => sum + quantity, 0);
        document.getElementById('todayMilk').textContent = todayMilk.toFixed(1) + ' L';
    };
    
    const salesTx = db.transaction(['sales'], 'readonly');
    salesTx.objectStore('sales').getAll().onsuccess = ({ target: { result: sales } }) => {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = sales
            .filter(({ date }) => date === today)
            .reduce((sum, { totalAmount }) => sum + totalAmount, 0);
        document.getElementById('todaySales').textContent = 'KSH ' + todaySales.toFixed(2);
    };
    
    loadRecentActivity();
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    const transaction = db.transaction(['milkRecords', 'sales'], 'readonly');
    
    transaction.objectStore('milkRecords').getAll().onsuccess = ({ target: { result: records } }) => {
        transaction.objectStore('sales').getAll().onsuccess = ({ target: { result: sales } }) => {
            const activities = [
                ...records.map(({ quantity, date, createdAt }) => ({
                    icon: '🥛', text: 'Milk: ' + quantity + 'L', date, createdAt
                })),
                ...sales.map(({ quantity, totalAmount, date, createdAt }) => ({
                    icon: '💰', text: 'Sale: KSH ' + totalAmount, date, createdAt
                }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
            
            if (activities.length === 0) {
                container.innerHTML = '<p class="no-data">No recent activity</p>';
                return;
            }
            
            container.innerHTML = activities.map(({ icon, text, date, createdAt }) => `
                <div class="activity-item">
                    <span class="activity-icon">${icon}</span>
                    <div class="activity-details">
                        <strong>${text}</strong>
                        <p>${formatDate(date)}</p>
                        <small>${timeAgo(createdAt)}</small>
                    </div>
                </div>
            `).join('');
        };
    };
}

// ============ LOAD FUNCTIONS ============
function loadCowDropdown() {
    const transaction = db.transaction(['cows'], 'readonly');
    transaction.objectStore('cows').getAll().onsuccess = ({ target: { result: cows } }) => {
        const select = document.getElementById('milkCowSelect');
        select.innerHTML = '<option value="">Select Cow</option>' + 
            cows.map(({ id, name }) => '<option value="' + id + '">' + name + '</option>').join('');
    };
}

function loadMilkRecords() {
    const transaction = db.transaction(['milkRecords'], 'readonly');
    transaction.objectStore('milkRecords').getAll().onsuccess = ({ target: { result: records } }) => {
        const container = document.getElementById('milkRecordsList');
        
        if (records.length === 0) {
            container.innerHTML = '<p class="no-data">No milk records</p>';
            return;
        }
        
        container.innerHTML = records.slice().reverse().map(({ cowId, date, time, session, quantity, feedGiven, feedQuantity }) => `
            <div class="milk-record">
                <div class="record-header">
                    <span class="record-id">Cow #${cowId}</span>
                    <span class="record-session">${session}</span>
                </div>
                <p>📅 ${formatDate(date)} ${time ? 'at ' + time : ''}</p>
                <p>🥛 ${quantity} L</p>
                ${feedGiven ? '<p>🌾 ' + feedGiven + ' (' + feedQuantity + 'kg)</p>' : ''}
            </div>
        `).join('');
    };
}

function loadSales() {
    const transaction = db.transaction(['sales'], 'readonly');
    transaction.objectStore('sales').getAll().onsuccess = ({ target: { result: sales } }) => {
        const container = document.getElementById('salesList');
        
        if (sales.length === 0) {
            container.innerHTML = '<p class="no-data">No sales recorded</p>';
            return;
        }
        
        container.innerHTML = sales.slice().reverse().map(({ date, quantity, pricePerLiter, totalAmount, buyer }) => `
            <div class="sale-record">
                <p>📅 ${formatDate(date)}</p>
                <p>🥛 ${quantity} L × KSH ${pricePerLiter}</p>
                <p class="sale-total">💰 KSH ${totalAmount.toFixed(2)}</p>
                ${buyer ? '<p>👤 ' + buyer + '</p>' : ''}
            </div>
        `).join('');
        
        updateSalesSummary(sales);
    };
}

function updateSalesSummary(sales) {
    const today = new Date().toISOString().split('T')[0];
    const { start, end } = getWeekRange();
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisYear = new Date().getFullYear().toString();
    
    const summaries = {
        today: sales.filter(s => s.date === today).reduce((sum, s) => sum + s.totalAmount, 0),
        week: sales.filter(s => s.date >= start && s.date <= end).reduce((sum, s) => sum + s.totalAmount, 0),
        month: sales.filter(s => s.date.startsWith(thisMonth)).reduce((sum, s) => sum + s.totalAmount, 0),
        year: sales.filter(s => s.date.startsWith(thisYear)).reduce((sum, s) => sum + s.totalAmount, 0)
    };
    
    document.getElementById('salesSummary').innerHTML = Object.entries({
        Today: summaries.today,
        'This Week': summaries.week,
        'This Month': summaries.month,
        'This Year': summaries.year
    }).map(([label, value]) => `
        <div class="summary-card"><h3>${label}</h3><p>KSH ${value.toFixed(2)}</p></div>
    `).join('');
}

function loadFeeds() {
    const transaction = db.transaction(['feedInventory'], 'readonly');
    transaction.objectStore('feedInventory').getAll().onsuccess = ({ target: { result: feeds } }) => {
        const container = document.getElementById('feedsList');
        
        if (feeds.length === 0) {
            container.innerHTML = '<p class="no-data">No feeds recorded</p>';
            return;
        }
        
        container.innerHTML = feeds.map(({ type, customType, quantity, energyContent, unitCost, datePurchased }) => `
            <div class="feed-card">
                <h3>${type === 'custom' ? customType : type}</h3>
                <p>📦 ${quantity} kg</p>
                <p>⚡ ${energyContent.toFixed(2)} MJ</p>
                <p>💵 KSH ${unitCost}/kg</p>
                <p>📅 ${formatDate(datePurchased)}</p>
            </div>
        `).join('');
    };
}

function loadAnalytics() {
    // Analytics loaded when section is viewed
    console.log('Analytics section loaded');
}

// ============ UTILITY FUNCTIONS ============
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

function getWeekRange() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    const end = new Date(now);
    end.setDate(now.getDate() + (6 - dayOfWeek));
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
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
}

// ============ FORM LISTENERS ============
function setupFormListeners() {
    document.getElementById('cowForm')?.addEventListener('submit', saveCow);
    document.getElementById('milkForm')?.addEventListener('submit', recordMilk);
    document.getElementById('feedForm')?.addEventListener('submit', saveFeed);
    document.getElementById('saleForm')?.addEventListener('submit', recordSale);
    
    document.getElementById('milkingSession')?.addEventListener('change', function() {
        document.getElementById('customTimeGroup').style.display = this.value === 'custom' ? 'block' : 'none';
    });
}

// ============ TOUCH GESTURES ============
function setupTouchGestures() {
    let touchStartX = 0;
    document.addEventListener('touchstart', ({ touches }) => { touchStartX = touches[0].clientX; });
    document.addEventListener('touchend', ({ changedTouches }) => {
        const diff = touchStartX - changedTouches[0].clientX;
        if (diff < -50 && touchStartX < 30) toggleMenu(true);
        if (diff > 50) toggleMenu(false);
    });
}

// ============ ONLINE/OFFLINE ============
window.addEventListener('online', () => {
    showToast('📤 Syncing data...');
    processSyncQueue();
});

window.addEventListener('offline', () => {
    showToast('🟡 Offline - Data will sync when connected');
});

// Periodic sync
setInterval(processSyncQueue, 30000);

// ============ EXPORT/IMPORT ============
function exportData() {
    const stores = ['cows', 'milkRecords', 'sales', 'feedInventory'];
    const data = {};
    let completed = 0;
    
    stores.forEach(storeName => {
        const transaction = db.transaction([storeName], 'readonly');
        transaction.objectStore(storeName).getAll().onsuccess = ({ target: { result: items } }) => {
            data[storeName] = items;
            completed++;
            if (completed === stores.length) {
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = Object.assign(document.createElement('a'), {
                    href: url,
                    download: 'dairy-farm-backup-' + new Date().toISOString().split('T')[0] + '.json'
                });
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
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            Object.keys(data).forEach(storeName => {
                const transaction = db.transaction([storeName], 'readwrite');
                data[storeName].forEach(item => transaction.objectStore(storeName).add(item));
            });
            showToast('✅ Data imported!');
            loadDashboardData();
        };
        reader.readAsText(e.target.files[0]);
    };
    input.click();
}

function clearAllData() {
    if (confirm('⚠️ Delete ALL data? This cannot be undone!')) {
        ['cows', 'milkRecords', 'sales', 'feedInventory'].forEach(storeName => {
            db.transaction([storeName], 'readwrite').objectStore(storeName).clear();
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
    
    const message = actions.map((a, i) => (i + 1) + '. ' + a.label).join('\n');
    const choice = prompt('Quick Action:\n\n' + message + '\n\nEnter number:');
    if (choice && actions[parseInt(choice) - 1]) {
        actions[parseInt(choice) - 1].action();
    }
}

function showSyncStatus() {
    if (navigator.onLine) {
        showToast('🟢 Online - Data is syncing');
    } else {
        showToast('🟡 Offline - Data will sync when online');
    }
}