import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Tool Imports ---
import { tool as dashboardTool } from '/tools/dashboard.js';
import { tool as vcfGeneratorTool } from '/tools/vcf-generator.js';
import { tool as cvSorterTool } from '/tools/cv-sorter.js';
import { tool as analyticsTool } from '/tools/analytics.js';
import { tool as profileTool } from '/tools/profile.js';

// =================================================================================
// --- 🔒 CONFIGURATION & SECURITY 🔒 ---
// =================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyANbAmQo0SNFntMpE_iceishapEGxMQ1SI",
    authDomain: "go-pc-987d0.firebaseapp.com",
    projectId: "go-pc-987d0",
    storageBucket: "go-pc-987d0.appspot.com",
    messagingSenderId: "1070794251659",
    appId: "1:1070794251659:web:55ebbc5239fb583dc2a38e"
};

const ADMIN_EMAIL = "fns.placementcell@srcc.du.ac.in";
const WHITELISTED_EMAILS = [ ADMIN_EMAIL, 'srcc.pc.fns2526@gmail.com', 'placementcell@srcc.du.ac.in', 'shourayaaggarwal2006@gmail.com','sjonumwalia@gmail.com','tanvibansal0607@gmail.com','kohliashish12@gmail.com','dhwani1006@gmail.com','harshit.9731@gmail.com','aditya5462006@gmail.com','sharmamanzil05@gmail.com','rohangehani1@gmail.com','cheshani2006@gmail.com','gunjan17guptaa@gmail.com','sandeepramani2006@gmail.com','aadityagoyal0108@gmail.com','aayatirgoyal@gmail.com','mothikrishna86217@gmail.com' ];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const tools = {
    'dashboard': dashboardTool,
    'vcf-generator': vcfGeneratorTool,
    'cv-sorter': cvSorterTool,
    'analytics': analyticsTool,
    'profile': profileTool,
};

// --- Logger ---
async function logActivity(user, action) {
    if (!user || !user.email) {
        console.warn("Attempted to log activity without a valid user.");
        return;
    }
    try {
        await addDoc(collection(db, "activity_logs"), { userEmail: user.email, action: action, timestamp: serverTimestamp() });
    } catch (e) {
        console.error("Error adding activity log document: ", e);
    }
}

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.getElementById('terminal');
    const commandInput = document.getElementById('command-input');
    let commandHistory = [];
    let historyIndex = -1;
    let currentUser = null;

    const printToTerminal = (text, isCommand = false) => {
        if (isCommand) {
            terminal.textContent += `\n> ${text}`;
        }
        terminal.textContent += `\n${text}`;
        terminal.scrollTop = terminal.scrollHeight;
    };

    const clearTerminal = () => {
        terminal.textContent = '';
    };

    const showHelp = () => {
        printToTerminal('Available commands:');
        printToTerminal('  help      - Show this help message');
        printToTerminal('  login     - Log in with your Google account');
        printToTerminal('  logout    - Log out of the current session');
        printToTerminal('  clear     - Clear the terminal screen');
        Object.keys(tools).forEach(key => {
            printToTerminal(`  ${key.padEnd(10)} - ${tools[key].name}`);
        });
    };

    const handleCommand = async (command) => {
        const [cmd, ...args] = command.trim().split(' ');
        printToTerminal(command, true);
        commandHistory.unshift(command);
        historyIndex = -1;

        if (!currentUser && cmd !== 'login') {
            printToTerminal('Error: You must be logged in to use this command. Type "login" to begin.');
            return;
        }

        switch (cmd) {
            case 'help':
                showHelp();
                break;
            case 'login':
                if (currentUser) {
                    printToTerminal('You are already logged in.');
                } else {
                    handleGoogleSignIn();
                }
                break;
            case 'logout':
                if (currentUser) {
                    await signOut(auth);
                    printToTerminal('You have been logged out.');
                } else {
                    printToTerminal('You are not logged in.');
                }
                break;
            case 'clear':
                clearTerminal();
                break;
            default:
                if (tools[cmd]) {
                    const tool = tools[cmd];
                    try {
                        const output = tool.render(currentUser, { db, logActivity });
                        printToTerminal(output.text); // We'll refactor tools to return text
                        if (tool.onMount) {
                            tool.onMount(terminal, currentUser, { db, logActivity });
                        }
                    } catch (error) {
                        printToTerminal(`Error executing tool "${cmd}": ${error.message}`);
                    }
                } else {
                    printToTerminal(`Command not found: ${cmd}. Type "help" for a list of commands.`);
                }
                break;
        }
    };

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            if (!WHITELISTED_EMAILS.includes(user.email)) {
                await signOut(auth);
                printToTerminal("Error: This Google account is not authorized for GO-PC.");
            }
        } catch (error) {
            printToTerminal(`Sign-in failed: ${error.message}`);
        }
    };

    onAuthStateChanged(auth, (user) => {
        if (user && WHITELISTED_EMAILS.includes(user.email)) {
            currentUser = user;
            clearTerminal();
            printToTerminal(`Welcome, ${user.displayName}.`);
            printToTerminal('Type "help" for a list of available commands.');
            logActivity(user, "User Logged In (CLI)");
        } else {
            currentUser = null;
            clearTerminal();
            printToTerminal('GO-PC Terminal Interface');
            printToTerminal('Type "login" to authenticate with your Google account.');
            if (user) {
                signOut(auth).catch(console.error);
            }
        }
    });

    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = commandInput.value;
            commandInput.value = '';
            handleCommand(command);
        } else if (e.key === 'ArrowUp') {
            if (commandHistory.length > 0) {
                historyIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
                commandInput.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex > 0) {
                historyIndex--;
                commandInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = -1;
                commandInput.value = '';
            }
        }
    });
});
