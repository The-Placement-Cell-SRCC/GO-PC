// NOTE: Firebase functions (like collection, addDoc) are passed via onMount from main.js
// No need to import them here directly.

// --- ICONS ---
// Defined locally as they are specific to this tool's UI templates
const CV_ICONS = {
    FOLDER: `<svg class="w-12 h-12 text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>`,
    CHECKLIST: `<svg class="w-12 h-12 text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`,
    ARROW: `<svg class="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 text-primary absolute bottom-8 right-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m14-7H3"></path></svg>`,
    SEARCH: `<svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>`,
    CLIPBOARD: `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`,
    REFRESH: `<svg class="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11A8.1 8.1 0 004.5 9M4 5v4h4m-4 0a8.1 8.1 0 0015.5 2m.5 4v-4h-4"></path></svg>`
};
const LOADER_HTML = `<div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Indexing CV Manifest...</p></div>`;

// --- State Variables ---
let cvData = new Map(); // Key: "24BC581 A", Value: { fileName: "...", gdriveLink: "..." }
let selectedKeys = new Set();
let currentMode = 'loading'; // loading, error, selectMethod, selectList, pasteRolls
const ROLL_VARIANT_REGEX = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i; // Added 'i' flag for case-insensitive matching
const CV_SORTER_GAS_URL = "https://script.google.com/macros/s/AKfycbyMvCESqD2binugno_IC4YbcNcqVGbNCbIYDqBPeMy2NQOaIRvnamI173omWYQ9bwWY/exec";

// --- Tool Definition ---
const tool = {
    name: 'CV Sorter',
    icon: `<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>`,
    render: () => ({
        // Initial HTML structure, content will be loaded dynamically
        html: `<div id="cv-sorter-content">${LOADER_HTML}</div>`
    }),
    // onMount is called by main.js after the initial HTML is rendered
    // It receives the container element, user object, and dependencies like logActivity
    onMount: (contentElement, user, { logActivity }) => {
        const toolContainer = contentElement.querySelector('#cv-sorter-content');
        // Start the main logic for the CV Sorter tool
        runCVSorter(toolContainer, user, { logActivity });
    }
};

