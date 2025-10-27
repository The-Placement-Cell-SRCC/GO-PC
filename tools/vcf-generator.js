// NOTE: Firebase functions (like logActivity) are passed via onMount from main.js
// No need to import them here directly.

const tool = {
    name: 'VCF Generator',
    icon: `<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>`,
    render: () => ({
        html: `<div id="vcf-generator-content"><div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading Student Data...</p></div></div>`
    }),
    onMount: (contentElement, user, { logActivity }) => { // Accept logActivity here
        const toolContainer = contentElement.querySelector('#vcf-generator-content');

        // --- Constants & State ---
        const VCF_ICONS = { // Local icons for templates
            VCF: `<svg class="w-12 h-12 text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,
            CHECKLIST: `<svg class="w-12 h-12 text-primary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`,
            ARROW: `<svg class="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 text-primary absolute bottom-8 right-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m14-7H3"></path></svg>`,
            SEARCH: `<svg class="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>`,
            CLIPBOARD: `<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`,
            REFRESH: `<svg class="w-5 h-5 text-text-secondary group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11A8.1 8.1 0 004.5 9M4 5v4h4m-4 0a8.1 8.1 0 0015.5 2m.5 4v-4h-4"></path></svg>`
        };
        const LOADER_HTML = `<div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading Student Data...</p></div>`;
        let studentData = [], studentDataMap = new Map(), selectedStudents = new Set(), currentMode = 'loading';
        const ROLL_NUMBER_REGEX = /^\d{2}[A-Z]{2}\d{3}$/i; // Case-insensitive regex
        const CSV_FILE_PATH = '/number_list.csv'; // Consolidated file name

        // --- Core UI Update Function ---
        function reRender(mode, error = null) {
            currentMode = mode;
            let viewHtml = '';
            switch (mode) {
                case 'error': viewHtml = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> ${error || 'An unknown error occurred.'}</div>`; break;
                case 'selectMethod': viewHtml = getMethodSelectionHtml(studentData.length); break;
                case 'selectList': viewHtml = getSelectListHtml(); break;
                case 'pasteRolls': viewHtml = getPasteRollsHtml(); break;
                default: viewHtml = LOADER_HTML;
            }
            toolContainer.innerHTML = viewHtml;
            const firstChild = toolContainer.firstElementChild;
            if (firstChild) firstChild.classList.add('page-enter');
            attachEventListeners(); // Attach listeners for the new view
        }

        // --- Attaches Event Listeners Based on Current Mode ---
        function attachEventListeners() {
             // Common back button
            const backButton = toolContainer.querySelector('#back-to-selection-btn');
             if (backButton) {
                 backButton.addEventListener('click', () => {
                     selectedStudents.clear(); // Clear selection when going back
                     reRender('selectMethod');
                 });
             }

             if (currentMode === 'selectMethod') {
                toolContainer.querySelector('#select-from-list-btn')?.addEventListener('click', () => reRender('selectList'));
                toolContainer.querySelector('#paste-rolls-btn')?.addEventListener('click', () => reRender('pasteRolls'));
                toolContainer.querySelector('#refresh-csv-btn')?.addEventListener('click', () => {
                    reRender('loading'); // Show loader
                    loadData(); // Reload data
                });
            } else if (currentMode === 'selectList') {
                const searchInput = toolContainer.querySelector('#student-search');
                const studentList = toolContainer.querySelector('#student-list');
                const selectAllCheckbox = toolContainer.querySelector('#select-all-checkbox');
                const generateBtn = toolContainer.querySelector('#generate-vcf-btn');
                const clearBtn = toolContainer.querySelector('#clear-selection-btn');

                const filterStudents = () => {
                    const query = searchInput.value.toLowerCase().trim();
                    studentList.querySelectorAll('.student-item').forEach(item => {
                        const name = item.dataset.name?.toLowerCase() || '';
                        const roll = item.dataset.roll?.toLowerCase() || '';
                        item.style.display = (name.includes(query) || roll.includes(query)) ? '' : 'none';
                    });
                };

                searchInput?.addEventListener('input', filterStudents);

                studentList?.addEventListener('change', (e) => {
                    if (e.target.matches('input[type="checkbox"][data-roll]')) {
                        const roll = e.target.dataset.roll; // Roll is already uppercase from loadData
                        if (e.target.checked) selectedStudents.add(roll);
                        else selectedStudents.delete(roll);
                        updateSelectionFooter();
                         // Update select-all checkbox state based on visible items
                        const allCheckboxes = studentList.querySelectorAll('input[type="checkbox"][data-roll]');
                        const allVisibleChecked = Array.from(allCheckboxes).filter(cb => cb.closest('li').style.display !== 'none' && cb.checked).length;
                        const allVisible = Array.from(allCheckboxes).filter(cb => cb.closest('li').style.display !== 'none').length;
                        selectAllCheckbox.checked = allVisible > 0 && allVisibleChecked === allVisible;
                        selectAllCheckbox.indeterminate = allVisibleChecked > 0 && allVisibleChecked < allVisible;
                    }
                });

                selectAllCheckbox?.addEventListener('change', (e) => {
                    const isChecked = e.target.checked;
                     // Only affect visible list items
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
                    updateSelectionFooter();
                });

                generateBtn?.addEventListener('click', () => {
                    const suffix = toolContainer.querySelector('#suffix-input')?.value.trim() || '';
                    const studentsToGenerate = studentData.filter(s => selectedStudents.has(s.roll));
                    if (studentsToGenerate.length > 0) {
                         generateVCF(studentsToGenerate, suffix);
                         logActivity(user, `Generated VCF from List (${studentsToGenerate.length} contacts, suffix: ${suffix || 'none'})`);
                    } else {
                        // Optional: Show message if nothing selected
                         console.log("No students selected to generate VCF.");
                    }
                });

                clearBtn?.addEventListener('click', () => {
                    selectedStudents.clear();
                    reRender('selectList'); // Re-render to clear UI state
                });

                updateSelectionFooter(); // Initial update

            } else if (currentMode === 'pasteRolls') {
                const textArea = toolContainer.querySelector('#roll-numbers-textarea');
                const pasteBtn = toolContainer.querySelector('#paste-from-clipboard-btn');
                const generateBtn = toolContainer.querySelector('#generate-vcf-paste-btn');

                textArea?.addEventListener('input', validatePastedRolls);

                pasteBtn?.addEventListener('click', async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (textArea) textArea.value = text;
                        validatePastedRolls(); // Validate after pasting
                    } catch (err) {
                        console.error('Failed to read clipboard contents: ', err);
                        // Maybe show a small error message to the user near the button
                    }
                });

                generateBtn?.addEventListener('click', () => {
                    const suffix = toolContainer.querySelector('#suffix-input-paste')?.value.trim() || '';
                    const { validStudents } = processPastedRolls(textArea?.value || '');
                    if (validStudents.length > 0) {
                        generateVCF(validStudents, suffix);
                        logActivity(user, `Generated VCF from Paste (${validStudents.length} contacts, suffix: ${suffix || 'none'})`);
                    } else {
                         console.log("No valid roll numbers found to generate VCF.");
                    }
                });

                validatePastedRolls(); // Initial validation on load
            }
        }

        // --- Fetches and Parses Student Data from CSV ---
        async function loadData() {
            try {
                const response = await fetch(CSV_FILE_PATH, { cache: 'no-store' });
                if (!response.ok) {
                     throw new Error(`Could not load '${CSV_FILE_PATH}'. Status: ${response.status}. Ensure the file exists in the root directory.`);
                }
                const text = await response.text();

                 // More robust CSV parsing (handles quoted names with commas)
                 const parsed = text.split('\n').map(line => {
                     // Match comma only if it's not inside quotes
                     const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                     if (parts.length < 3) return null; // Skip lines without enough columns

                     const name = parts[0]?.trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
                     const roll = parts[1]?.trim().toUpperCase(); // Trim and ensure uppercase
                     const contact = parts[2]?.trim();

                     // Validate required fields and roll number format
                     if (name && roll && contact && ROLL_NUMBER_REGEX.test(roll)) {
                         return { name, roll, contact }; // Roll is uppercase here
                     }
                     return null; // Invalid line
                 }).filter(Boolean); // Filter out null (invalid) entries

                if (parsed.length === 0) {
                     throw new Error(`CSV file ('${CSV_FILE_PATH}') is empty or contains no valid student data matching the expected format (Name,RollNumber,Contact).`);
                 }

                studentData = parsed.sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
                studentDataMap = new Map(studentData.map(s => [s.roll, s])); // Map uppercase roll to student data
                reRender('selectMethod'); // Show selection options
            } catch (e) {
                console.error("Error loading CSV data:", e);
                reRender('error', e.message); // Display error view
            }
        }


        // --- Updates the Sticky Footer in SelectList Mode ---
        function updateSelectionFooter() {
            const footer = toolContainer.querySelector('#selection-footer');
            const countEl = toolContainer.querySelector('#selection-count');
            const generateBtn = toolContainer.querySelector('#generate-vcf-btn');

            if (footer && countEl && generateBtn) {
                 const count = selectedStudents.size;
                if (count > 0) {
                    footer.classList.remove('translate-y-full', 'opacity-0');
                    countEl.textContent = `${count} student${count !== 1 ? 's' : ''} selected`;
                    generateBtn.disabled = false; // Enable button if students are selected
                } else {
                    footer.classList.add('translate-y-full', 'opacity-0');
                    countEl.textContent = '0 students selected';
                    generateBtn.disabled = true; // Disable button if no selection
                }
            }
        }

        // --- Generates and Triggers Download of VCF File ---
        function generateVCF(studentsToGenerate, suffix) {
            if (!studentsToGenerate || studentsToGenerate.length === 0) {
                 console.warn("generateVCF called with no students.");
                 return; // Do nothing if no students provided
             }
            let vcfString = '';
            studentsToGenerate.forEach(student => {
                 // Format name as "FirstName LastName || RollNumber || Suffix"
                const fullName = `${student.name} || ${student.roll}${suffix ? ` || ${suffix}` : ''}`;
                 // Basic VCF escaping (commas, semicolons, newlines in names/notes are unlikely but handled)
                const escapeVCF = (str) => str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

                const safeFullName = escapeVCF(fullName);
                const safeName = escapeVCF(student.name);
                const safeContact = escapeVCF(student.contact);
                 const safeSuffix = suffix ? escapeVCF(suffix) : '';

                vcfString += 'BEGIN:VCARD\n';
                vcfString += 'VERSION:3.0\n';
                 // FN (Formatted Name) - The primary display name
                vcfString += `FN:${safeFullName}\n`;
                 // N (Name components) - For better address book parsing
                 // Splitting name into potential parts (simple space split)
                const nameParts = student.name.split(' ');
                const lastName = nameParts.length > 1 ? escapeVCF(nameParts.pop()) : ''; // Use last part as last name
                const firstName = escapeVCF(nameParts.join(' ')); // Join remaining parts as first name
                vcfString += `N:${lastName};${firstName};;;\n`; // Last;First;Middle;Prefix;Suffix
                 // TEL (Telephone)
                vcfString += `TEL;TYPE=CELL:${safeContact}\n`;
                 // ORG (Organization) - Store Roll Number here
                 vcfString += `ORG:${escapeVCF(student.roll)}\n`;
                 // NOTE - Can store additional info like suffix or the original formatted name if needed
                 vcfString += `NOTE:Roll: ${escapeVCF(student.roll)}${safeSuffix ? `\\nSuffix: ${safeSuffix}` : ''}\n`;
                vcfString += 'END:VCARD\n\n'; // Extra newline between entries
            });

            if (vcfString) {
                try {
                    const blob = new Blob([vcfString], { type: 'text/vcard;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    // Generate filename with date
                    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
                    a.download = `gopc_contacts_${dateStr}${suffix ? ('_' + suffix.replace(/[^a-z0-9]/gi, '_')) : ''}.vcf`; // Sanitize suffix for filename
                    document.body.appendChild(a);
                    a.click(); // Trigger download
                    document.body.removeChild(a); // Clean up link
                    URL.revokeObjectURL(url); // Release blob URL
                } catch (e) {
                    console.error("Error generating VCF blob/download:", e);
                    // Optionally show an error message to the user in the UI
                    alert("Error creating VCF file for download.");
                }
            }
        }

        // --- Processes Text Pasted in pasteRolls Mode ---
         function processPastedRolls(text) {
             const allPasted = text.split('\n').map(l => l.trim().toUpperCase()).filter(Boolean); // Trim, Uppercase, Filter empty
             const results = {
                 validStudents: [],
                 invalidOrNotFound: new Set(), // Combined set for invalid format or not found
                 duplicateRollsInPaste: new Set() // Tracks duplicate roll# lines in the paste itself
             };
             const seenLines = new Set();
             const seenValidRolls = new Set();

             allPasted.forEach(rollInput => {
                 // Check for duplicate lines within the pasted text
                 if (seenLines.has(rollInput)) {
                     results.duplicateRollsInPaste.add(rollInput);
                 }
                 seenLines.add(rollInput);

                 // Check format and existence in student data
                 if (ROLL_NUMBER_REGEX.test(rollInput) && studentDataMap.has(rollInput)) {
                      // Check if this valid roll has already been added
                      if (!seenValidRolls.has(rollInput)) {
                          results.validStudents.push(studentDataMap.get(rollInput));
                          seenValidRolls.add(rollInput);
                      } // Else: It's a valid roll, but already processed - ignore duplicate roll
                 } else {
                     results.invalidOrNotFound.add(rollInput); // Invalid format OR valid format but not found
                 }
             });

             return {
                 validStudents: results.validStudents, // Return array of student objects
                 invalidOrNotFound: Array.from(results.invalidOrNotFound),
                 duplicateRollsInPaste: Array.from(results.duplicateRollsInPaste)
             };
         }

        // --- Validates Pasted Rolls and Updates UI ---
        function validatePastedRolls() {
            const textArea = toolContainer.querySelector('#roll-numbers-textarea');
            const generateBtn = toolContainer.querySelector('#generate-vcf-paste-btn');

             if (!textArea || !generateBtn) return; // Ensure elements exist

            const { validStudents, invalidOrNotFound, duplicateRollsInPaste } = processPastedRolls(textArea.value);

             // Update UI counts
            toolContainer.querySelector('#valid-count').textContent = `${validStudents.length} valid roll numbers found`;
            toolContainer.querySelector('#duplicate-count').textContent = `${duplicateRollsInPaste.length} duplicate lines ignored`;
            toolContainer.querySelector('#invalid-count').textContent = `${invalidOrNotFound.length} invalid or not found`;

             // Update ready count
            toolContainer.querySelector('#ready-to-generate-count').textContent = `Ready to generate ${validStudents.length} contacts`;

             // Enable/disable generate button
            generateBtn.disabled = validStudents.length === 0;
        }


        // --- HTML Template Functions ---

        function getMethodSelectionHtml(count) {
            return `
                <div class="relative text-center flex flex-col items-center justify-center min-h-[70vh] page-enter">
                    <div class="absolute top-0 right-0 p-4"> <!-- Added padding -->
                        <button id="refresh-csv-btn" title="Reload data from ${CSV_FILE_PATH}" class="group flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            ${VCF_ICONS.REFRESH}
                            <span class="ml-2 text-sm font-semibold text-text-secondary group-hover:text-primary">Refresh CSV</span>
                        </button>
                    </div>
                    <h2 class="text-3xl font-bold mb-2 text-text-primary">VCF Generator</h2>
                    <p class="text-lg text-text-secondary mb-12">Create vCard files from the student contact list.</p>
                    <div class="flex flex-col md:flex-row gap-8">
                        <button id="select-from-list-btn" class="action-card">
                            ${VCF_ICONS.CHECKLIST}
                            <h3 class="text-2xl font-semibold mb-2 text-text-primary">Select from List</h3>
                            <p class="text-text-secondary flex-grow">Browse and select students from the complete list.</p>
                            <div class="flex justify-between items-center text-sm mt-4">
                                <span class="badge-blue">Best for: Selective generation</span>
                                <span class="text-text-secondary">${count} students</span>
                            </div>
                            ${VCF_ICONS.ARROW}
                        </button>
                        <button id="paste-rolls-btn" class="action-card">
                            ${VCF_ICONS.VCF}
                            <h3 class="text-2xl font-semibold mb-2 text-text-primary">Paste Roll Numbers</h3>
                            <p class="text-text-secondary flex-grow">Quickly paste a list of roll numbers for bulk generation.</p>
                            <div class="flex justify-between items-center text-sm mt-4">
                                <span class="badge-blue">Best for: Quick bulk operations</span>
                                <span class="text-text-secondary">Faster for large batches</span>
                            </div>
                            ${VCF_ICONS.ARROW}
                        </button>
                    </div>
                </div>`;
        }

        function getSelectListHtml() {
            return `
                <div class="relative min-h-[70vh] page-enter">
                    <!-- Back Button -->
                    <button id="back-to-selection-btn" class="mb-8 text-sm text-text-secondary hover:text-text-primary flex items-center group transition-colors">
                        <svg class="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to selection
                    </button>
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <!-- Left Panel: List -->
                        <div class="lg:col-span-2 space-y-4">
                             <!-- Search Input -->
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">${VCF_ICONS.SEARCH}</div>
                                <input type="text" id="student-search" placeholder="Filter by name or roll number..." class="input-field pl-12">
                            </div>
                             <!-- Student List -->
                            <div class="bg-surface rounded-xl shadow-sm border border-border h-[60vh] overflow-y-auto">
                                <div class="flex items-center p-4 border-b border-border sticky top-0 bg-surface z-10">
                                    <input type="checkbox" id="select-all-checkbox" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0">
                                    <label for="select-all-checkbox" class="ml-4 font-semibold text-text-primary cursor-pointer">Select All Visible</label>
                                </div>
                                <ul id="student-list" class="divide-y divide-border">
                                    ${studentData.map(s => `
                                        <li class="student-item" data-name="${s.name}" data-roll="${s.roll}">
                                            <label class="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150">
                                                <input type="checkbox" data-roll="${s.roll}" class="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0 mr-4 shrink-0" ${selectedStudents.has(s.roll) ? 'checked' : ''}>
                                                <div class="flex-grow flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
                                                    <p class="font-medium text-text-primary truncate mr-4">${s.name}</p>
                                                    <p class="text-sm text-text-secondary font-mono shrink-0">${s.roll}</p>
                                                </div>
                                            </label>
                                        </li>
                                    `).join('')}
                                     ${studentData.length === 0 ? '<li class="p-4 text-center text-text-secondary">No student data loaded.</li>' : ''}
                                </ul>
                            </div>
                        </div>
                         <!-- Right Panel: Options -->
                        <div class="bg-surface rounded-xl shadow-sm border border-border p-6 h-fit sticky top-28"> <!-- Adjusted top -->
                             <h3 class="text-lg font-semibold mb-4">Export Options</h3>
                            <div class="space-y-4">
                                <div>
                                    <label for="suffix-input" class="block text-sm font-medium text-text-primary mb-1">Suffix (Optional)</label>
                                    <input type="text" id="suffix-input" placeholder="e.g., Placement 2025" class="input-field">
                                    <p class="text-xs text-text-secondary mt-1">Added to each contact's name like: <br><code class="text-xs">[Name] || [Roll] || [Suffix]</code></p>
                                </div>
                            </div>
                        </div>
                    </div>
                     <!-- Sticky Footer -->
                    <div id="selection-footer" class="fixed bottom-0 left-[260px] right-0 bg-surface/90 backdrop-blur-sm p-4 border-t border-border shadow-[0_-4px_30px_rgba(0,0,0,0.05)] flex justify-between items-center transform translate-y-full opacity-0 transition-all duration-300 z-20">
                         <div class="max-w-7xl mx-auto w-full flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <p id="selection-count" class="font-semibold text-lg text-text-primary">0 students selected</p>
                                <button id="clear-selection-btn" class="text-sm text-text-secondary hover:text-error transition-colors">Clear selection</button>
                            </div>
                            <button id="generate-vcf-btn" class="button-primary px-6 h-[48px] disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                Generate VCF File
                            </button>
                        </div>
                    </div>
                </div>`;
        }


        function getPasteRollsHtml() {
            return `
                <div class="relative min-h-[70vh] page-enter">
                    <!-- Back Button -->
                    <button id="back-to-selection-btn" class="mb-8 text-sm text-text-secondary hover:text-text-primary flex items-center group transition-colors">
                       <svg class="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                       Back to Method Selection
                    </button>
                     <!-- Instructions -->
                    <div class="bg-blue-50 border-l-4 border-primary text-blue-800 p-4 rounded-r-lg mb-8 text-sm">
                        <p>Paste roll numbers (e.g., <code class="font-mono bg-blue-100 px-1 rounded">24BC718</code>), one per line. Invalid formats, duplicates, and non-existent entries will be flagged.</p>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <!-- Left Panel: Textarea -->
                        <div class="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-4">
                            <div class="flex justify-between items-center">
                                <label for="roll-numbers-textarea" class="font-semibold text-text-primary">Roll Numbers</label>
                                <button id="paste-from-clipboard-btn" class="text-sm text-primary font-semibold flex items-center hover:text-primary-dark transition-colors">
                                    ${VCF_ICONS.CLIPBOARD} Paste from clipboard
                                </button>
                            </div>
                            <textarea id="roll-numbers-textarea" class="w-full h-[40vh] p-4 font-mono text-sm bg-gray-50 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y" placeholder="24BC718\n23BC501\n22ECO187..."></textarea>
                        </div>
                         <!-- Right Panel: Validation & Options -->
                        <div class="space-y-6">
                            <div class="bg-surface rounded-xl shadow-sm border border-border p-6">
                                <h3 class="font-semibold text-text-primary mb-4">Validation Status</h3>
                                <div class="space-y-3 text-sm">
                                    <div id="valid-count" class="flex items-center text-secondary"><span class="h-2 w-2 bg-secondary rounded-full mr-3 shrink-0"></span>0 valid roll numbers found</div>
                                    <div id="duplicate-count" class="flex items-center text-warning-amber"><span class="h-2 w-2 bg-warning-amber rounded-full mr-3 shrink-0"></span>0 duplicate lines ignored</div>
                                    <div id="invalid-count" class="flex items-center text-error"><span class="h-2 w-2 bg-error rounded-full mr-3 shrink-0"></span>0 invalid or not found</div>
                                </div>
                            </div>
                            <div class="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-4">
                                <h3 id="ready-to-generate-count" class="text-lg font-semibold text-center text-text-primary">Ready to generate 0 contacts</h3>
                                <div class="space-y-1">
                                    <label for="suffix-input-paste" class="font-semibold text-text-primary text-sm">Suffix (Optional)</label>
                                    <input type="text" id="suffix-input-paste" placeholder="e.g., Interested-List" class="input-field">
                                    <p class="text-xs text-text-secondary mt-1">Added like: <code class="text-xs">[Name] || [Roll] || [Suffix]</code></p>
                                </div>
                                <button id="generate-vcf-paste-btn" disabled class="button-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                                    Generate VCF from Roll Numbers
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        // --- Initial Data Load ---
        loadData();
    } // End of onMount for VCF Generator
};

export { tool };
