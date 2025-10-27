import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Tool Imports ---
// Ensure paths start with '/' for absolute paths from the domain root
import { tool as dashboardTool } from '/tools/dashboard.js';
import { tool as vcfGeneratorTool } from '/tools/vcf-generator.js';
import { tool as cvSorterTool } from '/tools/cv-sorter.js';
import { tool as analyticsTool } from '/tools/analytics.js';


// =================================================================================
// --- 🔒 CONFIGURATION & SECURITY 🔒 ---
// =================================================================================

// WARNING: Exposing Firebase config like this, especially the apiKey, in client-side code is a security risk.
// Consider using environment variables or a backend proxy if possible.
// For this setup, ensure your Firestore Security Rules are properly configured for protection.
const firebaseConfig = {
    apiKey: "AIzaSyANbAmQo0SNFntMpE_iceishapEGxMQ1SI",
    authDomain: "go-pc-987d0.firebaseapp.com",
    projectId: "go-pc-987d0",
    storageBucket: "go-pc-987d0.appspot.com",
    messagingSenderId: "1070794251659",
    appId: "1:1070794251659:web:55ebbc5239fb583dc2a38e"
};

const ADMIN_EMAIL = "fns.placementcell@srcc.du.ac.in";
// WARNING: Client-side whitelisting can be easily bypassed by modifying the JavaScript in the browser.
// Use Firestore Security Rules (e.g., `allow read, write: if request.auth.token.email in ['admin@example.com', 'user@example.com'];`)
// for reliable authorization control.
const WHITELISTED_EMAILS = [ ADMIN_EMAIL, 'srcc.pc.fns2526@gmail.com', 'placementcell@srcc.du.ac.in', 'shourayaaggarwal2006@gmail.com','sjonumwalia@gmail.com','tanvibansal0607@gmail.com','kohliashish12@gmail.com','dhwani1006@gmail.com','harshit.9731@gmail.com','aditya5462006@gmail.com','sharmamanzil05@gmail.com','rohangehani1@gmail.com','cheshani2006@gmail.com','gunjan17guptaa@gmail.com','sandeepramani2006@gmail.com','aadityagoyal0108@gmail.com','aayatirgoyal@gmail.com','mothikrishna86217@gmail.com' ];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Combine imported tools into a single object
const tools = {
    'dashboard': dashboardTool,
    'vcf-generator': vcfGeneratorTool,
    'cv-sorter': cvSorterTool,
    'analytics': analyticsTool,
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
    const appScreen = document.getElementById('app-screen');
    const toolNav = document.getElementById('tool-nav');
    const mainContent = document.getElementById('main-content');
    const mainHeader = document.getElementById('main-header');
    const userProfileContainer = document.getElementById('user-profile-container');

    // Helper function to render views with fade-in animation
    const renderView = (container, html) => {
        container.innerHTML = html;
        // Apply animation class to the first child element if it exists
        const firstChild = container.firstElementChild;
        if (firstChild) firstChild.classList.add('page-enter');
    };

    // Helper function to show the correct main screen (loading, auth, app)
    const showPage = (pageId) => {
        // Hide loading screen smoothly
        loadingScreen.style.opacity = 0;
        setTimeout(() => loadingScreen.classList.add('hidden'), 300); // Wait for transition before hiding

        // Ensure other screens are hidden
        authScreen.classList.add('hidden');
        appScreen.classList.add('hidden');

        // Show the target screen
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
            // User is logged in and whitelisted
            logActivity(user, "User Logged In");
            renderAppShell(user); // Build the main app UI
            loadTool('dashboard', user); // Load the default tool
            showPage('app-screen'); // Display the app screen
        } else {
            // User is not logged in or not whitelisted
            if (user) {
                // If logged in but not whitelisted, log attempt and sign out
                logActivity(user, "Unauthorized access attempt, logging out.");
                signOut(auth).catch(console.error); // Sign out unauthorized user
            }
            renderAuthShell(); // Build the login UI
            showPage('auth-screen'); // Display the auth screen
        }
    });

    // --- Renders the Authentication Screen Layout ---
    function renderAuthShell() {
        const html = `
            <div class="min-h-screen flex">
                <div class="hidden lg:flex w-1/2 bg-gradient-to-br from-indigo-600 to-purple-600 relative items-center justify-center overflow-hidden">
                     <!-- Decorative shapes -->
                    <div class="absolute w-60 h-60 bg-white/5 rounded-full -top-10 -left-12 opacity-50"></div>
                    <div class="absolute w-80 h-80 bg-white/5 rounded-full -bottom-20 -right-10 opacity-50"></div>
                    <div class="z-10 text-white text-center p-12">
                        <div class="flex items-center justify-center gap-4 mb-4">
                             <img class="w-16 h-16 bg-white/20 rounded-2xl p-2" src="/logo.png" alt="GO-PC Logo">
                             <h1 class="text-5xl font-bold tracking-tight">GO-PC</h1>
                        </div>
                        <p class="text-xl opacity-80">Streamline Your Placement Process</p>
                    </div>
                </div>
                <!-- Container for the login form -->
                <div id="auth-form-container" class="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background"></div>
            </div>`;
        authScreen.innerHTML = html;
        // Render the actual login form inside the container
        renderLoginForm(document.getElementById('auth-form-container'));
    }

    // --- Renders the Google Sign-In Form ---
    function renderLoginForm(container) {
        renderView(container, `
            <div class="w-full max-w-sm mx-auto">
                <h2 class="text-3xl font-bold text-text-primary mb-2">Welcome Back</h2>
                <p class="text-text-secondary mb-8">Sign in with your authorized Google account to continue.</p>
                <button id="google-signin-btn" class="button-primary w-full">
                    <!-- Google Icon SVG -->
                    <svg class="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,35.508,44,29.891,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                    Sign in with Google
                </button>
                 <!-- Error message display area -->
                <p id="login-error" class="text-error text-sm text-center mt-4 hidden"></p>
            </div>`);
        // Attach click listener to the sign-in button
        container.querySelector('#google-signin-btn').addEventListener('click', handleGoogleSignIn);
    }

    // --- Handles the Google Sign-In Popup Flow ---
    async function handleGoogleSignIn() {
        const provider = new GoogleAuthProvider();
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.classList.add('hidden'); // Hide previous errors

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            // Crucial: Check against whitelist AFTER successful sign-in
            if (!WHITELISTED_EMAILS.includes(user.email)) {
                await signOut(auth); // Sign out if not authorized
                throw new Error("This Google account is not authorized for GO-PC.");
            }
            // Auth state listener (onAuthStateChanged) will handle rendering the app shell
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            if (errorEl) {
                // Display specific error messages
                let message = "Sign-in failed. Please try again.";
                if (error.code === 'auth/popup-closed-by-user') {
                    message = "Sign-in cancelled.";
                } else if (error.message.includes("authorized")) {
                    message = error.message; // Show the "not authorized" message
                }
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
            }
        }
    }

    // --- Renders the Main Application Shell (Sidebar, Header, User Profile) ---
    function renderAppShell(user) {
        const isAdmin = user.email === ADMIN_EMAIL; // Check if the user is the admin

        // Populate sidebar navigation based on available tools and user role
        toolNav.innerHTML = Object.keys(tools).map(key => {
            // Only show admin tools (cv-sorter, analytics) if user is admin
            if ((key === 'analytics') && !isAdmin) {
                return ''; // Skip rendering for non-admins
            }
            const tool = tools[key];
            // Generate link for the tool
            return `<a href="#" data-tool="${key}" class="nav-item mb-1">${tool.icon}<span>${tool.name}</span></a>`;
        }).join('');

        // Populate user profile section
        userProfileContainer.innerHTML = `
            <div class="border-t border-white/10 pt-4 mt-auto"> <!-- Use mt-auto to push to bottom -->
                 <div class="flex items-center p-2 rounded-lg">
                     <!-- User Avatar -->
                    <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=4F46E5&color=fff`}" alt="User Avatar" class="w-9 h-9 rounded-full object-cover border-2 border-white/20" />
                    <div class="ml-3 flex-1 min-w-0">
                         <!-- User Name and Email -->
                        <p class="text-sm font-semibold truncate text-white" title="${user.displayName}">${user.displayName}</p>
                        <p class="text-xs text-gray-400 truncate" title="${user.email}">${user.email}</p>
                    </div>
                </div>
                 <!-- Logout Button -->
                <button id="logout-button" class="w-full mt-2 text-left flex items-center p-2 rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-300 transition-colors">
                    <svg class="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span>Logout</span>
                </button>
            </div>`;

        // Attach event listeners after rendering
        document.getElementById('logout-button').addEventListener('click', () => {
             logActivity(user, "User Logged Out"); // Log before signing out
             signOut(auth);
        });
        // Add listener to the navigation container for tool switching
        toolNav.addEventListener('click', e => {
            const link = e.target.closest('a[data-tool]'); // Find the clicked tool link
            if (link) {
                e.preventDefault(); // Prevent default link behavior
                loadTool(link.dataset.tool, user); // Load the selected tool
            }
        });
    }

    // --- Loads and Renders a Specific Tool ---
    function loadTool(toolKey, user) {
        const isAdmin = user.email === ADMIN_EMAIL;

        // Double-check authorization before loading admin tools
        if ((toolKey === 'analytics') && !isAdmin) {
            console.warn(`Unauthorized attempt by ${user.email} to access admin tool: ${toolKey}. Redirecting to dashboard.`);
            loadTool('dashboard', user); // Redirect non-admins to dashboard
            return; // Stop further execution
        }

        // Check if the requested tool exists
        if (!tools[toolKey]) {
            console.error(`Tool not found: ${toolKey}. Loading dashboard instead.`);
            loadTool('dashboard', user); // Fallback to dashboard
            return; // Stop further execution
        }

        const tool = tools[toolKey];
        // Update main header with the tool name
        mainHeader.innerHTML = `<h1 class="text-2xl font-bold text-text-primary">${tool.name}</h1>`;

        try {
            // Render the tool's HTML content
            const rendered = tool.render(user, { db, logActivity }); // Pass db and logActivity if needed by render
            renderView(mainContent, rendered.html); // Render HTML into the main content area

            // If the tool has an onMount function, call it after rendering
            if (tool.onMount && typeof tool.onMount === 'function') {
                // Pass necessary dependencies (user, db, logActivity) to onMount
                tool.onMount(mainContent, user, { db, logActivity });
            }

            // Update active state in sidebar navigation
            document.querySelectorAll('#tool-nav a').forEach(a => {
                a.classList.remove('active'); // Remove active class from all links
                if (a.dataset.tool === toolKey) {
                    a.classList.add('active'); // Add active class to the current tool's link
                }
            });

            // Log tool access
            logActivity(user, `Mapped to ${tool.name}`); // Corrected typo: Mapped instead of Mapsd

        } catch (error) {
             // Handle errors during tool rendering or mounting
             console.error(`Error rendering or mounting tool "${toolKey}":`, error);
             mainContent.innerHTML = `<div class="bg-error/10 text-error p-4 rounded-lg"><strong>Error:</strong> Could not load tool "${tool.name}". Please check the console for details.</div>`;
             logActivity(user, `Error loading tool: ${tool.name}`);
        }
    }

    // Initial check to hide loading screen if auth state resolves quickly
    // (though showPage is usually called by the onAuthStateChanged listener)
    setTimeout(() => {
        if (loadingScreen.style.opacity !== '0') { // Only hide if not already fading out
            showPage(auth.currentUser ? 'app-screen' : 'auth-screen');
        }
    }, 1500); // Fallback timeout

}); // End DOMContentLoaded
