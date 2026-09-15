/* ==========================================================================
   Flat 5D - Smart Meal Management System
   JavaScript Logic - Part 1 of 3 (Total Part 7 of 9)
   ========================================================================== */

/**
 * --------------------------------------------------------------------------
 * Firebase Configuration
 * --------------------------------------------------------------------------
 */
const firebaseConfig = {
  apiKey: "AIzaSyBOf2aHKyT8V1Tennc1byJ2Mt4ZED_FteU",
  authDomain: "flat-5b.firebaseapp.com",
  databaseURL: "https://flat-5b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flat-5b",
  storageBucket: "flat-5b.firebasestorage.app",
  messagingSenderId: "999159210859",
  appId: "1:999159210859:web:168bc656d5c873bd80622e"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

/**
 * --------------------------------------------------------------------------
 * 1. Application State & LocalStorage Management
 * --------------------------------------------------------------------------
 * This section handles the core data structure of the application.
 * It defines the default members, their roles, and initializes
 * the 31-day data structure for meals, bazaar, vacations, and notices.
 */

const defaultState = {
    isAdmin: false,
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    activeUserId: null,
    guestMeals: {},
    vacations: {},
    members: [
        { 
            id: 1, 
            name: "Abid", 
            role: "admin_eligible", 
            image: "images/abid.jpg" 
        },
        { 
            id: 2, 
            name: "Rifat", 
            role: "user", 
            image: "images/rifat.jpg" 
        },
        { 
            id: 3, 
            name: "Jubair", 
            role: "admin_eligible", 
            image: "images/jubair.jpg" 
        },
        { 
            id: 4, 
            name: "Maimun", 
            role: "user", 
            image: "images/maimun.jpg" 
        },
        { 
            id: 5, 
            name: "Onon", 
            role: "admin_eligible", 
            image: "images/onon.jpg" 
        },
        { 
            id: 6, 
            name: "Sakib", 
            role: "user", 
            image: "images/sakib.jpg" 
        },
        { 
            id: 7, 
            name: "Mostakim", 
            role: "user", 
            image: "images/mostakim.jpg" 
        }
    ],
    bazaarRecords: [],
    notices: [],
    meals: {},
    history: {}
};

// Initialize empty 31 days data for the default state
for (let i = 1; i <= 31; i++) {
    defaultState.meals[i] = {
        morning: {},
        night: {},
        khalaStatus: {
            morning: 'pending',
            night: 'pending'
        }
    };
    
    // By default, everyone's meal is ON (1)
    defaultState.members.forEach(function(member) {
        defaultState.meals[i].morning[member.id] = 1;
        defaultState.meals[i].night[member.id] = 1;
    });
}

// Clone default state into AppState
let AppState = JSON.parse(JSON.stringify(defaultState));

// Load data from LocalStorage
const savedData = localStorage.getItem('flat5d_data');

if (savedData) {
    try {
        const parsedData = JSON.parse(savedData);
        Object.assign(AppState, parsedData);
        
        /**
         * 🔥 ADVANCED DATA HEALING SYSTEM 🔥
         * If the browser crashes and the data gets corrupted,
         * this system will automatically restore the missing data
         * without losing the existing correct data.
         */
        
        // 1. Fix Members Array Corruption
        if (!Array.isArray(AppState.members) || AppState.members.length === 0) {
            console.warn("Data Healing: Restoring Members Array");
            AppState.members = JSON.parse(JSON.stringify(defaultState.members));
        }
        
        // 2. Fix Meals Object Corruption
        if (!AppState.meals || typeof AppState.meals !== 'object' || Object.keys(AppState.meals).length < 31) {
            console.warn("Data Healing: Restoring Meals Object");
            AppState.meals = JSON.parse(JSON.stringify(defaultState.meals));
        }
        
        // 3. Fix Guest Meals & Vacations Objects
        if (!AppState.guestMeals || typeof AppState.guestMeals !== 'object') {
            AppState.guestMeals = {};
        }
        if (!AppState.vacations || typeof AppState.vacations !== 'object') {
            AppState.vacations = {};
        }
        
        // Security Feature: Always log out admin on page refresh
        AppState.isAdmin = false; 
        
    } catch (error) {
        console.error("Critical Error Loading Data. Resetting to Default.", error);
        AppState = JSON.parse(JSON.stringify(defaultState));
    }
}

/**
 * Saves the current application state to LocalStorage
 */
function saveData() {
    try {
        localStorage.setItem('flat5d_data', JSON.stringify(AppState));
    } catch (error) {
        console.error("Error saving data to LocalStorage:", error);
    }
}

/**
 * --------------------------------------------------------------------------
 * 2. Utility & Helper Functions
 * --------------------------------------------------------------------------
 */

/**
 * Converts English numbers to Bengali digits
 * @param {number|string} engNum - The English number
 * @returns {string} - The Bengali number
 */
function convertToBanglaNumber(engNum) {
    const banglaDigits = {
        '0': '০',
        '1': '১',
        '2': '২',
        '3': '৩',
        '4': '৪',
        '5': '৫',
        '6': '৬',
        '7': '৭',
        '8': '৮',
        '9': '৯'
    };
    
    return String(engNum).replace(/[0-9]/g, function(match) {
        return banglaDigits[match];
    });
}

/**
 * Formats a Date object into a readable Bengali date string
 * @param {Date} dateObj - The Date object
 * @returns {string} - Formatted Bengali date (e.g., ১৬ মে, ২০২৬)
 */
function getBengaliDate(dateObj) {
    const months = [
        "জানুয়ারি", 
        "ফেব্রুয়ারি", 
        "মার্চ", 
        "এপ্রিল", 
        "মে", 
        "জুন", 
        "জুলাই", 
        "আগস্ট", 
        "সেপ্টেম্বর", 
        "অক্টোবর", 
        "নভেম্বর", 
        "ডিসেম্বর"
    ];
    
    const days = [
        "রবিবার", 
        "সোমবার", 
        "মঙ্গলবার", 
        "বুধবার", 
        "বৃহস্পতিবার", 
        "শুক্রবার", 
        "শনিবার"
    ];
    
    const dayName = days[dateObj.getDay()];
    const dateNum = convertToBanglaNumber(dateObj.getDate());
    const monthName = months[dateObj.getMonth()];
    const yearNum = convertToBanglaNumber(dateObj.getFullYear());
    
    return `${dateNum} ${monthName}, ${yearNum} (${dayName})`;
}

/**
 * Formats a numeric amount into Bengali Currency format
 * @param {number} amount - The amount in English digits
 * @returns {string} - Formatted Bengali currency (e.g., ১২.০০ ৳)
 */
function formatCurrency(amount) {
    if (isNaN(amount)) return "০.০০ ৳";
    return convertToBanglaNumber(amount.toFixed(2)) + " ৳";
}

/**
 * Displays a Toast Notification on the screen
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success' or 'error')
 */
function showToast(message, type = 'success') {
    const msgBox = document.getElementById('toastMessage');
    const msgText = document.getElementById('toastText');
    
    if (!msgBox || !msgText) return;
    
    msgText.innerText = message;
    
    if (type === 'error') {
        msgBox.classList.add('error');
    } else {
        msgBox.classList.remove('error');
    }
    
    msgBox.classList.add('show');
    
    // Hide toast after 3 seconds
    setTimeout(function() {
        msgBox.classList.remove('show');
    }, 3000);
}

/**
 * Displays a Custom Confirmation Modal (Updated with safety validation)
 * @param {string} message - The question to ask the user
 * @param {Function} onConfirm - Callback function if user clicks "Yes"
 * @param {string} validationWord - (Optional) Word user must type to confirm
 */
window.customConfirm = function(message, onConfirm, validationWord = null) {
    const modal = document.getElementById('customConfirmModal');
    const msgEl = document.getElementById('customConfirmMessage');
    const inputEl = document.getElementById('customConfirmInput');
    const errorEl = document.getElementById('customConfirmError');
    
    if (!modal || !msgEl) return;
    
    msgEl.innerText = message;
    modal.classList.add('show');
    
    // ইনপুট বক্স শো/হাইড করার লজিক
    if (validationWord) {
        if (inputEl) {
            inputEl.style.display = 'block';
            inputEl.value = ''; // আগের লেখা ক্লিয়ার করে দেওয়া
        }
        if (errorEl) errorEl.style.display = 'none';
    } else {
        if (inputEl) inputEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
    }
    
    const okBtn = document.getElementById('customConfirmOk');
    const cancelBtn = document.getElementById('customConfirmCancel');
    
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    
    okBtn.replaceWith(newOkBtn);
    cancelBtn.replaceWith(newCancelBtn);
    
    newCancelBtn.addEventListener('click', function() {
        modal.classList.remove('show');
    });
    
    newOkBtn.addEventListener('click', function() {
        if (validationWord) {
            // যদি validationWord দেওয়া থাকে, তবে চেক করতে হবে
            if (inputEl && inputEl.value.trim().toLowerCase() === validationWord.toLowerCase()) {
                modal.classList.remove('show');
                if (typeof onConfirm === 'function') onConfirm();
            } else {
                if (errorEl) errorEl.style.display = 'block'; // ভুল লিখলে এরর দেখাবে
            }
        } else {
            // যদি ইনপুট না লাগে, সরাসরি কাজ করবে
            modal.classList.remove('show');
            if (typeof onConfirm === 'function') onConfirm();
        }
    });
};

/**
 * --------------------------------------------------------------------------
 * 3. User Authentication & Initial Setup logic
 * --------------------------------------------------------------------------
 */

/**
 * Populates the user selection dropdowns across the application
 */
function populateMemberDropdowns() {
    const activeSelect = document.getElementById('activeUserSelect');
    const bazaarSelect = document.getElementById('bazaarMemberSelect');
    
    if (activeSelect) {
        activeSelect.innerHTML = '<option value="" disabled selected>আপনার নাম সিলেক্ট করুন...</option>';
    }
    
    if (bazaarSelect) {
        bazaarSelect.innerHTML = '';
    }
    
    if (AppState.members && Array.isArray(AppState.members)) {
        AppState.members.forEach(function(member) {
            const optionHTML = `<option value="${member.id}">${member.name}</option>`;
            
            if (activeSelect) {
                activeSelect.insertAdjacentHTML('beforeend', optionHTML);
            }
            if (bazaarSelect) {
                bazaarSelect.insertAdjacentHTML('beforeend', optionHTML);
            }
        });
    }
}

// User Login Logic (Entering the website)
const enterBtn = document.getElementById('enterWebsiteBtn');

if (enterBtn) {
    enterBtn.addEventListener('click', function() {
        const selectedId = document.getElementById('activeUserSelect').value;
        
        if (!selectedId) {
            showToast('দয়া করে আপনার নাম সিলেক্ট করুন!', 'error');
            return;
        }
        
        AppState.activeUserId = parseInt(selectedId);
        const activeUser = AppState.members.find(m => m.id === AppState.activeUserId);
        
        if (activeUser) {
            const greetingEl = document.getElementById('greetingText');
            if (greetingEl) {
                greetingEl.innerText = "Welcome, " + activeUser.name + "!";
            }
            
            // Reset Admin Status
            AppState.isAdmin = false;
            
            const adminBtn = document.getElementById('adminLoginBtn');
            if (adminBtn) {
                adminBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px; height:20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg> <span class="admin-btn-text">অ্যাডমিন লগিন</span>`;
                adminBtn.style.background = '';
            }
            
            // Hide admin-only elements
            document.querySelectorAll('.admin-only-btn').forEach(function(btn) {
                btn.style.display = 'none';
            });
        }
        
        const loginModal = document.getElementById('userLoginModal');
        if (loginModal) {
            loginModal.classList.remove('show');
        }
        
        showToast('সিস্টেমে সফলভাবে প্রবেশ করেছেন!', 'success');
        
        // Call global refresh if available
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
}

// Admin Login Button Click
const adminLoginBtn = document.getElementById('adminLoginBtn');

if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', function() {
        if (AppState.isAdmin) {
            // Logout logic
            AppState.isAdmin = false;
            adminLoginBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px; height:20px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg> <span class="admin-btn-text">অ্যাডমিন লগিন</span>`;
            adminLoginBtn.style.background = '';
            
            document.querySelectorAll('.admin-only-btn').forEach(function(btn) {
                btn.style.display = 'none';
            });
            
            showToast("অ্যাডমিন প্যানেল থেকে লগআউট করা হয়েছে।", "success");
            
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        } else {
            // Show Login Modal
            const adminModal = document.getElementById('adminLoginModal');
            if (adminModal) {
                adminModal.classList.add('show');
                document.getElementById('adminPasswordInput').value = '';
                document.getElementById('passwordError').style.display = 'none';
            }
        }
    });
}

// Verify Admin Password
const verifyPasswordBtn = document.getElementById('verifyPasswordBtn');

if (verifyPasswordBtn) {
    verifyPasswordBtn.addEventListener('click', function() {
        const passwordInput = document.getElementById('adminPasswordInput');
        const errorEl = document.getElementById('passwordError');
        
        if (passwordInput && passwordInput.value === "flat5badmin") {
            AppState.isAdmin = true;
            
            const adminModal = document.getElementById('adminLoginModal');
            if (adminModal) {
                adminModal.classList.remove('show');
            }
            
            const adminBtn = document.getElementById('adminLoginBtn');
            if (adminBtn) {
                adminBtn.innerHTML = `<span class="admin-btn-text">লগআউট (Admin)</span>`;
                adminBtn.style.background = 'var(--danger-color)';
                adminBtn.style.borderColor = 'var(--danger-color)';
            }
            
            document.querySelectorAll('.admin-only-btn').forEach(function(btn) {
                btn.style.display = 'block';
            });
            
            showToast("অ্যাডমিন প্যানেলে সফলভাবে লগিন হয়েছেন!", "success");
            
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        } else {
            if (errorEl) {
                errorEl.style.display = 'block';
            }
        }
    });
}

/* ==========================================================================
   Flat 5D - Smart Meal Management System
   JavaScript Logic - Part 2 of 3 (Total Part 8 of 9)
   ========================================================================== */

/**
 * --------------------------------------------------------------------------
 * 4. Navigation & Modal Triggers
 * --------------------------------------------------------------------------
 * Handles switching between different sections (Dashboard, Calendar, etc.)
 * and opening/closing all pop-up modals smoothly.
 */

// Universal Close Modal Logic
document.querySelectorAll('.close-modal').forEach(function(button) {
    button.addEventListener('click', function() {
        const modalOverlay = button.closest('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
        }
    });
});

// Setup Add Buttons to open specific Modals with form reset
const modalTriggers = [
    { buttonId: 'addBazaarBtn', formId: 'addBazaarForm', modalId: 'addBazaarModal' },
    { buttonId: 'addNoticeBtn', formId: 'addNoticeForm', modalId: 'addNoticeModal' },
    { buttonId: 'addMemberBtn', formId: 'addMemberForm', modalId: 'addMemberModal' }
];

modalTriggers.forEach(function(trigger) {
    const btn = document.getElementById(trigger.buttonId);
    if (btn) {
        btn.addEventListener('click', function() {
            // Reset the form inside the modal to clear previous inputs
            const form = document.getElementById(trigger.formId);
            if (form) {
                form.reset();
            }
            // Show the target modal
            const modal = document.getElementById(trigger.modalId);
            if (modal) {
                modal.classList.add('show');
            }
        });
    }
});

// Sidebar Navigation Menu Logic
document.querySelectorAll('.nav-item').forEach(function(navItem) {
    navItem.addEventListener('click', function() {
        
        // Remove active class from all navigation items
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.classList.remove('active');
        });
        
        // Add active class to the currently clicked item
        navItem.classList.add('active');
        
        // Get target section ID from data attribute
        const targetSectionId = navItem.getAttribute('data-target');
        
        // Hide all main content sections
        document.querySelectorAll('.content-section').forEach(function(section) {
            section.classList.remove('active-section');
            // Small timeout to allow fade-out animation if needed
            setTimeout(function() {
                section.style.display = 'none';
            }, 50);
        });
        
        // Show the target section with animation
        const targetSection = document.getElementById(targetSectionId);
        if (targetSection) {
            setTimeout(function() {
                targetSection.style.display = 'block';
                // Trigger reflow for animation
                void targetSection.offsetWidth; 
                targetSection.classList.add('active-section');
            }, 60);
        }
        
        // Refresh data whenever a tab is switched to ensure fresh data
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
});

/**
 * --------------------------------------------------------------------------
 * 5. Core Time Logic & Calculations
 * --------------------------------------------------------------------------
 * Calculates meal rates, total costs, and checks if a meal time has passed.
 */

/**
 * Strictly checks if the time for a specific meal slot has passed.
 * Morning Meal deadline: 8:00 AM
 * Night Meal deadline: 6:00 PM (18:00)
 * * @param {number} day - The date of the month (1-31)
 * @param {string} type - 'morning' or 'night'
 * @returns {boolean} - True if time is passed, false otherwise
 */
function isTimePassedStrictly(day, type) {
    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    
    // If the checked day is in the past month/day
    if (day < currentDay) {
        return true;
    }
    
    // If the checked day is today, check the strict hour limits
    if (day === currentDay) {
        if (type === 'morning') {
            // Deadline for morning meal is 8 AM
            return currentHour >= 8;
        } else if (type === 'night') {
            // Deadline for night meal is 6 PM (18:00)
            return currentHour >= 18;
        }
    }
    
    // If the day is in the future
    return false;
}

/**
 * Checks if a meal is locked for editing.
 * Admins bypass this lock completely.
 * * @param {number} day - The date
 * @param {string} type - 'morning' or 'night'
 * @returns {boolean} - True if locked
 */
function isMealLocked(day, type) {
    // If user is logged in as Admin via password, never lock them out
    if (AppState.isAdmin) {
        return false;
    }
    // Otherwise, apply strict time rules
    return isTimePassedStrictly(day, type);
}

/**
 * Calculates the total bazaar, total active meals, and the current meal rate.
 * Updated Logic: Counts meals if time has passed OR if khala is confirmed 'yes'.
 * @returns {Object} { totalBazaar, totalMeals, currentMealRate }
 */
function calculateTotals() {
    let totalBazaar = 0;
    let totalMeals = 0;
    
    if (AppState.bazaarRecords && Array.isArray(AppState.bazaarRecords)) {
        AppState.bazaarRecords.forEach(function(record) {
            totalBazaar += (record.amount || 0);
        });
    }
    
    for (let day = 1; day <= 31; day++) {
        if (AppState.meals[day]) {
            // Count if time passed OR khala is confirmed 'yes'
            if (isTimePassedStrictly(day, 'morning') || AppState.meals[day].khalaStatus.morning === 'yes') {
                // শুধুমাত্র বর্তমান মেম্বারদের মিল কাউন্ট করবে
                AppState.members.forEach(function(member) {
                    totalMeals += (AppState.meals[day].morning[member.id] || 0);
                });
            }
            if (isTimePassedStrictly(day, 'night') || AppState.meals[day].khalaStatus.night === 'yes') {
                // শুধুমাত্র বর্তমান মেম্বারদের মিল কাউন্ট করবে
                AppState.members.forEach(function(member) {
                    totalMeals += (AppState.meals[day].night[member.id] || 0);
                });
            }
        }
    }
    
    const currentMealRate = totalMeals > 0 ? (totalBazaar / totalMeals) : 0;
    
    return {
        totalBazaar: totalBazaar,
        totalMeals: totalMeals,
        currentMealRate: currentMealRate
    };
}

/**
 * Animates a number counting up from start to end.
 * Used for Dashboard top premium cards.
 * * @param {string} elementId - Target DOM element ID
 * @param {number} start - Starting number
 * @param {number} end - Ending number
 * @param {number} duration - Duration in milliseconds
 * @param {boolean} isCurrency - If true, formats as currency (e.g. ৳)
 */
function animateValue(elementId, start, end, duration, isCurrency = false) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    
    let startTimestamp = null;
    
    const step = function(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function for smooth slowdown at the end (easeOutQuart)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentVal = (easeOutQuart * (end - start)) + start;
        
        if (isCurrency) {
            obj.innerText = formatCurrency(currentVal);
        } else {
            // Use Math.floor for integer counts (like total meals)
            obj.innerText = convertToBanglaNumber(Math.floor(currentVal));
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Ensure exact final value at the end of animation
            if (isCurrency) {
                obj.innerText = formatCurrency(end);
            } else {
                obj.innerText = convertToBanglaNumber(end);
            }
        }
    };
    
    window.requestAnimationFrame(step);
}

/**
 * --------------------------------------------------------------------------
 * 6. Rendering Main Dashboard Data
 * --------------------------------------------------------------------------
 */

/**
 * Updates the top stat cards and the member cards grid on the Dashboard.
 */

window.updateDashboardStats = function() {
    const totals = calculateTotals();
    
    animateValue('totalBazaarValue', 0, totals.totalBazaar, 1500, true);
    animateValue('totalMealsValue', 0, totals.totalMeals, 1500, false);
    animateValue('currentMealRate', 0, totals.currentMealRate, 1500, true);
    
    const gridContainer = document.getElementById('membersGrid');
    if (!gridContainer) return;
    
    gridContainer.innerHTML = ''; 
    if (!AppState.members || !Array.isArray(AppState.members)) return;
    
    AppState.members.forEach(function(member) {
        let memberBazaar = 0;
        if (AppState.bazaarRecords) {
            AppState.bazaarRecords.forEach(function(record) {
                if (record.memberId === member.id) {
                    memberBazaar += (record.amount || 0);
                }
            });
        }
        
        let memberMeals = 0;
        for (let day = 1; day <= 31; day++) {
            if (AppState.meals[day]) {
                // Updated Logic here as well
                if (isTimePassedStrictly(day, 'morning') || AppState.meals[day].khalaStatus.morning === 'yes') {
                    memberMeals += (AppState.meals[day].morning[member.id] || 0);
                }
                if (isTimePassedStrictly(day, 'night') || AppState.meals[day].khalaStatus.night === 'yes') {
                    memberMeals += (AppState.meals[day].night[member.id] || 0);
                }
            }
        }
        
        const mealCost = memberMeals * totals.currentMealRate;
        const balance = memberBazaar - mealCost;
        
        let balanceHtml = '';
        if (balance > 1) {
            balanceHtml = `<span style="color:var(--success-color)">পাবেন: ${formatCurrency(balance)}</span>`;
        } else if (balance < -1) {
            balanceHtml = `<span style="color:var(--danger-color)">দিতে হবে: ${formatCurrency(Math.abs(balance))}</span>`;
        } else {
            balanceHtml = `<span style="color:var(--text-muted)">হিসাব সমান</span>`;
        }
        
        let deleteBtnHtml = '';
        if (AppState.isAdmin) {
            deleteBtnHtml = `
                <button 
                    onclick="removeMember(${member.id})" 
                    style="position: absolute; top: 15px; right: 15px; background: var(--danger-light); color: var(--danger-color); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; z-index: 10; transition: 0.3s;"
                    onmouseover="this.style.background='var(--danger-color)'; this.style.color='#fff';"
                    onmouseout="this.style.background='var(--danger-light)'; this.style.color='var(--danger-color)';"
                >
                    &times;
                </button>
            `;
        }

        const cardHtml = `
            <div class="member-card">
                ${deleteBtnHtml}
                <div class="member-header">
                    <img src="${member.image}" alt="${member.name}" class="member-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random&color=fff'">
                    <div class="member-info">
                        <h4 class="member-name">${member.name}</h4>
                        <p class="member-status">মোট মিল: <span class="fw-bold text-dark">${convertToBanglaNumber(memberMeals)}</span></p>
                    </div>
                </div>
                <div class="member-stats">
                    <div class="stat-row">
                        <span>জমা/বাজার:</span>
                        <span class="text-success fw-bold">${formatCurrency(memberBazaar)}</span>
                    </div>
                    <div class="stat-row">
                        <span>মিল খরচ:</span>
                        <span class="text-danger fw-bold">${formatCurrency(mealCost)}</span>
                    </div>
                </div>
                <div class="member-balance">
                    ${balanceHtml}
                </div>
            </div>
        `;
        
        gridContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
};

/**
 * --------------------------------------------------------------------------
 * 7. Guest Meals & Vacation (Absence) Logic
 * --------------------------------------------------------------------------
 * Advanced system to handle multiple guest meals for specific durations,
 * and complete absence (vacation) modes.
 */

// Format Guest Data securely on startup
if (AppState.guestMeals) {
    Object.keys(AppState.guestMeals).forEach(function(uid) {
        if (typeof AppState.guestMeals[uid] === 'number') {
            AppState.guestMeals[uid] = { 
                count: AppState.guestMeals[uid], 
                duration: null, 
                isMorning: true, 
                isNight: true 
            };
        }
    });
}

/**
 * Applies Guest Meals dynamically to the calendar (Smart Routine Check)
 */
function applyAdvancedGuestMeals(uid, config, isAdd) {
    const count = parseInt(config.count) || 0;
    const duration = config.duration ? parseInt(config.duration) : null;
    const isMorning = config.isMorning;
    const isNight = config.isNight;
    
    // ইউজারের পার্মানেন্ট রুটিন চেক করা
    const prefs = (AppState.mealPreferences && AppState.mealPreferences[uid]) ? AppState.mealPreferences[uid] : { morning: true, night: true };
    
    let mealsApplied = 0;
    const currentDay = new Date().getDate();
    
    for (let day = currentDay; day <= 31; day++) {
        if (duration !== null && mealsApplied >= duration) break;
        
        // Morning Update - শুধুমাত্র যদি সকালের রুটিন অন থাকে
        if (isMorning && prefs.morning && !isTimePassedStrictly(day, 'morning')) {
            let currentMorning = parseFloat(AppState.meals[day].morning[uid]) || 0;
            if (isAdd) {
                AppState.meals[day].morning[uid] = currentMorning + count;
            } else {
                let newValue = currentMorning - count;
                AppState.meals[day].morning[uid] = newValue < 0 ? 0 : newValue;
            }
            mealsApplied++;
            if (duration !== null && mealsApplied >= duration) break;
        }
        
        // Night Update - শুধুমাত্র যদি রাতের রুটিন অন থাকে
        if (isNight && prefs.night && !isTimePassedStrictly(day, 'night')) {
            let currentNight = parseFloat(AppState.meals[day].night[uid]) || 0;
            if (isAdd) {
                AppState.meals[day].night[uid] = currentNight + count;
            } else {
                let newValue = currentNight - count;
                AppState.meals[day].night[uid] = newValue < 0 ? 0 : newValue;
            }
            mealsApplied++;
            if (duration !== null && mealsApplied >= duration) break;
        }
    }
}

// Render Guest Meal Box UI
window.renderGuestMealBox = function() {
    const uid = AppState.activeUserId; 
    if (!uid) return;
    
    const config = AppState.guestMeals[uid];
    const controls = document.getElementById('guestMealControls');
    const statusBox = document.getElementById('activeGuestMealStatus');
    const detailsTxt = document.getElementById('guestMealDetailsTxt');
    
    if (config) {
        // Guest mode is ON
        if (controls) controls.style.display = 'none'; 
        if (statusBox) statusBox.style.display = 'block';
        
        if (detailsTxt) {
            let txtHtml = `<span style="font-size: 20px;">${convertToBanglaNumber(config.count)}</span> টি গেস্ট মিল<br><span style="font-size: 14px; opacity:0.9;">(`;
            
            if (config.isMorning && config.isNight) txtHtml += 'সকাল ও রাত'; 
            else if (config.isMorning) txtHtml += 'শুধু সকাল'; 
            else if (config.isNight) txtHtml += 'শুধু রাত';
            
            txtHtml += `)</span><br>`;
            
            if (config.duration) txtHtml += `<span style="font-size: 14px; opacity:0.8; margin-top:5px; display:block;">${convertToBanglaNumber(config.duration)} বেলার জন্য</span>`; 
            else txtHtml += `<span style="font-size: 14px; opacity:0.8; margin-top:5px; display:block;">আনলিমিটেড সময়</span>`;
            
            detailsTxt.innerHTML = txtHtml;
        }
    } else {
        // Guest mode is OFF
        if (controls) controls.style.display = 'block'; 
        if (statusBox) statusBox.style.display = 'none';
    }
};

// Start Guest Meal Event
const startGuestBtn = document.getElementById('startGuestMealBtn');
if (startGuestBtn) {
    startGuestBtn.addEventListener('click', function() {
        const countInput = document.getElementById('guestMealCountInput').value;
        const count = parseInt(countInput);
        const durationVal = document.getElementById('guestMealDurationInput').value;
        const duration = durationVal ? parseInt(durationVal) : null;
        
        const isMorning = document.getElementById('guestMorningCheck').checked;
        const isNight = document.getElementById('guestNightCheck').checked;
        
        if (!count || count < 1 || isNaN(count)) {
            return showToast('দয়া করে সঠিক গেস্টের সংখ্যা লিখুন!', 'error');
        }
        
        if (!isMorning && !isNight) {
            return showToast('সকাল অথবা রাত যেকোনো একটি সিলেক্ট করুন!', 'error');
        }
        
        const config = { count: count, duration: duration, isMorning: isMorning, isNight: isNight };
        
        // Save to State and Apply to Calendar
        AppState.guestMeals[AppState.activeUserId] = config; 
        applyAdvancedGuestMeals(AppState.activeUserId, config, true);
        
        showToast('গেস্ট মিল চালু হয়েছে!', 'success'); 
        
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
}

// Stop Guest Meal Event
const stopGuestBtn = document.getElementById('stopGuestMealBtn');
if (stopGuestBtn) {
    stopGuestBtn.addEventListener('click', function() {
        const config = AppState.guestMeals[AppState.activeUserId];
        if (config) { 
            // Remove applied meals from calendar
            applyAdvancedGuestMeals(AppState.activeUserId, config, false); 
            // Delete configuration
            delete AppState.guestMeals[AppState.activeUserId]; 
            
            showToast('গেস্ট মিল অফ করা হয়েছে!', 'success'); 
            
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        }
    });
}

/**
 * Vacation (Complete Absence) Logic
 * Turns off all future unlocked meals automatically.
 */
function applyVacation(uid, isStart) {
    const currentDay = new Date().getDate();
    for (let day = currentDay; day <= 31; day++) {
        // Set meal to 0 if starting vacation, reset to 1 if stopping
        if (!isTimePassedStrictly(day, 'morning')) {
            AppState.meals[day].morning[uid] = isStart ? 0 : 1;
        }
        if (!isTimePassedStrictly(day, 'night')) {
            AppState.meals[day].night[uid] = isStart ? 0 : 1;
        }
    }
}

// Render Vacation UI Box
window.renderVacationBox = function() {
    const uid = AppState.activeUserId; 
    if (!uid) return;
    
    const isVacation = AppState.vacations[uid];
    const controls = document.getElementById('vacationControls');
    const statusBox = document.getElementById('activeVacationStatus');
    
    if (isVacation) { 
        if (controls) controls.style.display = 'none'; 
        if (statusBox) statusBox.style.display = 'block'; 
    } else { 
        if (controls) controls.style.display = 'block'; 
        if (statusBox) statusBox.style.display = 'none'; 
    }
};

// Start Vacation Event
const startVacBtn = document.getElementById('startVacationBtn');
if (startVacBtn) {
    startVacBtn.addEventListener('click', function() {
        window.customConfirm("ভবিষ্যতের সব আনলকড মিল ০ হয়ে যাবে। আপনি কি নিশ্চিত?", function() {
            AppState.vacations[AppState.activeUserId] = true; 
            applyVacation(AppState.activeUserId, true);
            
            showToast('ছুটি চালু! সামনের সব মিল অফ করা হয়েছে।', 'success'); 
            
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        });
    });
}

// Stop Vacation Event
const stopVacBtn = document.getElementById('stopVacationBtn');
if (stopVacBtn) {
    stopVacBtn.addEventListener('click', function() {
        window.customConfirm("ছুটি শেষ? আগামী সব আনলকড মিল আবার চালু (১) হয়ে যাবে। নিশ্চিত?", function() {
            delete AppState.vacations[AppState.activeUserId]; 
            applyVacation(AppState.activeUserId, false);
            
            showToast('ছুটি শেষ! রেগুলার মিল চালু হয়েছে।', 'success'); 
            
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        });
    });
}

/* ==========================================================================
   Flat 5D - Smart Meal Management System
   JavaScript Logic - Part 3 of 3 (Total Part 9 of 9 - Final)
   ========================================================================== */

/**
 * --------------------------------------------------------------------------
 * 9. Monthly Summary Report & 12-Month Auto History Logic
 * --------------------------------------------------------------------------
 * Handles the automatic transition of months, saves previous months to history,
 * and renders the detailed monthly financial summary.
 */

/**
 * Gets the total number of days in a specific month and year
 * @param {number} month - The month (1-12)
 * @param {number} year - The full year (e.g., 2026)
 * @returns {number} - Number of days in the month
 */
function getDaysInMonth(month, year) {
    // Setting day to 0 of the next month gives the last day of the current month
    return new Date(year, month, 0).getDate();
}

/**
 * Checks if a new month has started.
 * If yes, it backs up the current month's data to history and resets the calendar.
 */
window.checkAndResetNewMonth = function() {
    if (!AppState.history) {
        AppState.history = {};
    }
    
    const now = new Date();
    const realMonth = now.getMonth() + 1; // getMonth is 0-indexed (0-11)
    const realYear = now.getFullYear();

    // Check if the actual month is different from the saved state month
    if (AppState.currentMonth !== realMonth || AppState.currentYear !== realYear) {
        console.log("New Month Detected! Archiving previous data...");
        
        // Format key as YYYY-MM (e.g., 2026-05)
        const historyKey = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
        
        // Calculate the final rate of the ending month
        const totals = calculateTotals();
        
        // Save to history archive
        AppState.history[historyKey] = {
            meals: JSON.parse(JSON.stringify(AppState.meals)),
            bazaarRecords: JSON.parse(JSON.stringify(AppState.bazaarRecords)),
            finalRate: totals.currentMealRate
        };

        // Update application state to the new month
        AppState.currentMonth = realMonth;
        AppState.currentYear = realYear;
        
        // Reset Bazaar Records for the new month
        AppState.bazaarRecords = [];
        
        // Create fresh meal calendar for the new month
        const daysInNewMonth = getDaysInMonth(realMonth, realYear);
        AppState.meals = {};
        
        for (let i = 1; i <= daysInNewMonth; i++) {
            AppState.meals[i] = {
                morning: {}, 
                night: {},
                khalaStatus: { 
                    morning: 'pending', 
                    night: 'pending' 
                }
            };
            
            // Set default meal status to 1 for all members
            AppState.members.forEach(function(member) {
                AppState.meals[i].morning[member.id] = 1; 
                AppState.meals[i].night[member.id] = 1; 
            });
        }
        
        // Save the freshly reset data
        saveData();
        showToast("নতুন মাস শুরু হয়েছে! আগের হিসাব সেভ করে ক্যালেন্ডার আপডেট করা হলো।", "success");
    }
};

/**
 * Populates the dropdown selection for viewing monthly reports.
 */
window.populateMonthDropdown = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    if (!selectEl) return;
    
    selectEl.innerHTML = '';
    
    const monthNames = [
        "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", 
        "মে", "জুন", "জুলাই", "আগস্ট", 
        "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
    ];
    
    const currentM = AppState.currentMonth; 
    const currentY = AppState.currentYear;
    
    // Generate dropdown options for all 12 months
    for (let m = 1; m <= 12; m++) {
        const historyKey = `${currentY}-${String(m).padStart(2, '0')}`;
        let optionLabel = `${monthNames[m - 1]} ${convertToBanglaNumber(currentY)}`;
        let optionValue = historyKey;
        
        if (m === currentM) {
            optionLabel += " (চলতি মাস)";
            optionValue = "current";
        } else if (m > currentM) {
            optionLabel += " (আগামী মাস)";
            optionValue = "upcoming"; 
        }
        
        const isSelected = (m === currentM) ? "selected" : "";
        const html = `<option value="${optionValue}" ${isSelected}>${optionLabel}</option>`;
        
        selectEl.insertAdjacentHTML('beforeend', html);
    }

    // Attach event listener to re-render table when month is changed
    selectEl.removeEventListener('change', renderMonthlySummary);
    selectEl.addEventListener('change', renderMonthlySummary);
};

/**
 * Renders the detailed financial summary table for the selected month.
 */
window.renderMonthlySummary = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    const contentBox = document.getElementById('monthlySummaryContent');
    
    if (!selectEl || !contentBox) return;
    
    const selectedValue = selectEl.value;

    if (selectedValue === 'upcoming') {
        contentBox.innerHTML = `
            <div style="text-align:center; padding: 60px 0;">
                <svg style="width:60px; color:#a3aed1; margin-bottom:15px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 style="color:#a3aed1; font-size:22px; font-weight:700;">এই মাসের ডেটা এখনও তৈরি হয়নি!</h3>
                <p style="color:#707eae; font-size:16px;">মাস শুরু হলে তবেই হিসাব দেখা যাবে।</p>
            </div>`;
        return;
    }

    let sourceMeals = AppState.meals;
    let sourceBazaar = AppState.bazaarRecords;
    let finalArchivedRate = null;
    
    let targetYearStr, targetMonthStr;
    
    if (selectedValue === 'current') {
        targetYearStr = AppState.currentYear;
        targetMonthStr = String(AppState.currentMonth).padStart(2, '0');
    } else {
        const splitVal = selectedValue.split('-');
        targetYearStr = splitVal[0];
        targetMonthStr = splitVal[1];
    }
    
    let targetMonthNum = parseInt(targetMonthStr);
    let targetYearNum = parseInt(targetYearStr);
    let daysInTargetMonth = getDaysInMonth(targetMonthNum, targetYearNum);

    if (selectedValue !== 'current') {
        if (AppState.history && AppState.history[selectedValue]) {
            sourceMeals = AppState.history[selectedValue].meals;
            sourceBazaar = AppState.history[selectedValue].bazaarRecords;
            finalArchivedRate = AppState.history[selectedValue].finalRate;
        } else {
            contentBox.innerHTML = `
                <div style="text-align:center; padding: 60px 0;">
                    <svg style="width:60px; color:#fc6076; margin-bottom:15px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 style="color:#fc6076; font-size:22px; font-weight:700;">কোনো তথ্য পাওয়া যায়নি!</h3>
                    <p style="color:#707eae; font-size:16px;">এই মাসের কোনো ডেটা হিস্ট্রিতে রেকর্ড করা নেই।</p>
                </div>`;
            return;
        }
    }

    let totalBazaarAmount = 0;
    sourceBazaar.forEach(function(record) {
        totalBazaarAmount += (record.amount || 0);
    });
    
    let totalMealsCount = 0;
    for (let d = 1; d <= daysInTargetMonth; d++) {
        if (sourceMeals[d]) {
            if (selectedValue !== 'current' || isTimePassedStrictly(d, 'morning') || sourceMeals[d].khalaStatus?.morning === 'yes') {
                // শুধুমাত্র বর্তমান মেম্বারদের মিল কাউন্ট করবে
                AppState.members.forEach(function(m) {
                    totalMealsCount += (sourceMeals[d].morning[m.id] || 0);
                });
            }
            if (selectedValue !== 'current' || isTimePassedStrictly(d, 'night') || sourceMeals[d].khalaStatus?.night === 'yes') {
                // শুধুমাত্র বর্তমান মেম্বারদের মিল কাউন্ট করবে
                AppState.members.forEach(function(m) {
                    totalMealsCount += (sourceMeals[d].night[m.id] || 0);
                });
            }
        }
    }

    let calculatedRate = 0;
    if (finalArchivedRate !== null) {
        calculatedRate = finalArchivedRate;
    } else if (totalMealsCount > 0) {
        calculatedRate = totalBazaarAmount / totalMealsCount;
    }

    let tableHtml = `
        <table class="bazaar-table">
            <thead>
                <tr>
                    <th>মেম্বার</th>
                    <th>মোট মিল</th>
                    <th>খরচ</th>
                    <th>বাজার জমা</th>
                    <th>পাবে/দিবে</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    AppState.members.forEach(function(member) {
        let memberBazaar = 0;
        sourceBazaar.forEach(function(record) {
            if (record.memberId === member.id) {
                memberBazaar += (record.amount || 0);
            }
        });
        
        let memberMeals = 0; 
        for (let d = 1; d <= daysInTargetMonth; d++) { 
            if (sourceMeals[d]) {
                if (selectedValue !== 'current' || isTimePassedStrictly(d, 'morning') || sourceMeals[d].khalaStatus?.morning === 'yes') {
                    memberMeals += (sourceMeals[d].morning[member.id] || 0); 
                }
                if (selectedValue !== 'current' || isTimePassedStrictly(d, 'night') || sourceMeals[d].khalaStatus?.night === 'yes') {
                    memberMeals += (sourceMeals[d].night[member.id] || 0); 
                }
            }
        }
        
        let mealCost = memberMeals * calculatedRate;
        let balance = memberBazaar - mealCost;
        
        let balanceOutput = '';
        if (balance >= 0) {
            balanceOutput = `<span style="color:var(--success-color); font-weight:800; font-size:16px;">পাবে: ${formatCurrency(balance)}</span>`;
        } else {
            balanceOutput = `<span style="color:var(--danger-color); font-weight:800; font-size:16px;">দিবে: ${formatCurrency(Math.abs(balance))}</span>`;
        }
        
        tableHtml += `
            <tr>
                <td><b style="color:var(--text-primary); font-size:16px;">${member.name}</b></td>
                <td style="font-size: 18px; font-weight: 800; color:var(--text-primary);">${convertToBanglaNumber(memberMeals)}</td>
                <td class="text-danger" style="font-weight:800; font-size:16px;">${formatCurrency(mealCost)}</td>
                <td class="text-success" style="font-weight:800; font-size:16px;">${formatCurrency(memberBazaar)}</td>
                <td>${balanceOutput}</td>
            </tr>
        `;
    });
    
    tableHtml += `
            <tr class="total-row" style="background: var(--bg-sidebar); color: white;">
                <td style="font-size:18px; font-weight: 800;">সর্বমোট</td>
                <td style="font-size:22px; font-weight: 800; color: var(--warning-color);">${convertToBanglaNumber(totalMealsCount)}</td>
                <td>-</td>
                <td style="font-size:22px; font-weight: 800; color: var(--success-color);">${formatCurrency(totalBazaarAmount)}</td>
                <td style="color:var(--warning-color); font-size:18px; font-weight: 800;">রেট: ${formatCurrency(calculatedRate)}</td>
            </tr>
        </tbody>
    </table>`;
    
    contentBox.innerHTML = tableHtml;
};

/**
 * --------------------------------------------------------------------------
 * 10. Motivational Quotes Engine (Islamic & General)
 * --------------------------------------------------------------------------
 * Rotates quotes daily avoiding immediate repetition using LocalStorage.
 */

const baseMotivationalQuotes = [
    { text: "নিশ্চয়ই কষ্টের সাথেই রয়েছে স্বস্তি।", author: "- সূরা আল-ইনশিরাহ (আয়াত: ৫)" },
    { text: "আল্লাহ কারো উপর তার সাধ্যাতীত কষ্ট চাপিয়ে দেন না।", author: "- সূরা আল-বাকারা (আয়াত: ২৮৬)" },
    { text: "যে ব্যক্তি আল্লাহর উপর ভরসা করে, আল্লাহই তার জন্য যথেষ্ট।", author: "- সূরা আত-তালাক (আয়াত: ৩)" },
    { text: "জ্ঞানের চেয়ে বড় কোনো সম্পদ নেই, আর অজ্ঞতার চেয়ে বড় কোনো দারিদ্র্য নেই।", author: "- হযরত আলী (রাঃ)" },
    { text: "যে ব্যক্তি নিজের দোষ দেখতে পায়, সে অন্যের দোষ খোঁজার সময় পায় না।", author: "- হযরত উমর (রাঃ)" },
    { text: "রিজিক শুধু টাকা নয়, ভালো মানুষ, ভালো চরিত্র এবং সুস্থতাও বড় রিজিক।", author: "- ইসলামিক প্রবাদ" },
    { text: "বিপদে ধৈর্য ধারণ করা হলো সবচেয়ে বড় ইবাদত।", author: "- ইসলামিক প্রবাদ" },
    { text: "যে ব্যক্তি পরিশ্রম করে, আল্লাহ তার পরিশ্রমের ফল অবশ্যই দেন।", author: "- ইসলামিক প্রবাদ" },
    { text: "সততা এমন এক উপহার, যা সস্তা মানুষের কাছে আশা করা যায় না।", author: "- সংগৃহীত" },
    { text: "যে নিজের ভুল থেকে শেখে, সে-ই হলো প্রকৃত জ্ঞানী।", author: "- সংগৃহীত" }
];

// Dynamically generate a larger array
const allQuotes = [];
for (let i = 0; i < 30; i++) {
    allQuotes.push(...baseMotivationalQuotes);
}

window.setDailyMotivation = function() {
    try {
        let shownHistory = JSON.parse(localStorage.getItem('flat5d_shownQuotes')) || [];
        
        // Reset if we've shown everything
        if (shownHistory.length >= allQuotes.length) {
            shownHistory = []; 
        }
        
        let availableIndices = [];
        for (let i = 0; i < allQuotes.length; i++) {
            if (!shownHistory.includes(i)) {
                availableIndices.push(i);
            }
        }

        // Pick a random index from available pool
        const randomPick = Math.floor(Math.random() * availableIndices.length);
        const finalIndex = availableIndices[randomPick];
        
        // Save to history
        shownHistory.push(finalIndex);
        localStorage.setItem('flat5d_shownQuotes', JSON.stringify(shownHistory));

        // Update DOM
        const textEl = document.getElementById('quoteText');
        const authorEl = document.getElementById('quoteAuthor');
        
        if (textEl && authorEl && allQuotes[finalIndex]) {
            textEl.innerText = `"${allQuotes[finalIndex].text}"`;
            authorEl.innerText = allQuotes[finalIndex].author;
        }
    } catch (error) {
        console.error("Error setting motivation quote:", error);
    }
};

/**
 * --------------------------------------------------------------------------
 * 11. Master Refresh & System Bootstrap
 * --------------------------------------------------------------------------
 * Core functions to initialize the app and keep UI synchronized with State.
 */

window.refreshAll = function() {
    // 1. Save data to storage
    saveData();
    
    // 2. Update Dashboard Stats
    if (typeof updateDashboardStats === 'function') {
        updateDashboardStats();
    }
    
    // 3. Update Next Meal Box
    if (typeof updateNextMealDisplay === 'function') {
        updateNextMealDisplay();
    }
    
    // 4. Update Quick Toggle Swipe Box
    if (typeof updateQuickMealToggle === 'function') {
        updateQuickMealToggle();
    }
    
    // 5. Render Main Calendar
    if (typeof renderCalendar === 'function') {
        renderCalendar();
    }
    
    // 6. Render Bazaar Data
    if (typeof renderBazaarList === 'function') {
        renderBazaarList();
    }
    
    // 7. Render Guest Meal Controls
    if (typeof renderGuestMealBox === 'function') {
        renderGuestMealBox();
    }
    
    // 8. Render Vacation Controls
    if (typeof renderVacationBox === 'function') {
        renderVacationBox();
    }
    
    // 9. Update Monthly Report table
    if (typeof renderMonthlySummary === 'function') {
        renderMonthlySummary();
    }
    
    // 10. Render Notices
    const noticeContainer = document.getElementById('noticeContainer');
    if (noticeContainer) {
        noticeContainer.innerHTML = '';
        
        // Filter out notices older than 7 days (7 * 24 * 60 * 60 * 1000 ms)
        AppState.notices = AppState.notices.filter(function(notice) {
            return (Date.now() - notice.timestamp) <= 604800000; 
        });
        
        // Display in reverse order (newest first)
        const reversedNotices = [...AppState.notices].reverse();
        
        reversedNotices.forEach(function(notice, index) {
            let deleteBtnHtml = '';
            if (AppState.isAdmin) {
                deleteBtnHtml = `<button class="btn-delete-notice" style="background:var(--danger-light); color:var(--danger-color); border:none; width:30px; height:30px; border-radius:50%; font-size:18px; font-weight:bold; cursor:pointer;" onclick="customConfirm('এই নোটিশটি মুছে ফেলবেন?', function() { AppState.notices = AppState.notices.filter(x => x.id !== ${notice.id}); refreshAll(); })">&times;</button>`;
            }
            
            const isNew = index === 0 ? 'border-left: 5px solid var(--info-color);' : 'border-left: 5px solid #edf2f9;';
            const formattedDate = getBengaliDate(new Date(notice.timestamp));
            
            const noticeHtml = `
                <div class="notice-card" style="background:#fff; padding:20px; border-radius:15px; margin-bottom:15px; box-shadow:var(--shadow-sm); ${isNew}">
                    <div class="notice-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #edf2f9; padding-bottom:10px;">
                        <div>
                            <span style="font-size: 13px; color: var(--text-muted); font-weight:600;">${formattedDate}</span>
                            <b style="color: var(--primary-color); margin-left: 10px; font-size:16px;">${notice.author}</b>
                        </div>
                        ${deleteBtnHtml}
                    </div>
                    <p style="color: var(--text-primary); font-size: 16px; line-height: 1.6; font-weight:500;">${notice.content}</p>
                </div>
            `;
            noticeContainer.insertAdjacentHTML('beforeend', noticeHtml);
        });
    }
};

/**
 * --------------------------------------------------------------------------
 * 🔥 MISSING CORE RENDER FUNCTIONS (CALENDAR, BAZAAR, NEXT MEAL, TOGGLE) 🔥
 * --------------------------------------------------------------------------
 */

// 1. Render Calendar Function

// 1. Render Calendar Function (Fixed Bug for Guest Meals & Future Colors)
window.renderCalendar = function() {
    const thead = document.getElementById('mealTableHead');
    const tbody = document.getElementById('mealTableBody');
    if (!thead || !tbody) return;

    let headHtml = `<tr>
        <th>তারিখ</th>
        <th>বেলা</th>
        <th>মোট</th>`;
    AppState.members.forEach(function(m) { 
        headHtml += `<th>${m.name}</th>`; 
    });
    headHtml += `<th>অ্যাকশন</th></tr>`;
    thead.innerHTML = headHtml;

    let bodyHtml = '';
    const daysInMonth = getDaysInMonth(AppState.currentMonth, AppState.currentYear);
    
    // বর্তমান মিল কোনটা সেটা বের করা
    const upcomingInfo = getUpcomingMealInfo();

    // Helper function for cell rendering
    const getMealCellHtml = (val, day, type) => {
        let isFuture = false;
        
        // চেক করা হচ্ছে এটা ভবিষ্যতের মিল কি না
        if (day > upcomingInfo.day) {
            isFuture = true;
        } else if (day === upcomingInfo.day && upcomingInfo.type === 'morning' && type === 'night') {
            isFuture = true;
        }

        let statusClass = '';
        let displayVal = '';
        
        if (val === 0) {
            statusClass = isFuture ? 'upcoming-off' : 'off'; 
            displayVal = '০';
        } else if (val === 0.5) {
            statusClass = isFuture ? 'upcoming-half' : 'half'; 
            displayVal = '০.৫';
        } else if (val === 1) {
            statusClass = isFuture ? 'upcoming-on' : 'on'; 
            displayVal = '১';
        } else {
            statusClass = isFuture ? 'upcoming-on' : 'on'; 
            displayVal = convertToBanglaNumber(val); // Shows 2, 2.5, 3 etc.
        }
        return `<td class="meal-status ${statusClass}">${displayVal}</td>`;
    };

    for (let day = 1; day <= daysInMonth; day++) {
        if (!AppState.meals[day]) continue;

        const isMornLocked = isMealLocked(day, 'morning');
        const isNightLocked = isMealLocked(day, 'night');

        let mornTotal = 0; let nightTotal = 0;
        AppState.members.forEach(function(m) {
            mornTotal += (AppState.meals[day].morning[m.id] || 0);
            nightTotal += (AppState.meals[day].night[m.id] || 0);
        });

        // Morning Row
        bodyHtml += `<tr>
            <td rowspan="2" class="date-cell">${convertToBanglaNumber(day)}</td>
            <td class="bela-cell">সকাল</td>
            <td style="font-weight:800; color:var(--primary-color);">${convertToBanglaNumber(mornTotal)}</td>`;
        AppState.members.forEach(function(m) {
            const val = AppState.meals[day].morning[m.id] || 0;
            bodyHtml += getMealCellHtml(val, day, 'morning');
        });
        bodyHtml += `<td><button class="btn-edit-meal ${isMornLocked ? 'locked' : ''}" onclick="openEditModal(${day}, 'morning')" ${isMornLocked ? 'disabled' : ''}>${isMornLocked ? 'লকড' : 'এডিট'}</button></td></tr>`;

        // Night Row
        bodyHtml += `<tr style="border-bottom: 3px solid #a3aed1;">
            <td class="bela-cell">রাত</td>
            <td style="font-weight:800; color:var(--primary-color);">${convertToBanglaNumber(nightTotal)}</td>`;
        AppState.members.forEach(function(m) {
            const val = AppState.meals[day].night[m.id] || 0;
            bodyHtml += getMealCellHtml(val, day, 'night');
        });
        bodyHtml += `<td><button class="btn-edit-meal ${isNightLocked ? 'locked' : ''}" onclick="openEditModal(${day}, 'night')" ${isNightLocked ? 'disabled' : ''}>${isNightLocked ? 'লকড' : 'এডিট'}</button></td></tr>`;
    }
    tbody.innerHTML = bodyHtml;
};

// Edit Modal Logic (Fixed to support Guest Meals in Edit Mode)
window.openEditModal = function(day, type) {
    if (isMealLocked(day, type)) return;
    document.getElementById('editMealDate').innerText = convertToBanglaNumber(day);
    document.getElementById('editMealBela').innerText = type === 'morning' ? 'সকাল' : 'রাত';
    
    const form = document.getElementById('editMealForm');
    form.innerHTML = '';
    form.dataset.editDay = day;
    form.dataset.editType = type;

    AppState.members.forEach(function(m) {
        const currentVal = AppState.meals[day][type][m.id] || 0;
        
        let extraOption = '';
        if (currentVal > 1) {
            extraOption = `<option value="${currentVal}" selected>গেস্ট সহ (${convertToBanglaNumber(currentVal)})</option>`;
        }

        const html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center; background:#f8f9fa; padding:10px 15px; border-radius:10px; border: 1px solid #edf2f9;">
                <label style="margin:0; font-weight:800; color:var(--text-primary);">${m.name}</label>
                <select class="form-control" id="edit_member_${m.id}" style="width:150px; padding:10px; font-weight:700;">
                    ${extraOption}
                    <option value="1" ${currentVal === 1 ? 'selected' : ''}>ফুল (১)</option>
                    <option value="0.5" ${currentVal === 0.5 ? 'selected' : ''}>হাফ (০.৫)</option>
                    <option value="0" ${currentVal === 0 ? 'selected' : ''}>অফ (০)</option>
                </select>
            </div>
        `;
        form.insertAdjacentHTML('beforeend', html);
    });
    document.getElementById('editMealModal').classList.add('show');
};

const saveMealBtn = document.getElementById('saveMealBtn');
if(saveMealBtn) {
    saveMealBtn.addEventListener('click', function() {
        const form = document.getElementById('editMealForm');
        const day = parseInt(form.dataset.editDay);
        const type = form.dataset.editType;
        
        AppState.members.forEach(function(m) {
            const select = document.getElementById(`edit_member_${m.id}`);
            if (select) {
                AppState.meals[day][type][m.id] = parseFloat(select.value);
            }
        });
        document.getElementById('editMealModal').classList.remove('show');
        showToast('মিল সফলভাবে আপডেট হয়েছে!', 'success');
        refreshAll();
    });
}

// 2. Next Meal Banner & Live Board Logic
function getUpcomingMealInfo() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDate();
    
    if (hour < 8) return { day: day, type: 'morning', label: 'আজ সকালের মিল' };
    if (hour < 18) return { day: day, type: 'night', label: 'আজ রাতের মিল' };
    
    const nextDay = day + 1 > getDaysInMonth(AppState.currentMonth, AppState.currentYear) ? 1 : day + 1;
    return { day: nextDay, type: 'morning', label: 'আগামীকাল সকালের মিল' };
}

