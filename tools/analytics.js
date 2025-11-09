// NO CHANGES REQUIRED
// This tool's HTML structure is already modular and will
// inherit the new styles from style.css automatically.
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const tool = {
    name: 'Analytics',
    icon: 'bar-chart-3', // Lucide icon name
    render: () => ({
        html: `<div id="analytics-content"><div class="flex items-center justify-center min-h-[70vh]"><div class="loader"></div><p class="ml-4 text-text-secondary">Loading Activity Logs...</p></div></div>`
    }),
    // Accept `db` instance from main.js
    onMount: async (contentElement, user, { db }) => {
        const container = contentElement.querySelector('#analytics-content');
        if (!db) {
            container.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> Database connection not available.</div>`;
            console.error("Firestore 'db' instance was not passed to Analytics tool.");
            return;
        }

        try {
            const logsRef = collection(db, "activity_logs");
            const q = query(logsRef, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            // --- Analytics Data Processing ---
            const logs = [];
            const userSet = new Set();
            const actionMap = new Map();
            let mostCommonAction = { action: 'N/A', count: 0 };

            querySnapshot.forEach((doc) => {
                const log = doc.data();
                logs.push(log); // Store log for table rendering

                // Calculate stats
                userSet.add(log.userEmail);
                const newCount = (actionMap.get(log.action) || 0) + 1;
                actionMap.set(log.action, newCount);

                if (newCount > mostCommonAction.count) {
                    mostCommonAction = { action: log.action, count: newCount };
                }
            });
            // --- End Analytics Data Processing ---

            let logHtml = `
                <div class="page-enter space-y-8">
                    <!-- Stat Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="stat-card-lg">
                            <div class="flex items-center gap-4">
                                <div class="p-3 bg-primary/10 rounded-lg">
                                    <i data-lucide="database" class="w-6 h-6 text-primary"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-text-secondary font-medium">Total Log Entries</p>
                                    <p class="text-3xl font-bold text-text-primary">${querySnapshot.size}</p>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card-lg">
                            <div class="flex items-center gap-4">
                                <div class="p-3 bg-success/10 rounded-lg">
                                    <i data-lucide="users" class="w-6 h-6 text-success"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-text-secondary font-medium">Unique Users</p>
                                    <p class="text-3xl font-bold text-text-primary">${userSet.size}</p>
                                </div>
                            </div>
                        </div>
                        <div class="stat-card-lg">
                            <div class="flex items-center gap-4">
                                <div class="p-3 bg-warning/10 rounded-lg">
                                    <i data-lucide="activity" class="w-6 h-6 text-warning"></i>
                                </div>
                                <div>
                                    <p class="text-sm text-text-secondary font-medium">Most Common Action</p>
                                    <p class="text-xl font-bold text-text-primary truncate" title="${mostCommonAction.action}">${mostCommonAction.action}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Log Table -->
                    <div class="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-border">
                        <div class="flex items-center gap-3 mb-6">
                            <i data-lucide="history" class="w-7 h-7 text-primary"></i>
                            <h1 class="text-3xl font-bold text-text-primary">Full Activity Log</h1>
                        </div>
                        <div class="overflow-x-auto border border-border rounded-lg">
                            <table class="styled-table table-zebra">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            if (logs.length === 0) {
                logHtml += `<tr><td colspan="3" class="p-4 text-center text-text-secondary">No activity logs found.</td></tr>`;
            } else {
                // Use the pre-processed 'logs' array
                logs.forEach((log, index) => {
                    const timestamp = log.timestamp?.toDate()
                        ? log.timestamp.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                        : 'N/A';
                    
                    logHtml += `
                        <tr>
                            <td class="text-text-primary truncate" title="${log.userEmail}">${log.userEmail}</td>
                            <td class="text-text-secondary">${log.action}</td>
                            <td class="text-gray-500 whitespace-nowrap">${timestamp}</td>
                        </tr>`;
                });
            }

            logHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            
            container.innerHTML = logHtml;
            // Initialize icons after rendering
            lucide.createIcons();
        } catch (error) {
            console.error("Error fetching activity logs:", error);
            container.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> Could not load activity logs. ${error.message}</div>`;
        }
    }
};

export { tool };