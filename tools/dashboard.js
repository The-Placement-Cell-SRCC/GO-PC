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

        // UPDATED: HTML structure for the new UI
        return {
            html: `
                <div id="dashboard-content" class="page-enter space-y-8">
                     
                    <!-- Welcome Banner (styles will update from style.css) -->
                    <div class="welcome-banner">
                        <div class="relative z-10">
                            <h1 class="text-3xl font-bold mb-2">${getGreeting()}, ${firstName}!</h1>
                            <p class="text-lg text-blue-100">Welcome to the GO-PC Dashboard. Access your tools below.</p>
                        </div>
                        <i data-lucide="rocket" class="absolute -right-4 -bottom-8 w-40 h-40 text-black/10 transform rotate-[-30deg] z-0"></i>
                    </div>

                     <!-- Quick Actions (UPDATED to be simpler cards) -->
                     <div>
                        <h2 class="text-2xl font-bold text-text-primary mb-4">Quick Actions</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <a href="#" data-tool-link="vcf-generator" class="stat-card group !flex-row items-center gap-4">
                                <div class="p-3 bg-primary/10 rounded-lg">
                                    <i data-lucide="contact" class="w-6 h-6 text-primary"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">VCF Generator</h3>
                                    <p class="text-sm text-text-secondary">Create vCard files from student lists.</p>
                                </div>
                                <i data-lucide="arrow-right" class="w-5 h-5 text-text-secondary group-hover:text-primary transition-all group-hover:translate-x-1"></i>
                            </a>
                            
                            <a href="#" data-tool-link="cv-sorter" class="stat-card group !flex-row items-center gap-4">
                                <div class="p-3 bg-primary/10 rounded-lg">
                                    <i data-lucide="folder-search" class="w-6 h-6 text-primary"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">CV Sorter</h3>
                                    <p class="text-sm text-text-secondary">Sort & export CVs in bulk.</p>
                                </div>
                                <i data-lucide="arrow-right" class="w-5 h-5 text-text-secondary group-hover:text-primary transition-all group-hover:translate-x-1"></i>
                            </a>
                            
                        </div>
                     </div>

                     <!-- Statistics Cards -->
                    <div>
                        <h2 class="text-2xl font-bold text-text-primary mb-4">Workspace Snapshot</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            <!-- Students Connected Card -->
                            <div class="stat-card-lg">
                                <div class="flex items-center gap-4">
                                    <div class="p-3 bg-primary/10 rounded-lg">
                                        <i data-lucide="users" class="w-6 h-6 text-primary"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm text-text-secondary font-medium">Students Connected</p>
                                        <p class="text-3xl font-bold text-text-primary" data-target="1725">0</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Active Tools Card -->
                            <div class="stat-card-lg">
                                <div class="flex items-center gap-4">
                                    <div class="p-3 bg-success/10 rounded-lg">
                                        <i data-lucide="terminal-square" class="w-6 h-6 text-success"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm text-text-secondary font-medium">Active Tools</p>
                                        <p class="text-3xl font-bold text-text-primary" data-target="2">0</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Recent Updates Card -->
                            <div class="stat-card-lg">
                                <div class="flex items-center gap-4">
                                    <div class="p-3 bg-warning/10 rounded-lg">
                                        <i data-lucide="zap" class="w-6 h-6 text-warning"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm text-text-secondary font-medium">Recent Updates</p>
                                        <p class="text-base font-semibold text-text-primary pt-1">Added CV Sorter</p>
                                    </div>
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
        dashboardContent?.querySelectorAll('.stat-value[data-target], .text-3xl[data-target]').forEach(el => {
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
                    el.textContent = target.toLocaleString(); // Add commas
                    clearInterval(interval);
                } else {
                     el.textContent = Math.ceil(current).toLocaleString(); 
                }
            };
           const interval = setInterval(updateCounter, stepTime);
        });

        // Add event listeners for Quick Action links
        dashboardContent?.querySelectorAll('a[data-tool-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const toolKey = link.dataset.toolLink;
                // Find the nav link in the sidebar and click it
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