window.updateNextMealDisplay = function() {
    const info = getUpcomingMealInfo();
    const labelEl = document.getElementById('nextMealLabel');
    const countEl = document.getElementById('nextMealCount');
    const boardTitle = document.getElementById('currentMealBoardTitle');
    const boardList = document.getElementById('currentMealBoardList');
    
    if(labelEl) labelEl.innerText = info.label;
    if(boardTitle) boardTitle.innerText = `${info.label} - লাইভ বোর্ড`;
    
    let total = 0;
    let boardHtml = '';
    
    if(AppState.meals[info.day]) {
        AppState.members.forEach(function(m) {
            const val = AppState.meals[info.day][info.type][m.id] || 0;
            total += val;
            
            let statusClass = '';
            let displayVal = '';
            
            // নতুন লজিক: ১ এর বেশি হলে সেটা গেস্ট সহ মোট মিল দেখাবে
            if (val === 0) {
                statusClass = 'off';
                displayVal = 'অফ (০)';
            } else if (val === 0.5) {
                statusClass = 'half';
                displayVal = 'হাফ (০.৫)';
            } else if (val === 1) {
                statusClass = 'on';
                displayVal = 'ফুল (১)';
            } else {
                statusClass = 'on';
                displayVal = `মোট (${convertToBanglaNumber(val)})`; // যেমন: মোট (২.৫) বা মোট (৩)
            }
            
            boardHtml += `<div class="live-meal-item-small ${statusClass}">
                <span style="font-size:14px; margin-bottom:4px;">${m.name}</span>
                <span style="font-size:12px;">${displayVal}</span>
            </div>`;
        });
    }
    
    if(countEl) countEl.innerText = convertToBanglaNumber(total);
    if(boardList) boardList.innerHTML = boardHtml;
};

