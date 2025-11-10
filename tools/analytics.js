import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const tool = {
    name: 'Analytics',
    icon: 'bar-chart-3',
    render: () => {
        // The main logic is now in onMount to fit the CLI model
        return { text: 'Loading analytics data...' };
    },
    onMount: async (terminal, user, { db }) => {
        const printToTerminal = (text) => {
            terminal.textContent += `\n${text}`;
            terminal.scrollTop = terminal.scrollHeight;
        };

        // A bit of a hack to clear the "Loading..." message
        terminal.textContent = terminal.textContent.replace('Loading analytics data...', '');

        if (!db) {
            printToTerminal("Error: Database connection not available.");
            return;
        }

        try {
            const logsRef = collection(db, "activity_logs");
            const q = query(logsRef, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            const logs = [];
            const userSet = new Set();
            const actionMap = new Map();
            let mostCommonAction = { action: 'N/A', count: 0 };

            querySnapshot.forEach((doc) => {
                const log = doc.data();
                logs.push(log);
                userSet.add(log.userEmail);
                const newCount = (actionMap.get(log.action) || 0) + 1;
                actionMap.set(log.action, newCount);
                if (newCount > mostCommonAction.count) {
                    mostCommonAction = { action: log.action, count: newCount };
                }
            });

            let output = "\n--- GO-PC Analytics ---\n\n";
            output += `Total Log Entries: ${querySnapshot.size}\n`;
            output += `Unique Users:      ${userSet.size}\n`;
            output += `Most Common Action: ${mostCommonAction.action} (${mostCommonAction.count} times)\n\n`;
            output += "--- Recent Activity ---\n";
            output += "User".padEnd(30) + "Action".padEnd(30) + "Timestamp\n";
            output += "-".repeat(80) + "\n";

            logs.slice(0, 15).forEach(log => {
                const timestamp = log.timestamp?.toDate()
                    ? log.timestamp.toDate().toLocaleString()
                    : 'N/A';
                const user = log.userEmail.padEnd(30);
                const action = log.action.padEnd(30);
                output += `${user}${action}${timestamp}\n`;
            });

            printToTerminal(output);

        } catch (error) {
            printToTerminal(`Error: Could not load activity logs. ${error.message}`);
        }
    }
};

export { tool };
