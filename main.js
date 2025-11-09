import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Tool Imports ---
import { tool as dashboardTool } from '/tools/dashboard.js';
import { tool as vcfGeneratorTool } from '/tools/vcf-generator.js';
import { tool as cvSorterTool } from '/tools/cv-sorter.js';
import { tool as analyticsTool } from '/tools/analytics.js';
import { tool as profileTool } from '/tools/profile.js';

// =================================================================================
// --- 🔒 CONFIGURATION & SECURITY 🔒 ---
// =================================================================================
// Using the user-provided Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyANbAmQo0SNFntMpE_iceishapEGxMQ1SI",
    authDomain: "go-pc-987d0.firebaseapp.com",
    projectId: "go-pc-987d0",
    storageBucket: "go-pc-987d0.appspot.com",
    messagingSenderId: "1070794251659",
    appId: "1:1070794251659:web:55ebbc5239fb583dc2a38e"
};

// Using the user-provided whitelist
const ADMIN_EMAIL = "fns.placementcell@srcc.du.ac.in";
const WHITELISTED_EMAILS = [ ADMIN_EMAIL, 'srcc.pc.fns2526@gmail.com', 'placementcell@srcc.du.ac.in', 'shourayaaggarwal2006@gmail.com','sjonumwalia@gmail.com','tanvibansal0607@gmail.com','kohliashish12@gmail.com','dhwani1006@gmail.com','harshit.9731@gmail.com','aditya5462006@gmail.com','sharmamanzil05@gmail.com','rohangehani1@gmail.com','cheshani2006@gmail.com','gunjan17guptaa@gmail.com','sandeepramani2006@gmail.com','aadityagoyal0108@gmail.com','aayatirgoyal@gmail.com','mothikrishna86217@gmail.com' ];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const tools = {
    'dashboard': dashboardTool,
    'vcf-generator': vcfGeneratorTool,
    'cv-sorter': cvSorterTool,
    'analytics': analyticsTool,
    'profile': profileTool,
};