// Quick Meal Swipe Toggle Logic (Fixed Guest vs Personal Logic)
window.updateQuickMealToggle = function() {
    const uid = AppState.activeUserId;
    if(!uid) return;
    
    const info = getUpcomingMealInfo();
    const toggleLabel = document.getElementById('quickMealLabel');
    if(toggleLabel) toggleLabel.innerText = `${info.label} আপডেট করুন`;
    
    const toggle = document.getElementById('quickMealMainToggle');
    const halfContainer = document.getElementById('halfMealOptionContainer');
    const statusTxt = document.getElementById('quickMealStatusTxt');
    const warningBox = document.getElementById('routineWarningBox');
    
    // পার্মানেন্ট রুটিন চেক
    const prefs = (AppState.mealPreferences && AppState.mealPreferences[uid]) ? AppState.mealPreferences[uid] : { morning: true, night: true };
    const isRoutineOn = info.type === 'morning' ? prefs.morning : prefs.night;
    
    // ড্যাশবোর্ডে ওয়ার্নিং মেসেজ দেখানো
    if (warningBox) {
        let warnings = [];
        if (!prefs.morning) warnings.push('সকাল');
        if (!prefs.night) warnings.push('রাত');

        if (warnings.length > 0) {
            warningBox.style.display = 'block';
            warningBox.innerHTML = `⚠️ আপনার নিয়মিত রুটিনে <b>${warnings.join(' ও ')}</b> এর মিল স্থায়ীভাবে অফ করা আছে।<br><span style="font-size:12px; color:#555;">গেস্ট মিল দিলে তা এই বেলায় অ্যাড হবে না। (আজকের জন্য চাইলে নিচে ম্যানুয়ালি অন করতে পারেন)</span>`;
        } else {
            warningBox.style.display = 'none';
        }
    }
    
    let currentVal = parseFloat(AppState.meals[info.day][info.type][uid]) || 0;
    
    // অ্যাকটিভ গেস্ট মিল আছে কি না বের করা
    let activeGuestCount = 0;
    const guestConfig = AppState.guestMeals[uid];
    if (guestConfig && isRoutineOn) {
        if ((info.type === 'morning' && guestConfig.isMorning) || (info.type === 'night' && guestConfig.isNight)) {
            activeGuestCount = parseInt(guestConfig.count) || 0;
        }
    }
    
    // নিজের বেস মিল হিসাব করা (মোট মিল থেকে গেস্ট বাদ দিয়ে)
    let baseMeal = currentVal - activeGuestCount;
    if (baseMeal < 0) baseMeal = 0;
    if (baseMeal > 1) baseMeal = 1;

    // টগল ইভেন্ট আপডেট করা
    const newToggle = toggle.cloneNode(true);
    toggle.replaceWith(newToggle);
    
    newToggle.checked = baseMeal > 0;
    if(halfContainer) halfContainer.style.display = baseMeal > 0 ? 'block' : 'none';
    
    // স্ট্যাটাস টেক্সট আপডেট
    if(baseMeal === 1) statusTxt.innerText = "আপনার নিজের মিল ফুল (১) সেট করা আছে।";
    else if(baseMeal === 0.5) statusTxt.innerText = "আপনার নিজের মিল হাফ (০.৫) সেট করা আছে।";
    else statusTxt.innerText = "আপনার নিজের মিল অফ (০) করা আছে।";

    // গেস্ট মিল থাকলে সেটা আলাদাভাবে দেখানো
    if(activeGuestCount > 0) {
        statusTxt.innerHTML += `<br><span style="color:var(--success-color); font-size:15px; display:block; margin-top:5px; font-weight:800;">+ সাথে ${convertToBanglaNumber(activeGuestCount)} টি গেস্ট মিল যোগ করা আছে</span>`;
    }
    
    newToggle.addEventListener('change', function() {
        if(halfContainer) halfContainer.style.display = this.checked ? 'block' : 'none';
        if(!this.checked) {
            AppState.meals[info.day][info.type][uid] = 0 + activeGuestCount;
            showToast('আপনার নিজের মিল অফ করা হয়েছে!', 'success');
            refreshAll();
        } else {
            AppState.meals[info.day][info.type][uid] = 1 + activeGuestCount;
            showToast('আপনার নিজের মিল চালু করা হয়েছে!', 'success');
            refreshAll();
        }
    });
    
    const btnFull = document.getElementById('quickMealFullBtn');
    const btnHalf = document.getElementById('quickMealHalfBtn');
    
    if(btnFull && btnHalf) {
        const newBtnFull = btnFull.cloneNode(true);
        const newBtnHalf = btnHalf.cloneNode(true);
        btnFull.replaceWith(newBtnFull);
        btnHalf.replaceWith(newBtnHalf);
        
        if(baseMeal === 1) {
            newBtnFull.style.borderColor = 'var(--success-color)';
            newBtnHalf.style.borderColor = 'transparent';
        } else if (baseMeal === 0.5) {
            newBtnHalf.style.borderColor = 'var(--warning-color)';
            newBtnFull.style.borderColor = 'transparent';
        }
        
        newBtnFull.addEventListener('click', function() {
            AppState.meals[info.day][info.type][uid] = 1 + activeGuestCount;
            showToast('নিজের মিল ফুল (১) করা হয়েছে!', 'success');
            refreshAll();
        });
        
        newBtnHalf.addEventListener('click', function() {
            AppState.meals[info.day][info.type][uid] = 0.5 + activeGuestCount;
            showToast('নিজের মিল হাফ (০.৫) করা হয়েছে!', 'success');
            refreshAll();
        });
    }
};

