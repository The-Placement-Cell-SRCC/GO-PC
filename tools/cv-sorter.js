// --- State Variables ---
let cvData = new Map(); 
let selectedKeys = new Set();
let currentMode = 'list'; // 'list' or 'paste'
const ROLL_VARIANT_REGEX = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i; 
const CV_SORTER_GAS_URL = "https://script.google.com/macros/s/AKfycbwODlCwdVbWf95F__YBwokhTZ1k3xIVDw2ofn6X27OKEVIEnLwTb5KuuS7fAQ9nUi_b/exec";

const LOADER_HTML = `<div class="flex items-center justify-center h-full min-h-[40vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading...</p></div>`;

// --- Tool Definition ---
const tool = {
    name: 'CV Sorter',
    icon: 'folder-search', // Lucide icon name
    render: () => ({
        html: `<div id="cv-sorter-content" class="page-enter"><div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading CV Sorter...</p></div></div>`
    }),
    onMount: (contentElement, user, { logActivity }) => {
        const toolContainer = contentElement.querySelector('#cv-sorter-content');
        runCVSorter(toolContainer, user, { logActivity });
    }
};

// --- Main Logic Function ---
function runCVSorter(container, user, { logActivity }) {

    // --- Core UI Update Function ---
    function renderToolShell() {
        container.innerHTML = getToolShellHtml();
        
        // Attach listeners for shell elements (tabs, generate button)
        attachShellEventListeners();
        
        // Load default tab
        loadTabContent('list', true); // Show loader initially
        
        // Start loading data
        loadData();
    }

    // --- Event Listeners ---
    function attachShellEventListeners() {
        const listTab = container.querySelector('#tab-list');
        const pasteTab = container.querySelector('#tab-paste');
        const generateBtn = container.querySelector('#generate-btn');
        const outputNameInput = container.querySelector('#output-name-input');
        
        listTab?.addEventListener('click', () => {
            currentMode = 'list';
            loadTabContent(currentMode);
        });
        pasteTab?.addEventListener('click', () => {
            currentMode = 'paste';
            loadTabContent(currentMode);
        });
        
        container.querySelector('#refresh-manifest-btn')?.addEventListener('click', () => {
            loadTabContent(currentMode, true); // Force loading state
            loadData();
        });

        generateBtn?.addEventListener('click', () => {
            let keysToProcess = new Set();
            if (currentMode === 'list') {
                keysToProcess = selectedKeys;
            } else if (currentMode === 'paste') {
                const textArea = container.querySelector('#roll-numbers-textarea');
                const { validKeys } = processPastedKeys(textArea?.value || '');
                keysToProcess = new Set(validKeys);
            }
            handleGenerate(keysToProcess);
        });

        outputNameInput?.addEventListener('input', updateGenerateButtonState);
    }
    
    function attachListTabListeners() {
        const searchInput = container.querySelector('#cv-search');
        const cvList = container.querySelector('#cv-list');
        const selectAllCheckbox = container.querySelector('#select-all-checkbox');

        const filterCVs = () => {
            if (!searchInput || !cvList) return;
            const query = searchInput.value.toLowerCase().trim();
            let visibleCount = 0;
            cvList.querySelectorAll('.cv-item').forEach(item => {
                const key = item.dataset.key?.toLowerCase() || '';
                const fileName = item.dataset.filename?.toLowerCase() || '';
                const isVisible = (key.includes(query) || fileName.includes(query));
                item.style.display = isVisible ? '' : 'none';
                if (isVisible) visibleCount++;
            });
            const filterCountEl = container.querySelector('#filter-count');
            if(filterCountEl) filterCountEl.textContent = `Showing ${visibleCount} of ${cvData.size} CVs`;
        };

        searchInput?.addEventListener('input', filterCVs);
        filterCVs(); 

        cvList?.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"][data-key]')) {
                const key = e.target.dataset.key;
                if (e.target.checked) selectedKeys.add(key);
                else selectedKeys.delete(key);
                updateGenerateButtonState(); 
                
                const allCheckboxes = cvList.querySelectorAll('input[type="checkbox"][data-key]');
                const allVisibleChecked = Array.from(allCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none' && cb.checked).length;
                const allVisible = Array.from(allCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none').length;
                if(selectAllCheckbox) {
                    selectAllCheckbox.checked = allVisible > 0 && allVisibleChecked === allVisible;
                    selectAllCheckbox.indeterminate = allVisibleChecked > 0 && allVisibleChecked < allVisible;
                }
            }
        });

        selectAllCheckbox?.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
             cvList.querySelectorAll('.cv-item').forEach(item => {
                 if (item.style.display !== 'none') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        const key = checkbox.dataset.key;
                        if (isChecked) selectedKeys.add(key);
                        else selectedKeys.delete(key);
                    }
                }
             });
            updateGenerateButtonState();
        });
    }
    
    function attachPasteTabListeners() {
        const textArea = container.querySelector('#roll-numbers-textarea');
        const pasteBtn = container.querySelector('#paste-from-clipboard-btn');
        
        textArea?.addEventListener('input', validatePastedKeys);
        pasteBtn?.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (textArea) textArea.value = text;
                validatePastedKeys(); 
            } catch (err) {
                 console.error('Failed to read clipboard:', err);
            }
        });
        
        validatePastedKeys(); // Initial validation
    }
    
    // --- Tab Loading ---
    function loadTabContent(mode, forceLoading = false) {
        const tabContent = container.querySelector('#tab-content-area');
        const listTab = container.querySelector('#tab-list');
        const pasteTab = container.querySelector('#tab-paste');
        
        if (!tabContent || !listTab || !pasteTab) return;

        // Update tab visuals
        listTab.classList.toggle('active', mode === 'list');
        pasteTab.classList.toggle('active', mode === 'paste');
        
        let contentHtml = '';
        if (forceLoading) {
            contentHtml = LOADER_HTML;
        } else if (mode === 'list') {
            contentHtml = getSelectListHtml(cvData);
        } else if (mode === 'paste') {
            contentHtml = getPasteRollsHtml();
        }
        
        tabContent.innerHTML = `<div class="content-enter-fade">${contentHtml}</div>`;

        // Attach listeners *after* content is in the DOM
        if (!forceLoading) {
            if (mode === 'list') {
                attachListTabListeners();
            } else if (mode === 'paste') {
                attachPasteTabListeners();
            }
        }
        
        lucide.createIcons();
        updateGenerateButtonState(); // Update button state whenever tab changes
    }

    // --- Data Loading ---
    async function loadData() {
        try {
             const [manifestResponse, linksResponse] = await Promise.all([
                 fetch('/cv-manifest.csv', { cache: 'no-store' }),
                 fetch('/CVlinks.csv', { cache: 'no-store' })
             ]);

            if (!manifestResponse.ok) throw new Error(`Could not load '/cv-manifest.csv'. Status: ${manifestResponse.status}`);
            if (!linksResponse.ok) throw new Error(`Could not load '/CVlinks.csv'. Status: ${linksResponse.status}`);

             const [manifestText, linksText] = await Promise.all([
                manifestResponse.text(),
                linksResponse.text()
             ]);

            const linksMap = new Map();
            linksText.split('\n').forEach(line => {
                 const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                 if (parts.length >= 2) {
                    const fileName = parts[0]?.trim().replace(/^"|"$/g, ''); 
                    const gdriveLink = parts[1]?.trim().replace(/^"|"$/g, '');
                    if (fileName && gdriveLink) {
                        linksMap.set(fileName.toLowerCase(), gdriveLink); 
                    }
                 }
            });

            const parsedData = new Map();
            manifestText.split('\n').forEach(line => {
                const fileName = line.trim();
                if (fileName) {
                    const nameWithoutExt = fileName.replace(/\.pdf$/i, ''); 
                    const keyMatch = nameWithoutExt.match(ROLL_VARIANT_REGEX);
                    if (keyMatch && keyMatch[0]) {
                        const key = keyMatch[0].toUpperCase(); 
                        const gdriveLink = linksMap.get(fileName.toLowerCase()) || null; 
                        if (!parsedData.has(key)) {
                             parsedData.set(key, { fileName, gdriveLink });
                        }
                    }
                }
            });

            if (parsedData.size === 0) {
                 throw new Error("Manifest file empty or no valid roll number/variant keys found.");
            }
            
            cvData = parsedData; 
            loadTabContent(currentMode); // Reload content of the currently active tab
            
        } catch (e) {
            console.error("Error loading CV data:", e);
            container.querySelector('#tab-content-area').innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${e.message}</div>`;
        }
    }

     // --- UI Updates ---
     function updateGenerateButtonState() {
        const generateBtn = container.querySelector('#generate-btn');
        const outputNameInput = container.querySelector('#output-name-input');
        if (!generateBtn || !outputNameInput) return;
        
        const hasOutputName = outputNameInput.value.trim().length > 0;
        let hasValidSelection = false;

        if (currentMode === 'list') {
            hasValidSelection = selectedKeys.size > 0;
        } else if (currentMode === 'paste') {
            const textArea = container.querySelector('#roll-numbers-textarea');
            if (textArea) {
                const { validKeys } = processPastedKeys(textArea.value || '');
                hasValidSelection = validKeys.length > 0;
            }
        }

         generateBtn.disabled = !(hasValidSelection && hasOutputName);
     }

    function processPastedKeys(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const results = {
            validKeys: new Set(),
            invalidInputs: new Set(),
            duplicateLinesInPaste: new Set(),
            notFoundKeys: new Set()
        };
        const seenLines = new Set();
        const seenValidKeys = new Set();

        lines.forEach(line => {
             if (seenLines.has(line)) {
                results.duplicateLinesInPaste.add(line);
             }
             seenLines.add(line);

            const keyMatch = line.match(ROLL_VARIANT_REGEX);
            if (keyMatch && keyMatch[0]) {
                const key = keyMatch[0].toUpperCase(); 
                if (cvData.has(key)) {
                    if (!seenValidKeys.has(key)) {
                         results.validKeys.add(key);
                         seenValidKeys.add(key);
                    }
                } else {
                    results.notFoundKeys.add(key); 
                     results.invalidInputs.add(line); 
                }
            } else {
                results.invalidInputs.add(line); 
            }
        });

        return {
            validKeys: Array.from(results.validKeys), 
            invalidInputs: Array.from(results.invalidInputs),
            duplicateLinesInPaste: Array.from(results.duplicateLinesInPaste),
            notFoundKeys: Array.from(results.notFoundKeys)
        };
    }

    function validatePastedKeys() {
         const textArea = container.querySelector('#roll-numbers-textarea');
         if (!textArea) return;
         const { validKeys, invalidInputs, duplicateLinesInPaste } = processPastedKeys(textArea.value || '');

         const validCountEl = container.querySelector('#valid-count');
         const duplicateCountEl = container.querySelector('#duplicate-count');
         const invalidCountEl = container.querySelector('#invalid-count');

         if(validCountEl) validCountEl.textContent = `${validKeys.length} valid entries found`;
         if(duplicateCountEl) duplicateCountEl.textContent = `${duplicateLinesInPaste.length} duplicate lines ignored`;
         if(invalidCountEl) invalidCountEl.textContent = `${invalidInputs.length} invalid lines or CVs not found`; 
         
         updateGenerateButtonState();
    }

    // --- Generation Logic ---
    async function handleGenerate(keysToProcessSet) {
        const outputNameInput = container.querySelector('#output-name-input');
        const outputTypeSelect = container.querySelector('#output-type-select');
        const feedback = container.querySelector('#generation-feedback');
        const generateBtn = container.querySelector('#generate-btn');

        if (!outputNameInput || !outputTypeSelect || !feedback || !generateBtn) return;

        const outputName = outputNameInput.value.trim();
        const outputType = outputTypeSelect.value;
        const keysArray = Array.from(keysToProcessSet);

        const showFeedback = (message, type = 'info') => {
            feedback.innerHTML = message;
            feedback.className = `text-center text-sm mt-4 p-4 rounded-lg ${ 
                type === 'error' ? 'bg-error/10 text-error' : 
                type === 'success' ? 'bg-secondary/10 text-secondary' : 
                'bg-primary/10 text-primary' 
            }`;
            feedback.classList.remove('hidden');
            lucide.createIcons();
        };

        if (!outputName) return showFeedback("Please enter an output file/folder name.", 'error');
        if (keysArray.length === 0) return showFeedback("No valid CV keys selected or provided.", 'error');

        generateBtn.disabled = true;

        const numKeys = keysArray.length;
        const etaMessage = `Est. ${new Date(Date.now() + Math.ceil((numKeys * 1.2) + 5) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;

        const progressHtml = `
            <div class="space-y-3">
                <div class="flex justify-between items-center text-sm font-semibold">
                    <span class="text-primary flex items-center"><i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i>Processing ${numKeys} CVs...</span>
                    <span class="text-text-secondary">${etaMessage}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-primary h-2 rounded-full animate-pulse" style="animation: indeterminate 2s infinite linear;"></div>
                </div>
                <p class="text-xs text-text-secondary text-center">Please keep this tab open.</p>
            </div>
            <style>@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }</style>
        `;
        showFeedback(progressHtml, 'info');

        try {
            const formData = new FormData();
            formData.append('payload', JSON.stringify({
                keys: keysArray,
                outputName: outputName,
                outputType: outputType,
                userEmail: user.email
            }));

            const response = await fetch(CV_SORTER_GAS_URL, { method: 'POST', body: formData });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed (${response.status}): ${errorText.substring(0, 200)}`);
            }
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Received unexpected response format from server.");
            }

            const result = await response.json();

            if (result.status === 'success') {
                let successMsg = '<strong class="block mb-2">Success!</strong>';
                if (outputType === 'zip' && result.downloadUrls?.length > 0) {
                    successMsg += `Download: ${result.downloadUrls.map((url, i) => 
                        `<a href="${url}" target="_blank" class="text-primary underline hover:text-primary-dark font-medium">Part ${i + 1}</a>`
                    ).join(', ')}`;
                } else if (outputType === 'gdrive' && result.folderUrl) {
                    successMsg += `<a href="${result.folderUrl}" target="_blank" class="text-primary underline hover:text-primary-dark font-medium">Open Google Drive Folder</a>`;
                }
                showFeedback(successMsg, 'success');
                logActivity?.(user, `CV Sort success: ${outputName} (${keysArray.length} CVs, ${outputType})`);
            } else if (result.status === 'approval_sent') {
                showFeedback(
                    '⏳ <strong>Approval Required</strong><br>Your request has been sent to the admin for approval.<br><span class="text-xs opacity-75 mt-2 block">You will be notified by email.</span>', 
                    'info'
                );
                logActivity?.(user, `CV Sort approval requested: ${outputName}`);
            } else {
                throw new Error(result.message || result.error || 'Unknown error');
            }

        } catch (err) {
            console.error("CV Sorter Fetch Error:", err);
            showFeedback(`<strong>Error:</strong> ${err.message}`, 'error');
            logActivity?.(user, `CV Sort failed: ${outputName} - ${err.message}`);
        } finally {
            generateBtn.disabled = false;
        }
    }

    // --- HTML Template Functions ---
    // NEW "Master-Detail" Shell
    function getToolShellHtml() {
       return `
        <div>
            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 class="text-3xl font-bold text-text-primary">CV Sorter</h1>
                    <p class="text-lg text-text-secondary mt-1">Select, sort, and export CVs in bulk.</p>
                </div>
                <button id="refresh-manifest-btn" title="Reload CV data" class="button-secondary px-3 h-10 w-full md:w-auto">
                    <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>
                    <span class="text-sm font-semibold">Refresh Manifest</span>
                </button>
            </div>
            
            <!-- Main Content Card -->
            <div class="bg-surface rounded-xl shadow-sm border border-border">
                <!-- Master-Detail Layout -->
                <div class="flex flex-col md:flex-row">
                    <!-- Master (Navigation) -->
                    <div class="w-full md:w-1/3 lg:w-1/4 p-6 border-b md:border-b-0 md:border-r border-border">
                        <h3 class="text-lg font-semibold text-text-primary mb-4">Method</h3>
                        <nav class="space-y-2">
                            <button id="tab-list" class="tab-item-vertical active" type="button">
                                <i data-lucide="list-checks" class="w-5 h-5 mr-3"></i>
                                Select from List
                            </button>
                            <button id="tab-paste" class="tab-item-vertical" type="button">
                                <i data-lucide="clipboard-paste" class="w-5 h-5 mr-3"></i>
                                Paste Roll Numbers
                            </button>
                        </nav>
                    </div>
                    
                    <!-- Detail (Tab Content) -->
                    <div id="tab-content-area" class="w-full md:w-2/3 lg:w-3/4 p-6 md:p-8">
                        ${LOADER_HTML}
                    </div>
                </div>

                <!-- Shared Generation Area -->
                <div id="generation-area" class="border-t border-border p-6 md:p-8 space-y-4">
                    <h3 class="text-xl font-semibold text-text-primary">Configuration & Export</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="space-y-1">
                            <label for="output-name-input" class="font-semibold text-text-primary text-sm">Output Name</label>
                            <input type="text" id="output-name-input" placeholder="e.g., Shortlist-Round1" class="input-field">
                        </div>
                        <div class="space-y-1">
                            <label for="output-type-select" class="font-semibold text-text-primary text-sm">Output Type</label>
                            <select id="output-type-select" class="input-field !px-4 !bg-gray-50">
                                <option value="zip">Export as .ZIP</option>
                                <option value="gdrive">Create Google Drive Folder</option>
                            </select>
                        </div>
                        <div class="space-y-1 md:self-end">
                            <button id="generate-btn" disabled class="button-primary w-full">
                                Generate
                            </button>
                        </div>
                    </div>
                    <p id="generation-feedback" class="text-center text-sm mt-2 hidden"></p>
                </div>
            </div>
        </div>`;
    }

    function getSelectListHtml(data) {
        return `
        <div class="space-y-4">
            <h2 class="text-2xl font-semibold text-text-primary">Select from List</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i data-lucide="search" class="w-5 h-5 text-text-secondary"></i>
                    </div>
                    <input type="text" id="cv-search" placeholder="Filter..." class="input-field pl-12 !h-11">
                </div>
                <div id="filter-count" class="h-11 bg-gray-50 border border-border rounded-lg flex items-center px-4 text-text-secondary font-medium">
                    Showing ${data.size} of ${data.size} CVs
                </div>
            </div>
            <!-- CV List Table -->
            <div class="h-[45vh] overflow-y-auto border border-border rounded-lg">
                <table class="styled-table table-zebra">
                    <thead>
                        <tr>
                            <th class="p-4 w-12"><input type="checkbox" id="select-all-checkbox" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0"></th>
                            <th>Roll Number / Variant</th>
                            <th>File Name</th>
                        </tr>
                    </thead>
                    <tbody id="cv-list">
                        ${Array.from(data.entries()).sort().map(([key, itemData]) => `
                            <tr class="cv-item" data-key="${key}" data-filename="${itemData.fileName}">
                                <td class="p-4"><input type="checkbox" data-key="${key}" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" ${selectedKeys.has(key) ? 'checked' : ''}></td>
                                <td class="font-mono text-sm">${key}</td>
                                <td class="text-sm text-text-secondary truncate" title="${itemData.fileName}">${itemData.fileName}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    function getPasteRollsHtml() {
         return `
         <div class="space-y-6">
            <h2 class="text-2xl font-semibold text-text-primary">Paste Roll Numbers</h2>
             <!-- Text Input -->
            <div class="space-y-4">
                 <div class="flex justify-between items-center">
                    <label for="roll-numbers-textarea" class="font-semibold text-text-primary">Roll Numbers & Variants</label>
                    <button id="paste-from-clipboard-btn" class="button-secondary px-3 h-9 text-sm">
                        <i data-lucide="clipboard-paste" class="w-4 h-4 mr-2"></i> Paste
                    </button>
                </div>
                <textarea id="roll-numbers-textarea" class="input-field h-[30vh] p-4 font-mono text-sm resize-y" placeholder="24BC581 A\n23BC501 B..."></textarea>
            </div>
            <!-- Validation -->
            <div class="space-y-6">
                <div class="bg-gray-50 p-6 rounded-xl border border-border">
                     <h3 class="font-semibold text-text-primary mb-4">Live Validation</h3>
                     <div class="space-y-3">
                        <div id="valid-count" class="badge-dot badge-dot-secondary">0 valid entries found</div>
                        <div id="duplicate-count" class="badge-dot badge-dot-warning">0 duplicate lines ignored</div>
                        <div id="invalid-count" class="badge-dot badge-dot-error">0 invalid lines or CVs not found</div>
                     </div>
                </div>
            </div>
        </div>`;
    }

    // --- Initial Tool Load ---
    renderToolShell();

} // End runCVSorter

export { tool };

