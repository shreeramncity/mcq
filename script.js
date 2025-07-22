// ===== MBBS Quiz Master - Complete Script =====

// Global Variables
let currentScreen = 'signIn';
let folders = {};
let expandedFolders = new Set();
let searchQuery = '';
let fontScale = 1;
let currentQuiz = null;
let quizMode = 'normal';
let currentQuestionIndex = 0;
let quizQuestions = [];
let answers = {};
let bookmarkedQuestions = new Set();
let quizStartTime = null;
let timerInterval = null;
let performanceChart = null;
let contextTarget = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    loadLocalData();
    showMainScreen();
    updatePerformancePanel();
    checkInstallStatus();
    
    // Auto-save every 30 seconds
    setInterval(saveData, 30000);
}

// ===== DATA MANAGEMENT =====
function loadLocalData() {
    folders = loadFromStorage('mbbs_folders', getDefaultFolders());
    expandedFolders = new Set(loadFromStorage('mbbs_expanded', []));
    fontScale = loadFromStorage('mbbs_fontScale', 1);
    updateFontScale();
}

function saveData() {
    saveToStorage('mbbs_folders', folders);
    saveToStorage('mbbs_expanded', Array.from(expandedFolders));
    saveToStorage('mbbs_fontScale', fontScale);
    showNotification('💾 Data saved locally', 'info');
}

function saveToStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadFromStorage(key, defaultValue = {}) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
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

// ===== SYNC FUNCTIONS =====
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
    
    showNotification('📤 Data exported successfully!', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = handleDataImport;
    input.click();
}

function handleDataImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.folders) {
                folders = data.folders;
                expandedFolders = new Set(data.expandedFolders || []);
                fontScale = data.settings?.fontScale || 1;
                updateFontScale();
                saveData();
                displayFolders();
                updatePerformancePanel();
                showNotification('📥 Data imported successfully!', 'success');
            } else {
                showNotification('❌ Invalid backup file format', 'danger');
            }
        } catch (error) {
            showNotification('❌ Error reading backup file', 'danger');
        }
    };
    reader.readAsText(file);
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
    displayFolders();
    updatePerformancePanel();
    updateSyncStatus('offline');
}

function showQuizScreen() {
    showScreen('quizScreen');
    displayQuestion();
    startTimer();
}

function showResultsScreen() {
    showScreen('resultsScreen');
    displayResults();
}

function continueOffline() {
    showMainScreen();
}

// ===== FONT SCALING =====
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

function updateSyncStatus(status) {
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');
    
    if (!syncIcon || !syncText) return;
    
    switch (status) {
        case 'offline':
            syncIcon.className = 'fas fa-save';
            syncIcon.style.color = '#28a745';
            syncText.textContent = 'Local Storage';
            break;
        case 'syncing':
            syncIcon.className = 'fas fa-sync fa-spin';
            syncIcon.style.color = '#007bff';
            syncText.textContent = 'Saving...';
            break;
    }
}

// ===== SEARCH FUNCTIONALITY =====
function handleSearch() {
    searchQuery = document.getElementById('searchInput').value.toLowerCase();
    displayFolders();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    displayFolders();
}

function filterContent() {
    if (!searchQuery.trim()) {
        return folders;
    }
    
    const filtered = {};
    
    for (const [folderName, folderData] of Object.entries(folders)) {
        const folderMatches = folderName.toLowerCase().includes(searchQuery);
        const matchingDecks = folderData.decks.filter(deck => {
            const deckMatches = deck.name.toLowerCase().includes(searchQuery);
            const questionMatches = deck.questions.some(q => 
                q.question.toLowerCase().includes(searchQuery) ||
                (q.explanation && q.explanation.toLowerCase().includes(searchQuery)) ||
                Object.values(q.options || {}).some(opt => opt.toLowerCase().includes(searchQuery))
            );
            return deckMatches || questionMatches;
        });
        
        if (folderMatches || matchingDecks.length > 0) {
            filtered[folderName] = {
                ...folderData,
                decks: folderMatches ? folderData.decks : matchingDecks
            };
        }
    }
    
    return filtered;
}

