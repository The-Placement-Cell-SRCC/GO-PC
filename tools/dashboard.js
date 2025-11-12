import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { formatDistanceToNow } from 'https://cdn.jsdelivr.net/npm/date-fns@3.6.0/+esm';

const tool = {
    name: 'Dashboard',
    icon: 'layout-grid',
    render: (user) => {
        function getGreeting() {
            const hour = new Date().getHours();
            if (hour < 12) return "Good Morning";
            if (hour < 18) return "Good Afternoon";
            return "Good Evening";
        }
        const firstName = user.displayName.split(' ')[0];

        return {
            text: `
${getGreeting()}, ${firstName}.
Here’s what’s happening with your workspace today.

Quick Actions:
  vcf-generator - Create shareable contact files from spreadsheets.
  cv-sorter     - Sort and categorize CVs based on custom criteria.

Recent Activity:
Loading...
            `
        };
    },
    onMount: async (terminal, user, dependencies) => {
        const { db } = dependencies;

        const printToTerminal = (text) => {
            terminal.textContent += `\n${text}`;
            terminal.scrollTop = terminal.scrollHeight;
        };

        try {
            const logsQuery = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(5));
            const querySnapshot = await getDocs(logsQuery);

            if (querySnapshot.empty) {
                printToTerminal("No recent activity found.");
                return;
            }

            let activityText = "\n--- Recent Activity ---\n";
            querySnapshot.forEach(doc => {
                const log = doc.data();
                const timestamp = log.timestamp ? log.timestamp.toDate() : new Date();
                const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });
                activityText += `${log.action} by ${log.userEmail} (${timeAgo})\n`;
            });
            // A bit of a hack to replace the "Loading..." message
            terminal.textContent = terminal.textContent.replace("Loading...", activityText);


        } catch (error) {
            printToTerminal("Could not load activity logs.");
        }
    }
};

export { tool };