// 3. Render Bazaar List
window.renderBazaarList = function() {
    const tbody = document.getElementById('bazaarTableBody');
    const totalEl = document.getElementById('tableTotalBazaar');
    if (!tbody || !totalEl) return;
    
    tbody.innerHTML = '';
    let total = 0;
    
    AppState.bazaarRecords.forEach(function(record) {
        const member = AppState.members.find(m => m.id === record.memberId);
        const memName = member ? member.name : 'Unknown';
        total += record.amount;
        
        let actionHtml = '-';
        if (AppState.isAdmin) {
            actionHtml = `<button onclick="deleteBazaar(${record.id})" style="background:var(--danger-light); color:var(--danger-color); border:none; padding:8px 15px; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.3s;" onmouseover="this.style.background='var(--danger-color)'; this.style.color='#fff';" onmouseout="this.style.background='var(--danger-light)'; this.style.color='var(--danger-color)';">মুছুন</button>`;
        }
        
        tbody.insertAdjacentHTML('beforeend', `
            <tr>
                <td style="font-weight:600;">${getBengaliDate(new Date(record.date))}</td>
                <td style="font-weight:800; color:var(--primary-color);">${memName}</td>
                <td style="font-weight:500;">${record.details}</td>
                <td style="font-weight:800; color:var(--success-color); font-size:18px;">${formatCurrency(record.amount)}</td>
                <td>${actionHtml}</td>
            </tr>
        `);
    });
    
    totalEl.innerText = formatCurrency(total);
};

