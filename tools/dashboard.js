const tool = {
    name: 'Dashboard',
    icon: 'layout-grid', // Lucide icon name
    render: (user) => {
        // Function to determine the time-based greeting
        function getGreeting() {
            const hour = new Date().getHours();
            if (hour < 12) return "Good Morning";
            if (hour < 18) return "Good Afternoon";
            return "Good Evening";
        }
        const firstName = user.displayName.split(' ')[0];

        return {
            html: `
                <div id="dashboard-content" class="page-enter space-y-8">
                     
                    <!-- NEW: Welcome Banner -->
                    <div class="welcome-banner">
                        <div class="relative z-10">
                            <h1 class="text-3xl font-bold mb-2">${getGreeting()}, ${firstName}!</h1>
                            <p class="text-lg text-indigo-200">Welcome to the GO-PC Dashboard. Access your tools below.</p>
                        </div>
                        <i data-lucide="rocket" class="absolute -right-4 -bottom-8 w-40 h-40 text-black/10 transform rotate-[-30deg] z-0"></i>
                    </div>

                     <!-- NEW: Quick Actions -->
                     <div>
                        <h2 class="text-2xl font-bold text-text-primary mb-4">Quick Actions</h2>
                        <!-- MODIFICATION: Changed md:grid-cols-3 to md:grid-cols-2 -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <a href="#" data-tool-link="vcf-generator" class="action-card !max-w-none">
                                <i data-lucide="contact" class="w-10 h-10 text-primary mb-3"></i>
                                <h3 class="text-xl font-semibold mb-1 text-text-primary">VCF Generator</h3>
                                <p class="text-text-secondary text-sm flex-grow">Create vCard files from student lists.</p>
                                <div class="text-sm text-primary font-semibold mt-4 flex items-center group-hover:gap-2 transition-all">
                                    Go to Tool <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
                                </div>
                            </a>
                            <a href="#" data-tool-link="cv-sorter" class="action-card !max-w-none">
                                <i data-lucide="folder-search" class="w-10 h-10 text-primary mb-3"></i>
                                <h3 class="text-xl font-semibold mb-1 text-text-primary">CV Sorter</h3>
                                <p class="text-text-secondary text-sm flex-grow">Sort & export CVs in bulk.</p>
                                <div class="text-sm text-primary font-semibold mt-4 flex items-center group-hover:gap-2 transition-all">
                                    Go to Tool <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
                                </div>
                            </a>
                            <!-- MODIFICATION: Removed Analytics card -->
                        </div>
                     </div>

                     <!-- Statistics Cards -->
                    <div>
                        <h2 class="text-2xl font-bold text-text-primary mb-4">Workspace Snapshot</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            <!-- Students Connected Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-center mb-4">
                                    <p class="stat-label">Students Connected</p>
                                    <div class="p-2 bg-primary/10 rounded-lg">
                                        <i data-lucide="users" class="w-5 h-5 text-primary"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="stat-value" data-target="1725">0</span>
                                </div>
                            </div>

                            <!-- Active Tools Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-center mb-4">
                                    <p class="stat-label">Active Tools</p>
                                    <div class="p-2 bg-secondary/10 rounded-lg">
                                        <i data-lucide="terminal-square" class="w-5 h-5 text-secondary"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="stat-value" data-target="2">0</span>
                                    <span class="stat-trend text-gray-500">All systems operational</span>
                                </div>
                            </div>

                            <!-- MODIFICATION: Renamed Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-center mb-4">
                                    <p class="stat-label">Recent Updates</p>
                                    <div class="p-2 bg-warning-amber/10 rounded-lg">
                                        <i data-lucide="zap" class="w-5 h-5 text-warning-amber"></i>
                                    </div>
                                </div>
                                <div>
                                    <span></span>
                                    <span class="stat-trend text-gray-500">Added CV Sorter</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        }
    },
    onMount: (contentElement, user, dependencies) => {
        const dashboardContent = contentElement.querySelector('#dashboard-content');
        
        // Animate counters
        dashboardContent?.querySelectorAll('.stat-value[data-target]').forEach(el => {
            const target = +el.dataset.target;
            if (isNaN(target)) return; 

            let current = 0;
            const duration = 1000; 
            const stepTime = 20; 
            const steps = duration / stepTime;
            const increment = target / steps;

            const updateCounter = () => {
                current += increment;
                if (current >= target) {
                    el.textContent = target; 
                    clearInterval(interval);
                } else {
                     el.textContent = Math.ceil(current); 
                }
            };
           const interval = setInterval(updateCounter, stepTime);
        });

        // NEW: Add event listeners for Quick Action links
        dashboardContent?.querySelectorAll('a[data-tool-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const toolKey = link.dataset.toolLink;
                // This simulates the main.js loadTool function by dispatching a custom event
                // A more robust way would be to have main.js pass a `loadTool` function into dependencies
                // But for this structure, we'll dispatch an event that main.js could listen for,
                // or just find the nav link and click it.
                
                // Simple way: Find the nav link in the sidebar and click it
                const navLink = document.querySelector(`#tool-nav a[data-tool="${toolKey}"]`);
                if (navLink) {
                    navLink.click();
                } else {
                    console.error(`Could not find nav link for tool: ${toolKey}`);
                }
            });
        });

        // Initialize Lucide icons
        lucide.createIcons();
    }
};

export { tool };