// --- Logger ---
async function logActivity(user, action) {
    if (!user || !user.email) {
        console.warn("Attempted to log activity without a valid user.");
        return;
    }
    try {
        await addDoc(collection(db, "activity_logs"), { userEmail: user.email, action: action, timestamp: serverTimestamp() });
    } catch (e) {
        console.error("Error adding activity log document: ", e);
    }
}

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app-screen'); // This is the element to toggle class on
    const toolNav = document.getElementById('tool-nav');
    const mainContent = document.getElementById('main-content');
    const mainHeader = document.getElementById('main-header');
    const userProfileContainer = document.getElementById('user-profile-container');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // Helper function to render views with fade-in animation
    const renderView = (container, html) => {
        container.innerHTML = html;
        const firstChild = container.firstElementChild;
        if (firstChild) firstChild.classList.add('page-enter');
    };

    // Helper function to show the correct main screen (loading, auth, app)
    const showPage = (pageId) => {
        loadingScreen.style.opacity = 0;
        setTimeout(() => loadingScreen.classList.add('hidden'), 300);

        authScreen.classList.add('hidden');
        appScreen.classList.add('hidden');

        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('hidden');
        } else {
            console.error(`Page with ID "${pageId}" not found.`);
        }
    };

    // --- Authentication State Listener ---
    onAuthStateChanged(auth, (user) => {
        if (user && WHITELISTED_EMAILS.includes(user.email)) {
            logActivity(user, "User Logged In");
            renderAppShell(user); 
            loadTool('dashboard', user); 
            showPage('app-screen'); 
        } else {
            if (user) {
                logActivity(user, "Unauthorized access attempt, logging out.");
                signOut(auth).catch(console.error); 
            }
            renderAuthShell(); 
            showPage('auth-screen'); 
        }
    });

    // --- Renders the Authentication Screen Layout ---
    function renderAuthShell() {
        const html = `
            <div class="min-h-screen flex items-center justify-center bg-background p-4">
                <div id="auth-form-container" class="w-full max-w-sm"></div>
            </div>`;
        authScreen.innerHTML = html;
        renderLoginForm(document.getElementById('auth-form-container'));
    }

    // --- Renders the Google Sign-In Form ---
    function renderLoginForm(container) {
        renderView(container, `
            <div class="w-full bg-surface p-8 rounded-xl border border-border shadow-2xl">
                <div class="flex items-center justify-center gap-3 mb-6">
                    <img class="w-10 h-10" src="/media/logo.png" alt="GO-PC Logo">
                    <h1 class="text-2xl font-bold text-text-primary">GO-PC Login</h1>
                </div>
                <p class="text-text-secondary text-center mb-8 text-sm">Use your authorized Google account to access the dashboard.</p>
                <button id="google-signin-btn" class="button-primary w-full">
                    <svg class="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,35.508,44,29.891,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                    Sign in with Google
                </button>
                 <p id="login-error" class="text-error text-sm text-center mt-4 hidden"></p>
            </div>`);
        container.querySelector('#google-signin-btn').addEventListener('click', handleGoogleSignIn);
    }

    // --- Handles the Google Sign-In Popup Flow ---
    async function handleGoogleSignIn() {
        const provider = new GoogleAuthProvider();
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.classList.add('hidden'); 

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            if (!WHITELISTED_EMAILS.includes(user.email)) {
                await signOut(auth); 
                throw new Error("This Google account is not authorized for GO-PC.");
            }
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            if (errorEl) {
                let message = "Sign-in failed. Please try again.";
                if (error.code === 'auth/popup-closed-by-user') {
                    message = "Sign-in cancelled.";
                } else if (error.message.includes("authorized")) {
                    message = error.message; 
                }
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
            }
        }
    }

    // --- Mobile Sidebar Toggle ---
    function toggleSidebar() {
        sidebar.classList.toggle('-translate-x-full');
        sidebarOverlay.classList.toggle('hidden');
        sidebarOverlay.classList.toggle('opacity-0');
    }

    // --- Desktop Sidebar Toggle ---
    // This function correctly swaps the icon and re-renders Lucide
    function toggleSidebarCollapse() {
        const appScreen = document.getElementById('app-screen');
        const collapseIcon = document.querySelector('#collapse-btn i');
        
        // Toggle the class on the main app screen
        const isCollapsed = appScreen.classList.toggle('sidebar-collapsed');
        
        // Update the icon to reflect the new state
        if (collapseIcon) {
            collapseIcon.setAttribute('data-lucide', isCollapsed ? 'chevrons-right' : 'chevrons-left');
            lucide.createIcons(); // Re-render the icon
        }
    }


    // --- Renders the Main Application Shell (Sidebar, Header, User Profile) ---
    function renderAppShell(user) {
        const isAdmin = user.email === ADMIN_EMAIL; 

        toolNav.innerHTML = Object.keys(tools).map(key => {
            if ((key === 'analytics') && !isAdmin) {
                return ''; 
            }
            const tool = tools[key];
            return `<a href="#" data-tool="${key}" class="nav-item mb-1">
                        <i data-lucide="${tool.icon || 'file-text'}"></i>
                        <span class="nav-item-text">${tool.name}</span>
                    </a>`;
        }).join('');

        userProfileContainer.innerHTML = `
            <button id="collapse-btn" class="nav-item mb-1 w-full lg:flex">
                <i data-lucide="chevrons-left" class="w-5 h-5 mr-3 transition-transform duration-300 ease-in-out"></i>
                <span class="nav-item-text">Collapse</span>
            </button>

            <div class="border-t border-border pt-2">
                 <div id="user-profile-card" class="flex items-center p-2 rounded-lg transition-all duration-300 ease-in-out cursor-pointer hover:bg-white/5">
                    <img id="user-avatar" src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=161B22&color=C9D1D9`}" alt="User Avatar" class="w-9 h-9 rounded-full object-cover border-2 border-border shrink-0" />
                    <div id="user-profile-info" class="ml-3 flex-1 min-w-0 nav-item-text">
                        <p class="text-sm font-semibold truncate text-text-primary" title="${user.displayName}">${user.displayName}</p>
                        <p class="text-xs text-text-secondary truncate" title="${user.email}">${user.email}</p>
                    </div>
                </div>
                <button id="logout-button" class="w-full mt-1 text-left flex items-center p-2 rounded-md text-text-secondary hover:bg-error/10 hover:text-error transition-colors">
                    <i data-lucide="log-out" class="w-5 h-5 mr-3"></i>
                    <span class="nav-item-text">Logout</span>
                </button>

                <div class="border-t border-border mt-2 pt-2">
                    <div class="flex items-center justify-between p-2">
                        <div class="flex items-center nav-item-text">
                            <i data-lucide="sun" class="w-5 h-5 mr-3 text-text-secondary"></i>
                            <span class="text-sm text-text-secondary">Light Mode</span>
                        </div>
                        <label for="theme-toggle" class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" value="" id="theme-toggle" class="sr-only peer">
                            <div class="w-11 h-6 bg-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>
            </div>`;
        
        mainHeader.innerHTML = `
            <button id="menu-toggle-btn" class="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary">
                <i data-lucide="menu" class="w-6 h-6"></i>
            </button>
            <div id="header-content" class="flex-1">
                <!-- Tool-specific header content will be injected by loadTool -->
            </div>
        `;

        // Attach listeners after rendering
        document.getElementById('logout-button').addEventListener('click', () => {
             logActivity(user, "User Logged Out"); 
             signOut(auth);
        });

        document.getElementById('user-profile-card').addEventListener('click', () => {
            loadTool('profile', user);
        });

        document.getElementById('menu-toggle-btn').addEventListener('click', toggleSidebar);
        sidebarOverlay.addEventListener('click', toggleSidebar);
        
        // Attach listener for collapse button
        document.getElementById('collapse-btn').addEventListener('click', toggleSidebarCollapse);

        // --- Theme Toggle Logic ---
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = themeToggle.closest('.flex').querySelector('i');

        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                themeToggle.checked = false;
                themeIcon.setAttribute('data-lucide', 'moon');
            } else {
                document.documentElement.classList.remove('dark');
                themeToggle.checked = true;
                themeIcon.setAttribute('data-lucide', 'sun');
            }
            lucide.createIcons();
        };

        // Check for saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
        applyTheme(savedTheme);

        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
            logActivity(user, `Theme changed to ${newTheme}`);
        });


        toolNav.addEventListener('click', e => {
            const link = e.target.closest('a[data-tool]');
            if (link) {
                e.preventDefault(); 
                loadTool(link.dataset.tool, user); 
                if (window.innerWidth < 1024) {
                    toggleSidebar();
                }
            }
        });

        lucide.createIcons();
    }

    // --- Loads and Renders a Specific Tool ---
    function loadTool(toolKey, user) {
        const isAdmin = user.email === ADMIN_EMAIL;
        const headerContent = document.getElementById('header-content');

        if ((toolKey === 'analytics') && !isAdmin) {
            console.warn(`Unauthorized attempt by ${user.email} to access admin tool: ${toolKey}. Redirecting to dashboard.`);
            loadTool('dashboard', user); 
            return; 
        }

        if (!tools[toolKey]) {
            console.error(`Tool not found: ${toolKey}. Loading dashboard instead.`);
            loadTool('dashboard', user); 
            return; 
        }

        const tool = tools[toolKey];
        if (headerContent) {
            headerContent.innerHTML = `<h1 class="text-xl md:text-2xl font-bold text-text-primary ml-2 lg:ml-0">${tool.name}</h1>`;
        } else {
            mainHeader.innerHTML = `<h1 class="text-xl md:text-2xl font-bold text-text-primary">${tool.name}</h1>`;
        }

        try {
            const rendered = tool.render(user, { db, logActivity }); 
            renderView(mainContent, rendered.html); 

            if (tool.onMount && typeof tool.onMount === 'function') {
                tool.onMount(mainContent, user, { db, logActivity });
            }

            document.querySelectorAll('#tool-nav a').forEach(a => {
                a.classList.remove('active'); 
                if (a.dataset.tool === toolKey) {
                    a.classList.add('active'); 
                }
            });

            logActivity(user, `Mapped to ${tool.name}`);
            
            lucide.createIcons();

        } catch (error) {
             console.error(`Error rendering or mounting tool "${toolKey}":`, error);
             mainContent.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> Could not load tool "${tool.name}". Please check the console for details.</div>`;
             logActivity(user, `Error loading tool: ${tool.name}`);
        }
    }

    setTimeout(() => {
        if (loadingScreen.style.opacity !== '0') { 
            showPage(auth.currentUser ? 'app-screen' : 'auth-screen');
        }
    }, 1500); 

}); // End DOMContentLoaded