window.deleteBazaar = function(id) {
    customConfirm('এই বাজার রেকর্ডটি মুছে ফেলবেন?', function() {
        AppState.bazaarRecords = AppState.bazaarRecords.filter(r => r.id !== id);
        showToast('বাজার রেকর্ড মুছে ফেলা হয়েছে', 'success');
        refreshAll();
    });
};

window.removeMember = function(id) {
    window.customConfirm(
        'সতর্কতা: এই সদস্যকে সম্পূর্ণ মুছে ফেলতে চাইলে নিচের বক্সে "delete" লিখে নিশ্চিত করুন।', 
        function() {
            AppState.members = AppState.members.filter(m => m.id !== id);
            showToast('সদস্য মুছে ফেলা হয়েছে', 'success');
            refreshAll();
        },
        'delete' // <-- এই তৃতীয় প্যারামিটারটাই ইনপুট বক্স শো করাবে!
    );
};

/**
 * ========================================================================
 * 🔥 MISSING BUTTON ACTIONS, KHALA LOGIC & ADMIN ACCESS CONTROL 🔥
 * ========================================================================
 */

// ১. শুধুমাত্র জুবায়ের এবং আবিদের জন্য অ্যাডমিন বাটন শো করার লজিক
const authSection = document.querySelector('.admin-auth-section');
if (authSection) authSection.style.display = 'none'; // শুরুতে হাইড থাকবে

