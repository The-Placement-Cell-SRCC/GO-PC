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
                <div id="dashboard-content" class="page-enter space-y-6">
                     
                    <!-- Welcome Banner -->
                    <div class="welcome-banner relative overflow-hidden">
                        <div class="absolute inset-0 opacity-20">
                            <div class="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                            <div class="absolute bottom-10 right-10 w-40 h-40 bg-purple-300 rounded-full blur-3xl"></div>
                        </div>
                        <div class="relative z-10">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                                    ✨ ${getGreeting()}
                                </div>
                            </div>
                            <h1 class="text-3xl md:text-4xl font-black mb-2 tracking-tight">${firstName}</h1>
                            <p class="text-base md:text-lg text-indigo-100 font-medium">Welcome back to your placement command center</p>
                        </div>
                        <div class="absolute -right-8 -bottom-8 w-40 h-40 opacity-10">
                            <i data-lucide="rocket" class="w-full h-full transform rotate-[-25deg]"></i>
                        </div>
                    </div>

                     <!-- Quick Actions -->
                     <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-bold text-text-primary flex items-center gap-2">
                                <div class="w-1 h-6 bg-gradient-to-b from-primary to-indigo-600 rounded-full"></div>
                                Quick Actions
                            </h2>
                            <span class="text-xs text-text-secondary font-medium px-2.5 py-1 bg-gray-100 rounded-full">2 Tools Available</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <a href="#" data-tool-link="vcf-generator" class="action-card !max-w-none">
                                <div class="flex items-start justify-between mb-4">
                                    <div class="p-3 bg-gradient-to-br from-primary/10 to-indigo-600/10 rounded-xl group-hover:scale-105 transition-transform duration-200">
                                        <i data-lucide="contact" class="w-7 h-7 text-primary"></i>
                                    </div>
                                    <div class="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">ACTIVE</div>
                                </div>
                                <h3 class="text-xl font-bold mb-2 text-text-primary group-hover:text-primary transition-colors">VCF Generator</h3>
                                <p class="text-text-secondary text-sm flex-grow leading-relaxed">Create professional vCard files from student contact lists with custom formatting options.</p>
                                <div class="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span class="badge-blue">Contact Management</span>
                                    <div class="flex items-center text-sm text-primary font-bold gap-1 group-hover:gap-2 transition-all">
                                        Launch <i data-lucide="arrow-right" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </a>
                            <a href="#" data-tool-link="cv-sorter" class="action-card !max-w-none">
                                <div class="flex items-start justify-between mb-4">
                                    <div class="p-3 bg-gradient-to-br from-secondary/10 to-emerald-600/10 rounded-xl group-hover:scale-105 transition-transform duration-200">
                                        <i data-lucide="folder-search" class="w-7 h-7 text-secondary"></i>
                                    </div>
                                    <div class="px-2.5 py-1 bg-secondary/10 text-secondary text-xs font-bold rounded-full">ACTIVE</div>
                                </div>
                                <h3 class="text-xl font-bold mb-2 text-text-primary group-hover:text-secondary transition-colors">CV Sorter</h3>
                                <p class="text-text-secondary text-sm flex-grow leading-relaxed">Efficiently sort and export CVs in bulk with intelligent filtering and organization tools.</p>
                                <div class="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary/10 text-secondary">Document Processing</span>
                                    <div class="flex items-center text-sm text-secondary font-bold gap-1 group-hover:gap-2 transition-all">
                                        Launch <i data-lucide="arrow-right" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </a>
                        </div>
                     </div>

                     <!-- Statistics Cards -->
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <h2 class="text-xl font-bold text-text-primary flex items-center gap-2">
                                <div class="w-1 h-6 bg-gradient-to-b from-secondary to-emerald-600 rounded-full"></div>
                                Workspace Snapshot
                            </h2>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                            
                            <!-- Students Connected Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <p class="stat-label mb-1 text-xs">Students Connected</p>
                                        <p class="text-xs text-text-secondary">Total database</p>
                                    </div>
                                    <div class="p-2.5 bg-gradient-to-br from-primary/10 to-indigo-600/10 rounded-lg group-hover:scale-105 transition-transform duration-200">
                                        <i data-lucide="users" class="w-5 h-5 text-primary"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="stat-value text-3xl" data-target="1725">0</span>
                                    <div class="mt-2 flex items-center gap-1.5 text-xs text-secondary font-semibold">
                                        <i data-lucide="trending-up" class="w-3 h-3"></i>
                                        <span>All contacts synced</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Active Tools Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <p class="stat-label mb-1 text-xs">Active Tools</p>
                                        <p class="text-xs text-text-secondary">Currently operational</p>
                                    </div>
                                    <div class="p-2.5 bg-gradient-to-br from-secondary/10 to-emerald-600/10 rounded-lg group-hover:scale-105 transition-transform duration-200">
                                        <i data-lucide="terminal-square" class="w-5 h-5 text-secondary"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="stat-value text-3xl" data-target="2">0</span>
                                    <div class="mt-2 flex items-center gap-1.5 text-xs text-secondary font-semibold">
                                        <div class="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></div>
                                        <span>All systems operational</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Recent Updates Card -->
                            <div class="stat-card">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <p class="stat-label mb-1 text-xs">Recent Updates</p>
                                        <p class="text-xs text-text-secondary">Latest improvements</p>
                                    </div>
                                    <div class="p-2.5 bg-gradient-to-br from-warning-amber/10 to-yellow-600/10 rounded-lg group-hover:scale-105 transition-transform duration-200">
                                        <i data-lucide="zap" class="w-5 h-5 text-warning-amber"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="text-xl font-bold text-text-primary">CV Sorter</span>
                                    <div class="mt-2 flex items-center gap-1.5 text-xs text-warning-amber font-semibold">
                                        <i data-lucide="sparkles" class="w-3 h-3"></i>
                                        <span>Recently added</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Info Panels -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="info-box blue">
                            <div class="p-2 bg-blue-100 rounded-lg shrink-0">
                                <i data-lucide="info" class="w-5 h-5 text-blue-600"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-base text-blue-900 mb-1">System Status</h3>
                                <p class="text-sm text-blue-700 leading-relaxed">All tools are functioning normally. Database last synced 2 minutes ago.</p>
                            </div>
                        </div>
                        <div class="info-box purple">
                            <div class="p-2 bg-purple-100 rounded-lg shrink-0">
                                <i data-lucide="lightbulb" class="w-5 h-5 text-purple-600"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-base text-purple-900 mb-1">Quick Tip</h3>
                                <p class="text-sm text-purple-700 leading-relaxed">Use the CV Sorter to create custom collections for different placement drives.</p>
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
            const duration = 1500; 
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

        // Add event listeners for Quick Action links
        dashboardContent?.querySelectorAll('a[data-tool-link]').forEach(link => {
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

        // Initialize Lucide icons
        lucide.createIcons();
    }
};

export { tool };