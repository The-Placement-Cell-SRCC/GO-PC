// NO CHANGES REQUIRED
// This tool's HTML structure is already modular and will
// inherit the new styles from style.css automatically.
const tool = {
    name: 'VCF Generator',
    icon: 'contact', // Lucide icon name
    render: () => ({
        html: `<div id="vcf-generator-content" class="page-enter"><div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading Student Data...</p></div></div>`
    }),
    onMount: (contentElement, user, { logActivity }) => {
        const toolContainer = contentElement.querySelector('#vcf-generator-content');
        runVCFGenerator(toolContainer, user, { logActivity });
    }
};

// --- Main Logic Function ---
function runVCFGenerator(container, user, { logActivity }) {
    // --- Constants & State ---
    const LOADER_HTML = `<div class_id="loader-wrapper" class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading Student Data...</p></div>`;
    let studentData = [], studentDataMap = new Map(), selectedStudents = new Set();
    let currentMode = 'loading'; // 'loading', 'selectMethod', 'list', 'paste'
    const ROLL_NUMBER_REGEX = /^\d{2}[A-Z]{2}\d{3}$/i; 
    const CSV_FILE_PATH = '/number_list.csv'; 

    // --- Core UI Update Function ---
    function render(mode, error = null) {
        currentMode = mode;
        let viewHtml = '';

        switch (mode) {
            case 'selectMethod':
                viewHtml = getMethodSelectionHtml(studentData.length);
                break;
            case 'list':
                viewHtml = getSelectListHtml(studentData);
                break;
            case 'paste':
                viewHtml = getPasteRollsHtml();
                break;
            case 'error':
                 viewHtml = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${error || 'An unknown error occurred.'}</div>`;
                 break;
            case 'loading':
            default:
                viewHtml = LOADER_HTML;
        }

        // Apply fade-in animation to the new content
        // Add a key to the div to force re-animation
        const animationKey = `anim-${Date.now()}`;
        container.innerHTML = `<div class="content-enter-fade" key="${animationKey}">${viewHtml}</div>`;
        lucide.createIcons();
        attachEventListeners(); // Attach listeners for the new view
    }

    // --- Event Listeners ---
    function attachEventListeners() {
         // --- Common Listeners ---
        container.querySelector('#refresh-csv-btn')?.addEventListener('click', () => {
            render('loading'); 
            loadData(); 
        });
        
        container.querySelector('#back-to-selection-btn')?.addEventListener('click', () => {
            selectedStudents.clear(); // Clear selection
            render('selectMethod');
        });

        // --- Mode-Specific Listeners ---
         if (currentMode === 'selectMethod') {
            container.querySelector('#select-from-list-btn')?.addEventListener('click', () => render('list'));
            container.querySelector('#paste-rolls-btn')?.addEventListener('click', () => render('paste'));
        
        } else if (currentMode === 'list') {
            const searchInput = container.querySelector('#student-search');
            const studentList = container.querySelector('#student-list');
            const selectAllCheckbox = container.querySelector('#select-all-checkbox');
            const generateBtn = container.querySelector('#generate-vcf-btn');

            const filterStudents = () => {
                if (!searchInput || !studentList) return;
                const query = searchInput.value.toLowerCase().trim();
                let visibleCount = 0;
                studentList.querySelectorAll('.student-item').forEach(item => {
                    const name = item.dataset.name?.toLowerCase() || '';
                    const roll = item.dataset.roll?.toLowerCase() || '';
                    const isVisible = (name.includes(query) || roll.includes(query));
                    item.style.display = isVisible ? '' : 'none';
                    if (isVisible) visibleCount++;
                });
                const filterCountEl = container.querySelector('#filter-count');
                if(filterCountEl) filterCountEl.textContent = `Showing ${visibleCount} of ${studentData.length} students`;
            };

            searchInput?.addEventListener('input', filterStudents);
            filterStudents(); 

            studentList?.addEventListener('change', (e) => {
                if (e.target.matches('input[type="checkbox"][data-roll]')) {
                    const roll = e.target.dataset.roll; 
                    if (e.target.checked) selectedStudents.add(roll);
                    else selectedStudents.delete(roll);
                    updateGenerateButtonState('list');
                    
                    const allCheckboxes = studentList.querySelectorAll('input[type="checkbox"][data-roll]');
                    const allVisibleChecked = Array.from(allCheckboxes).filter(cb => cb.closest('li').style.display !== 'none' && cb.checked).length;
                    const allVisible = Array.from(allCheckboxes).filter(cb => cb.closest('li').style.display !== 'none').length;
                    if(selectAllCheckbox) {
                        selectAllCheckbox.checked = allVisible > 0 && allVisibleChecked === allVisible;
                        selectAllCheckbox.indeterminate = allVisibleChecked > 0 && allVisibleChecked < allVisible;
                    }
                }
            });

            selectAllCheckbox?.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                studentList.querySelectorAll('.student-item').forEach(item => {
                    if (item.style.display !== 'none') {
                        const checkbox = item.querySelector('input[type="checkbox"]');
                        if (checkbox) {
                            checkbox.checked = isChecked;
                            const roll = checkbox.dataset.roll;
                            if (isChecked) selectedStudents.add(roll);
                            else selectedStudents.delete(roll);
                        }
                    }
                });
                updateGenerateButtonState('list');
            });

            generateBtn?.addEventListener('click', () => {
                const suffix = container.querySelector('#suffix-input')?.value.trim() || '';
                const studentsToGenerate = studentData.filter(s => selectedStudents.has(s.roll));
                if (studentsToGenerate.length > 0) {
                     generateVCF(studentsToGenerate, suffix);
                     logActivity(user, `Generated VCF (List) (${studentsToGenerate.length} contacts, suffix: ${suffix || 'none'})`);
                }
            });
            
            updateGenerateButtonState('list'); // Initial check

        } else if (currentMode === 'paste') {
            const textArea = container.querySelector('#roll-numbers-textarea');
            const pasteBtn = container.querySelector('#paste-from-clipboard-btn');
            const generateBtn = container.querySelector('#generate-vcf-btn');
            
            textArea?.addEventListener('input', validatePastedRolls);
            pasteBtn?.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (textArea) textArea.value = text;
                    validatePastedRolls(); 
                } catch (err) {
                     console.error('Failed to read clipboard contents: ', err);
                }
            });
            
            generateBtn?.addEventListener('click', () => {
                const suffix = container.querySelector('#suffix-input')?.value.trim() || '';
                const { validStudents } = processPastedRolls(textArea?.value || '');
                if (validStudents.length > 0) {
                    generateVCF(validStudents, suffix);
                    logActivity(user, `Generated VCF (Paste) (${validStudents.length} contacts, suffix: ${suffix || 'none'})`);
                }
            });

            validatePastedRolls(); // Initial validation
        }
    }
    
    // --- Data Loading ---
    async function loadData() {
        try {
            const response = await fetch(CSV_FILE_PATH, { cache: 'no-store' });
            if (!response.ok) {
                 throw new Error(`Could not load '${CSV_FILE_PATH}'. Status: ${response.status}.`);
            }
            const text = await response.text();

             const parsed = text.split('\n').map(line => {
                 const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                 if (parts.length < 3) return null; 
                 const name = parts[0]?.trim().replace(/^"|"$/g, ''); 
                 const roll = parts[1]?.trim().toUpperCase(); 
                 const contact = parts[2]?.trim();
                 if (name && roll && contact && ROLL_NUMBER_REGEX.test(roll)) {
                     return { name, roll, contact }; 
                 }
                 return null; 
             }).filter(Boolean); 

            if (parsed.length === 0) {
                 throw new Error(`CSV file ('${CSV_FILE_PATH}') is empty or contains no valid data.`);
             }

            studentData = parsed.sort((a, b) => a.name.localeCompare(b.name)); 
            studentDataMap = new Map(studentData.map(s => [s.roll, s])); 
            render('selectMethod'); 
        } catch (e) {
            console.error("Error loading CSV data:", e);
            render('error', e.message); 
        }
    }

    // --- UI Updates ---
    function updateGenerateButtonState(mode) {
        const generateBtn = container.querySelector('#generate-vcf-btn');
        if (!generateBtn) return;
        
        let hasValidSelection = false;

        if (mode === 'list') {
            hasValidSelection = selectedStudents.size > 0;
        } else if (mode === 'paste') {
            const textArea = container.querySelector('#roll-numbers-textarea');
            if (textArea) {
                const { validStudents } = processPastedRolls(textArea.value || '');
                hasValidSelection = validStudents.length > 0;
            }
        }

         generateBtn.disabled = !hasValidSelection;
     }

    function processPastedRolls(text) {
         const allPasted = text.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean); 
         const results = {
             validStudents: [],
             invalidOrNotFound: new Set(), 
             duplicateRollsInPaste: new Set() 
         };
         const seenLines = new Set();
         const seenValidRolls = new Set();

         allPasted.forEach(rollInput => {
             if (seenLines.has(rollInput)) {
                 results.duplicateRollsInPaste.add(rollInput);
             }
             seenLines.add(rollInput);

             if (ROLL_NUMBER_REGEX.test(rollInput) && studentDataMap.has(rollInput)) {
                  if (!seenValidRolls.has(rollInput)) {
                      results.validStudents.push(studentDataMap.get(rollInput));
                      seenValidRolls.add(rollInput);
                  }
             } else {
                 results.invalidOrNotFound.add(rollInput); 
             }
         });

         return {
             validStudents: results.validStudents, 
             invalidOrNotFound: Array.from(results.invalidOrNotFound),
             duplicateRollsInPaste: Array.from(results.duplicateRollsInPaste)
         };
     }

    function validatePastedRolls() {
        const textArea = container.querySelector('#roll-numbers-textarea');
        if (!textArea) return;
        
        const { validStudents, invalidOrNotFound, duplicateRollsInPaste } = processPastedRolls(textArea.value);

         container.querySelector('#valid-count').textContent = `${validStudents.length} valid roll numbers found`;
         container.querySelector('#duplicate-count').textContent = `${duplicateRollsInPaste.length} duplicate lines ignored`;
         container.querySelector('#invalid-count').textContent = `${invalidOrNotFound.length} invalid or not found`;

         updateGenerateButtonState('paste');
    }

    // --- Generation Logic ---
    function generateVCF(studentsToGenerate, suffix) {
        if (!studentsToGenerate || studentsToGenerate.length === 0) return;
        
        let vcfString = '';
        studentsToGenerate.forEach(student => {
            const fullName = `${student.name} || ${student.roll}${suffix ? ` || ${suffix}` : ''}`;
            const escapeVCF = (str) => str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
            const safeFullName = escapeVCF(fullName);
            const safeContact = escapeVCF(student.contact);
            const nameParts = student.name.split(' ');
            const lastName = nameParts.length > 1 ? escapeVCF(nameParts.pop()) : ''; 
            const firstName = escapeVCF(nameParts.join(' ')); 

            vcfString += 'BEGIN:VCARD\n';
            vcfString += 'VERSION:3.0\n';
            vcfString += `FN:${safeFullName}\n`;
            vcfString += `N:${lastName};${firstName};;;\n`; 
            vcfString += `TEL;TYPE=CELL:${safeContact}\n`;
            vcfString += `ORG:${escapeVCF(student.roll)}\n`;
            vcfString += `NOTE:Roll: ${escapeVCF(student.roll)}${suffix ? `\\nSuffix: ${escapeVCF(suffix)}` : ''}\n`;
            vcfString += 'END:VCARD\n\n'; 
        });

        if (vcfString) {
            try {
                const blob = new Blob([vcfString], { type: 'text/vcard;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const dateStr = new Date().toISOString().slice(0, 10); 
                a.download = `gopc_contacts_${dateStr}${suffix ? ('_' + suffix.replace(/[^a-z0-9]/gi, '_')) : ''}.vcf`; 
                document.body.appendChild(a);
                a.click(); 
                document.body.removeChild(a); 
                URL.revokeObjectURL(url); 
            } catch (e) {
                console.error("Error generating VCF blob/download:", e);
            }
        }
    }

    // --- HTML Template Functions ---
    // STEP 1: Method Selection
    function getMethodSelectionHtml(count) {
        return `
            <div class="flex flex-col items-center justify-center min-h-[70vh]">
                <!-- Header -->
                <div class="text-center">
                    <div class="w-16 h-16 bg-primary/10 text-primary flex items-center justify-center rounded-2xl mb-4 mx-auto">
                        <i data-lucide="contact" class="w-8 h-8"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-text-primary">VCF Generator</h1>
                    <p class="text-lg text-text-secondary mt-1">Create vCard files from the student contact list.</p>
                </div>
                
                <!-- Refresh Button -->
                <div class="absolute top-0 right-0 p-4">
                    <button id="refresh-csv-btn" title="Reload data" class="button-secondary px-3 h-10">
                        <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i>
                        <span class="text-sm font-semibold">Refresh CSV</span>
                    </button>
                </div>

                <!-- Action Cards -->
                <div class="flex flex-col md:flex-row gap-8 mt-12">
                    <button id="select-from-list-btn" class="action-card">
                        <i data-lucide="list-checks" class="w-10 h-10 text-primary mb-4"></i>
                        <h3 class="text-2xl font-semibold mb-2 text-text-primary">Select from List</h3>
                        <p class="text-text-secondary flex-grow">Browse and select students from the complete list.</p>
                        <div class="flex justify-between items-center text-sm mt-6 pt-4 border-t border-border">
                            <span class="text-xs font-medium bg-primary/10 text-primary py-1 px-2 rounded-full">Best for: Selective generation</span>
                            <span class="text-text-secondary font-medium">${count} students</span>
                        </div>
                        <i data-lucide="arrow-right" class="opacity-0 group-hover:opacity-100 transition-all w-6 h-6 text-primary absolute bottom-8 right-8 group-hover:translate-x-1 duration-200"></i>
                    </button>
                    <button id="paste-rolls-btn" class="action-card">
                        <i data-lucide="clipboard-paste" class="w-10 h-10 text-primary mb-4"></i>
                        <h3 class="text-2xl font-semibold mb-2 text-text-primary">Paste Roll Numbers</h3>
                        <p class="text-text-secondary flex-grow">Quickly paste a list of roll numbers for bulk generation.</p>
                        <div class="flex justify-between items-center text-sm mt-6 pt-4 border-t border-border">
                            <span class="text-xs font-medium bg-primary/10 text-primary py-1 px-2 rounded-full">Best for: Quick bulk operations</span>
                            <span class="text-text-secondary font-medium">Faster for large batches</span>
                        </div>
                        <i data-lucide="arrow-right" class="opacity-0 group-hover:opacity-100 transition-all w-6 h-6 text-primary absolute bottom-8 right-8 group-hover:translate-x-1 duration-200"></i>
                    </button>
                </div>
            </div>`;
    }

    // STEP 2: Select from List
    function getSelectListHtml(data) {
        return `
        <div class="bg-surface rounded-xl shadow-sm border border-border">
            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 p-6 md:p-8 border-b border-border">
                <div class="flex items-center gap-4">
                     <button id="back-to-selection-btn" class="button-secondary !h-10 !w-10 !p-0 rounded-full hover:bg-gray-100">
                        <i data-lucide="arrow-left" class="w-5 h-5"></i>
                    </button>
                    <div>
                        <h2 class="text-2xl font-semibold text-text-primary">Select from List</h2>
                        <p class="text-text-secondary">Step 2 of 2: Choose students to include</p>
                    </div>
                </div>
                <div class-id="filter-container" class="relative">
                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <i data-lucide="search" class="w-5 h-5 text-text-secondary"></i>
                    </div>
                    <input type="text" id="student-search" placeholder="Filter by name or roll number..." class="input-field pl-12 !h-11 w-full md:w-64">
                </div>
            </div>

            <!-- List Content -->
            <div class="p-6 md:p-8">
                <div id="filter-count" class="h-11 bg-background border border-border rounded-lg flex items-center px-4 text-text-secondary font-medium mb-4 text-sm">
                    Showing ${data.length} of ${data.length} students
                </div>
                <!-- Student List -->
                <div class="h-[45vh] overflow-y-auto border border-border rounded-lg bg-white">
                    <div class="flex items-center p-4 border-b border-border sticky top-0 bg-surface z-10">
                        <input type="checkbox" id="select-all-checkbox" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0">
                        <label for="select-all-checkbox" class="ml-4 font-semibold text-text-primary cursor-pointer text-sm">Select All Visible</label>
                    </div>
                    <ul id="student-list" class="divide-y divide-border">
                        ${data.map(s => `
                            <li class="student-item" data-name="${s.name}" data-roll="${s.roll}">
                                <label class="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                                    <input type="checkbox" data-roll="${s.roll}" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0 mr-4 shrink-0" ${selectedStudents.has(s.roll) ? 'checked' : ''}>
                                    <div class="flex-grow flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
                                        <p class="font-medium text-text-primary truncate mr-4 text-sm">${s.name}</p>
                                        <p class="text-sm text-text-secondary font-mono shrink-0">${s.roll}</p>
                                    </div>
                                </label>
                            </li>
                        `).join('')}
                         ${data.length === 0 ? '<li class="p-4 text-center text-text-secondary">No student data loaded.</li>' : ''}
                    </ul>
                </div>
            </div>
            
            <!-- Generation Area -->
            <div class="border-t border-border p-6 md:p-8 mt-2 space-y-4 bg-background rounded-b-xl">
                <h3 class="text-xl font-semibold text-text-primary">Configuration & Export</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="space-y-1 md:col-span-2">
                        <label for="suffix-input" class="font-semibold text-text-primary text-sm">Suffix (Optional)</label>
                        <input type="text" id="suffix-input" placeholder="e.g., Placement 2025" class="input-field">
                        <p class="text-xs text-text-secondary mt-1">Added as: <code class="text-xs">[Name] || [Roll] || [Suffix]</code></p>
                    </div>
                    <div class="space-y-1 md:self-end">
                        <button id="generate-vcf-btn" disabled class="button-primary w-full">
                            Generate VCF File
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // STEP 2: Paste Roll Numbers
    function getPasteRollsHtml() {
         return `
         <div class="bg-surface rounded-xl shadow-sm border border-border">
            <!-- Header -->
            <div class="flex items-center gap-4 p-6 md:p-8 border-b border-border">
                 <button id="back-to-selection-btn" class="button-secondary !h-10 !w-10 !p-0 rounded-full hover:bg-gray-100">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div>
                    <h2 class="text-2xl font-semibold text-text-primary">Paste Roll Numbers</h2>
                    <p class="text-text-secondary">Step 2 of 2: Paste list and validate</p>
                </div>
            </div>
         
            <!-- Content -->
             <div class="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Left Panel: Text Input -->
                <div class="space-y-4">
                     <div class="flex justify-between items-center">
                        <label for="roll-numbers-textarea" class="font-semibold text-text-primary">Roll Numbers</label>
                        <button id="paste-from-clipboard-btn" class="button-secondary px-3 h-9 text-sm">
                            <i data-lucide="clipboard-paste" class="w-4 h-4 mr-2"></i> Paste
                        </button>
                    </div>
                    <textarea id="roll-numbers-textarea" class="input-field h-[40vh] p-4 font-mono text-sm resize-y" placeholder="24BC718\n23BC501\n22BC187..."></textarea>
                </div>
                <!-- Right Panel: Validation -->
                <div class="space-y-6">
                    <div class="bg-background p-6 rounded-xl border border-border">
                         <h3 class="font-semibold text-text-primary mb-4">Live Validation</h3>
                         <div class="space-y-3">
                            <div id="valid-count" class="badge-dot badge-dot-success">0 valid roll numbers found</div>
                            <div id="duplicate-count" class="badge-dot badge-dot-warning">0 duplicate lines ignored</div>
                            <div id="invalid-count" class="badge-dot badge-dot-error">0 invalid or not found</div>
                         </div>
                    </div>
                    <div class="bg-blue-50 border-l-4 border-primary text-blue-800 p-4 rounded-r-lg text-sm flex items-start">
                        <i data-lucide="info" class="w-5 h-5 mr-3 shrink-0 mt-0.5"></i>
                        <div>
                            <p>Invalid formats, duplicates, and non-existent roll numbers will be flagged and ignored.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Generation Area -->
            <div class="border-t border-border p-6 md:p-8 mt-2 space-y-4 bg-background rounded-b-xl">
                <h3 class="text-xl font-semibold text-text-primary">Configuration & Export</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="space-y-1 md:col-span-2">
                        <label for="suffix-input" class="font-semibold text-text-primary text-sm">Suffix (Optional)</label>
                        <input type="text" id="suffix-input" placeholder="e.g., Placement 2025" class="input-field">
                        <p class="text-xs text-text-secondary mt-1">Added as: <code class="text-xs">[Name] || [Roll] || [Suffix]</code></p>
                    </div>
                    <div class="space-y-1 md:self-end">
                        <button id="generate-vcf-btn" disabled class="button-primary w-full">
                            Generate VCF File
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // --- Initial Tool Load ---
    render('loading');
    loadData();

} // End runVCFGenerator

export { tool };