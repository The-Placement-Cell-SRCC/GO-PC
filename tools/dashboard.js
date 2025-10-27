const tool = {
    name: 'Dashboard',
    icon: `<svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>`,
    render: (user) => {
        // Function to determine the time-based greeting
        function getGreeting() {
            const hour = new Date().getHours();
            if (hour < 12) return "Good Morning";
            if (hour < 18) return "Good Afternoon";
            return "Good Evening";
        }
        return {
            html: `
                <div id="dashboard-content" class="page-enter">
                     <!-- Greeting - Use full display name -->
                    <h1 class="text-3xl font-bold text-text-primary mb-2">${getGreeting()}, ${user.displayName}!</h1>
                    <p class="text-lg text-text-secondary mb-8">Here's a snapshot of your workspace.</p>
                     <!-- Statistics Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> <!-- Adjusted grid for potentially 3 cards -->
                        <div class="stat-card" style="--accent-color: #4F46E5;"> <!-- Primary color accent -->
                            <span class="stat-value" data-target="775">0</span>+
                            <p class="stat-label">Students Connected</p>
                            <span class="stat-trend text-green-500">↑ 12%</span>
                        </div>
                        <div class="stat-card" style="--accent-color: #0F766E;"> <!-- Teal color accent -->
                            <span class="stat-value" data-target="3">0</span>
                            <p class="stat-label">Active Tools</p>
                            <span class="stat-trend text-gray-400">→</span> <!-- Neutral trend -->
                        </div>
                         <div class="stat-card" style="--accent-color: #F59E0B;"> <!-- Amber color accent -->
                            <span class="stat-value" data-target="94">0</span>%
                            <p class="stat-label">Success Rate</p>
                             <span class="stat-trend text-green-500">↑ 2.1%</span>
                        </div>
                         <!-- Optional 4th card example if needed later -->
                        <!-- <div class="stat-card" style="--accent-color: #DC2626;"> Red color accent
                            <span class="stat-value" data-target="5">0</span>
                            <p class="stat-label">Pending Actions</p>
                             <span class="stat-trend text-red-500">↓ 1</span>
                        </div> -->
                    </div>
                </div>
            `
        }
    },
    onMount: (contentElement) => {
        const dashboardContent = contentElement.querySelector('#dashboard-content');
        // Animate counters if they exist
        dashboardContent?.querySelectorAll('.stat-value[data-target]').forEach(el => {
            const target = +el.dataset.target; // Get target number from data attribute
            if (isNaN(target)) return; // Skip if target is not a number

            let current = 0;
            const duration = 1000; // Animation duration in ms
            const stepTime = 20; // Time between steps in ms
            const steps = duration / stepTime;
            const increment = target / steps;

            const updateCounter = () => {
                current += increment;
                if (current >= target) {
                    el.textContent = target; // Ensure final value is exact
                    clearInterval(interval);
                } else {
                     el.textContent = Math.ceil(current); // Show integer values during animation
                }
            };
           // Start the animation interval
           const interval = setInterval(updateCounter, stepTime);
        });
    }
};

export { tool };