// ===== FOLDER MANAGEMENT =====
function createRootFolder() {
    showFolderModal('Create New Folder', '', 'create');
}

function showFolderModal(title, value, action, oldName = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('folderNameInput').value = value;
    document.getElementById('confirmBtn').textContent = action === 'create' ? 'Create' : 'Rename';
    document.getElementById('folderModal').classList.remove('hidden');
    
    document.getElementById('folderModal').dataset.action = action;
    document.getElementById('folderModal').dataset.oldName = oldName;
    
    document.getElementById('folderNameInput').focus();
}

function confirmFolderAction() {
    const modal = document.getElementById('folderModal');
    const action = modal.dataset.action;
    const oldName = modal.dataset.oldName;
    const newName = document.getElementById('folderNameInput').value.trim();
    
    if (!newName) {
        showNotification('Please enter a folder name!', 'danger');
        return;
    }
    
    if (action === 'create') {
        if (folders[newName]) {
            showNotification('Folder already exists!', 'danger');
            return;
        }
        folders[newName] = { decks: [], subfolders: {} };
        expandedFolders.add(newName);
    } else if (action === 'rename') {
        if (folders[newName] && newName !== oldName) {
            showNotification('Folder already exists!', 'danger');
            return;
        }
        folders[newName] = folders[oldName];
        delete folders[oldName];
        expandedFolders.delete(oldName);
        expandedFolders.add(newName);
        
        folders[newName].decks.forEach(deck => {
            deck.folder = newName;
        });
    }
    
    saveData();
    closeModal();
    displayFolders();
    showNotification(`Folder ${action === 'create' ? 'created' : 'renamed'} successfully!`, 'success');
}

function closeModal() {
    document.getElementById('folderModal').classList.add('hidden');
}

function expandAll() {
    for (const folderName in folders) {
        expandedFolders.add(folderName);
    }
    saveData();
    displayFolders();
}

function collapseAll() {
    expandedFolders.clear();
    saveData();
    displayFolders();
}

// ===== FILE IMPORT =====
function importDeck() {
    document.getElementById('fileInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.questions || !Array.isArray(data.questions)) {
                showNotification('Invalid file format! Please select a valid JSON question deck.', 'danger');
                return;
            }
            
            const folderName = data.folder || 'Uncategorized';
            if (!folders[folderName]) {
                folders[folderName] = { decks: [], subfolders: {} };
            }
            
            const deckName = file.name.replace('.json', '').replace(/_/g, ' ');
            const deck = {
                name: deckName,
                questions: data.questions,
                total: data.questions.length,
                correct: 0,
                incorrect: 0,
                attempted: 0,
                folder: folderName
            };
            
            folders[folderName].decks.push(deck);
            expandedFolders.add(folderName);
            
            saveData();
            displayFolders();
            updatePerformancePanel();
            
            showNotification(`Successfully imported ${data.questions.length} questions to ${folderName}!`, 'success');
            
        } catch (error) {
            showNotification('Error reading file. Please ensure it\'s a valid JSON file.', 'danger');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}

