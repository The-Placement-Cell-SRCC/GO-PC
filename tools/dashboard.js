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
            html: `
                <div class="space-y-8">
                    <!-- Header -->
                    <div>
                        <h1 class="text-3xl font-bold text-text-primary">${getGreeting()}, ${firstName}</h1>
                        <p class="text-text-secondary mt-1">Here’s what’s happening with your workspace today.</p>
                    </div>

                    <!-- Quick Actions -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <a href="#" data-tool-link="vcf-generator" class="action-card">
                             <div class="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                                <i data-lucide="contact" class="w-6 h-6 text-primary"></i>
                            </div>
                            <h3 class="mt-4 font-semibold text-text-primary">VCF Generator</h3>
                            <p class="mt-1 text-sm text-text-secondary">Create shareable contact files from spreadsheets.</p>
                        </a>
                         <a href="#" data-tool-link="cv-sorter" class="action-card">
                             <div class="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                                <i data-lucide="users" class="w-6 h-6 text-primary"></i>
                            </div>
                            <h3 class="mt-4 font-semibold text-text-primary">CV Sorter</h3>
                            <p class="mt-1 text-sm text-text-secondary">Sort and categorize CVs based on custom criteria.</p>
                        </a>
                        <a href="#" data-tool-link="analytics" class="action-card">
                            <div class="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                                <i data-lucide="bar-chart-3" class="w-6 h-6 text-primary"></i>
                            </div>
                            <h3 class="mt-4 font-semibold text-text-primary">System Analytics</h3>
                            <p class="mt-1 text-sm text-text-secondary">View usage statistics and system health.</p>
                        </a>
                        <a href="#" data-tool-link="profile" class="action-card">
                            <div class="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                                <i data-lucide="user-cog" class="w-6 h-6 text-primary"></i>
                            </div>
                            <h3 class="mt-4 font-semibold text-text-primary">Profile & Settings</h3>
                            <p class="mt-1 text-sm text-text-secondary">Manage your account and application settings.</p>
                        </a>
                    </div>

                    <!-- Recent Activity -->
                    <div>
                        <h2 class="text-xl font-bold text-text-primary mb-4">Recent Activity</h2>
                        <div id="activity-log-container" class="bg-surface rounded-lg border border-border">
                            <div class="p-8 text-center text-text-secondary">
                                <div class="loader inline-block"></div>
                                <p class="mt-3">Loading activity...</p>
                            </div>
                        </div>
                    </div>

                </div>
            `
        };
    },
    onMount: async (contentElement, user, dependencies) => {
        const { db } = dependencies;
        const activityLogContainer = contentElement.querySelector('#activity-log-container');

        // --- Fetch and Display Activity Logs ---
        async function fetchActivityLogs() {
            try {
                const logsQuery = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(10));
                const querySnapshot = await getDocs(logsQuery);

                if (querySnapshot.empty) {
                    activityLogContainer.innerHTML = `<div class="p-4 text-center text-text-secondary">No recent activity found.</div>`;
                    return;
                }

                let html = '<ul class="divide-y divide-border">';
                querySnapshot.forEach(doc => {
                    const log = doc.data();
                    const timestamp = log.timestamp ? log.timestamp.toDate() : new Date();
                    const timeAgo = formatDistanceToNow(timestamp, { addSuffix: true });

                    html += `
                        <li class="p-4 flex items-center justify-between">
                            <div>
                                <p class="font-medium text-text-primary">${log.action}</p>
                                <p class="text-sm text-text-secondary">${log.userEmail}</p>
                            </div>
                            <span class="text-sm text-text-secondary">${timeAgo}</span>
                        </li>
                    `;
                });
                html += '</ul>';
                activityLogContainer.innerHTML = html;

            } catch (error) {
                console.error("Error fetching activity logs:", error);
                activityLogContainer.innerHTML = `<div class="p-4 text-center text-error">Could not load activity logs.</div>`;
            }
        }

        fetchActivityLogs();

        // --- Handle Quick Action Clicks ---
        contentElement.querySelectorAll('a[data-tool-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const toolKey = link.dataset.toolLink;
                const navLink = document.querySelector(`#tool-nav a[data-tool="${toolKey}"]`);
                if (navLink) {
                    navLink.click();
                } else {
                    console.error(`Could not find nav link for tool: ${toolKey}`);
                }
            });
        });
    }
};

export { tool };