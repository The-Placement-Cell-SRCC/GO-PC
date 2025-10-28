// Import only necessary Firestore functions if needed directly, otherwise rely on 'db' passed from main.js
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

            // --- NEW: Analytics Data Processing ---
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

            // Enhanced Analytics rendering - replace the logHtml section in analytics.js

// Replace the logHtml construction in the onMount function with this:

let logHtml = `
    <div class="page-enter space-y-8">
        <!-- Enhanced Header -->
        <div class="flex items-center gap-4 mb-8">
            <div class="p-4 bg-gradient-to-br from-primary/10 to-indigo-600/10 rounded-2xl">
                <i data-lucide="bar-chart-3" class="w-10 h-10 text-primary"></i>
            </div>
            <div>
                <h1 class="text-4xl font-black text-text-primary tracking-tight">Analytics Dashboard</h1>
                <p class="text-lg text-text-secondary mt-1">Monitor system activity and user engagement</p>
            </div>
        </div>

        <!-- Enhanced Stat Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="stat-card-lg group">
                <div class="flex items-center gap-4">
                    <div class="p-4 bg-gradient-to-br from-primary/10 to-indigo-600/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                        <i data-lucide="database" class="w-8 h-8 text-primary"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-text-secondary font-semibold uppercase tracking-wide mb-1">Total Log Entries</p>
                        <p class="text-4xl font-black text-text-primary">${querySnapshot.size.toLocaleString()}</p>
                        <div class="mt-2 flex items-center gap-1 text-xs text-primary font-semibold">
                            <i data-lucide="activity" class="w-3 h-3"></i>
                            <span>All recorded events</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stat-card-lg group">
                <div class="flex items-center gap-4">
                    <div class="p-4 bg-gradient-to-br from-secondary/10 to-emerald-600/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                        <i data-lucide="users" class="w-8 h-8 text-secondary"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-text-secondary font-semibold uppercase tracking-wide mb-1">Unique Users</p>
                        <p class="text-4xl font-black text-text-primary">${userSet.size}</p>
                        <div class="mt-2 flex items-center gap-1 text-xs text-secondary font-semibold">
                            <i data-lucide="user-check" class="w-3 h-3"></i>
                            <span>Active participants</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stat-card-lg group">
                <div class="flex items-center gap-4">
                    <div class="p-4 bg-gradient-to-br from-warning-amber/10 to-yellow-600/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                        <i data-lucide="activity" class="w-8 h-8 text-warning-amber"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-text-secondary font-semibold uppercase tracking-wide mb-1">Most Common Action</p>
                        <p class="text-xl font-bold text-text-primary truncate" title="${mostCommonAction.action}">${mostCommonAction.action}</p>
                        <div class="mt-2 flex items-center gap-1 text-xs text-warning-amber font-semibold">
                            <i data-lucide="trending-up" class="w-3 h-3"></i>
                            <span>${mostCommonAction.count} occurrences</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Enhanced Log Table -->
        <div class="bg-white p-8 rounded-2xl shadow-xl border-2 border-gray-100">
            <div class="flex items-center gap-3 mb-6">
                <div class="p-2 bg-primary/10 rounded-xl">
                    <i data-lucide="history" class="w-6 h-6 text-primary"></i>
                </div>
                <div>
                    <h2 class="text-3xl font-bold text-text-primary">Full Activity Log</h2>
                    <p class="text-text-secondary text-sm mt-1">Complete history of all system events</p>
                </div>
            </div>
            <div class="overflow-x-auto border-2 border-gray-200 rounded-xl shadow-inner">
                <table class="styled-table table-zebra">
                    <thead class="sticky top-0 z-10">
                        <tr>
                            <th class="p-5">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="user" class="w-4 h-4"></i>
                                    User
                                </div>
                            </th>
                            <th class="p-5">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="zap" class="w-4 h-4"></i>
                                    Action
                                </div>
                            </th>
                            <th class="p-5">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="clock" class="w-4 h-4"></i>
                                    Timestamp
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>`;

if (logs.length === 0) {
    logHtml += `<tr><td colspan="3" class="p-8 text-center text-text-secondary">No activity logs found.</td></tr>`;
} else {
    logs.forEach((log) => {
        const timestamp = log.timestamp?.toDate()
            ? log.timestamp.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
            : 'N/A';
        logHtml += `
            <tr class="hover:bg-gradient-to-r hover:from-primary/5 hover:to-indigo-500/5">
                <td class="p-5 text-text-primary truncate font-medium" title="${log.userEmail}">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 bg-secondary rounded-full"></div>
                        ${log.userEmail}
                    </div>
                </td>
                <td class="p-5 text-text-secondary">
                    <span class="bg-gray-100 px-3 py-1 rounded-lg text-sm font-medium">${log.action}</span>
                </td>
                <td class="p-5 text-gray-500 whitespace-nowrap font-mono text-xs">
                    ${timestamp}
                </td>
            </tr>`;
    });
}

logHtml += `
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Additional Insights Panel -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100 p-6 rounded-2xl shadow-md">
                <div class="flex items-start gap-4">
                    <div class="p-3 bg-purple-100 rounded-xl shrink-0">
                        <i data-lucide="pie-chart" class="w-6 h-6 text-purple-600"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-purple-900 mb-2">Activity Distribution</h3>
                        <p class="text-sm text-purple-700 leading-relaxed">Tracking ${actionMap.size} unique action types across ${userSet.size} users with ${querySnapshot.size} total events.</p>
                    </div>
                </div>
            </div>
            <div class="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-100 p-6 rounded-2xl shadow-md">
                <div class="flex items-start gap-4">
                    <div class="p-3 bg-blue-100 rounded-xl shrink-0">
                        <i data-lucide="shield-check" class="w-6 h-6 text-blue-600"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-blue-900 mb-2">Data Integrity</h3>
                        <p class="text-sm text-blue-700 leading-relaxed">All activity logs are securely stored and timestamped with Firebase Firestore serverside timestamps.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

            if (logs.length === 0) {
                logHtml += `<tr><td colspan="3" class="p-4 text-center text-text-secondary">No activity logs found.</td></tr>`;
            } else {
                // Use the pre-processed 'logs' array
                logs.forEach((log, index) => {
                    const timestamp = log.timestamp?.toDate()
                        ? log.timestamp.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                        : 'N/A';
                    // Stagger animation removed for performance on potentially large logs
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

