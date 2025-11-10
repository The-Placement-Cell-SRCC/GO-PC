// --- NEW: Define a global poller variable ---
// We use 'window' to ensure it's truly global and can be cleared
// when the tool is re-mounted.
if (window.cvSorterPoller) {
  clearInterval(window.cvSorterPoller);
}
window.cvSorterPoller = null;


const tool = {
    name: 'CV Sorter',
    icon: 'folder-search',
    render: () => ({
        html: `<div id="cv-sorter-content" class="page-enter"><div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading CV Sorter...</p></div></div>`
    }),
    onMount: (contentElement, user, { logActivity }) => {
        const toolContainer = contentElement.querySelector('#cv-sorter-content');
        
        // --- NEW: Clear any old pollers when the tool loads ---
        if (window.cvSorterPoller) {
          clearInterval(window.cvSorterPoller);
        }
        
        runCVSorter(toolContainer, user, { logActivity });
    }
};

// --- Main Logic Function ---
function runCVSorter(container, user, { logActivity }) {

    // --- State Variables ---
    let cvData = new Map(); 
    let selectedKeys = new Set();
    let currentMode = 'list'; // 'list' or 'paste'
    const ROLL_VARIANT_REGEX = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i; 
    const CV_SORTER_GAS_URL = "https://script.google.com/macros/s/AKfycbzZL0S7DCmz7WMMPIqFguNvfZvlbO-c4jZmNsoA9ahE5-9seradcbEpu18v7gxKgCom/exec";
    const LOADER_HTML = `<div class="flex items-center justify-center h-full min-h-[40vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading...</p></div>`;

    // --- Helper to show feedback ---
    const showFeedback = (message, type = 'info') => {
        const feedback = container.querySelector('#generation-feedback');
        if (!feedback) return;
        
        feedback.innerHTML = message;
        feedback.className = `text-center text-sm mt-4 p-4 rounded-lg ${ 
            type === 'error' ? 'bg-error/10 text-error' : 
            type === 'success' ? 'bg-success/10 text-success' : 
            'bg-primary/10 text-primary' 
        }`;
        feedback.classList.remove('hidden');
        lucide.createIcons();
    };

    // --- Functions for polling and progress UI ---
    
    /**
     * --- MODIFIED ---
     * Starts polling the 'getJobStatus' endpoint.
     * Now only checks for 'idle' status to stop.
     */
    function startJobPolling() {
      stopJobPolling(); // Clear any existing pollers
      
      window.cvSorterPoller = setInterval(async () => {
        try {
          // Append a random query param to prevent caching
          const pollUrl = `${CV_SORTER_GAS_URL}?action=getJobStatus&cachebust=${Date.now()}`;
          const response = await fetch(pollUrl, { cache: 'no-cache' });
          
          if (!response.ok) {
            console.warn(`Poll request failed with status ${response.status}`);
            return;
          }

          const statusData = await response.json();
          
          if (statusData.status === 'idle') {
            // Job is done!
            stopJobPolling();
            renderProgressUI(null, true); // Render final "complete" state
          } else if (statusData.status === 'processing') {
            // Job is still running, do nothing and let it keep polling.
          } else if (statusData.status === 'error') {
            // This shouldn't happen with the new backend, but good to have
            console.error('Job status returned an error:', statusData.message);
            stopJobPolling();
            showFeedback(`<strong>Error during processing:</strong> ${statusData.message}`, 'error');
            if (container.querySelector('#generate-btn')) container.querySelector('#generate-btn').disabled = false;
          }
          
        } catch (err) {
          console.error('Poll Error:', err);
          // Don't stop polling on a single network error, just log it.
        }
      }, 10000); // Poll every 10 seconds
    }

    /**
     * Clears the polling interval
     */
    function stopJobPolling() {
      if (window.cvSorterPoller) {
        clearInterval(window.cvSorterPoller);
        window.cvSorterPoller = null;
      }
    }

    /**
     * --- MODIFIED ---
     * Renders an indeterminate progress bar with an optional ETA string.
     * No longer shows X of Y counts.
     */
    function renderProgressUI(etaString, isComplete = false) {
        const generateBtn = container.querySelector('#generate-btn');
        
        if (isComplete) {
            if(generateBtn) generateBtn.disabled = false;
            showFeedback(
                '✅ <strong>Processing Complete!</strong><br>Your request has been sent to the admin for final approval.<br><span class="text-xs opacity-75 mt-2 block">You will be notified by email.</span>', 
                'success'
            );
            return;
        }

        // This is the new "processing" state.
        if(generateBtn) generateBtn.disabled = true;

        const progressHtml = `
            <div class="space-y-3">
                <div class="flex justify-between items-center text-sm font-semibold">
                    <span class="text-primary flex items-center"><i data-lucide="loader-2" class="w-4 h-4 mr-2 animate-spin"></i>Processing...</span>
                    ${etaString ? `<span class="text-text-secondary">${etaString}</span>` : ''}
                </div>
                <div class="w-full bg-border rounded-full h-2.5 overflow-hidden">
                    <div class="bg-primary h-2.5 rounded-full" style="width: 100%; animation: indeterminate 2s infinite linear;"></div>
                </div>
                <p class="text-xs text-text-secondary text-center">Please keep this tab open.</p>
            </div>
            <style>
                @keyframes indeterminate {
                    0% { transform: translateX(-100%) scaleX(0.5); }
                    50% { transform: translateX(0) scaleX(0.2); }
                    100% { transform: translateX(100%) scaleX(0.5); }
                }
            </style>
        `;
        showFeedback(progressHtml, 'info');
    }

    // --- Core UI Update Function ---
    function renderToolShell() {
        // Only render if the container is empty (or has the initial loader)
        if (container.querySelector('#cv-sorter-content') || !container.querySelector('#generation-area')) {
             container.innerHTML = getToolShellHtml();
             attachShellEventListeners(); // Attach listeners for shell elements
        }
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
            loadData().then(() => {
                // Once data is re-loaded, render the tab content
                loadTabContent(currentMode);
            });
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
    
    // --- Unchanged Functions ---
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
                    const fileName = parts[2]?.trim().replace(/^"|"$/g, ''); 
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
            
        } catch (e) {
            console.error("Error loading CV data:", e);
            renderToolShell();
            const tabContent = container.querySelector('#tab-content-area');
            if (tabContent) {
                tabContent.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${e.message}</div>`;
            } else {
                 container.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${e.message}</div>`;
            }
        }
    }
     function updateGenerateButtonState() {
        const generateBtn = container.querySelector('#generate-btn');
        const outputNameInput = container.querySelector('#output-name-input');
        if (!generateBtn || !outputNameInput) return;
        
        if (window.cvSorterPoller) {
            generateBtn.disabled = true;
            return;
        }
        
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
    // --- End Unchanged Functions ---


    /**
     * --- MODIFIED ---
     * Calculates client-side ETA.
     * Shows indeterminate progress bar.
     * Calls 'doPost' to start the job.
     * Starts the simplified poller.
     */
    async function handleGenerate(keysToProcessSet) {
        const outputNameInput = container.querySelector('#output-name-input');
        const outputTypeSelect = container.querySelector('#output-type-select');
        const generateBtn = container.querySelector('#generate-btn');

        if (!outputNameInput || !outputTypeSelect || !generateBtn) return;

        const outputName = outputNameInput.value.trim();
        const outputType = outputTypeSelect.value;
        const keysArray = Array.from(keysToProcessSet);

        if (!outputName) return showFeedback("Please enter an output file/folder name.", 'error');
        if (keysArray.length === 0) return showFeedback("No valid CV keys selected or provided.", 'error');

        generateBtn.disabled = true;

        // --- NEW: Client-side ETA calculation ---
        const SECONDS_PER_CV = 4.0; // ~4.0 seconds per CV fetch/copy
        const etaMs = (keysArray.length * SECONDS_PER_CV * 1000) + 20000; // Add 15s buffer for zipping/etc
        const etaDate = new Date(Date.now() + etaMs);
        const etaString = `ETA - ${etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;

        // Show the new indeterminate progress UI
        renderProgressUI(etaString, false); 

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

            if (result.status === 'processing_started') {
                // The job is running! Start polling for updates.
                startJobPolling();
                logActivity?.(user, `CV Sort started: ${outputName} (${keysArray.length} CVs, ${outputType})`);
            
            } else if (result.status === 'error') {
                throw new Error(result.message || 'The server returned an error.');
            } else {
                throw new Error(`Received unexpected status: ${result.status}`);
            }

        } catch (err) {
            console.error("CV Sorter Fetch Error:", err);
            showFeedback(`<strong>Error:</strong> ${err.message}`, 'error');
            logActivity?.(user, `CV Sort failed: ${outputName} - ${err.message}`);
            
            // Re-enable the button on failure
            if (generateBtn) generateBtn.disabled = false;
            stopJobPolling();
        }
    }

    // --- HTML Template Functions (Unchanged) ---
    function getToolShellHtml() {
       return `
        <div>
            <div class="flex justify-between items-center mb-6">
                 <div>
                    <h1 class="text-3xl font-bold text-text-primary">CV Sorter</h1>
                    <p class="text-text-secondary mt-1">Select, sort, and export CVs in bulk from the manifest.</p>
                </div>
                <button id="refresh-manifest-btn" title="Reload CV data" class="button-secondary">
                    <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>
                    <span>Refresh Manifest</span>
                </button>
            </div>
            
            <div class="bg-surface rounded-xl border border-border">
                <div class="p-4 border-b border-border">
                    <nav class="flex space-x-2">
                        <button id="tab-list" class="tab-item active" type="button">
                            <i data-lucide="list-checks" class="w-5 h-5 mr-2"></i>Select from List
                        </button>
                        <button id="tab-paste" class="tab-item" type="button">
                            <i data-lucide="clipboard-paste" class="w-5 h-5 mr-2"></i>Paste Keys
                        </button>
                    </nav>
                </div>

                <div id="tab-content-area" class="p-6">
                    ${LOADER_HTML}
                </div>

                <div id="generation-area" class="p-6 bg-background/50 border-t border-border rounded-b-xl">
                    <div class="grid md:grid-cols-3 gap-4 items-end">
                        <div class="space-y-1">
                            <label for="output-name-input" class="text-sm font-medium text-text-primary">Output Name</label>
                            <input type="text" id="output-name-input" placeholder="e.g., Shortlist-Round1" class="input-field mt-1">
                        </div>
                        <div class="space-y-1">
                            <label for="output-type-select" class="text-sm font-medium text-text-primary">Output Type</label>
                            <select id="output-type-select" class="input-field mt-1">
                                <option value="zip">Export as .ZIP</option>
                                <option value="gdrive">Create Google Drive Folder</option>
                            </select>
                        </div>
                        <button id="generate-btn" disabled class="button-primary w-full">
                           <i data-lucide="folder-sync" class="w-5 h-5 mr-2"></i> Generate
                        </button>
                    </div>
                    <p id="generation-feedback" class="text-center text-sm mt-4 hidden"></p>
                </div>
            </div>
        </div>
        <style>
            .tab-item { @apply flex items-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-text-secondary hover:text-text-primary; }
            .tab-item.active { @apply bg-primary/10 text-primary; }
        </style>
       `;
    }
    function getSelectListHtml(data) {
        return `
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold text-text-primary">Select CVs from Manifest</h3>
                <div class="relative w-1/3">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary"></i>
                    <input type="text" id="cv-search" placeholder="Filter..." class="input-field pl-10">
                </div>
            </div>
            <div id="filter-count" class="text-sm text-text-secondary">Showing ${data.size} of ${data.size} CVs</div>
            <div class="h-[40vh] overflow-y-auto border border-border rounded-lg">
                <table class="styled-table w-full">
                     <thead class="sticky top-0 bg-surface">
                        <tr>
                            <th class="w-12 !pl-4"><input type="checkbox" id="select-all-checkbox" class="input-checkbox"></th>
                            <th>Key</th>
                            <th>File Name</th>
                        </tr>
                    </thead>
                    <tbody id="cv-list">
                        ${Array.from(data.entries()).sort().map(([key, itemData]) => `
                            <tr class="cv-item" data-key="${key}" data-filename="${itemData.fileName}">
                                <td><input type="checkbox" data-key="${key}" class="input-checkbox" ${selectedKeys.has(key) ? 'checked' : ''}></td>
                                <td class="font-mono text-sm">${key}</td>
                                <td class="text-sm text-text-secondary truncate" title="${itemData.fileName}">${itemData.fileName}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }
    function getPasteRollsHtml() {
         return `
         <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <label for="roll-numbers-textarea" class="text-lg font-semibold text-text-primary">Paste CV Keys</label>
                    <button id="paste-from-clipboard-btn" class="button-secondary text-xs !h-7">
                        <i data-lucide="clipboard-paste" class="w-4 h-4 mr-1.5"></i>Paste
                    </button>
                </div>
                <textarea id="roll-numbers-textarea" class="input-field h-48 font-mono text-sm" placeholder="24BC581 A\n23BC501 B..."></textarea>
            </div>
             <div class="bg-background/50 p-4 rounded-lg">
                 <h3 class="font-semibold text-text-primary mb-3 text-sm">Live Validation</h3>
                 <div class="space-y-2">
                    <div id="valid-count" class="badge-dot">0 valid entries found</div>
                    <div id="duplicate-count" class="badge-dot">0 duplicate lines ignored</div>
                    <div id="invalid-count" class="badge-dot">0 invalid lines or CVs not found</div>
                 </div>
            </div>
        </div>`;
    }

    /**
     * --- MODIFIED ---
     * Checks for a running job on load.
     * Shows generic "Processing..." animation if a job is active.
     */
    const checkInitialJobStatus = async () => {
         try {
            const pollUrl = `${CV_SORTER_GAS_URL}?action=getJobStatus&cachebust=${Date.now()}`;
            const response = await fetch(pollUrl, { cache: 'no-cache' });
            const statusData = await response.json();
            
            renderToolShell(); // Render the main UI first

            if (statusData.status === 'processing') {
                // A job is already running! Show the progress bar *without* ETA.
                renderProgressUI(null, false); // Pass null for etaString
                startJobPolling();
            } else {
                // No job, load as normal.
                loadTabContent(currentMode); // <-- Render the default tab
            }
         } catch (e) {
             console.error("Initial job status check failed:", e);
             renderToolShell(); // Load normally even if check fails
             loadTabContent(currentMode); // <-- Render the default tab
         }
    };

    // Start by loading data, which will then render the UI
    loadData().then(() => {
        // After data is loaded, check if a job is running.
        if (cvData.size > 0) {
            checkInitialJobStatus();
        }
        // If cvData.size is 0, loadData() already rendered an error, so do nothing.
    });

} // End runCVSorter

export { tool };