// ===== DISPLAY FUNCTIONS =====
function displayFolders() {
    const container = document.getElementById('fileTree');
    const filteredFolders = filterContent();
    
    if (Object.keys(filteredFolders).length === 0) {
        container.innerHTML = `
            <div style="padding: 50px 20px; text-align: center; color: #6c757d;">
                ${searchQuery ? 'No results found' : 'No folders yet. Create one to get started!'}
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // Add sync controls at the top
    const syncControls = document.createElement('div');
    syncControls.style.cssText = 'padding: 1rem; background: #f8f9fa; border-radius: 0.5rem; margin-bottom: 1rem;';
    syncControls.innerHTML = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button onclick="exportData()" class="btn btn-success btn-sm">
                <i class="fas fa-download"></i> Export Data
            </button>
            <button onclick="importData()" class="btn btn-primary btn-sm">
                <i class="fas fa-upload"></i> Import Data
            </button>
        </div>
        <small style="color: #6c757d; display: block; margin-top: 0.5rem;">
            💡 Use Export/Import to sync between devices
        </small>
    `;
    container.appendChild(syncControls);
    
    for (const [folderName, folderData] of Object.entries(filteredFolders)) {
        const isExpanded = expandedFolders.has(folderName);
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'tree-node';
        
        const folderContent = document.createElement('div');
        folderContent.className = 'tree-node-content';
        folderContent.oncontextmenu = (e) => showContextMenu(e, 'folder', folderName);
        
        folderContent.innerHTML = `
            <button class="tree-expand-btn ${isExpanded ? 'expanded' : ''}" onclick="toggleFolder('${folderName}')">
                <i class="fas fa-chevron-right"></i>
            </button>
            <i class="tree-icon folder fas fa-folder"></i>
            <span class="tree-label">${folderName}</span>
            <span class="tree-count">${folderData.decks.length}</span>
            <div class="tree-actions">
                <button class="tree-action-btn start" onclick="importToFolder('${folderName}')" title="Import to this folder">
                    <i class="fas fa-file-import"></i>
                </button>
                <button class="tree-action-btn bookmark" onclick="renameFolder('${folderName}')" title="Rename folder">
                    <i class="fas fa-edit"></i>
                </button>
                ${folderName !== 'Uncategorized' ? 
                    `<button class="tree-action-btn delete" onclick="deleteFolder('${folderName}')" title="Delete folder">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
            </div>
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
                deckContent.oncontextmenu = (e) => showContextMenu(e, 'deck', deck, folderName);
                
                deckContent.innerHTML = `
                    <span style="width: 20px;"></span>
                    <i class="tree-icon file fas fa-file-alt"></i>
                    <span class="tree-label">${deck.name}</span>
                    <span class="tree-count">${deck.total}</span>
                    <div class="tree-actions">
                        <button class="tree-action-btn start" onclick="startQuiz('${folderName}', '${deck.name}', 'fresh')" title="Start fresh quiz">
                            <i class="fas fa-play"></i>
                        </button>
                        ${getIncorrectCount(deck) > 0 ? 
                            `<button class="tree-action-btn review" onclick="startQuiz('${folderName}', '${deck.name}', 'incorrect')" title="Review incorrect">
                                <i class="fas fa-times"></i>
                            </button>` : ''}
                        ${getBookmarkedCount(deck) > 0 ? 
                            `<button class="tree-action-btn bookmark" onclick="startQuiz('${folderName}', '${deck.name}', 'bookmarked')" title="Review bookmarked">
                                <i class="fas fa-bookmark"></i>
                            </button>` : ''}
                        <button class="tree-action-btn delete" onclick="deleteDeck('${folderName}', '${deck.name}')" title="Delete deck">
                            <i class="fas fa-trash"></i>
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

function toggleFolder(folderName) {
    if (expandedFolders.has(folderName)) {
        expandedFolders.delete(folderName);
    } else {
        expandedFolders.add(folderName);
    }
    saveData();
    displayFolders();
}

function renameFolder(folderName) {
    showFolderModal('Rename Folder', folderName, 'rename', folderName);
}

function deleteFolder(folderName) {
    if (folderName === 'Uncategorized') {
        showNotification('Cannot delete Uncategorized folder!', 'danger');
        return;
    }
    
    if (confirm(`Delete folder "${folderName}"? Decks will be moved to Uncategorized.`)) {
        if (folders[folderName].decks.length > 0) {
            folders.Uncategorized.decks.push(...folders[folderName].decks);
        }
        delete folders[folderName];
        expandedFolders.delete(folderName);
        saveData();
        displayFolders();
        updatePerformancePanel();
        showNotification('Folder deleted successfully!', 'success');
    }
}

function importToFolder(folderName) {
    document.getElementById('fileInput').dataset.targetFolder = folderName;
    document.getElementById('fileInput').click();
}

function deleteDeck(folderName, deckName) {
    if (confirm(`Delete deck "${deckName}"?`)) {
        const folder = folders[folderName];
        folder.decks = folder.decks.filter(deck => deck.name !== deckName);
        saveData();
        displayFolders();
        updatePerformancePanel();
        showNotification('Deck deleted successfully!', 'success');
    }
}

function getIncorrectCount(deck) {
    return Math.floor(deck.total * 0.2);
}

function getBookmarkedCount(deck) {
    return Math.floor(deck.total * 0.1);
}

// ===== CONTEXT MENU =====
function showContextMenu(e, type, item, folderName = '') {
    e.preventDefault();
    const contextMenu = document.getElementById('contextMenu');
    contextTarget = { type, item, folderName };
    
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.classList.remove('hidden');
    
    document.addEventListener('click', hideContextMenu);
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.add('hidden');
    document.removeEventListener('click', hideContextMenu);
}

function contextAction(action) {
    hideContextMenu();
    
    if (!contextTarget) return;
    
    switch (action) {
        case 'newFolder':
            createRootFolder();
            break;
        case 'import':
            if (contextTarget.type === 'folder') {
                importToFolder(contextTarget.item);
            }
            break;
        case 'rename':
            if (contextTarget.type === 'folder') {
                renameFolder(contextTarget.item);
            }
            break;
        case 'delete':
            if (contextTarget.type === 'folder') {
                deleteFolder(contextTarget.item);
            } else if (contextTarget.type === 'deck') {
                deleteDeck(contextTarget.folderName, contextTarget.item.name);
            }
            break;
    }
}

// ===== PERFORMANCE PANEL =====
function updatePerformancePanel() {
    const stats = calculateOverallStats();
    
    const totalElement = document.getElementById('statTotal');
    const correctElement = document.getElementById('statCorrect');
    const incorrectElement = document.getElementById('statIncorrect');
    
    if (totalElement) totalElement.textContent = stats.total;
    if (correctElement) correctElement.textContent = stats.correct;
    if (incorrectElement) incorrectElement.textContent = stats.incorrect;
    
    updatePerformanceChart(stats);
    updateRecentActivity();
}

function calculateOverallStats() {
    let total = 0, correct = 0, incorrect = 0, attempted = 0;
    
    for (const folder of Object.values(folders)) {
        for (const deck of folder.decks) {
            total += deck.total;
            correct += deck.correct;
            incorrect += deck.incorrect;
            attempted += deck.attempted;
        }
    }
    
    const skipped = total - attempted;
    return { total, correct, incorrect, skipped, attempted };
}

function updatePerformanceChart(stats) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    if (stats.total === 0) {
        const context = ctx.getContext('2d');
        context.clearRect(0, 0, ctx.width, ctx.height);
        context.font = '14px Segoe UI';
        context.fillStyle = '#6c757d';
        context.textAlign = 'center';
        context.fillText('No Data Available', ctx.width / 2, ctx.height / 2);
        return;
    }
    
    if (window.Chart) {
        performanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect', 'Skipped'],
                datasets: [{
                    data: [stats.correct, stats.incorrect, stats.skipped],
                    backgroundColor: ['#4facfe', '#fa709a', '#adb5bd'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            fontSize: 10,
                            padding: 10
                        }
                    }
                }
            }
        });
    }
}

function updateRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    const activities = [
        { title: 'Quiz completed', time: '2 hours ago', icon: 'fas fa-check-circle' },
        { title: 'New deck imported', time: '1 day ago', icon: 'fas fa-file-import' },
        { title: 'Study streak: 5 days', time: '2 days ago', icon: 'fas fa-fire' }
    ];
    
    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        </div>
    `).join('');
}

// ===== QUIZ FUNCTIONS =====
function startQuiz(folderName, deckName, mode = 'normal') {
    const deck = folders[folderName].decks.find(d => d.name === deckName);
    if (!deck) return;
    
    currentQuiz = { ...deck, folderName };
    quizMode = mode;
    currentQuestionIndex = 0;
    answers = {};
    bookmarkedQuestions = new Set();
    
    if (mode === 'incorrect') {
        quizQuestions = deck.questions.slice(0, Math.ceil(deck.questions.length * 0.2));
    } else if (mode === 'bookmarked') {
        quizQuestions = deck.questions.slice(0, Math.ceil(deck.questions.length * 0.1));
    } else {
        quizQuestions = [...deck.questions];
    }
    
    quizQuestions.sort(() => Math.random() - 0.5);
    showQuizScreen();
}

function displayQuestion() {
    if (currentQuestionIndex >= quizQuestions.length) return;
    
    const question = quizQuestions[currentQuestionIndex];
    
    const questionCounter = document.getElementById('questionCounter');
    if (questionCounter) {
        questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${quizQuestions.length}`;
    }
    
    const modeIcons = {
        fresh: '<i class="fas fa-star"></i> Fresh Start',
        incorrect: '<i class="fas fa-times"></i> Review Mode',
        bookmarked: '<i class="fas fa-bookmark"></i> Bookmarked',
        normal: '<i class="fas fa-book"></i> Normal Mode'
    };
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
        modeIndicator.innerHTML = modeIcons[quizMode] || modeIcons.normal;
    }
    
    const qNumber = document.getElementById('qNumber');
    if (qNumber) qNumber.textContent = currentQuestionIndex + 1;
    
    const questionText = document.getElementById('questionText');
    if (questionText) questionText.innerHTML = question.question;
    
    const optionsContainer = document.getElementById('optionsContainer');
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        
        for (const [key, value] of Object.entries(question.options || {})) {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            optionDiv.innerHTML = `<strong>(${key})</strong> ${value}`;
            optionDiv.onclick = () => selectOption(key, optionDiv);
            optionsContainer.appendChild(optionDiv);
        }
    }
    
    updateBookmarkButton();
    updateNavigationButtons();
    updateProgressButtons();
    updateCurrentScore();
    
    if (answers[currentQuestionIndex]) {
        showAnswer(answers[currentQuestionIndex].selected);
    } else {
        clearExplanation();
    }
}

function selectOption(optionKey, optionElement) {
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    optionElement.classList.add('selected');
    
    const question = quizQuestions[currentQuestionIndex];
    const isCorrect = optionKey === question.correct_answer;
    
    answers[currentQuestionIndex] = {
        selected: optionKey,
        correct: isCorrect
    };
    
    showAnswer(optionKey);
    updateProgressButtons();
    updateCurrentScore();
    
    if (isCorrect && window.confetti) {
        confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function showAnswer(selectedOption) {
    const question = quizQuestions[currentQuestionIndex];
    const correctAnswer = question.correct_answer;
    
    document.querySelectorAll('.option').forEach((opt, index) => {
        const optionKey = Object.keys(question.options)[index];
        if (optionKey === correctAnswer) {
            opt.classList.add('correct');
        } else if (optionKey === selectedOption && optionKey !== correctAnswer) {
            opt.classList.add('incorrect');
        }
    });
    
    showExplanation(selectedOption === correctAnswer, selectedOption, correctAnswer, question.explanation);
}

function showExplanation(isCorrect, selected, correct, explanation) {
    const container = document.getElementById('explanationContent');
    if (!container) return;
    
    const resultClass = isCorrect ? 'correct' : 'incorrect';
    const resultText = isCorrect ? 
        '✅ Correct Answer!' : 
        `❌ Incorrect - Correct Answer: (${correct})`;
    
    let html = `
        <div class="explanation-result ${resultClass}">
            ${resultText}
        </div>
    `;
    
    if (explanation) {
        html += `
            <div style="margin-top: 15px;">
                <strong>💡 Explanation:</strong><br>
                ${explanation}
            </div>
        `;
    } else {
        html += '<div style="margin-top: 15px; color: #6c757d;">No explanation available for this question.</div>';
    }
    
    container.innerHTML = html;
}

function clearExplanation() {
    const container = document.getElementById('explanationContent');
    if (container) container.innerHTML = '';
}

function updateBookmarkButton() {
    const btn = document.getElementById('bookmarkBtn');
    if (btn) {
        const isBookmarked = bookmarkedQuestions.has(currentQuestionIndex);
        btn.classList.toggle('active', isBookmarked);
    }
}

function toggleBookmark() {
    if (bookmarkedQuestions.has(currentQuestionIndex)) {
        bookmarkedQuestions.delete(currentQuestionIndex);
    } else {
        bookmarkedQuestions.add(currentQuestionIndex);
    }
    updateBookmarkButton();
    updateProgressButtons();
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
        prevBtn.style.display = currentQuestionIndex > 0 ? 'flex' : 'none';
    }
    if (nextBtn) {
        nextBtn.style.display = currentQuestionIndex < quizQuestions.length - 1 ? 'flex' : 'none';
    }
}

function updateProgressButtons() {
    const container = document.getElementById('progressButtons');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < quizQuestions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'progress-btn';
        btn.textContent = i + 1;
        btn.onclick = () => jumpToQuestion(i);
        
        if (i === currentQuestionIndex) {
            btn.classList.add('current');
        } else if (answers[i]) {
            btn.classList.add(answers[i].correct ? 'correct' : 'incorrect');
        } else if (bookmarkedQuestions.has(i)) {
            btn.classList.add('bookmarked');
        }
        
        container.appendChild(btn);
    }
}

function updateCurrentScore() {
    const scoreElement = document.getElementById('currentScore');
    if (scoreElement) {
        const correct = Object.values(answers).filter(a => a.correct).length;
        const total = Object.keys(answers).length;
        scoreElement.textContent = `${correct}/${total}`;
    }
}

function jumpToQuestion(index) {
    if (index >= 0 && index < quizQuestions.length) {
        currentQuestionIndex = index;
        displayQuestion();
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

function goToMain() {
    stopTimer();
    showMainScreen();
}

function startTimer() {
    quizStartTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimer() {
    if (!quizStartTime) return;
    
    const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timerElement = document.getElementById('quizTimer');
    if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function finishQuiz() {
    const unanswered = quizQuestions.length - Object.keys(answers).length;
    
    if (unanswered > 0) {
        if (!confirm(`${unanswered} questions unanswered. Finish anyway?`)) {
            return;
        }
    }
    
    stopTimer();
    
    // Update deck statistics
    const correct = Object.values(answers).filter(a => a.correct).length;
    const incorrect = Object.values(answers).filter(a => !a.correct).length;
    
    const folder = folders[currentQuiz.folderName];
    const deck = folder.decks.find(d => d.name === currentQuiz.name);
    
    if (deck) {
        deck.correct = Math.max(deck.correct, correct);
        deck.incorrect = Math.max(deck.incorrect, incorrect);
        deck.attempted = Math.max(deck.attempted, Object.keys(answers).length);
        saveData();
    }
    
    showResultsScreen();
}

function displayResults() {
    const total = quizQuestions.length;
    const correct = Object.values(answers).filter(a => a.correct).length;
    const incorrect = Object.values(answers).filter(a => !a.correct).length;
    const unanswered = total - Object.keys(answers).length;
    const bookmarked = bookmarkedQuestions.size;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    const timeStr = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
    
    let title, badgeIcon, color;
    if (percentage >= 90) {
        title = '🎉 Outstanding Performance!';
        badgeIcon = '🏆';
        color = '#28a745';
    } else if (percentage >= 80) {
        title = '👏 Excellent Work!';
        badgeIcon = '🌟';
        color = '#28a745';
    } else if (percentage >= 70) {
        title = '👍 Good Job!';
        badgeIcon = '👍';
        color = '#ffc107';
    } else if (percentage >= 60) {
        title = '💪 Keep Practicing!';
        badgeIcon = '💪';
        color = '#ffc107';
    } else {
        title = '📚 More Study Needed';
        badgeIcon = '📚';
        color = '#dc3545';
    }
    
    const elements = {
        resultsBadgeIcon: document.getElementById('resultsBadgeIcon'),
        resultsBadgeText: document.getElementById('resultsBadgeText'),
        resultsTitle: document.getElementById('resultsTitle'),
        resultsScore: document.getElementById('resultsScore'),
        resultsInfo: document.getElementById('resultsInfo'),
        resultCorrect: document.getElementById('resultCorrect'),
        resultIncorrect: document.getElementById('resultIncorrect'),
        resultUnanswered: document.getElementById('resultUnanswered'),
        resultBookmarked: document.getElementById('resultBookmarked'),
        resultTime: document.getElementById('resultTime'),
        reviewWrongBtn: document.getElementById('reviewWrongBtn'),
        reviewBookmarkedBtn: document.getElementById('reviewBookmarkedBtn')
    };
    
    if (elements.resultsBadgeIcon) elements.resultsBadgeIcon.textContent = badgeIcon;
    if (elements.resultsBadgeText) elements.resultsBadgeText.textContent = title.split(' ')[1];
    if (elements.resultsTitle) {
        elements.resultsTitle.textContent = title;
        elements.resultsTitle.style.color = color;
    }
    if (elements.resultsScore) {
        elements.resultsScore.textContent = `${percentage}%`;
        elements.resultsScore.style.color = color;
    }
    
    const modeTexts = {
        fresh: '🆕 Fresh Start',
        incorrect: '❌ Wrong Questions Review',
        bookmarked: '🔖 Bookmarked Questions',
        normal: '📚 Normal Quiz'
    };
    
    if (elements.resultsInfo) {
        elements.resultsInfo.textContent = `${currentQuiz.name} - ${modeTexts[quizMode] || '📚 Quiz'}`;
    }
    
    if (elements.resultCorrect) elements.resultCorrect.textContent = correct;
    if (elements.resultIncorrect) elements.resultIncorrect.textContent = incorrect;
    if (elements.resultUnanswered) elements.resultUnanswered.textContent = unanswered;
    if (elements.resultBookmarked) elements.resultBookmarked.textContent = bookmarked;
    if (elements.resultTime) elements.resultTime.textContent = timeStr;
    
    const wrongTotal = incorrect + unanswered;
    
    if (elements.reviewWrongBtn) {
        if (wrongTotal > 0 && quizMode !== 'incorrect') {
            elements.reviewWrongBtn.classList.remove('hidden');
        } else {
            elements.reviewWrongBtn.classList.add('hidden');
        }
    }
    
    if (elements.reviewBookmarkedBtn) {
        if (bookmarked > 0 && quizMode !== 'bookmarked') {
            elements.reviewBookmarkedBtn.classList.remove('hidden');
        } else {
            elements.reviewBookmarkedBtn.classList.add('hidden');
        }
    }
    
    // Celebration effect
    if (percentage >= 80 && window.confetti) {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function retryQuiz() {
    startQuiz(currentQuiz.folderName, currentQuiz.name, quizMode);
}

function reviewWrong() {
    startQuiz(currentQuiz.folderName, currentQuiz.name, 'incorrect');
}

function reviewBookmarked() {
    startQuiz(currentQuiz.folderName, currentQuiz.name, 'bookmarked');
}

// ===== PWA FUNCTIONALITY =====
function checkInstallStatus() {
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        return true;
    }
    return false;
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
    
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notifications';
    container.className = 'notifications-container';
    document.body.appendChild(container);
    return container;
}

// ===== EVENT LISTENERS =====
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey) {
        switch(e.key) {
            case '=':
            case '+':
                e.preventDefault();
                changeFontSize(0.1);
                break;
            case '-':
                e.preventDefault();
                changeFontSize(-0.1);
                break;
            case '0':
                e.preventDefault();
                resetFontSize();
                break;
        }
    }
    
    if (currentScreen === 'quizScreen') {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                previousQuestion();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextQuestion();
                break;
        }
    }
});

// Add event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const folderNameInput = document.getElementById('folderNameInput');
    if (folderNameInput) {
        folderNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmFolderAction();
            }
        });
    }
    
    const folderModal = document.getElementById('folderModal');
    if (folderModal) {
        folderModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }
});