// --- Main Logic Function for CV Sorter ---
function runCVSorter(container, user, { logActivity }) {

    // --- Core UI Update Function ---
    function reRender(mode, error = null) {
        currentMode = mode;
        let viewHtml = '';
        switch (mode) {
            case 'error':
                viewHtml = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${error || 'An unknown error occurred.'}</div>`;
                break;
            case 'selectMethod':
                viewHtml = getMethodSelectionHtml(cvData.size);
                break;
            case 'selectList':
                viewHtml = getSelectListHtml();
                break;
            case 'pasteRolls':
                viewHtml = getPasteRollsHtml();
                break;
            default: // 'loading' or unknown
                viewHtml = LOADER_HTML;
        }
        container.innerHTML = viewHtml;
        // Apply entry animation
        const firstChild = container.firstElementChild;
        if (firstChild) firstChild.classList.add('page-enter');
        // Attach event listeners specific to the current view
        attachEventListeners();
    }

    // --- Attaches Event Listeners Based on Current Mode ---
    function attachEventListeners() {
        // --- Common Listeners ---
        const backButton = container.querySelector('#back-to-selection-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                selectedKeys.clear(); // Clear selection when going back
                reRender('selectMethod');
            });
        }

        // --- Mode-Specific Listeners ---
        if (currentMode === 'selectMethod') {
            container.querySelector('#select-from-list-btn')?.addEventListener('click', () => reRender('selectList'));
            container.querySelector('#paste-rolls-btn')?.addEventListener('click', () => reRender('pasteRolls'));
            container.querySelector('#refresh-manifest-btn')?.addEventListener('click', () => {
                reRender('loading'); // Show loader immediately
                loadData(); // Reload data
            });
        } else if (currentMode === 'selectList') {
            const searchInput = container.querySelector('#cv-search');
            const cvList = container.querySelector('#cv-list');
            const selectAllCheckbox = container.querySelector('#select-all-checkbox');
            const generateBtn = container.querySelector('#generate-btn');
            const clearBtn = container.querySelector('#clear-selection-btn');
            const outputNameInput = container.querySelector('#output-name-input');

            const filterCVs = () => {
                const query = searchInput.value.toLowerCase().trim();
                cvList.querySelectorAll('.cv-item').forEach(item => {
                    const key = item.dataset.key?.toLowerCase() || '';
                    const fileName = item.dataset.filename?.toLowerCase() || '';
                    // Show if query matches key OR filename
                    item.style.display = (key.includes(query) || fileName.includes(query)) ? '' : 'none';
                });
            };

            searchInput?.addEventListener('input', filterCVs);

            cvList?.addEventListener('change', (e) => {
                if (e.target.matches('input[type="checkbox"][data-key]')) {
                    const key = e.target.dataset.key;
                    if (e.target.checked) selectedKeys.add(key);
                    else selectedKeys.delete(key);
                    updateSelectionFooter(); // Update footer count and button state
                     // Update select-all checkbox state
                    const allCheckboxes = cvList.querySelectorAll('input[type="checkbox"][data-key]');
                    const allVisibleChecked = Array.from(allCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none' && cb.checked).length;
                    const allVisible = Array.from(allCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none').length;
                    selectAllCheckbox.checked = allVisible > 0 && allVisibleChecked === allVisible;
                    selectAllCheckbox.indeterminate = allVisibleChecked > 0 && allVisibleChecked < allVisible;
                }
            });

            selectAllCheckbox?.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                // Only affect visible checkboxes based on current filter
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
                updateSelectionFooter();
            });

            generateBtn?.addEventListener('click', () => handleGenerate(selectedKeys));
            clearBtn?.addEventListener('click', () => {
                selectedKeys.clear();
                reRender('selectList'); // Re-render to clear checkboxes and footer
            });
             outputNameInput?.addEventListener('input', updateSelectionFooter); // Update button state on name input

            updateSelectionFooter(); // Initial update

        } else if (currentMode === 'pasteRolls') {
            const textArea = container.querySelector('#roll-numbers-textarea');
            const generateBtn = container.querySelector('#generate-btn');
            const pasteBtn = container.querySelector('#paste-from-clipboard-btn');
             const outputNameInput = container.querySelector('#output-name-input');


            textArea?.addEventListener('input', validatePastedKeys);
            pasteBtn?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (textArea) textArea.value = text;
                    validatePastedKeys(); // Validate after pasting
                } catch (err) {
                     console.error('Failed to read clipboard:', err);
                     // Optionally show a user-friendly message here
                }
            });
            generateBtn?.addEventListener('click', () => {
                const { validKeys } = processPastedKeys(textArea?.value || '');
                handleGenerate(new Set(validKeys));
            });
             outputNameInput?.addEventListener('input', validatePastedKeys); // Update button state on name input

            validatePastedKeys(); // Initial validation check
        }
    }

    // --- Fetches and Parses CV Manifest and Links ---
    async function loadData() {
        try {
             // Use Promise.all for concurrent fetching
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


            // Create a map of filename -> gdriveLink from CVlinks.csv
            const linksMap = new Map();
            linksText.split('\n').forEach(line => {
                // Regex to handle commas within quoted fields (like filenames)
                 const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                 if (parts.length >= 2) {
                    const fileName = parts[0]?.trim().replace(/^"|"$/g, ''); // Trim and remove quotes
                    const gdriveLink = parts[1]?.trim().replace(/^"|"$/g, '');
                    if (fileName && gdriveLink) {
                        linksMap.set(fileName.toLowerCase(), gdriveLink); // Use lowercase for robust matching
                    }
                 }
            });

            // Process the manifest file
            const parsedData = new Map();
            let ignoredCount = 0;
            manifestText.split('\n').forEach(line => {
                const fileName = line.trim();
                if (fileName) {
                    const nameWithoutExt = fileName.replace(/\.pdf$/i, ''); // Case-insensitive extension removal
                    const keyMatch = nameWithoutExt.match(ROLL_VARIANT_REGEX);
                    if (keyMatch && keyMatch[0]) {
                        const key = keyMatch[0].toUpperCase(); // Standardize key to uppercase
                        const gdriveLink = linksMap.get(fileName.toLowerCase()) || null; // Match link using lowercase filename
                        if (!parsedData.has(key)) {
                             parsedData.set(key, { fileName, gdriveLink });
                        } else {
                            console.warn(`Duplicate key found in manifest: ${key}. Ignoring entry for file: ${fileName}`);
                            ignoredCount++;
                        }
                    } else {
                        // console.log(`Filename does not match expected pattern: ${fileName}`); // Optional: log files that don't match
                         ignoredCount++;
                    }
                }
            });

            if (parsedData.size === 0) {
                 throw new Error("Manifest file empty or no valid roll number/variant keys found. Please check cv-manifest.csv format (e.g., '24BC123 A.pdf').");
            }
             if (ignoredCount > 0) {
                 console.log(`${ignoredCount} lines ignored from manifest due to format mismatch or duplicates.`);
             }

            cvData = parsedData; // Update global state
            reRender('selectMethod'); // Show selection options
        } catch (e) {
            console.error("Error loading CV data:", e);
            reRender('error', e.message); // Show error view
        }
    }

     // --- Updates the Sticky Footer in SelectList Mode ---
     function updateSelectionFooter() {
        const footer = container.querySelector('#selection-footer');
        const countEl = container.querySelector('#selection-count');
        const generateBtn = container.querySelector('#generate-btn');
        const outputNameInput = container.querySelector('#output-name-input');

        if (!footer || !countEl || !generateBtn || !outputNameInput) return; // Ensure elements exist

         const hasSelection = selectedKeys.size > 0;
         const hasOutputName = outputNameInput.value.trim().length > 0;

         // Toggle footer visibility
         if (hasSelection) {
            footer.classList.remove('translate-y-full', 'opacity-0');
            countEl.textContent = `${selectedKeys.size} CV${selectedKeys.size !== 1 ? 's' : ''} selected`;
         } else {
             footer.classList.add('translate-y-full', 'opacity-0');
             countEl.textContent = '0 CVs selected';
         }

         // Enable/disable generate button
         generateBtn.disabled = !(hasSelection && hasOutputName);
     }


    // --- Processes Text Pasted in pasteRolls Mode ---
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
            // Check for duplicate lines *in the pasted text itself*
             if (seenLines.has(line)) {
                results.duplicateLinesInPaste.add(line);
             }
             seenLines.add(line);

            const keyMatch = line.match(ROLL_VARIANT_REGEX);
            if (keyMatch && keyMatch[0]) {
                const key = keyMatch[0].toUpperCase(); // Standardize to uppercase
                if (cvData.has(key)) {
                    // Check for duplicate *valid keys*
                    if (!seenValidKeys.has(key)) {
                         results.validKeys.add(key);
                         seenValidKeys.add(key);
                    } // else: it's a valid key but already added, ignore duplicate *key*
                } else {
                    results.notFoundKeys.add(key); // Valid format, but key not in cvData
                     results.invalidInputs.add(line); // Also add original line to invalid
                }
            } else {
                results.invalidInputs.add(line); // Doesn't match regex format
            }
        });

        return {
            validKeys: Array.from(results.validKeys), // Return as array
            invalidInputs: Array.from(results.invalidInputs),
            duplicateLinesInPaste: Array.from(results.duplicateLinesInPaste),
            notFoundKeys: Array.from(results.notFoundKeys)
        };
    }

    // --- Validates Pasted Keys and Updates UI ---
    function validatePastedKeys() {
         const textArea = container.querySelector('#roll-numbers-textarea');
         const outputNameInput = container.querySelector('#output-name-input');
         const generateBtn = container.querySelector('#generate-btn');

         if (!textArea || !outputNameInput || !generateBtn) return; // Ensure elements exist

         const { validKeys, invalidInputs, duplicateLinesInPaste, notFoundKeys } = processPastedKeys(textArea.value);

         // Update validation counts in the UI
         container.querySelector('#valid-count').textContent = `${validKeys.length} valid entries found`;
         container.querySelector('#duplicate-count').textContent = `${duplicateLinesInPaste.length} duplicate lines ignored`;
         container.querySelector('#invalid-count').textContent = `${invalidInputs.length} invalid lines or CVs not found`; // Combined count

         // Update ready count
         container.querySelector('#ready-to-generate-count').textContent = `Ready to sort ${validKeys.length} CVs`;

         // Enable/disable button based on validation and output name
         const hasValidKeys = validKeys.length > 0;
         const hasOutputName = outputNameInput.value.trim().length > 0;
         generateBtn.disabled = !(hasValidKeys && hasOutputName);
    }


    // --- Handles the Generation Request (ZIP or GDrive) ---
    async function handleGenerate(keysToProcessSet) {
    const outputNameInput = container.querySelector('#output-name-input');
    const outputTypeSelect = container.querySelector('#output-type-select');
    const feedback = container.querySelector('#generation-feedback');
    const generateBtn = container.querySelector('#generate-btn');

    if (!outputNameInput || !outputTypeSelect || !feedback || !generateBtn) {
        console.error("Could not find necessary UI elements for generation.");
        return;
    }

    const outputName = outputNameInput.value.trim();
    const outputType = outputTypeSelect.value;
    const keysArray = Array.from(keysToProcessSet);

    const showFeedback = (message, type = 'info') => {
        feedback.innerHTML = message;
        feedback.className = `text-center text-sm mt-2 ${ 
            type === 'error' ? 'text-error' : 
            type === 'success' ? 'text-secondary' : 
            'text-primary' 
        }`;
        feedback.classList.remove('hidden');
    };

    if (!outputName) return showFeedback("Please enter an output file/folder name.", 'error');
    if (keysArray.length === 0) return showFeedback("No valid CV keys selected or provided.", 'error');

    generateBtn.disabled = true;
    showFeedback(`Sending request to process ${keysArray.length} CVs... <div class="loader-small inline-block ml-2"></div>`, 'info');

    try {
        // IMPORTANT: Update this URL with your deployment URL
        const GAS_URL = CV_SORTER_GAS_URL;
        
        console.log('Sending request to:', GAS_URL);

        // Create form data to avoid preflight
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            keys: keysArray,
            outputName: outputName,
            outputType: outputType,
            userEmail: user.email
        }));

        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: formData,
            // No Content-Type header - let browser set it for FormData
            // This avoids CORS preflight
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Request failed (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const contentType = response.headers.get("content-type");
        if (!(contentType && contentType.includes("application/json"))) {
            const responseText = await response.text();
            console.error('Non-JSON response:', responseText);
            throw new Error("Received unexpected response format from server.");
        }

        const result = await response.json();
        console.log('Success result:', result);

        if (result.status === 'success') {
            let successMsg = 'Success! ';
            if (outputType === 'zip' && result.downloadUrls && result.downloadUrls.length > 0) {
                successMsg += `Download: ${result.downloadUrls.map((url, i) => 
                    `<a href="${url}" target="_blank" class="text-primary underline hover:text-primary-dark">Part ${i + 1}</a>`
                ).join(', ')}`;
            } else if (outputType === 'gdrive' && result.folderUrl) {
                successMsg += `<a href="${result.folderUrl}" target="_blank" class="text-primary underline hover:text-primary-dark">Open Folder</a>`;
            }
            showFeedback(successMsg, 'success');
            if (typeof logActivity === 'function') {
                logActivity(user, `CV Sort success: ${outputName} (${keysArray.length} CVs, ${outputType})`);
            }
        } else if (result.status === 'approval_sent') {
            showFeedback('Request sent for admin approval. You will be notified when processed.', 'info');
            if (typeof logActivity === 'function') {
                logActivity(user, `CV Sort approval requested: ${outputName}`);
            }
        } else {
            throw new Error(result.message || result.error || 'Unknown error occurred');
        }

    } catch (err) {
        console.error("CV Sorter Fetch Error:", err);
        showFeedback(`Error: ${err.message}`, 'error');
        if (typeof logActivity === 'function') {
            logActivity(user, `CV Sort failed: ${outputName} - ${err.message}`);
        }
    } finally {
        generateBtn.disabled = false;
    }
}

    // --- HTML Template Functions ---
    // NOTE: These return strings to be used with innerHTML in reRender()

    function getMethodSelectionHtml(count) {
       // Provides buttons to choose between selecting from a list or pasting roll numbers
       return `
            <div class="relative text-center flex flex-col items-center justify-center min-h-[70vh] page-enter">
                 <!-- Refresh Button -->
                 <div class="absolute top-0 right-0 p-4">
                    <button id="refresh-manifest-btn" title="Reload CV data from server" class="group flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors">
                        ${CV_ICONS.REFRESH}
                        <span class="ml-2 text-sm font-semibold text-text-secondary group-hover:text-primary">Refresh Manifest</span>
                    </button>
                </div>
                <!-- Header -->
                <h2 class="text-3xl font-bold mb-2 text-text-primary">CV Sorter</h2>
                <p class="text-lg text-text-secondary mb-12">Select, sort, and export CVs.</p>
                <!-- Action Cards -->
                <div class="flex flex-col md:flex-row gap-8">
                    <!-- Select From List Card -->
                    <button id="select-from-list-btn" class="action-card">
                        ${CV_ICONS.CHECKLIST}
                        <h3 class="text-2xl font-semibold mb-2 text-text-primary">Select from List</h3>
                        <p class="text-text-secondary flex-grow">Browse and select students from the complete list of available CVs.</p>
                        <div class="flex justify-between items-center text-sm mt-4">
                            <span class="badge-blue">Best for: Precision</span>
                            <span class="text-text-secondary">${count} CVs indexed</span>
                        </div>
                        ${CV_ICONS.ARROW} <!-- Hover arrow indicator -->
                    </button>
                    <!-- Paste Roll Numbers Card -->
                    <button id="paste-rolls-btn" class="action-card">
                         ${CV_ICONS.FOLDER}
                        <h3 class="text-2xl font-semibold mb-2 text-text-primary">Paste Roll Numbers</h3>
                        <p class="text-text-secondary flex-grow">Quickly paste a list of roll number & variant combinations for bulk sorting.</p>
                        <div class="flex justify-between items-center text-sm mt-4">
                            <span class="badge-blue">Best for: Bulk Actions</span>
                            <span class="text-text-secondary">Faster for large lists</span>
                        </div>
                         ${CV_ICONS.ARROW} <!-- Hover arrow indicator -->
                    </button>
                </div>
            </div>`;
    }

    function getSelectListHtml() {
        // Displays the searchable list of CVs with checkboxes
        return `
        <div class="relative min-h-[70vh] page-enter">
             <!-- Back Button -->
            <button id="back-to-selection-btn" class="mb-8 text-sm text-text-secondary hover:text-text-primary flex items-center group transition-colors">
                <svg class="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Back to Method Selection
            </button>
            <div class="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-border">
                <!-- Search and Count -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                     <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">${CV_ICONS.SEARCH}</div>
                        <input type="text" id="cv-search" placeholder="Filter by roll number & variant or filename..." class="input-field pl-12">
                    </div>
                    <div class="h-[48px] bg-gray-50 border border-border rounded-lg flex items-center px-4 text-text-secondary">
                        Showing ${cvData.size} CVs
                    </div>
                </div>
                 <!-- CV List Table -->
                <div class="h-[45vh] overflow-y-auto border border-border rounded-lg">
                    <table class="w-full text-left table-auto">
                        <thead class="sticky top-0 bg-gray-50 z-10">
                            <tr>
                                <th class="p-4 w-12"><input type="checkbox" id="select-all-checkbox" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0"></th>
                                <th class="p-4 font-semibold text-sm">Roll Number / Variant</th>
                                <th class="p-4 font-semibold text-sm">File Name</th>
                            </tr>
                        </thead>
                        <tbody id="cv-list" class="divide-y divide-border">
                            ${Array.from(cvData.entries()).sort().map(([key, data]) => `
                                <tr class="cv-item hover:bg-gray-50 transition-colors duration-150" data-key="${key}" data-filename="${data.fileName}">
                                    <td class="p-4"><input type="checkbox" data-key="${key}" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" ${selectedKeys.has(key) ? 'checked' : ''}></td>
                                    <td class="p-4 font-mono text-sm">${key}</td>
                                    <td class="p-4 text-sm text-text-secondary truncate" title="${data.fileName}">${data.fileName}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
             <!-- Sticky Footer for Actions -->
            <div id="selection-footer" class="fixed bottom-0 left-[260px] right-0 bg-surface/90 backdrop-blur-sm p-4 border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.05)] transform translate-y-full opacity-0 transition-all duration-300 z-20">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center gap-4 justify-between">
                     <!-- Selection Count and Clear Button -->
                    <div class="flex-shrink-0">
                        <p id="selection-count" class="font-semibold text-lg text-text-primary">0 CVs selected</p>
                        <button id="clear-selection-btn" class="text-sm text-text-secondary hover:text-error transition-colors">Clear selection</button>
                    </div>
                     <!-- Output Options and Generate Button -->
                    <div class="flex flex-wrap items-center gap-4 flex-grow justify-end">
                        <input id="output-name-input" type="text" placeholder="Enter file/folder name..." class="input-field w-full sm:w-auto md:w-1/3 flex-grow sm:flex-grow-0" />
                        <select id="output-type-select" class="input-field w-full sm:w-auto md:w-1/5 h-[48px] !px-4 !bg-gray-50 flex-grow sm:flex-grow-0">
                            <option value="zip">Export as .ZIP</option>
                            <option value="gdrive">Create Google Drive Folder</option>
                        </select>
                        <button id="generate-btn" class="button-primary px-6 h-[48px] w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            Generate
                        </button>
                    </div>
                </div>
                 <!-- Feedback Area -->
                 <p id="generation-feedback" class="text-center text-sm mt-2 hidden w-full"></p>
            </div>
        </div>`;
    }

    function getPasteRollsHtml() {
         // Provides a textarea for pasting roll numbers and shows validation
         return `
        <div class="relative min-h-[70vh] page-enter">
             <!-- Back Button -->
            <button id="back-to-selection-btn" class="mb-8 text-sm text-text-secondary hover:text-text-primary flex items-center group transition-colors">
               <svg class="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
               Back to Method Selection
            </button>
             <!-- Instructions -->
            <div class="bg-blue-50 border-l-4 border-primary text-blue-800 p-4 rounded-r-lg mb-8 text-sm">
                <p>Paste roll numbers with variants (e.g., <code class="font-mono bg-blue-100 px-1 rounded">24BC581 A</code>), one per line. Invalid formats, duplicates, and non-existent CVs will be flagged.</p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Left Panel: Text Input -->
                <div class="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-border space-y-4">
                     <div class="flex justify-between items-center">
                        <label for="roll-numbers-textarea" class="font-semibold text-text-primary">Paste Roll Numbers & Variants</label>
                        <button id="paste-from-clipboard-btn" class="text-sm text-primary font-semibold flex items-center hover:text-primary-dark transition-colors">
                            ${CV_ICONS.CLIPBOARD} Paste
                        </button>
                    </div>
                    <textarea id="roll-numbers-textarea" class="w-full h-[40vh] p-4 font-mono text-sm bg-gray-50 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y" placeholder="24BC581 A\n23BC501 B..."></textarea>
                </div>
                <!-- Right Panel: Validation & Generation -->
                <div class="space-y-6">
                     <!-- Validation Status Box -->
                    <div class="bg-surface p-6 rounded-xl shadow-sm border border-border">
                         <h3 class="font-semibold text-text-primary mb-4">Live Validation</h3>
                         <div class="space-y-3 text-sm">
                            <div id="valid-count" class="flex items-center text-secondary"><span class="h-2 w-2 bg-secondary rounded-full mr-3 shrink-0"></span>0 valid entries found</div>
                            <div id="duplicate-count" class="flex items-center text-warning-amber"><span class="h-2 w-2 bg-warning-amber rounded-full mr-3 shrink-0"></span>0 duplicate lines ignored</div>
                            <div id="invalid-count" class="flex items-center text-error"><span class="h-2 w-2 bg-error rounded-full mr-3 shrink-0"></span>0 invalid lines or CVs not found</div>
                         </div>
                    </div>
                    <!-- Generation Box -->
                    <div class="bg-surface p-6 rounded-xl shadow-sm border border-border space-y-4">
                         <h3 id="ready-to-generate-count" class="text-lg font-semibold text-center text-text-primary">Ready to sort 0 CVs</h3>
                          <!-- Output Name Input -->
                         <div class="space-y-1">
                             <label for="output-name-input" class="font-semibold text-text-primary text-sm">Output Name</label>
                             <input type="text" id="output-name-input" placeholder="e.g., Shortlist-Round1" class="input-field">
                         </div>
                          <!-- Output Type Select -->
                         <div class="space-y-1">
                              <label for="output-type-select" class="font-semibold text-text-primary text-sm">Output Type</label>
                              <select id="output-type-select" class="input-field h-[48px] !px-4 !bg-gray-50">
                                <option value="zip">Export as .ZIP</option>
                                <option value="gdrive">Create Google Drive Folder</option>
                              </select>
                         </div>
                          <!-- Generate Button -->
                         <button id="generate-btn" disabled class="button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                            Generate
                         </button>
                          <!-- Feedback Area -->
                         <p id="generation-feedback" class="text-center text-sm mt-2 hidden"></p>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // --- Initial Data Load ---
    loadData(); // Start by loading the CV data

} // End runCVSorter


// Export the tool object for main.js
export { tool };

// Removed the duplicate onAuthStateChanged, renderAppShell, etc. logic from here.
// It belongs in main.js.
