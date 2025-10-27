// Import only necessary Firestore functions if needed directly, otherwise rely on 'db' passed from main.js
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const tool = {
    name: 'Analytics',
    icon: `<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>`,
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
            // Query logs, ordered by timestamp descending
            const q = query(logsRef, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            let logHtml = `
                <div class="bg-surface p-6 md:p-8 rounded-xl shadow-sm border border-border page-enter">
                    <h1 class="text-3xl font-bold mb-6 text-text-primary">Activity Logs</h1>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left table-auto">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="p-4 font-semibold text-sm uppercase text-text-secondary tracking-wider">User</th>
                                    <th class="p-4 font-semibold text-sm uppercase text-text-secondary tracking-wider">Action</th>
                                    <th class="p-4 font-semibold text-sm uppercase text-text-secondary tracking-wider">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-border">`;

            if (querySnapshot.empty) {
                logHtml += `<tr><td colspan="3" class="p-4 text-center text-text-secondary">No activity logs found.</td></tr>`;
            } else {
                querySnapshot.forEach((doc, index) => {
                    const log = doc.data();
                    // Format timestamp nicely, handle potential missing timestamp
                    const timestamp = log.timestamp?.toDate()
                        ? log.timestamp.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                        : 'N/A';
                    // Apply stagger animation delay
                    logHtml += `
                        <tr class="hover:bg-gray-50 stagger-item" style="--stagger-delay: ${index * 50}ms">
                            <td class="p-4 text-sm text-text-primary truncate" title="${log.userEmail}">${log.userEmail}</td>
                            <td class="p-4 text-sm text-text-secondary">${log.action}</td>
                            <td class="p-4 text-sm text-gray-500 whitespace-nowrap">${timestamp}</td>
                        </tr>`;
                });
            }

            logHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>`;
            container.innerHTML = logHtml;
        } catch (error) {
            console.error("Error fetching activity logs:", error);
            container.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> Could not load activity logs. ${error.message}</div>`;
        }
    }
};

export { tool };
