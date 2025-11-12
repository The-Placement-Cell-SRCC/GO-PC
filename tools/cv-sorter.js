// Clear any existing pollers when the tool is re-mounted.
if (window.cvSorterPoller) {
    clearInterval(window.cvSorterPoller);
}
window.cvSorterPoller = null;

const tool = {
    name: 'CV Sorter',
    icon: 'folder-search',
    render: (user, dependencies, args = []) => {
        runCVSorter(user, dependencies, args);
        return {
            text: 'Processing CV Sorter command...'
        };
    }
};

async function runCVSorter(user, { logActivity }, args) {
    const terminal = document.getElementById('terminal');
    const printToTerminal = (text) => {
        terminal.textContent += `\n${text}`;
        terminal.scrollTop = terminal.scrollHeight;
    };
    
    terminal.textContent = terminal.textContent.replace('Processing CV Sorter command...', '');

    const usage = "Usage: cv-sorter --output-name \"File Name\" [--output-type zip|gdrive] <key1> <key2> ...";

    if (args.length === 0) {
        printToTerminal(usage);
        return;
    }

    const { options, keys } = parseArgs(args);
    const outputName = options['output-name'] || '';
    const outputType = options['output-type'] || 'zip';

    if (!outputName) {
        printToTerminal("Error: --output-name is a required flag.");
        printToTerminal(usage);
        return;
    }

    if (keys.length === 0) {
        printToTerminal("Error: No CV keys provided.");
        printToTerminal(usage);
        return;
    }

    const cvData = await loadData(printToTerminal);

    if (!cvData) {
        return;
    }

    const keysToProcess = new Set();
    const notFoundKeys = [];
    keys.forEach(key => {
        if (cvData.has(key.toUpperCase())) {
            keysToProcess.add(key.toUpperCase());
        } else {
            notFoundKeys.push(key);
        }
    });

    if (notFoundKeys.length > 0) {
        printToTerminal(`Warning: The following CV keys were not found: ${notFoundKeys.join(', ')}`);
    }

    if (keysToProcess.size > 0) {
        handleGenerate(keysToProcess, outputName, outputType, user, logActivity, printToTerminal);
    } else {
        printToTerminal("No valid CVs found to process.");
    }
}

function parseArgs(args) {
    const options = {};
    const keys = [];
    let i = 0;
    while (i < args.length) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[i + 1] : true;
            options[key] = value;
            if (value !== true) i++;
        } else {
            // Check if the next argument is 'A', 'B', or 'C'
            if (i + 1 < args.length && ['A', 'B', 'C'].includes(args[i + 1].toUpperCase())) {
                keys.push(`${args[i]} ${args[i + 1]}`);
                i++;
            } else {
                keys.push(args[i]);
            }
        }
        i++;
    }
    return { options, keys };
}

async function loadData(printToTerminal) {
    printToTerminal("Loading CV manifest...");
    try {
        const response = await fetch('/cv-manifest.csv', { cache: 'no-store' });
        if (!response.ok) throw new Error("Could not load '/cv-manifest.csv'.");
        const manifestText = await response.text();
        const ROLL_VARIANT_REGEX = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i;
        const cvMap = new Map();
        manifestText.split('\n').forEach(line => {
            const fileName = line.trim();
            if (fileName) {
                const keyMatch = fileName.match(ROLL_VARIANT_REGEX);
                if (keyMatch && keyMatch[0]) {
                    cvMap.set(keyMatch[0].toUpperCase(), { fileName });
                }
            }
        });

        if (cvMap.size === 0) throw new Error("Manifest is empty or invalid.");
        printToTerminal(`Successfully loaded ${cvMap.size} CV records.`);
        return cvMap;
    } catch (e) {
        printToTerminal(`Error: ${e.message}`);
        return null;
    }
}

async function handleGenerate(keysToProcessSet, outputName, outputType, user, logActivity, printToTerminal) {
    const CV_SORTER_GAS_URL = "https://script.google.com/macros/s/AKfycbzZL0S7DCmz7WMMPIqFguNvfZvlbO-c4jZmNsoA9ahE5-9seradcbEpu18v7gxKgCom/exec";
    const keysArray = Array.from(keysToProcessSet);

    printToTerminal(`Starting job for "${outputName}" with ${keysArray.length} CVs...`);

    try {
        const formData = new FormData();
        formData.append('payload', JSON.stringify({
            keys: keysArray,
            outputName,
            outputType,
            userEmail: user.email
        }));

        const response = await fetch(CV_SORTER_GAS_URL, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Request failed: ${await response.text()}`);

        const result = await response.json();
        if (result.status === 'processing_started') {
            startJobPolling(outputName, user, logActivity, printToTerminal);
            logActivity?.(user, `CV Sort started: ${outputName}`);
        } else {
            throw new Error(result.message || 'The server returned an unexpected response.');
        }
    } catch (err) {
        printToTerminal(`Error: ${err.message}`);
    }
}

function startJobPolling(outputName, user, logActivity, printToTerminal) {
    stopJobPolling();
    printToTerminal("Job started. Polling for status updates...");
    window.cvSorterPoller = setInterval(async () => {
        try {
            const pollUrl = `https://script.google.com/macros/s/AKfycbzZL0S7DCmz7WMMPIqFguNvfZvlbO-c4jZmNsoA9ahE5-9seradcbEpu18v7gxKgCom/exec?action=getJobStatus&cachebust=${Date.now()}`;
            const response = await fetch(pollUrl, { cache: 'no-cache' });
            if (!response.ok) return;
            const statusData = await response.json();

            if (statusData.status === 'idle') {
                stopJobPolling();
                printToTerminal(`✅ Success: CV sorting for "${outputName}" is complete.`);
                logActivity(user, `CV Sort complete: ${outputName}`);
            }
        } catch (err) {
            // silent fail
        }
    }, 10000);
}

function stopJobPolling() {
    if (window.cvSorterPoller) {
        clearInterval(window.cvSorterPoller);
        window.cvSorterPoller = null;
    }
}

export { tool };
