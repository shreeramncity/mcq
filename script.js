// ===== SIMPLE GITHUB SYNC THAT ACTUALLY WORKS =====

const GITHUB_TOKEN = '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';
const GITHUB_API = 'https://api.github.com/repos/shreeramncity/mcq/contents/quiz-data.json';

let folders = {
    "General Medicine": { decks: [] },
    "Surgery": { decks: [] },
    "Pediatrics": { decks: [] },
    "Gynecology": { decks: [] },
    "Uncategorized": { decks: [] }
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 App starting...');
    showMainScreen();
    
    // Try to load from GitHub
    await loadFromGitHub();
    displayFolders();
});

// ===== GITHUB FUNCTIONS =====
async function saveToGitHub() {
    console.log('💾 Saving to GitHub...');
    
    try {
        // Prepare data
        const data = {
            folders: folders,
            lastUpdated: new Date().toISOString(),
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
        };
        
        const content = btoa(JSON.stringify(data, null, 2)); // Convert to base64
        
        // Get current file (if exists) to get SHA
        let sha = null;
        try {
            const getResponse = await fetch(GITHUB_API, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
                console.log('📄 Found existing file, SHA:', sha);
            }
        } catch (e) {
            console.log('📄 No existing file, creating new one');
        }
        
        // Save to GitHub
        const saveData = {
            message: `Update quiz data from ${data.device} - ${new Date().toLocaleString()}`,
            content: content,
            branch: 'main'
        };
        
        if (sha) saveData.sha = sha; // Include SHA if updating existing file
        
        const response = await fetch(GITHUB_API, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Saved to GitHub!', result.commit.sha);
            showMessage('✅ Data saved to GitHub repository!', 'success');
            updateSyncStatus('✅ Synced to GitHub');
            return true;
        } else {
            const error = await response.text();
            console.error('❌ Save failed:', error);
            showMessage('❌ Save failed: ' + error, 'error');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Save error:', error);
        showMessage('❌ Save error: ' + error.message, 'error');
        return false;
    }
}

async function loadFromGitHub() {
    console.log('📥 Loading from GitHub...');
    
    try {
        const response = await fetch(GITHUB_API, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });
        
        if (response.ok) {
            const fileData = await response.json();
            const content = atob(fileData.content); // Decode from base64
            const data = JSON.parse(content);
            
            folders = data.folders || folders;
            
            console.log('✅ Loaded from GitHub!', Object.keys(folders).length, 'folders');
            showMessage('📥 Data loaded from GitHub!', 'success');
            updateSyncStatus('✅ Loaded from GitHub');
            return true;
            
        } else if (response.status === 404) {
            console.log('📄 No data file found in GitHub yet');
            showMessage('📄 No data in GitHub yet. Import some files!', 'info');
            updateSyncStatus('🆕 Ready to sync');
            return false;
        } else {
            console.error('❌ Load failed:', response.status);
            showMessage('❌ Failed to load from GitHub', 'error');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Load error:', error);
        showMessage('❌ Load error: ' + error.message, 'error');
        return false;
    }
}

// ===== FILE IMPORT =====
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📂 Importing file:', file.name);
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (!data.questions || !Array.isArray(data.questions)) {
                showMessage('❌ Invalid file! Need JSON with questions array.', 'error');
                return;
            }
            
            const folderName = data.folder || 'Uncategorized';
            const deckName = file.name.replace('.json', '').replace(/_/g, ' ');
            
            // Add to folders
            if (!folders[folderName]) {
                folders[folderName] = { decks: [] };
            }
            
            const deck = {
                name: deckName,
                questions: data.questions,
                total: data.questions.length,
                importedAt: new Date().toISOString()
            };
            
            folders[folderName].decks.push(deck);
            
            console.log(`📚 Added ${data.questions.length} questions to ${folderName}`);
            
            // Save to GitHub immediately
            const saved = await saveToGitHub();
            
            // Update display
            displayFolders();
            
            if (saved) {
                showMessage(`🎉 ${data.questions.length} questions imported and synced to GitHub!`, 'success');
            } else {
                showMessage(`⚠️ ${data.questions.length} questions imported (sync failed)`, 'warning');
            }
            
        } catch (error) {
            console.error('Import error:', error);
            showMessage('❌ Import failed: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

// ===== UI FUNCTIONS =====
function showMainScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('mainScreen').classList.remove('hidden');
}

function continueOffline() {
    showMainScreen();
}

function displayFolders() {
    const container = document.getElementById('fileTree');
    if (!container) return;
    
    // Count total questions
    let totalQuestions = 0;
    let totalDecks = 0;
    for (const folder of Object.values(folders)) {
        totalDecks += folder.decks.length;
        for (const deck of folder.decks) {
            totalQuestions += deck.total || 0;
        }
    }
    
    container.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
            <h3 style="margin: 0 0 10px 0;">📚 MBBS Quiz Master</h3>
            <p style="margin: 0; opacity: 0.9;">
                ${totalDecks} decks • ${totalQuestions} questions
            </p>
            <div id="syncStatus" style="margin-top: 10px; font-size: 14px;">
                🔄 Ready to sync
            </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
            <button onclick="document.getElementById('fileInput').click()" 
                    style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer;">
                📁 Import JSON Questions
            </button>
            <button onclick="testSync()" 
                    style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-left: 10px;">
                🧪 Test Sync
            </button>
            <input type="file" id="fileInput" accept=".json" style="display: none;" onchange="handleFileImport(event)">
        </div>
        
        <div id="messageArea" style="margin-bottom: 20px;"></div>
        
        ${Object.entries(folders).map(([folderName, folderData]) => `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #495057;">
                    📁 ${folderName} (${folderData.decks.length} decks)
                </h4>
                ${folderData.decks.map(deck => `
                    <div style="margin-left: 20px; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                        📄 <strong>${deck.name}</strong> - ${deck.total} questions
                        <small style="color: #666; display: block;">
                            Imported: ${new Date(deck.importedAt).toLocaleString()}
                        </small>
                    </div>
                `).join('')}
                ${folderData.decks.length === 0 ? '<p style="margin-left: 20px; color: #666;">No decks yet</p>' : ''}
            </div>
        `).join('')}
    `;
}

function updateSyncStatus(message) {
    const statusEl = document.getElementById('syncStatus');
    if (statusEl) {
        statusEl.innerHTML = message;
    }
}

function showMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const area = document.getElementById('messageArea');
    if (!area) return;
    
    const colors = {
        success: '#d4edda',
        error: '#f8d7da', 
        warning: '#fff3cd',
        info: '#d1ecf1'
    };
    
    area.innerHTML = `
        <div style="background: ${colors[type]}; padding: 12px; border-radius: 6px; margin: 5px 0;">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        area.innerHTML = '';
    }, 5000);
}

// ===== TEST FUNCTIONS =====
async function testSync() {
    console.log('🧪 Testing sync...');
    
    // Add test data
    const testDeck = {
        name: 'Test Deck ' + Date.now(),
        questions: [
            {
                question: 'What is the normal heart rate?',
                options: { A: '60-100 bpm', B: '80-120 bpm', C: '100-140 bpm' },
                correct_answer: 'A'
            }
        ],
        total: 1,
        importedAt: new Date().toISOString()
    };
    
    folders.Uncategorized.decks.push(testDeck);
    
    const success = await saveToGitHub();
    displayFolders();
    
    if (success) {
        showMessage('🎉 Test sync successful! Check your GitHub repository.', 'success');
    }
}

// ===== DUMMY FUNCTIONS (for UI compatibility) =====
function changeFontSize() {}
function resetFontSize() {}
function handleSearch() {}
function clearSearch() {}
function updatePerformancePanel() {}

// ===== AUTO-LOAD ON PAGE READY =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Already handled above
    });
} else {
    showMainScreen();
    loadFromGitHub().then(() => displayFolders());
}
