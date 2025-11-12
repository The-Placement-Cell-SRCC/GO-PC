const tool = {
    name: 'VCF Generator',
    icon: 'contact',
    render: (user, dependencies, args = []) => {
        runVCFGenerator(user, dependencies, args);
        return {
            text: 'Processing VCF Generator command...'
        };
    }
};

async function runVCFGenerator(user, { logActivity }, args) {
    const terminal = document.getElementById('terminal');
    const printToTerminal = (text) => {
        terminal.textContent += `\n${text}`;
        terminal.scrollTop = terminal.scrollHeight;
    };

    // Clear the initial "Processing..." message
    terminal.textContent = terminal.textContent.replace('Processing VCF Generator command...', '');

    const usage = "Usage: vcf-generator [--suffix \"Your Suffix\"] <roll1> <roll2> ...";

    if (args.length === 0) {
        printToTerminal(usage);
        return;
    }

    const { options, rollNumbers } = parseArgs(args);
    const suffix = options.suffix || '';
    
    if (rollNumbers.length === 0) {
        printToTerminal("Error: No roll numbers provided.");
        printToTerminal(usage);
        return;
    }

    const studentData = await loadData(printToTerminal);

    if (studentData.size === 0) {
        return; // loadData already printed the error
    }

    const studentsToGenerate = [];
    const notFoundRolls = [];
    rollNumbers.forEach(roll => {
        const student = studentData.get(roll.toUpperCase());
        if (student) {
            studentsToGenerate.push(student);
        } else {
            notFoundRolls.push(roll);
        }
    });

    if (notFoundRolls.length > 0) {
        printToTerminal(`Warning: The following roll numbers were not found: ${notFoundRolls.join(', ')}`);
    }

    if (studentsToGenerate.length > 0) {
        generateVCF(studentsToGenerate, suffix, user, logActivity, printToTerminal);
    } else {
        printToTerminal("No valid students found to generate VCF.");
    }
}

function parseArgs(args) {
    const options = {};
    const rollNumbers = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[i + 1] : true;
            options[key] = value;
            if (value !== true) i++; // Skip the value
        } else {
            rollNumbers.push(args[i]);
        }
    }
    return { options, rollNumbers };
}

async function loadData(printToTerminal) {
    printToTerminal("Loading student data from CSV...");
    try {
        const response = await fetch('/number_list.csv', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Could not load '/number_list.csv'. Status: ${response.status}.`);
        }
        const text = await response.text();
        const studentMap = new Map();
        const ROLL_NUMBER_REGEX = /^\d{2}[A-Z]{2}\d{3}$/i;

        text.split('\n').forEach(line => {
            const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length < 3) return;
            const name = parts[0]?.trim().replace(/^"|"$/g, '');
            const roll = parts[1]?.trim().toUpperCase();
            const contact = parts[2]?.trim();
            if (name && roll && contact && ROLL_NUMBER_REGEX.test(roll)) {
                studentMap.set(roll, { name, roll, contact });
            }
        });

        if (studentMap.size === 0) {
            throw new Error("CSV file is empty or contains no valid data.");
        }
        printToTerminal(`Successfully loaded ${studentMap.size} student records.`);
        return studentMap;
    } catch (e) {
        printToTerminal(`Error: ${e.message}`);
        return new Map();
    }
}

function generateVCF(studentsToGenerate, suffix, user, logActivity, printToTerminal) {
    let vcfString = '';
    studentsToGenerate.forEach(student => {
        const fullName = `${student.name} || ${student.roll}${suffix ? ` || ${suffix}` : ''}`;
        const escapeVCF = (str) => str.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
        vcfString += 'BEGIN:VCARD\n';
        vcfString += 'VERSION:3.0\n';
        vcfString += `FN:${escapeVCF(fullName)}\n`;
        vcfString += `N:${escapeVCF(student.name.split(' ').pop())};${escapeVCF(student.name.split(' ').slice(0, -1).join(' '))};;;\n`;
        vcfString += `TEL;TYPE=CELL:${escapeVCF(student.contact)}\n`;
        vcfString += `ORG:${escapeVCF(student.roll)}\n`;
        vcfString += `NOTE:Roll: ${escapeVCF(student.roll)}${suffix ? `\\nSuffix: ${escapeVCF(suffix)}` : ''}\n`;
        vcfString += 'END:VCARD\n\n';
    });

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
        printToTerminal(`VCF file for ${studentsToGenerate.length} student(s) has been generated and downloaded.`);
        logActivity(user, `Generated VCF (${studentsToGenerate.length} contacts, suffix: ${suffix || 'none'})`);
    } catch (e) {
        printToTerminal(`Error during VCF file generation: ${e.message}`);
    }
}

export { tool };