const mainEnterBtn = document.getElementById('enterWebsiteBtn');
if (mainEnterBtn) {
    mainEnterBtn.addEventListener('click', function() {
        const activeUser = AppState.members.find(m => m.id === AppState.activeUserId);
        if (activeUser && (activeUser.name === 'Onon')) {
            if (authSection) authSection.style.display = 'block'; // শুধু অনন হলে দেখাবে
        } else {
            if (authSection) authSection.style.display = 'none'; // অন্যদের জন্য হাইড
        }
    });
}

// ২. নতুন মেম্বার যোগ করার লজিক
const btnSaveMem = document.getElementById('saveMemberBtn');
if (btnSaveMem) {
    btnSaveMem.addEventListener('click', function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newMemberName');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) return showToast('দয়া করে নতুন মেম্বারের নাম দিন!', 'error');
        
        let newId = AppState.members.length > 0 ? Math.max(...AppState.members.map(m => m.id)) + 1 : 1;
        
        AppState.members.push({ 
            id: newId, 
            name: name, 
            role: 'user', 
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&bold=true` 
        });
        
        for (let day = 1; day <= 31; day++) { 
            if (AppState.meals[day]) {
                AppState.meals[day].morning[newId] = 1; 
                AppState.meals[day].night[newId] = 1; 
            }
        }
        
        document.getElementById('addMemberModal').classList.remove('show');
        showToast(`সদস্য "${name}" সফলভাবে যুক্ত হয়েছে!`, 'success'); 
        populateMemberDropdowns(); 
        refreshAll();
    });
}

// ৩. নোটিশ সাবমিট করার লজিক
const btnSubmitNot = document.getElementById('submitNoticeBtn');
if (btnSubmitNot) {
    btnSubmitNot.addEventListener('click', function(e) {
        e.preventDefault();
        const author = document.getElementById('noticeAuthorName').value.trim();
        const content = document.getElementById('noticeContent').value.trim();
        
        if (!author || !content) return showToast('নাম এবং নোটিশ দিন!', 'error');
        
        AppState.notices.push({ id: Date.now(), author: author, content: content, timestamp: Date.now() });
        
        document.getElementById('addNoticeModal').classList.remove('show');
        showToast('নতুন নোটিশ দেওয়া হয়েছে!', 'success');
        refreshAll();
    });
}

// ৪. বাজার যোগ করার লজিক
const btnSaveBazaar = document.getElementById('saveBazaarBtn');
if (btnSaveBazaar) {
    btnSaveBazaar.addEventListener('click', function(e) {
        e.preventDefault();
        const memId = parseInt(document.getElementById('bazaarMemberSelect').value);
        const details = document.getElementById('bazaarDetails').value.trim() || "-";
        const amount = parseFloat(document.getElementById('bazaarAmount').value);
        
        if (isNaN(amount) || amount <= 0) return showToast('সঠিক টাকার পরিমাণ দিন!', 'error');
        
        AppState.bazaarRecords.push({ 
            id: Date.now(), 
            memberId: memId, 
            details: details, 
            amount: amount, 
            date: new Date().toISOString().split('T')[0] 
        });
        
        document.getElementById('addBazaarModal').classList.remove('show');
        showToast('বাজার সফলভাবে যোগ হয়েছে!', 'success'); 
        refreshAll();
    });
}

// ৫. খালার স্ট্যাটাস (রান্না হবে কি হবে না) আপডেট লজিক
window.updateKhalaUI = function() {
    const info = typeof getUpcomingMealInfo === 'function' ? getUpcomingMealInfo() : null;
    if (!info) return;

    const currentStatus = AppState.meals[info.day]?.khalaStatus[info.type] || 'pending';
    
    const khalaActions = document.getElementById('khalaActions');
    const khalaStatusText = document.getElementById('khalaStatusText');
    const resetBtn = document.getElementById('adminResetKhalaBtn');
    const questionText = document.getElementById('khalaQuestionText');

    if (currentStatus === 'pending') {
        if(khalaActions) khalaActions.style.display = 'flex';
        if(khalaStatusText) khalaStatusText.style.display = 'none';
        if(questionText) questionText.style.display = 'block';
    } else {
        if(khalaActions) khalaActions.style.display = 'none';
        if(questionText) questionText.style.display = 'none';
        if(khalaStatusText) {
            khalaStatusText.style.display = 'block';
            if (currentStatus === 'yes') {
                khalaStatusText.innerHTML = `<span style="color:var(--success-color);">খালা এসেছে! রান্না হবে।</span>`;
            } else {
                khalaStatusText.innerHTML = `<span style="color:var(--danger-color);">খালা আসেনি! সবার মিল ০ হয়ে গেছে।</span>`;
            }
        }
    }

    if (resetBtn) {
        resetBtn.style.display = (currentStatus !== 'pending' && AppState.isAdmin) ? 'block' : 'none';
    }
};

// খালার বাটনের অ্যাকশন
const btnKhalaYes = document.getElementById('khalaYesBtn');
if(btnKhalaYes) btnKhalaYes.addEventListener('click', function() {
    const info = getUpcomingMealInfo();
    AppState.meals[info.day].khalaStatus[info.type] = 'yes';
    showToast('কনফার্ম করা হয়েছে: খালা এসেছে।', 'success');
    refreshAll();
});

const btnKhalaNo = document.getElementById('khalaNoBtn');
if(btnKhalaNo) btnKhalaNo.addEventListener('click', function() {
    window.customConfirm("খালা আসেনি? সবার মিল জিরো (০) হয়ে যাবে। নিশ্চিত?", function() {
        const info = getUpcomingMealInfo();
        AppState.meals[info.day].khalaStatus[info.type] = 'no';
        // সবার মিল ০ করে দেওয়া
        AppState.members.forEach(m => {
            AppState.meals[info.day][info.type][m.id] = 0;
        });
        showToast('খালা আসেনি! সবার মিল ০ করে দেওয়া হয়েছে।', 'error');
        refreshAll();
    });
});

const btnAdminResetKhala = document.getElementById('adminResetKhalaBtn');
if(btnAdminResetKhala) btnAdminResetKhala.addEventListener('click', function() {
    const info = getUpcomingMealInfo();
    AppState.meals[info.day].khalaStatus[info.type] = 'pending';
    showToast('খালার স্ট্যাটাস রিসেট করা হয়েছে।', 'success');
    refreshAll();
});

// Master Refresh-এ খালার UI যুক্ত করা
const oldRefresh = window.refreshAll;
window.refreshAll = function() {
    if(typeof oldRefresh === 'function') oldRefresh();
    if(typeof updateKhalaUI === 'function') updateKhalaUI();
};

// Initial Call
if(typeof updateKhalaUI === 'function') updateKhalaUI();

/**
 * --------------------------------------------------------------------------
 * 🚀 KHALA AUTO-TIMEOUT LOGIC (NEW)
 * --------------------------------------------------------------------------
 */
window.checkAndApplyKhalaTimeout = function() {
    const currentDay = new Date().getDate();
    let isDataChanged = false;

    for (let day = 1; day <= currentDay; day++) {
        if (!AppState.meals[day]) continue;
        
        ['morning', 'night'].forEach(type => {
            // Check if time passed strictly AND khala status is still pending
            if (isTimePassedStrictly(day, type) && AppState.meals[day].khalaStatus[type] === 'pending') {
                AppState.meals[day].khalaStatus[type] = 'no'; // Auto force 'No'
                
                // Force everyone's meal to 0 for that slot
                AppState.members.forEach(m => {
                    AppState.meals[day][type][m.id] = 0;
                });
                isDataChanged = true;
            }
        });
    }
    
    if (isDataChanged) {
        saveData(); // Save the new 0s to localStorage
        console.warn("Time passed without Khala confirmation. Auto-set all meals to 0.");
    }
};

/**
 * --------------------------------------------------------------------------
 * 🔥 PERMANENT MEAL ROUTINE LOGIC 🔥
 * --------------------------------------------------------------------------
 */

window.setupPermanentMealSettings = function() {
    const uid = AppState.activeUserId;
    if (!uid) return;

    // State a notun mealPreferences object na thakle toiri kora
    if (!AppState.mealPreferences) {
        AppState.mealPreferences = {};
    }
    
    // User er kono preference save kora na thakle default vabe dui bela on rakha
    if (!AppState.mealPreferences[uid]) {
        AppState.mealPreferences[uid] = { morning: true, night: true };
    }

    const prefs = AppState.mealPreferences[uid];
    
    const mornToggle = document.getElementById('permMorningToggle');
    const nightToggle = document.getElementById('permNightToggle');
    const settingsBox = document.getElementById('permanentMealSettingsBox');

    if (!mornToggle || !nightToggle || !settingsBox) return;

    // Shudhu user nijei nijer routine change korte parbe
    settingsBox.style.display = 'flex';

    // Clone node to remove old event listeners safely
    const newMorn = mornToggle.cloneNode(true);
    const newNight = nightToggle.cloneNode(true);
    mornToggle.replaceWith(newMorn);
    nightToggle.replaceWith(newNight);

    newMorn.checked = prefs.morning;
    newNight.checked = prefs.night;

    // Routine apply korar main function
    const applyRoutine = (type, isEnabled) => {
        window.customConfirm(`আপনি কি নিশ্চিত? এটি আগামী সব দিনের '${type === 'morning' ? 'সকালের' : 'রাতের'}' মিল ${isEnabled ? 'চালু (১)' : 'অফ (০)'} করে দিবে।`, function() {
            
            AppState.mealPreferences[uid][type] = isEnabled;
            const currentDay = new Date().getDate();
            let updatedCount = 0;

            for (let day = currentDay; day <= 31; day++) {
                if (AppState.meals[day] && !isTimePassedStrictly(day, type)) {
                    // Lock na thakle agami shob diner meal routine onujayi update korbe
                    AppState.meals[day][type][uid] = isEnabled ? 1 : 0;
                    updatedCount++;
                }
            }
            
            showToast(`রুটিন আপডেট! আগামী ${convertToBanglaNumber(updatedCount)} বেলার মিল পরিবর্তন হয়েছে।`, 'success');
            refreshAll();
            
        });
        
        // Confirm na korle jeno ager obosthai fire jay
        if(type === 'morning') newMorn.checked = !isEnabled;
        if(type === 'night') newNight.checked = !isEnabled;
    };

    newMorn.addEventListener('change', (e) => applyRoutine('morning', e.target.checked));
    newNight.addEventListener('change', (e) => applyRoutine('night', e.target.checked));
};

// Master Refresh a ei notun function ta hook kore dewa holo
const previousRefreshAll = window.refreshAll;
window.refreshAll = function() {
    if(typeof previousRefreshAll === 'function') previousRefreshAll();
    if(typeof setupPermanentMealSettings === 'function') setupPermanentMealSettings(); // Add this line
};

// Master Refresh-এ খালার Timeout যুক্ত করা (পুরাতন refreshAll কে আপডেট করা হলো)
const existingRefreshAll = window.refreshAll;
window.refreshAll = function() {
    if(typeof checkAndApplyKhalaTimeout === 'function') checkAndApplyKhalaTimeout(); // Check timeouts first
    if(typeof existingRefreshAll === 'function') existingRefreshAll(); // Then render everything
    if(typeof updateKhalaUI === 'function') updateKhalaUI(); // Update UI
};

/**
 * Initializes the entire application on startup.
 */
function initializeApp() {
    console.log("System Initializing: Flat 5D");
    
    // 1. Current Date Setup
    const dateEl = document.getElementById('displayCurrentDate');
    if (dateEl) {
        dateEl.innerText = getBengaliDate(new Date());
    }
    
    // 2. Start Monthly Checks
    if (typeof checkAndResetNewMonth === 'function') {
        checkAndResetNewMonth(); 
    }
    
    if (typeof populateMonthDropdown === 'function') {
        populateMonthDropdown(); 
    }
    
    // 3. Populate Select Dropdowns
    if (typeof populateMemberDropdowns === 'function') {
        populateMemberDropdowns();
    }
    
    // 4. Set Daily Motivation
    if (typeof setDailyMotivation === 'function') {
        setDailyMotivation(); 
    }
    
    // 5. Run initial rendering
    refreshAll();
    
    // Fallback: Make sure Month Dropdown Year displays correctly
    const calMonthText = document.getElementById('currentMonthYear');
    if (calMonthText) {
        const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        calMonthText.innerText = `${monthNames[AppState.currentMonth - 1]} ${convertToBanglaNumber(AppState.currentYear)}`;
    }
}

// 🔥 Start the app securely when the DOM is fully loaded 🔥
document.addEventListener('DOMContentLoaded', initializeApp);

// Global Error Handler to prevent system crashes
window.addEventListener('error', function(event) {
    console.error("System Caught an Error:", event.error);
});

for (let d = 1; d < new Date().getDate(); d++) { 
    AppState.members.forEach(m => { 
        AppState.meals[d].morning[m.id] = 0; 
        AppState.meals[d].night[m.id] = 0; 
    }); 
} 
saveData(); 
refreshAll();

// Print Report functionality
const printBtn = document.getElementById('printReportBtn');
if (printBtn) {
    const newPrintBtn = printBtn.cloneNode(true);
    printBtn.replaceWith(newPrintBtn);
    newPrintBtn.addEventListener('click', function() {
        const summaryContent = document.getElementById('monthlySummaryContent');
        if (!summaryContent || summaryContent.innerText.includes('কোনো তথ্য পাওয়া যায়নি')) {
            return showToast('প্রিন্ট করার মতো কোনো ডেটা নেই!', 'error');
        }
        showToast('পিডিএফ তৈরি হচ্ছে, দয়া করে অপেক্ষা করুন...', 'success');
        const sourceTable = summaryContent.querySelector('table');
        const pdfHead = document.getElementById('pdfExportHead');
        const pdfBody = document.getElementById('pdfExportBody');
        if (sourceTable && pdfHead && pdfBody) {
            pdfHead.innerHTML = sourceTable.querySelector('thead').innerHTML;
            pdfBody.innerHTML = sourceTable.querySelector('tbody').innerHTML;
            const selectEl = document.getElementById('reportMonthSelect');
            const monthText = selectEl ? selectEl.options[selectEl.selectedIndex].text : '';
            document.getElementById('pdfMonthYear').innerText = `মাস: ${monthText}`;
            const printArea = document.getElementById('pdfPrintArea');
            printArea.style.display = 'block';
            const opt = {
                margin: 0.5,
                filename: `Flat_5B_Monthly_Report_${monthText}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(printArea).save().then(() => {
                printArea.style.display = 'none';
                showToast('পিডিএফ সফলভাবে ডাউনলোড হয়েছে!', 'success');
            });
        }
    });
}
// Image Export Logic for Meal Calendar
window.exportMealCalendarToImage = function() {
    const calendarElement = document.getElementById('meal-calendar');
    if (!calendarElement) return showToast('ক্যালেন্ডার পাওয়া যায়নি!', 'error');

    showToast('ইমেজ তৈরি হচ্ছে, দয়া করে অপেক্ষা করুন...', 'success');
    
    if (typeof html2canvas !== 'undefined') {
        html2canvas(calendarElement, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            const monthText = document.getElementById('currentMonthYear') ? document.getElementById('currentMonthYear').innerText.replace(/\s+/g, '_') : 'Month';
            link.download = `Flat_5B_Meal_Report_${monthText}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.98);
            link.click();
            showToast('ইমেজ সফলভাবে ডাউনলোড হয়েছে!', 'success');
        }).catch(err => {
            console.error(err);
            showToast('ইমেজ ডাউনলোডে সমস্যা হয়েছে।', 'error');
        });
    } else {
        showToast('System Error: html2canvas is missing!', 'error');
    }
};
