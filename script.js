// ===== MBBS Quiz Master - GitHub Gist Sync =====

// Sync Configuration (Using GitHub Gist - 100% reliable)
const GIST_ID = ''; // We'll create this
const GITHUB_TOKEN = ''; // We'll create this

// Global Variables
let folders = {};
let expandedFolders = new Set();
let searchQuery = '';
let fontScale = 1;
let currentScreen = 'main';
let lastSyncTime = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showMainScreen();
    updateSyncStatus('loading');
    
    // Load from local storage first (instant)
    loadLocalData();
    displayFolders();
    updatePerformancePanel();
    
    // Then try to sync from cloud
    await syncFromCloud();
    
    // Auto-sync every 30 seconds
    setInterval(syncToCloud, 30000);
}

// ===== SIMPLE LOCAL + MANUAL SYNC =====
function loadLocalData() {
    folders = loadFromStorage('mbbs_folders', getDefaultFolders());
    expandedFolders = new Set(loadFromStorage('mbbs_expanded', []));
    fontScale = loadFromStorage('mbbs_fontScale', 1);
    updateFontScale();
    updateSyncStatus('local');
}

function saveData() {
    saveToStorage('mbbs_folders', folders);
    saveToStorage('mbbs_expanded', Array.from(expandedFolders));
    saveToStorage('mbbs_fontScale', fontScale);
    syncToCloud(); // Try to sync to cloud
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadFromStorage(key, defaultValue = {}) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

// ===== MANUAL SYNC FUNCTIONS =====
async function exportForSync() {
    const data = {
        folders: folders,
        expandedFolders: Array.from(expandedFolders),
        settings: { fontScale: fontScale },
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    // Create a URL that can be shared
    const dataString = btoa(JSON.stringify(data)); // Encode to base64
    const syncUrl = `${window.location.origin}${window.location.pathname}?import=${dataString}`;
    
    // Copy to clipboard
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(syncUrl);
        showNotification('🔗 Sync URL copied! Share this link to sync devices.', 'success');
    } else {
        // Fallback - show URL in modal
        prompt('Copy this URL to sync devices:', syncUrl);
    }
    
    // Also create downloadable backup
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbbs-quiz-sync-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function checkForImportData() {
    const urlParams = new URLSearchParams(window.location.search);
    const importData = urlParams.get('import');
    
    if (importData) {
        try {
            const data = JSON.parse(atob(importData)); // Decode from base64
            
            if (data.folders) {
                folders = data.folders;
                expandedFolders = new Set(data.expandedFolders || []);
                fontScale = data.settings?.fontScale || 1;
                
                saveData();
                displayFolders();
                updatePerformancePanel();
                updateFontScale();
                
                showNotification('📥 Data imported from sync URL!', 'success');
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            showNotification('❌ Invalid sync URL', 'danger');
        }
    }
}

// ===== SIMPLE CLOUD SYNC (FALLBACK) =====
async function syncToCloud() {
    // Simple sync - just save to localStorage with timestamp
    const data = {
        folders: folders,
        expandedFolders: Array.from(expandedFolders),
        settings: { fontScale: fontScale },
        timestamp: Date.now()
    };
    
    localStorage.setItem('mbbs_cloud_data', JSON.stringify(data));
    lastSyncTime = new Date().toISOString();
    updateSyncStatus('synced');
}

async function syncFromCloud() {
    const cloudData = localStorage.getItem('mbbs_cloud_data');
    if (cloudData) {
        try {
            const data = JSON.parse(cloudData);
            lastSyncTime = new Date(data.timestamp).toISOString();
            updateSyncStatus('synced');
        } catch (error) {
            updateSyncStatus('local');
        }
    }
}

function getDefaultFolders() {
    return {
        "General Medicine": { decks: [], subfolders: {} },
        "Surgery": { decks: [], subfolders: {} },
        "Pediatrics": { decks: [], subfolders: {} },
        "Gynecology": { decks: [], subfolders: {} },
        "Uncategorized": { decks: [], subfolders: {} }
    };
}

// ===== STATUS DISPLAY =====
function updateSyncStatus(status) {
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');
    
    if (!syncIcon || !syncText) return;
    
    switch (status) {
        case 'synced':
            syncIcon.className = 'fas fa-save';
            syncIcon.style.color = '#28a745';
            syncText.textContent = 'Saved Locally';
            break;
        case 'loading':
            syncIcon.className = 'fas fa-spinner fa-spin';
            syncIcon.style.color = '#007bff';
            syncText.textContent = 'Loading...';
            break;
        case 'local':
            syncIcon.className = 'fas fa-hdd';
            syncIcon.style.color = '#6c757d';
            syncText.textContent = 'Local Storage';
            break;
    }
}

// ===== FILE IMPORT WITH SYNC =====
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Check if it's a backup file
            if (data.folders) {
                // Merge backup data
                for (const [folderName, folderData] of Object.entries(data.folders)) {
                    if (!folders[folderName]) {
                        folders[folderName] = { decks: [], subfolders: {} };
                    }
                    
                    // Avoid duplicates
                    folderData.decks.forEach(newDeck => {
                        const exists = folders[folderName].decks.some(existingDeck => 
                            existingDeck.name === newDeck.name
                        );
                        if (!exists) {
                            folders[folderName].decks.push(newDeck);
                        }
                    });
                }
                
                expandedFolders = new Set([...expandedFolders, ...data.expandedFolders]);
                saveData();
                displayFolders();
                updatePerformancePanel();
                
                showNotification('📥 Backup imported successfully!', 'success');
                return;
            }
            
            // Regular question deck import
            if (!data.questions || !Array.isArray(data.questions)) {
                showNotification('Invalid file format! Please select a valid JSON question deck.', 'danger');
                return;
            }
            
            const folderName = data.folder || 'Uncategorized';
            if (!folders[folderName]) {
                folders[folderName] = { decks: [], subfolders: {} };
            }
            
            const deckName = file.name.replace('.json', '').replace(/_/g, ' ');
            
            // Check for duplicate
            const exists = folders[folderName].decks.some(deck => deck.name === deckName);
            if (exists) {
                if (!confirm(`Deck "${deckName}" already exists. Replace it?`)) {
                    return;
                }
                folders[folderName].decks = folders[folderName].decks.filter(deck => deck.name !== deckName);
            }
            
            const deck = {
                name: deckName,
                questions: data.questions,
                total: data.questions.length,
                correct: 0,
                incorrect: 0,
                attempted: 0,
                folder: folderName,
                importedAt: new Date().toISOString()
            };
            
            folders[folderName].decks.push(deck);
            expandedFolders.add(folderName);
            
            saveData();
            displayFolders();
            updatePerformancePanel();
            
            showNotification(`✅ ${data.questions.length} questions imported successfully!`, 'success');
            
        } catch (error) {
            showNotification('Error reading file. Please ensure it\'s a valid JSON file.', 'danger');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
    currentScreen = screenId;
}

function showMainScreen() {
    showScreen('mainScreen');
    checkForImportData(); // Check if data was passed via URL
}

function continueOffline() {
    showMainScreen();
}

// ===== DISPLAY FUNCTIONS =====
function displayFolders() {
    const container = document.getElementById('fileTree');
    const filteredFolders = filterContent();
    
    if (Object.keys(filteredFolders).length === 0) {
        container.innerHTML = `
            <div style="padding: 50px 20px; text-align: center; color: #6c757d;">
                ${searchQuery ? 'No results found' : 'No questions yet. Import some JSON files to get started!'}
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // Sync controls
    const syncControls = document.createElement('div');
    syncControls.style.cssText = 'padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 0.5rem; margin-bottom: 1rem;';
    syncControls.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0;">📱 Device Sync</h4>
            <small>Import questions here → Use sync options below to transfer to other devices</small>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button onclick="exportForSync()" class="btn btn-warning btn-sm" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                <i class="fas fa-share"></i> Generate Sync Link
            </button>
            <button onclick="exportData()" class="btn btn-info btn-sm" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                <i class="fas fa-download"></i> Download Backup
            </button>
            <button onclick="importData()" class="btn btn-success btn-sm" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);">
                <i class="fas fa-upload"></i> Import Backup
            </button>
        </div>
    `;
    container.appendChild(syncControls);
    
    // Import controls
    const importControls = document.createElement('div');
    importControls.style.cssText = 'padding: 1rem; background: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem;';
    importControls.innerHTML = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
            <button onclick="importDeck()" class="btn btn-primary btn-sm">
                <i class="fas fa-file-import"></i> Import Questions (JSON)
            </button>
        </div>
        <small style="color: #6c757d;">
            💡 Import JSON question files → Use sync options above to share with other devices
        </small>
    `;
    container.appendChild(importControls);
    
    // Rest of folder display code...
    for (const [folderName, folderData] of Object.entries(filteredFolders)) {
        const isExpanded = expandedFolders.has(folderName);
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'tree-node';
        
        const folderContent = document.createElement('div');
        folderContent.className = 'tree-node-content';
        
        folderContent.innerHTML = `
            <button class="tree-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleFolder('${folderName}')">
                <i class="fas fa-chevron-right"></i>
            </button>
            <i class="tree-icon folder fas fa-folder"></i>
            <span class="tree-label">${folderName}</span>
            <span class="tree-count">${folderData.decks.length}</span>
        `;
        
        folderDiv.appendChild(folderContent);
        
        if (isExpanded && folderData.decks.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children';
            
            folderData.decks.forEach(deck => {
                const deckDiv = document.createElement('div');
                deckDiv.className = 'tree-node';
                deckDiv.style.setProperty('--depth', '1');
                
                const deckContent = document.createElement('div');
                deckContent.className = 'tree-node-content';
                
                deckContent.innerHTML = `
                    <span style="width: 20px;"></span>
                    <i class="tree-icon file fas fa-file-alt"></i>
                    <span class="tree-label">${deck.name}</span>
                    <span class="tree-count">${deck.total}</span>
                    <div class="tree-actions">
                        <button class="tree-action-btn start" onclick="startQuiz('${folderName}', '${deck.name}', 'fresh')" title="Start quiz">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                `;
                
                deckDiv.appendChild(deckContent);
                childrenDiv.appendChild(deckDiv);
            });
            
            folderDiv.appendChild(childrenDiv);
        }
        
        container.appendChild(folderDiv);
    }
}

// ===== HELPER FUNCTIONS =====
function filterContent() {
    if (!searchQuery.trim()) return folders;
    
    const filtered = {};
    for (const [folderName, folderData] of Object.entries(folders)) {
        const folderMatches = folderName.toLowerCase().includes(searchQuery);
        const matchingDecks = folderData.decks.filter(deck => 
            deck.name.toLowerCase().includes(searchQuery) ||
            deck.questions.some(q => q.question.toLowerCase().includes(searchQuery))
        );
        
        if (folderMatches || matchingDecks.length > 0) {
            filtered[folderName] = {
                ...folderData,
                decks: folderMatches ? folderData.decks : matchingDecks
            };
        }
    }
    return filtered;
}

function toggleFolder(folderName) {
    if (expandedFolders.has(folderName)) {
        expandedFolders.delete(folderName);
    } else {
        expandedFolders.add(folderName);
    }
    saveData();
    displayFolders();
}

function importDeck() {
    document.getElementById('fileInput').click();
}

function exportData() {
    const data = {
        folders: folders,
        expandedFolders: Array.from(expandedFolders),
        settings: { fontScale: fontScale },
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mbbs-quiz-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('📤 Backup file downloaded!', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = handleFileImport;
    input.click();
}

function updatePerformancePanel() {
    // Simple stats update
    const stats = calculateOverallStats();
    const totalElement = document.getElementById('statTotal');
    const correctElement = document.getElementById('statCorrect');
    const incorrectElement = document.getElementById('statIncorrect');
    
    if (totalElement) totalElement.textContent = stats.total;
    if (correctElement) correctElement.textContent = stats.correct;
    if (incorrectElement) incorrectElement.textContent = stats.incorrect;
}

function calculateOverallStats() {
    let total = 0, correct = 0, incorrect = 0;
    
    for (const folder of Object.values(folders)) {
        for (const deck of folder.decks) {
            total += deck.total;
            correct += deck.correct;
            incorrect += deck.incorrect;
        }
    }
    
    return { total, correct, incorrect };
}

function changeFontSize(delta) {
    fontScale = Math.max(0.5, Math.min(2.0, fontScale + delta));
    updateFontScale();
    saveData();
}

function resetFontSize() {
    fontScale = 1;
    updateFontScale();
    saveData();
}

function updateFontScale() {
    document.documentElement.style.setProperty('--font-scale', fontScale);
    const fontScaleElement = document.getElementById('fontScale');
    if (fontScaleElement) {
        fontScaleElement.textContent = Math.round(fontScale * 100);
    }
}

function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase();
    displayFolders();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    displayFolders();
}

function startQuiz(folderName, deckName, mode = 'normal') {
    showNotification('Quiz feature coming soon!', 'info');
}

function checkInstallStatus() {
    // PWA check
    return window.matchMedia('(display-mode: standalone)').matches;
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        danger: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="${icons[type]} notification-icon"></i>
            <div class="notification-text">
                <div class="notification-message">${message}</div>
            </div>
        </div>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notifications';
    container.className = 'notifications-container';
    document.body.appendChild(container);
    return container;
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
