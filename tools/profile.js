// /tools/profile.js
import { updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const tool = {
    name: 'Profile & Settings',
    icon: 'user',
    render: (user, { db, logActivity }) => {
        return {
            html: `
                <div class="space-y-8">
                    <!-- Profile Header -->
                    <div class="flex items-center space-x-4">
                        <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=161B22&color=C9D1D9`}" alt="User Avatar" class="w-24 h-24 rounded-full object-cover border-4 border-surface" />
                        <div>
                            <h1 class="text-3xl font-bold">${user.displayName}</h1>
                            <p class="text-text-secondary">${user.email}</p>
                            <button class="button-secondary mt-2" disabled>Upload new picture</button>
                        </div>
                    </div>

                    <!-- Personal Information -->
                    <div class="bg-surface p-6 rounded-xl border border-border">
                        <h2 class="text-xl font-semibold mb-4">Personal Information</h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label for="fullName" class="block text-sm font-medium text-text-secondary mb-1">Full Name</label>
                                <input type="text" id="fullName" class="input-field" value="${user.displayName}" />
                            </div>
                            <div>
                                <label for="role" class="block text-sm font-medium text-text-secondary mb-1">Role</label>
                                <input type="text" id="role" class="input-field" value="User" disabled />
                            </div>
                            <div>
                                <label for="phone" class="block text-sm font-medium text-text-secondary mb-1">Phone</label>
                                <input type="text" id="phone" class="input-field" placeholder="(123) 456-7890" />
                            </div>
                        </div>
                    </div>

                    <!-- Notification Settings -->
                    <div class="bg-surface p-6 rounded-xl border border-border">
                        <h2 class="text-xl font-semibold mb-4">How you get notified</h2>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-semibold">New Announcements</h3>
                                    <p class="text-sm text-text-secondary">Get notified about important organization-wide news.</p>
                                </div>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="announcements" class="toggle-checkbox" />
                                    <label for="announcements" class="toggle-label"></label>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-semibold">Task Reminders</h3>
                                    <p class="text-sm text-text-secondary">Reminders for your upcoming task deadlines.</p>
                                </div>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="reminders" class="toggle-checkbox" />
                                    <label for="reminders" class="toggle-label"></label>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-semibold">Event RSVPs</h3>
                                    <p class="text-sm text-text-secondary">Notifications about responses to your events.</p>
                                </div>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="rsvps" class="toggle-checkbox" />
                                    <label for="rsvps" class="toggle-label"></label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex justify-end space-x-4">
                        <button id="cancel-btn" class="button-secondary">Cancel</button>
                        <button id="save-btn" class="button-primary">Save Changes</button>
                    </div>
                </div>
            `,
            onMount: async (container, user, { db, logActivity }) => {
                const fullNameInput = container.querySelector('#fullName');
                const phoneInput = container.querySelector('#phone');
                const announcementsToggle = container.querySelector('#announcements');
                const remindersToggle = container.querySelector('#reminders');
                const rsvpsToggle = container.querySelector('#rsvps');
                const saveBtn = container.querySelector('#save-btn');
                const cancelBtn = container.querySelector('#cancel-btn');

                const userDocRef = doc(db, 'users', user.uid);

                const loadUserSettings = async () => {
                    try {
                        const docSnap = await getDoc(userDocRef);
                        if (docSnap.exists()) {
                            const settings = docSnap.data();
                            phoneInput.value = settings.phone || '';
                            announcementsToggle.checked = settings.notifications?.announcements ?? true;
                            remindersToggle.checked = settings.notifications?.reminders ?? true;
                            rsvpsToggle.checked = settings.notifications?.rsvps ?? false;
                        }
                    } catch (error) {
                        console.error("Error loading user settings:", error);
                    }
                };

                await loadUserSettings();

                const saveUserSettings = async () => {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';

                    try {
                        // Update display name in Firebase Auth
                        if (fullNameInput.value !== user.displayName) {
                            await updateProfile(user, { displayName: fullNameInput.value });
                        }

                        // Prepare data for Firestore
                        const settingsData = {
                            phone: phoneInput.value,
                            notifications: {
                                announcements: announcementsToggle.checked,
                                reminders: remindersToggle.checked,
                                rsvps: rsvpsToggle.checked,
                            },
                        };

                        // Save settings to Firestore
                        await setDoc(userDocRef, settingsData, { merge: true });

                        await logActivity(user, "User updated profile settings");

                        saveBtn.textContent = 'Saved!';
                        setTimeout(() => {
                            saveBtn.textContent = 'Save Changes';
                            saveBtn.disabled = false;
                        }, 2000);

                    } catch (error) {
                        console.error("Error saving user settings:", error);
                        saveBtn.textContent = 'Error!';
                         setTimeout(() => {
                            saveBtn.textContent = 'Save Changes';
                            saveBtn.disabled = false;
                        }, 2000);
                    }
                };

                saveBtn.addEventListener('click', saveUserSettings);
                cancelBtn.addEventListener('click', loadUserSettings);
            }
        };
    }
};

export { tool };
