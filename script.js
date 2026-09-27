import { initializeApp as initFirebaseApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4uI-ranUbudtm6Cg5jgn53d4IV8ZnxCU",
  authDomain: "flat-5b-94bfd.firebaseapp.com",
  databaseURL: "https://flat-5b-94bfd-default-rtdb.firebaseio.com/",
  projectId: "flat-5b-94bfd",
  storageBucket: "flat-5b-94bfd.firebasestorage.app",
  messagingSenderId: "672445299460",
  appId: "1:672445299460:web:c1dcd3f26ce70302a16e51"
};

const app = initFirebaseApp(firebaseConfig);
const db = getDatabase(app);

const defaultState = {
    isAdmin: false,
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),
    activeUserId: null,
    guestMeals: {},
    vacations: {},
    members: [
        { id: 1, name: "Onon", role: "admin_eligible", image: "images/onon.jpg" },
        { id: 2, name: "Sakib", role: "user", image: "images/sakib.jpg" }
    ],
    bazaarRecords: [],
    notices: [],
    meals: {},
    history: {}
};

for (let i = 1; i <= 31; i++) {
    defaultState.meals[i] = {
        morning: {},
        night: {},
        khalaStatus: { morning: 'pending', night: 'pending' }
    };
    
    defaultState.members.forEach(function(member) {
        defaultState.meals[i].morning[member.id] = 1;
        defaultState.meals[i].night[member.id] = 1;
    });
}

let AppState = JSON.parse(JSON.stringify(defaultState));

let isInitialLoad = true;
let isFetching = false;
let firebaseReady = false;
let pendingSave = false;

// Flat 5B er Database Path
const DATABASE_PATH = 'flat5b_data';
const databaseRef = ref(db, DATABASE_PATH);

// 🔥 Onon কে সবসময় ডিফল্ট অ্যাডমিন হিসেবে সেট রাখার লজিক
function enforceDefaultAdmin() {
    if (!AppState.members || !Array.isArray(AppState.members)) {
        AppState.members = [];
    }
    const ononExists = AppState.members.find(m => m.name === "Onon");
    if (!ononExists) {
        // যদি Onon ডাটাবেসে না থাকে, তবে অটোমেটিক তৈরি করে নিবে
        AppState.members.unshift({ id: 1, name: "Onon", role: "admin_eligible", image: "images/onon.jpg" });
    } else {
        // Onon এর অ্যাডমিন রোল যেন সবসময় ঠিক থাকে
        ononExists.role = "admin_eligible"; 
    }
}

function deepClone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

// 2. Safe Firebase Data Synchronization
function normalizeArray(value) {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    if (typeof value === 'object') {
        return Object.values(value).filter(Boolean);
    }
    return [];
}

function normalizeObject(value) {
    // Firebase theke Array ashleo jeno seta object e convert hoye jay
    if (value && typeof value === 'object') {
        return Object.assign({}, value);
    }
    return {};
}

function normalizeMeals(value) {
    const source = value && typeof value === 'object' ? value : {};
    const normalized = {};

    for (let day = 1; day <= 31; day++) {
        const meal = source[day] || {};
        normalized[day] = {
            morning: normalizeObject(meal.morning),
            night: normalizeObject(meal.night),
            khalaStatus: {
                morning: meal.khalaStatus?.morning || 'pending',
                night: meal.khalaStatus?.night || 'pending'
            }
        };
    }

    return normalized;
}

function ensureMealDaysForMembers() {
    if (!AppState.meals || typeof AppState.meals !== 'object' || Array.isArray(AppState.meals)) {
        AppState.meals = {};
    }

    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();

    for (let day = 1; day <= 31; day++) {
        if (!AppState.meals[day] || typeof AppState.meals[day] !== 'object') {
            AppState.meals[day] = {
                morning: {},
                night: {},
                khalaStatus: { morning: 'pending', night: 'pending' }
            };
        }
        if (!AppState.meals[day].morning) AppState.meals[day].morning = {};
        if (!AppState.meals[day].night) AppState.meals[day].night = {};
        if (!AppState.meals[day].khalaStatus) AppState.meals[day].khalaStatus = { morning: 'pending', night: 'pending' };

        // 🔥 Asol Logic: Firebase e data na thakle past date e 0 ebong future date e 1 set korbe
        AppState.members.forEach(function(member) {
            const uid = member.id;

            // Sokal er meal check
            if (AppState.meals[day].morning[uid] === undefined) {
                // Jodi din ti otit hoy ba ajker dupur 1 ta par hoye jay, tobe 0
                if (day < currentDay || (day === currentDay && currentHour >= 13)) {
                    AppState.meals[day].morning[uid] = 0; 
                } else {
                    // Future hole 1 (Tobe chuti ba routine off thakle 0 hobe)
                    let isMornOn = 1;
                    if (AppState.vacations && AppState.vacations[uid]) isMornOn = 0;
                    else if (AppState.mealPreferences && AppState.mealPreferences[uid] && AppState.mealPreferences[uid].morning === false) isMornOn = 0;
                    AppState.meals[day].morning[uid] = isMornOn;
                }
            }

            // Rater meal check
            if (AppState.meals[day].night[uid] === undefined) {
                // Jodi din ti otit hoy ba ajker rat 10 ta par hoye jay, tobe 0
                if (day < currentDay || (day === currentDay && currentHour >= 22)) {
                    AppState.meals[day].night[uid] = 0; 
                } else {
                    // Future hole 1 (Tobe chuti ba routine off thakle 0 hobe)
                    let isNightOn = 1;
                    if (AppState.vacations && AppState.vacations[uid]) isNightOn = 0;
                    else if (AppState.mealPreferences && AppState.mealPreferences[uid] && AppState.mealPreferences[uid].night === false) isNightOn = 0;
                    AppState.meals[day].night[uid] = isNightOn;
                }
            }
        });
    }
}

function buildPersistedState() {
    const state = deepClone(AppState);
    state.isAdmin = false;
    state.activeUserId = null;
    return state;
}

// 3. Immediate Persistence Fix
window.saveData = async function() {
    if (!firebaseReady) {
        pendingSave = true;
        return false;
    }

    const payload = buildPersistedState();

    try {
        await set(databaseRef, payload);
        console.log("ডাটা ফায়ারবেসে সফলভাবে সেভ হয়েছে!");
        return true;
    } catch (error) {
        console.error("ফায়ারবেস এরর:", error);
        showToast('ডাটা সেভ করা যায়নি। আবার চেষ্টা করুন।', 'error');
        return false;
    }
};

const saveData = window.saveData;

onValue(databaseRef, (snapshot) => {
    isFetching = true;

    const data = snapshot.val();
    const currentAdminStatus = AppState.isAdmin;
    const currentActiveUser = AppState.activeUserId;

    if (data && typeof data === 'object') {
        AppState.currentMonth = Number.isFinite(Number(data.currentMonth)) ? Number(data.currentMonth) : defaultState.currentMonth;
        AppState.currentYear = Number.isFinite(Number(data.currentYear)) ? Number(data.currentYear) : defaultState.currentYear;

        AppState.guestMeals = normalizeObject(data.guestMeals);
        AppState.vacations = normalizeObject(data.vacations);
        AppState.todaysMenu = typeof data.todaysMenu === 'string' ? data.todaysMenu : '';

        enforceDefaultAdmin();

        AppState.members = normalizeArray(data.members).length > 0 ? normalizeArray(data.members) : defaultState.members;
        AppState.bazaarRecords = normalizeArray(data.bazaarRecords);
        AppState.notices = normalizeArray(data.notices);
        AppState.meals = normalizeMeals(data.meals);
        AppState.history = normalizeObject(data.history);
        
        if (data.mealPreferences) {
            AppState.mealPreferences = normalizeObject(data.mealPreferences);
        }

        AppState.isAdmin = currentAdminStatus;
        AppState.activeUserId = currentActiveUser;
    } else {
        AppState = deepClone(defaultState);
        AppState.isAdmin = currentAdminStatus;
        AppState.activeUserId = currentActiveUser;
    }

    ensureMealDaysForMembers();

    firebaseReady = true;
    isFetching = false;

    if (isInitialLoad) {
        isInitialLoad = false;
        if (!data || pendingSave) {
            pendingSave = false;
            saveData();
        }
    }

    // ড্রপডাউন এবং অন্যান্য বেসিক UI আপডেট (এটাই ক্যালেন্ডারের মাসের সমস্যার সমাধান)
    if (typeof populateMemberDropdowns === 'function') populateMemberDropdowns();
    if (typeof populateMonthDropdown === 'function') populateMonthDropdown();
    if (typeof window.populateCalendarMonthDropdown === 'function') window.populateCalendarMonthDropdown();
    
    if (typeof window.checkAndResetNewMonth === 'function') window.checkAndResetNewMonth();
    if (typeof window.refreshAll === 'function') window.refreshAll();

}, (error) => {
    isFetching = false;
    console.error("ফায়ারবেস ডেটা পড়তে সমস্যা হয়েছে:", error);
    showToast('ফায়ারবেস থেকে ডেটা লোড করা যায়নি।', 'error');
});

function convertToBanglaNumber(engNum) {
    const banglaDigits = {
        '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
        '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    return String(engNum).replace(/[0-9]/g, function(match) {
        return banglaDigits[match];
    });
}

function getBengaliDate(dateObj) {
    const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
    const dayName = days[dateObj.getDay()];
    const dateNum = convertToBanglaNumber(dateObj.getDate());
    const monthName = months[dateObj.getMonth()];
    const yearNum = convertToBanglaNumber(dateObj.getFullYear());
    return `${dateNum}${monthName}, ${yearNum} (${dayName})`;
}

function formatCurrency(amount) {
    if (isNaN(amount)) return "০.০০ ৳";
    return convertToBanglaNumber(amount.toFixed(2)) + " ৳";
}

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
    setTimeout(function() {
        msgBox.classList.remove('show');
    }, 3000);
}

window.customConfirm = function(message, onConfirm, validationWord = null) {
    const modal = document.getElementById('customConfirmModal');
    const msgEl = document.getElementById('customConfirmMessage');
    const inputEl = document.getElementById('customConfirmInput');
    const errorEl = document.getElementById('customConfirmError');
    if (!modal || !msgEl) return;
    msgEl.innerText = message;
    modal.classList.add('show');
    
    if (validationWord) {
        if (inputEl) {
            inputEl.style.display = 'block';
            inputEl.value = '';
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
            if (inputEl && inputEl.value.trim().toLowerCase() === validationWord.toLowerCase()) {
                modal.classList.remove('show');
                if (typeof onConfirm === 'function') onConfirm();
            } else {
                if (errorEl) errorEl.style.display = 'block';
            }
        } else {
            modal.classList.remove('show');
            if (typeof onConfirm === 'function') onConfirm();
        }
    });
};

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
            AppState.isAdmin = false;
            
            const adminBtn = document.getElementById('adminLoginBtn');
            const authSection = document.querySelector('.admin-auth-section');
            
            // 🔥 শুধুমাত্র Onon কে অ্যাডমিন বাটন দেখানো হবে
            if (activeUser.name === 'Onon') {
                if (authSection) authSection.style.display = 'block';
            } else {
                if (authSection) authSection.style.display = 'none';
            }

            if (adminBtn) {
                adminBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:20px; height:20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg> <span class="admin-btn-text">অ্যাডমিন লগিন</span>`;
                adminBtn.style.background = '';
            }
            document.querySelectorAll('.admin-only-btn').forEach(function(btn) {
                btn.style.display = 'none';
            });
        }
        
        const loginModal = document.getElementById('userLoginModal');
        if (loginModal) {
            loginModal.classList.remove('show');
        }
        showToast('সিস্টেমে সফলভাবে প্রবেশ করেছেন!', 'success');
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
}

const adminLoginBtn = document.getElementById('adminLoginBtn');
if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', function() {
        if (AppState.isAdmin) {
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
            const adminModal = document.getElementById('adminLoginModal');
            if (adminModal) {
                adminModal.classList.add('show');
                document.getElementById('adminPasswordInput').value = '';
                document.getElementById('passwordError').style.display = 'none';
            }
        }
    });
}

const verifyPasswordBtn = document.getElementById('verifyPasswordBtn');
if (verifyPasswordBtn) {
    verifyPasswordBtn.addEventListener('click', function() {
        const passwordInput = document.getElementById('adminPasswordInput');
        const errorEl = document.getElementById('passwordError');
        
        // 🔥 Flat 5B er Password Check
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

document.querySelectorAll('.close-modal').forEach(function(button) {
    button.addEventListener('click', function() {
        const modalOverlay = button.closest('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('show');
        }
    });
});

const modalTriggers = [
    { buttonId: 'addBazaarBtn', formId: 'addBazaarForm', modalId: 'addBazaarModal' },
    { buttonId: 'addNoticeBtn', formId: 'addNoticeForm', modalId: 'addNoticeModal' },
    { buttonId: 'addMemberBtn', formId: 'addMemberForm', modalId: 'addMemberModal' }
];

modalTriggers.forEach(function(trigger) {
    const btn = document.getElementById(trigger.buttonId);
    if (btn) {
        btn.addEventListener('click', function() {
            const form = document.getElementById(trigger.formId);
            if (form) {
                form.reset();
            }
            const modal = document.getElementById(trigger.modalId);
            if (modal) {
                modal.classList.add('show');
            }
        });
    }
});

document.querySelectorAll('.nav-item').forEach(function(navItem) {
    navItem.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.classList.remove('active');
        });
        navItem.classList.add('active');
        const targetSectionId = navItem.getAttribute('data-target');
        document.querySelectorAll('.content-section').forEach(function(section) {
            section.classList.remove('active-section');
            setTimeout(function() {
                section.style.display = 'none';
            }, 50);
        });
        const targetSection = document.getElementById(targetSectionId);
        if (targetSection) {
            setTimeout(function() {
                targetSection.style.display = 'block';
                void targetSection.offsetWidth; 
                targetSection.classList.add('active-section');
            }, 60);
        }
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
});

// সময়ের লজিক: রাত ১০টা থেকে দুপুর ১টা পর্যন্ত সকালের মিল, বাকি সময় রাতের মিল
function getUpcomingMealInfo() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDate();
    
    if (hour >= 22 || hour < 13) {
        const displayDay = (hour >= 22) ? (day + 1 > 31 ? 1 : day + 1) : day;
        return { day: displayDay, type: 'morning', label: 'সকালের মিল আপডেট করুন' };
    } else {
        return { day: day, type: 'night', label: 'রাতের মিল আপডেট করুন' };
    }
}

// মিল লক হওয়ার কড়া লজিক (আগের মাসের ডেটা হলে অটো লক)
function isTimePassedStrictly(day, type) {
    if (!AppState.meals[day]) return false;

    const now = new Date();
    const realDay = now.getDate();
    const realMonth = now.getMonth() + 1;
    const realYear = now.getFullYear();

    // আগের বছর বা আগের মাস হলে পুরোপুরি লকড (Time passed)
    if (AppState.currentYear < realYear || (AppState.currentYear === realYear && AppState.currentMonth < realMonth)) {
        return true;
    }

    // আগের দিন হলে পুরোপুরি লকড
    if (day < realDay) return true;
    
    // আজকের দিন হলে সময়ের হিসেবে চেক করা
    if (day === realDay) {
        const hour = now.getHours();
        if (type === 'morning' && hour >= 13) return true; // দুপুর ১টার পর সকালের মিল লক
        if (type === 'night' && hour >= 22) return true;   // রাত ১০টার পর রাতের মিল লক
           
        // সময় না পেরোলে, শুধু তখনই লক হবে যদি খালা কনফার্ম হয়ে যায়
        return AppState.meals[day].khalaStatus[type] !== 'pending';
    }

    // ফিউচারের দিন (আগামীকাল বা তার পর) হলে কখনোই লক হবে না (অর্থাৎ False)
    return false; 
}

function isMealLocked(day, type) {
    if (AppState.isAdmin) return false;
    return isTimePassedStrictly(day, type);
}

// ড্রপডাউনে মাসগুলো লোড করার ফাংশন (যাতে ক্যালেন্ডারে মাসগুলো আসে)
window.populateCalendarMonthDropdown = function() {
    const selectEl = document.getElementById('calendarMonthSelect');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    
    const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    
    selectEl.insertAdjacentHTML('beforeend', `<option value="current" selected>${monthNames[AppState.currentMonth - 1]} ${convertToBanglaNumber(AppState.currentYear)} (চলতি মাস)</option>`);
    
    if (AppState.history) {
        Object.keys(AppState.history).sort().reverse().forEach(key => {
            const splitKey = key.split('-');
            const y = splitKey[0];
            const m = splitKey[1];
            const monthName = monthNames[parseInt(m) - 1];
            selectEl.insertAdjacentHTML('beforeend', `<option value="${key}">${monthName} ${convertToBanglaNumber(y)}</option>`);
        });
    }
    
    selectEl.removeEventListener('change', window.renderCalendar);
    selectEl.addEventListener('change', window.renderCalendar);
};

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
            if (isTimePassedStrictly(day, 'morning') || AppState.meals[day].khalaStatus.morning === 'yes') {
                AppState.members.forEach(function(member) {
                    totalMeals += (AppState.meals[day].morning[member.id] || 0);
                });
            }
            if (isTimePassedStrictly(day, 'night') || AppState.meals[day].khalaStatus.night === 'yes') {
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

function animateValue(elementId, start, end, duration, isCurrency = false) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    let startTimestamp = null;
    const step = function(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentVal = (easeOutQuart * (end - start)) + start;
        if (isCurrency) {
            obj.innerText = formatCurrency(currentVal);
        } else {
            obj.innerText = convertToBanglaNumber(Math.floor(currentVal));
        }
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if (isCurrency) {
                obj.innerText = formatCurrency(end);
            } else {
                obj.innerText = convertToBanglaNumber(end);
            }
        }
    };
    window.requestAnimationFrame(step);
}

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

function applyAdvancedGuestMeals(uid, config, isAdd) {
    const count = parseFloat(config.count) || 0; // Float যোগ করার সুবিধা
    const duration = config.duration ? parseInt(config.duration) : null;
    const isMorning = config.isMorning;
    const isNight = config.isNight;
    const prefs = (AppState.mealPreferences && AppState.mealPreferences[uid]) ? AppState.mealPreferences[uid] : { morning: true, night: true };
    let mealsApplied = 0;
    
    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    
    for (let day = currentDay; day <= 31; day++) {
        if (!AppState.meals[day]) continue;
        if (duration !== null && mealsApplied >= duration) break;
        
        let isMorningLocked = (day === currentDay && currentHour >= 13) || AppState.meals[day].khalaStatus.morning !== 'pending';
        if (isMorning && prefs.morning && !isMorningLocked) {
            let currentMorning = parseFloat(AppState.meals[day].morning[uid]) || 0;
            if (isAdd) {
                AppState.meals[day].morning[uid] = currentMorning + count;
            } else {
                let newValue = currentMorning - count;
                AppState.meals[day].morning[uid] = newValue < 0 ? 0 : newValue;
                if (AppState.meals[day].morning[uid] === 0 && prefs.morning) AppState.meals[day].morning[uid] = 1;
            }
            mealsApplied++;
            if (duration !== null && mealsApplied >= duration) break;
        }
        
        let isNightLocked = (day === currentDay && currentHour >= 22) || AppState.meals[day].khalaStatus.night !== 'pending';
        if (isNight && prefs.night && !isNightLocked) {
            let currentNight = parseFloat(AppState.meals[day].night[uid]) || 0;
            if (isAdd) {
                AppState.meals[day].night[uid] = currentNight + count;
            } else {
                let newValue = currentNight - count;
                AppState.meals[day].night[uid] = newValue < 0 ? 0 : newValue;
                if (AppState.meals[day].night[uid] === 0 && prefs.night) AppState.meals[day].night[uid] = 1;
            }
            mealsApplied++;
            if (duration !== null && mealsApplied >= duration) break;
        }
    }
}

window.renderGuestMealBox = function() {
    const uid = AppState.activeUserId; 
    if (!uid) return;
    const config = AppState.guestMeals[uid];
    const controls = document.getElementById('guestMealControls');
    const statusBox = document.getElementById('activeGuestMealStatus');
    const detailsTxt = document.getElementById('guestMealDetailsTxt');
    
    if (config) {
        if (controls) controls.style.display = 'none'; 
        if (statusBox) statusBox.style.display = 'block';
        if (detailsTxt) {
            let txtHtml = `<span style="font-size: 20px;">${convertToBanglaNumber(config.count)}</span> টি গেস্ট মিল<br><span style="font-size: 14px; opacity:0.9;">(`;
            if (config.isMorning && config.isNight) txtHtml += 'সকাল ও রাত'; 
            else if (config.isMorning) txtHtml += 'শুধু সকাল'; 
            else if (config.isNight) txtHtml += 'শুধু রাত';
            txtHtml += `)</span><br>`;
            if (config.duration) txtHtml += `<span style="font-size: 14px; opacity:0.8; margin-top:5px; display:block;">${convertToBanglaNumber(config.duration)} বেলার জন্য</span>`; 
            else txtHtml += `<span style="font-size: 14px; opacity:0.8; margin-top:5px; display:block;">আনলিমিটেড সময়</span>`;
            detailsTxt.innerHTML = txtHtml;
        }
    } else {
        if (controls) controls.style.display = 'block'; 
        if (statusBox) statusBox.style.display = 'none';
    }
};

const startGuestBtn = document.getElementById('startGuestMealBtn');
if (startGuestBtn) {
    const newStartGuestBtn = startGuestBtn.cloneNode(true);
    startGuestBtn.replaceWith(newStartGuestBtn);
    
    newStartGuestBtn.addEventListener('click', async function() {
        const countInput = document.getElementById('guestMealCountInput').value;
        const count = parseFloat(countInput); // Float allow kora holo
        const durationVal = document.getElementById('guestMealDurationInput').value;
        const duration = durationVal ? parseInt(durationVal) : null;
        const isMorning = document.getElementById('guestMorningCheck').checked;
        const isNight = document.getElementById('guestNightCheck').checked;
        
        if (!count || count <= 0 || isNaN(count)) {
            return showToast('দয়া করে সঠিক গেস্টের সংখ্যা লিখুন!', 'error');
        }
        if (!isMorning && !isNight) {
            return showToast('সকাল অথবা রাত যেকোনো একটি সিলেক্ট করুন!', 'error');
        }
        const config = { count: count, duration: duration, isMorning: isMorning, isNight: isNight };
        AppState.guestMeals[AppState.activeUserId] = config; 
        applyAdvancedGuestMeals(AppState.activeUserId, config, true);
        await saveData();
        showToast('গেস্ট মিল চালু হয়েছে!', 'success'); 
        window.refreshAll();
    });
}

const stopGuestBtn = document.getElementById('stopGuestMealBtn');
if (stopGuestBtn) {
    const newStopGuestBtn = stopGuestBtn.cloneNode(true);
    stopGuestBtn.replaceWith(newStopGuestBtn);
    
    newStopGuestBtn.addEventListener('click', async function() {
        const config = AppState.guestMeals[AppState.activeUserId];
        if (config) { 
            applyAdvancedGuestMeals(AppState.activeUserId, config, false); 
            delete AppState.guestMeals[AppState.activeUserId]; 
            await saveData();
            showToast('গেস্ট মিল অফ করা হয়েছে!', 'success'); 
            window.refreshAll();
        }
    });
}

function applyVacation(uid, isStart) {
    const currentDay = new Date().getDate();
    for (let day = currentDay; day <= 31; day++) {
        if (!isTimePassedStrictly(day, 'morning')) {
            AppState.meals[day].morning[uid] = isStart ? 0 : 1;
        }
        if (!isTimePassedStrictly(day, 'night')) {
            AppState.meals[day].night[uid] = isStart ? 0 : 1;
        }
    }
}

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

const startVacBtn = document.getElementById('startVacationBtn');
if (startVacBtn) {
    startVacBtn.addEventListener('click', function() {
        window.customConfirm("ভবিষ্যতের সব আনলকড মিল ০ হয়ে যাবে। আপনি কি নিশ্চিত?", async function() {
            AppState.vacations[AppState.activeUserId] = true; 
            applyVacation(AppState.activeUserId, true);
            await saveData();
            showToast('ছুটি চালু! সামনের সব মিল অফ করা হয়েছে।', 'success'); 
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        });
    });
}

const stopVacBtn = document.getElementById('stopVacationBtn');
if (stopVacBtn) {
    stopVacBtn.addEventListener('click', function() {
        window.customConfirm("ছুটি শেষ? আগামী সব আনলকড মিল আবার চালু (১) হয়ে যাবে। নিশ্চিত?", async function() {
            delete AppState.vacations[AppState.activeUserId]; 
            applyVacation(AppState.activeUserId, false);
            await saveData();
            showToast('ছুটি শেষ! রেগুলার মিল চালু হয়েছে।', 'success'); 
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
        });
    });
}

function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

window.checkAndResetNewMonth = async function() {
    if (!AppState.history) {
        AppState.history = {};
    }
    const now = new Date();
    const realMonth = now.getMonth() + 1;
    const realYear = now.getFullYear();

    if (AppState.currentMonth !== realMonth || AppState.currentYear !== realYear) {
        const historyKey = `${AppState.currentYear}-${String(AppState.currentMonth).padStart(2, '0')}`;
        const totals = calculateTotals();
        AppState.history[historyKey] = {
            meals: JSON.parse(JSON.stringify(AppState.meals)),
            bazaarRecords: JSON.parse(JSON.stringify(AppState.bazaarRecords)),
            finalRate: totals.currentMealRate
        };
        AppState.currentMonth = realMonth;
        AppState.currentYear = realYear;
        AppState.bazaarRecords = [];
        const daysInNewMonth = getDaysInMonth(realMonth, realYear);
        AppState.meals = {};
        for (let i = 1; i <= daysInNewMonth; i++) {
            AppState.meals[i] = {
                morning: {}, 
                night: {},
                khalaStatus: { morning: 'pending', night: 'pending' }
            };
            AppState.members.forEach(function(member) {
                AppState.meals[i].morning[member.id] = 1; 
                AppState.meals[i].night[member.id] = 1; 
            });
        }
        await saveData();
        showToast("নতুন মাস শুরু হয়েছে! আগের হিসাব সেভ করে ক্যালেন্ডার আপডেট করা হলো।", "success");
    }
};

window.populateMonthDropdown = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    
    const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const currentM = AppState.currentMonth; 
    const currentY = AppState.currentYear;
    
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
        selectEl.insertAdjacentHTML('beforeend', `<option value="${optionValue}" ${isSelected}>${optionLabel}</option>`);
    }

    selectEl.removeEventListener('change', window.renderMonthlySummary);
    selectEl.addEventListener('change', window.renderMonthlySummary);
};

window.populateMonthDropdown = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    
    const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const currentM = AppState.currentMonth; 
    const currentY = AppState.currentYear;
    
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
        selectEl.insertAdjacentHTML('beforeend', `<option value="${optionValue}" ${isSelected}>${optionLabel}</option>`);
    }

    selectEl.removeEventListener('change', window.renderMonthlySummary);
    selectEl.addEventListener('change', window.renderMonthlySummary);
};

window.renderMonthlySummary = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    const contentBox = document.getElementById('monthlySummaryContent');
    if (!selectEl || !contentBox) return;
    
    const selectedValue = selectEl.value;

    if (selectedValue === 'upcoming') {
        contentBox.innerHTML = `<div style="text-align:center; padding: 60px 0;"><h3 style="color:#a3aed1;">এই মাসের ডেটা এখনও তৈরি হয়নি!</h3></div>`;
        return;
    }

    let sourceMeals = AppState.meals;
    let sourceBazaar = AppState.bazaarRecords;
    let targetMonthNum = AppState.currentMonth;
    let targetYearNum = AppState.currentYear;

    if (selectedValue !== 'current') {
        const splitVal = selectedValue.split('-');
        targetYearNum = parseInt(splitVal[0]);
        targetMonthNum = parseInt(splitVal[1]);
        if (AppState.history && AppState.history[selectedValue]) {
            sourceMeals = AppState.history[selectedValue].meals;
            sourceBazaar = AppState.history[selectedValue].bazaarRecords;
        } else {
            contentBox.innerHTML = `<div style="text-align:center; padding: 60px 0;"><h3 style="color:#fc6076;">কোনো তথ্য পাওয়া যায়নি!</h3></div>`;
            return;
        }
    }

    let daysInTargetMonth = new Date(targetYearNum, targetMonthNum, 0).getDate();
    let totalBazaarAmount = 0;
    sourceBazaar.forEach(record => totalBazaarAmount += (record.amount || 0));
    
    let totalMealsCount = 0;
    for (let d = 1; d <= daysInTargetMonth; d++) {
        if (sourceMeals[d]) {
            if (selectedValue !== 'current' || isTimePassedStrictly(d, 'morning') || sourceMeals[d].khalaStatus?.morning === 'yes') {
                AppState.members.forEach(m => totalMealsCount += (sourceMeals[d].morning[m.id] || 0));
            }
            if (selectedValue !== 'current' || isTimePassedStrictly(d, 'night') || sourceMeals[d].khalaStatus?.night === 'yes') {
                AppState.members.forEach(m => totalMealsCount += (sourceMeals[d].night[m.id] || 0));
            }
        }
    }
    totalMealsCount = Math.round(totalMealsCount * 1000) / 1000;

    let calculatedRate = totalMealsCount > 0 ? (totalBazaarAmount / totalMealsCount) : 0;

    let tableHtml = `<table class="bazaar-table"><thead><tr><th>মেম্বার</th><th>মোট মিল</th><th>খরচ</th><th>বাজার জমা</th><th>পাবে/দিবে</th></tr></thead><tbody>`;
    
    AppState.members.forEach(function(member) {
        let memberBazaar = 0;
        sourceBazaar.forEach(r => { if (r.memberId === member.id) memberBazaar += (r.amount || 0); });
        
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
        memberMeals = Math.round(memberMeals * 1000) / 1000;

        if (selectedValue !== 'current' && memberMeals === 0 && memberBazaar === 0) return;
        
        let mealCost = memberMeals * calculatedRate;
        let balance = memberBazaar - mealCost;
        let cleanBalance = parseFloat(balance.toFixed(2));
        
        let balanceOutput = cleanBalance >= 0 
            ? `<span style="color:var(--success-color); font-weight:800;">পাবে: ${formatCurrency(cleanBalance)}</span>`
            : `<span style="color:var(--danger-color); font-weight:800;">দিবে: ${formatCurrency(Math.abs(cleanBalance))}</span>`;
        
        tableHtml += `<tr>
            <td><b>${member.name}</b></td>
            <td>${convertToBanglaNumber(memberMeals)}</td>
            <td class="text-danger">${formatCurrency(mealCost)}</td>
            <td class="text-success">${formatCurrency(memberBazaar)}</td>
            <td>${balanceOutput}</td>
        </tr>`;
    });
    
    tableHtml += `<tr class="total-row" style="background: var(--bg-sidebar); color: white;">
        <td>সর্বমোট</td>
        <td>${convertToBanglaNumber(totalMealsCount)}</td>
        <td>-</td>
        <td>${formatCurrency(totalBazaarAmount)}</td>
        <td>রেট: ${formatCurrency(calculatedRate)}</td>
    </tr></tbody></table>`;
    
    contentBox.innerHTML = tableHtml;
};

const baseMotivationalQuotes = [
    { text: "নিশ্চয়ই কষ্টের সাথেই রয়েছে স্বস্তি।", author: "- সূরা আল-ইনশিরাহ (আয়াত: ৫)" },
    { text: "আল্লাহ কারো উপর তার সাধ্যাতীত কষ্ট চাপিয়ে দেন না।", author: "- সূরা আল-বাকারা (আয়াত: ২৮৬)" }
];

const allQuotes = [];
for (let i = 0; i < 30; i++) {
    allQuotes.push(...baseMotivationalQuotes);
}

window.setDailyMotivation = function() {
    try {
        const finalIndex = Math.floor(Math.random() * allQuotes.length);
        const textEl = document.getElementById('quoteText');
        const authorEl = document.getElementById('quoteAuthor');
        if (textEl && authorEl && allQuotes[finalIndex]) {
            textEl.innerText = '"' + allQuotes[finalIndex].text + '"';
            authorEl.innerText = allQuotes[finalIndex].author;
        }
    } catch (error) {
        console.error("Error:", error);
    }
};

window.exportMealCalendarToImage = function() {
    const tableElement = document.getElementById('mealTable');
    if (!tableElement) return showToast('ক্যালেন্ডার ডাটা পাওয়া যায়নি!', 'error');

    showToast('High-Quality ছবি তৈরি হচ্ছে... দয়া করে অপেক্ষা করুন।', 'success');

    const appWrapper = document.querySelector('.app-wrapper');
    if (appWrapper) appWrapper.style.display = 'none';

    const imageContainer = document.createElement('div');
    imageContainer.id = 'imageExportContainer';
    imageContainer.style.cssText = 'width: 1200px; background: #ffffff; padding: 40px; position: absolute; top: 0; left: 0; z-index: 999999;';

    const clonedTable = tableElement.cloneNode(true);
    clonedTable.querySelectorAll('tr').forEach(row => {
        if (row.children.length > 0) row.removeChild(row.lastElementChild);
    });

    clonedTable.style.width = '100%';
    clonedTable.style.borderCollapse = 'collapse';
    clonedTable.querySelectorAll('th').forEach(th => th.style.cssText = 'background-color: #4361ee; color: #ffffff; border: 1px solid #4361ee; padding: 15px; font-size: 16px; font-weight: bold;');
    clonedTable.querySelectorAll('td').forEach(td => td.style.cssText = 'border: 1px solid #cbd5e1; padding: 12px; font-size: 15px; font-weight: bold; text-align: center;');

    imageContainer.innerHTML = `
        <div style="text-align:center; margin-bottom: 30px; border-bottom: 3px solid #4361ee; padding-bottom: 20px;">
            <h1 style="color:#111c43; font-size: 36px;">Monthly Meal Report</h1>
            <p style="color:#4361ee; font-size: 22px;">Month: ${convertToBanglaNumber(AppState.currentMonth)} | Year: ${convertToBanglaNumber(AppState.currentYear)}</p>
        </div>
        ${clonedTable.outerHTML}
    `;

    document.body.appendChild(imageContainer);

    const restoreUI = () => {
        if (document.body.contains(imageContainer)) document.body.removeChild(imageContainer);
        if (appWrapper) appWrapper.style.display = 'flex';
    };

    const processImage = () => {
        setTimeout(() => {
            html2canvas(imageContainer, { scale: 3, useCORS: true, backgroundColor: "#ffffff" }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Meal_Report_${AppState.currentMonth}_${AppState.currentYear}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('ছবি ডাউনলোড সফল হয়েছে!', 'success');
                restoreUI();
            }).catch(e => { restoreUI(); showToast('ছবি তৈরিতে সমস্যা হয়েছে!', 'error'); });
        }, 1000);
    };

    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = processImage;
        document.head.appendChild(script);
    } else {
        processImage();
    }
};

// ডাউনলোড বাটনের ইভেন্ট লিসেনার
const printBtn = document.getElementById('printReportBtn');
if (printBtn) {
    printBtn.addEventListener('click', function() {
        window.exportMealCalendarToImage();
    });
}

// সব UI একসাথে আপডেট করার মাস্টার ফাংশন (যেটা মিসিং ছিল)
window.refreshAll = function() {
    if (typeof populateMemberDropdowns === 'function') populateMemberDropdowns();
    if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
    if (typeof window.updateNextMealDisplay === 'function') window.updateNextMealDisplay();
    if (typeof window.updateQuickMealToggle === 'function') window.updateQuickMealToggle();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.renderBazaarList === 'function') window.renderBazaarList();
    if (typeof window.renderGuestMealBox === 'function') window.renderGuestMealBox();
    if (typeof window.renderVacationBox === 'function') window.renderVacationBox();
    if (typeof window.renderMonthlySummary === 'function') window.renderMonthlySummary();
    if (typeof window.updateKhalaUI === 'function') window.updateKhalaUI();
    if (typeof window.setupPermanentMealSettings === 'function') window.setupPermanentMealSettings();
    if (typeof window.renderTodaysMenu === 'function') window.renderTodaysMenu();
    if (typeof window.renderMissedMeals === 'function') window.renderMissedMeals();

    // নোটিশ বোর্ড লজিক
    const noticeContainer = document.getElementById('noticeContainer');
    if (noticeContainer) {
        noticeContainer.innerHTML = '';
        AppState.notices = AppState.notices.filter(notice => (Date.now() - notice.timestamp) <= 604800000); 
        const reversedNotices = [...AppState.notices].reverse();
        
        reversedNotices.forEach((notice, index) => {
            let deleteBtn = AppState.isAdmin ? `<button style="background:var(--danger-light); color:var(--danger-color); border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;" onclick="window.customConfirm('মুছে ফেলবেন?', async function() { AppState.notices = AppState.notices.filter(x => x.id !== ${notice.id}); await window.saveData(); window.refreshAll(); })">&times;</button>` : '';
            const borderStyle = index === 0 ? 'border-left: 5px solid var(--info-color);' : 'border-left: 5px solid #edf2f9;';
            
            noticeContainer.insertAdjacentHTML('beforeend', `
                <div style="background:#fff; padding:20px; border-radius:15px; margin-bottom:15px; box-shadow:var(--shadow-sm); ${borderStyle}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <div><span style="font-size:13px; color:gray;">${getBengaliDate(new Date(notice.timestamp))}</span> <b style="color:var(--primary-color); margin-left:10px;">${notice.author}</b></div>
                        ${deleteBtn}
                    </div>
                    <p>${notice.content}</p>
                </div>
            `);
        });
    }
};


window.renderCalendar = function() {
    // ১. 'লোড হচ্ছে...' টেক্সট আপডেট করে বর্তমান মাস ও বছর বসানো
    const calMonthText = document.getElementById('currentMonthYear');
    if (calMonthText) {
        const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        calMonthText.innerText = `${monthNames[AppState.currentMonth - 1]} ${convertToBanglaNumber(AppState.currentYear)}`;
    }

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
    const daysInMonth = new Date(AppState.currentYear, AppState.currentMonth, 0).getDate();
    const upcomingInfo = getUpcomingMealInfo();

    const getMealCellHtml = (val, day, type, memberName) => {
        let isFuture = false;
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
            displayVal = convertToBanglaNumber(val); 
        }
        return `<td class="meal-status ${statusClass}" data-name="${memberName}"><span class="meal-val-text">${displayVal}</span></td>`;
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

        // সকালের রো (Row)
        bodyHtml += `<tr>
            <td rowspan="2" class="date-cell">${convertToBanglaNumber(day)}</td>
            <td class="bela-cell">সকাল</td>
            <td style="font-weight:800; color:var(--primary-color);">${convertToBanglaNumber(mornTotal)}</td>`;
        AppState.members.forEach(function(m) {
            const val = AppState.meals[day].morning[m.id] || 0;
            bodyHtml += getMealCellHtml(val, day, 'morning', m.name);
        });
        bodyHtml += `<td><button class="btn-edit-meal ${isMornLocked ? 'locked' : ''}" onclick="openEditModal(${day}, 'morning')" ${isMornLocked ? 'disabled' : ''}>${isMornLocked ? 'লকড' : 'এডিট'}</button></td></tr>`;

        // রাতের রো (Row)
        bodyHtml += `<tr style="border-bottom: 3px solid #a3aed1;">
            <td class="bela-cell">রাত</td>
            <td style="font-weight:800; color:var(--primary-color);">${convertToBanglaNumber(nightTotal)}</td>`;
        AppState.members.forEach(function(m) {
            const val = AppState.meals[day].night[m.id] || 0;
            bodyHtml += getMealCellHtml(val, day, 'night', m.name);
        });
        bodyHtml += `<td><button class="btn-edit-meal ${isNightLocked ? 'locked' : ''}" onclick="openEditModal(${day}, 'night')" ${isNightLocked ? 'disabled' : ''}>${isNightLocked ? 'লকড' : 'এডিট'}</button></td></tr>`;
    }
    tbody.innerHTML = bodyHtml;
};

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
        
        // Eikhane drop-down er bodole Input field dewa holo jate jekono decimal number dewa jay
        const html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; align-items:center; background:#f8f9fa; padding:10px 15px; border-radius:10px; border: 1px solid #edf2f9;">
                <label style="margin:0; font-weight:800; color:var(--text-primary); font-size:16px;">${m.name}</label>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" step="any" min="0" class="form-control" id="edit_member_${m.id}" value="${currentVal}" style="width:85px; padding:8px; font-weight:800; text-align:center; border:2px solid var(--primary-light); color:var(--primary-color); border-radius:8px;">
                    <span style="font-size:15px; font-weight:700; color:var(--text-muted);">টি</span>
                </div>
            </div>
        `;
        form.insertAdjacentHTML('beforeend', html);
    });
    document.getElementById('editMealModal').classList.add('show');
};

const saveMealBtn = document.getElementById('saveMealBtn');
if(saveMealBtn) {
    // Duplicate click erate cloneNode babohar kora hocche
    const newSaveBtn = saveMealBtn.cloneNode(true);
    saveMealBtn.replaceWith(newSaveBtn);
    
    newSaveBtn.addEventListener('click', async function() {
        const form = document.getElementById('editMealForm');
        const day = parseInt(form.dataset.editDay);
        const type = form.dataset.editType;
        
        AppState.members.forEach(function(m) {
            const inputEl = document.getElementById(`edit_member_${m.id}`);
            if (inputEl) {
                // parseFloat babohar kora holo jeno 0.343 ba decimal support kore
                let val = parseFloat(inputEl.value);
                if (isNaN(val) || val < 0) val = 0; 
                AppState.meals[day][type][m.id] = val;
            }
        });
        
        document.getElementById('editMealModal').classList.remove('show');
        showToast('মিল আপডেট হয়েছে!', 'success');
        await saveData();
        window.refreshAll();
    });
}


// লাইভ বোর্ড আপডেট লজিক
window.updateNextMealDisplay = function() {
    const info = getUpcomingMealInfo();
    const labelEl = document.getElementById('nextMealLabel');
    const countEl = document.getElementById('nextMealCount');
    const boardTitle = document.getElementById('currentMealBoardTitle');
    const boardList = document.getElementById('currentMealBoardList');
    
    if (!AppState.meals[info.day]) {
        AppState.meals[info.day] = { morning: {}, night: {}, khalaStatus: { morning: 'pending', night: 'pending' } };
    }
    
    const currentStatus = AppState.meals[info.day].khalaStatus[info.type] || 'pending';
    if (labelEl) {
        labelEl.innerText = currentStatus !== 'pending' ? `${info.label} (লকড)` : info.label;
    }
    
    if(boardTitle) boardTitle.innerText = `${info.label} - লাইভ অবস্থা`;
    
    let total = 0;
    let boardHtml = '';
    
    AppState.members.forEach(function(m) {
        const val = parseFloat(AppState.meals[info.day][info.type][m.id]) || 0;
        total += val;
        
        let statusClass = '';
        let displayVal = '';
        
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
            displayVal = `মোট (${convertToBanglaNumber(val)})`; 
        }
        
        boardHtml += `<div class="live-meal-item-small ${statusClass}">
            <span style="font-size:14px; margin-bottom:4px;">${m.name}</span>
            <span style="font-size:12px;">${displayVal}</span>
        </div>`;
    });
    
    if(countEl) countEl.innerText = convertToBanglaNumber(total);
    if(boardList) boardList.innerHTML = boardHtml;
};

// Quick Meal Swipe Toggle Logic (লোড হচ্ছে ফিক্স সহ)
window.updateQuickMealToggle = function() {
    const info = getUpcomingMealInfo();
    const toggleBoxOuter = document.querySelector('.quick-toggle-box-large');
    const toggleLabel = document.getElementById('quickMealLabel');
    
    if (!AppState.meals[info.day]) {
        AppState.meals[info.day] = { morning: {}, night: {}, khalaStatus: { morning: 'pending', night: 'pending' } };
    }

    const currentStatus = AppState.meals[info.day].khalaStatus[info.type] || 'pending';
    
    if (currentStatus !== 'pending') {
        if(toggleBoxOuter) toggleBoxOuter.classList.add('locked-section');
        if(toggleLabel) toggleLabel.innerText = `${info.label} (লক হয়ে গেছে)`;
    } else {
        if(toggleBoxOuter) toggleBoxOuter.classList.remove('locked-section');
        if(toggleLabel) toggleLabel.innerText = `${info.label} আপডেট করুন`;
    }
    
    const uid = AppState.activeUserId;
    const mainToggleWrapper = document.querySelector('.main-toggle-wrapper');
    const halfContainer = document.getElementById('halfMealOptionContainer');
    const statusTxt = document.getElementById('quickMealStatusTxt');

    // ইউজার সিলেক্ট না করা থাকলে ওয়ার্নিং
    if(!uid) {
        if(mainToggleWrapper) mainToggleWrapper.style.display = 'none';
        if(halfContainer) halfContainer.style.display = 'none';
        if(statusTxt) statusTxt.innerHTML = `<span style="color:var(--danger-color); font-size:16px;">দয়া করে ড্যাশবোর্ড থেকে নিজের নাম সিলেক্ট করুন!</span>`;
        return;
    } else {
        if(mainToggleWrapper) mainToggleWrapper.style.display = 'flex';
    }
    
    const toggle = document.getElementById('quickMealMainToggle');
    const warningBox = document.getElementById('routineWarningBox');
    
    const prefs = (AppState.mealPreferences && AppState.mealPreferences[uid]) ? AppState.mealPreferences[uid] : { morning: true, night: true };
    const isRoutineOn = info.type === 'morning' ? prefs.morning : prefs.night;
    
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
    
    let activeGuestCount = 0;
    const guestConfig = AppState.guestMeals[uid];
    if (guestConfig && isRoutineOn) {
        if ((info.type === 'morning' && guestConfig.isMorning) || (info.type === 'night' && guestConfig.isNight)) {
            activeGuestCount = parseInt(guestConfig.count) || 0;
        }
    }
    
    let baseMeal = currentVal - activeGuestCount;
    if (baseMeal < 0) baseMeal = 0;
    if (baseMeal > 1) baseMeal = 1;

    const newToggle = toggle.cloneNode(true);
    toggle.replaceWith(newToggle);
    
    newToggle.checked = baseMeal > 0;
    if(halfContainer) halfContainer.style.display = baseMeal > 0 ? 'block' : 'none';
    
    if(baseMeal === 1) statusTxt.innerText = "আপনার নিজের মিল ফুল (১) সেট করা আছে।";
    else if(baseMeal === 0.5) statusTxt.innerText = "আপনার নিজের মিল হাফ (০.৫) সেট করা আছে।";
    else statusTxt.innerText = "আপনার নিজের মিল অফ (০) করা আছে।";

    if(activeGuestCount > 0) {
        statusTxt.innerHTML += `<br><span style="color:var(--success-color); font-size:15px; display:block; margin-top:5px; font-weight:800;">+ সাথে ${convertToBanglaNumber(activeGuestCount)} টি গেস্ট মিল যোগ করা আছে</span>`;
    }
    
    newToggle.addEventListener('change', async function() {
        if(!this.checked) {
            if(halfContainer) halfContainer.style.display = 'none';
            AppState.meals[info.day][info.type][uid] = 0 + activeGuestCount;
            showToast('আপনার নিজের মিল অফ করা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        } else {
            if (!isRoutineOn) {
                const waktName = info.type === 'morning' ? 'সকালের' : 'রাতের';
                window.customConfirm(`আপনার নিয়মিত রুটিনে ${waktName} মিল বন্ধ আছে।\n\nআপনি কি শুধুমাত্র আজকের জন্য মিলটি চালু করতে চান?`, async function() {
                    AppState.meals[info.day][info.type][uid] = 1 + activeGuestCount;
                    showToast(`শুধুমাত্র আজকের ${waktName} মিল চালু করা হয়েছে!`, 'success');
                    await saveData();
                    window.refreshAll();
                });
                newToggle.checked = false; 
            } else {
                if(halfContainer) halfContainer.style.display = 'block';
                AppState.meals[info.day][info.type][uid] = 1 + activeGuestCount;
                showToast('আপনার নিজের মিল চালু করা হয়েছে!', 'success');
                await saveData();
                window.refreshAll();
            }
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
        
        newBtnFull.addEventListener('click', async function() {
            AppState.meals[info.day][info.type][uid] = 1 + activeGuestCount;
            showToast('নিজের মিল ফুল (১) করা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        });
        
        newBtnHalf.addEventListener('click', async function() {
            AppState.meals[info.day][info.type][uid] = 0.5 + activeGuestCount;
            showToast('নিজের মিল হাফ (০.৫) করা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        });
    }
};

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
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${record.date}</td><td>${memName}</td><td>${record.details}</td><td>${formatCurrency(record.amount)}</td><td></td></tr>`);
    });
    totalEl.innerText = formatCurrency(total);
};


// খালার স্ট্যাটাস UI আপডেট লজিক (Hardcore Fade Logic)
window.updateKhalaUI = function() {
    const info = getUpcomingMealInfo();
    if (!info) return;

    const currentStatus = AppState.meals[info.day]?.khalaStatus[info.type] || 'pending';
    
    const khalaSectionContainer = document.getElementById('khalaSectionContainer');
    const khalaActions = document.getElementById('khalaActions');
    const khalaStatusText = document.getElementById('khalaStatusText');
    const resetBtn = document.getElementById('adminResetKhalaBtn');
    const questionText = document.getElementById('khalaQuestionText');

    const now = new Date();
    const hour = now.getHours();

    let totalUpcomingMeals = 0;
    if (AppState.meals[info.day]) {
        AppState.members.forEach(m => {
            totalUpcomingMeals += (parseFloat(AppState.meals[info.day][info.type][m.id]) || 0);
        });
    }
    totalUpcomingMeals = Math.round(totalUpcomingMeals * 1000) / 1000;

    let isKhalaActionActive = false;
    let waitMessage = "";

    if (totalUpcomingMeals <= 0) {
        isKhalaActionActive = false;
        waitMessage = "সবার মিল অফ থাকায় খালার আপডেট বন্ধ আছে";
    } else {
        if (info.type === 'morning') {
            if (hour >= 6 && hour < 13) isKhalaActionActive = true;
            else waitMessage = "সকাল ৬ টার পর খালার আপডেট দেওয়া যাবে";
        } else if (info.type === 'night') {
            if (hour >= 17 && hour < 22) isKhalaActionActive = true;
            else waitMessage = "বিকাল ৫ টার পর খালার আপডেট দেওয়া যাবে";
        }
    }

    if (currentStatus === 'pending') {
        if (isKhalaActionActive) {
            if(khalaSectionContainer) {
                khalaSectionContainer.style.opacity = '1';
                khalaSectionContainer.style.pointerEvents = 'auto';
                khalaSectionContainer.style.filter = 'none';
            }
            if(khalaActions) khalaActions.style.display = 'flex';
            if(khalaStatusText) khalaStatusText.style.display = 'none';
            if(questionText) {
                questionText.style.display = 'block';
                questionText.innerText = "রান্নার জন্য খালা এসেছে কি না?";
                questionText.style.color = '#fff';
            }
        } else {
            if(khalaSectionContainer) {
                khalaSectionContainer.style.opacity = '0.4';
                khalaSectionContainer.style.pointerEvents = 'none';
                khalaSectionContainer.style.filter = 'grayscale(100%)';
            }
            if(khalaActions) khalaActions.style.display = 'none';
            if(khalaStatusText) khalaStatusText.style.display = 'none';
            if(questionText) {
                questionText.style.display = 'block';
                questionText.innerText = waitMessage;
                questionText.style.color = '#ffeb3b';
            }
        }
    } else {
        if(khalaSectionContainer) {
            khalaSectionContainer.style.opacity = '1';
            khalaSectionContainer.style.pointerEvents = 'auto';
            khalaSectionContainer.style.filter = 'none';
        }
        if(khalaActions) khalaActions.style.display = 'none';
        if(questionText) questionText.style.display = 'none';
        if(khalaStatusText) {
            khalaStatusText.style.display = 'block';
            if (currentStatus === 'yes') {
                const waktName = info.type === 'morning' ? 'সকালের' : 'রাতের';
                khalaStatusText.innerHTML = `<span style="color:var(--success-color); font-size:18px;">খালা এসেছে! আজ ${waktName} মোট মিল: ${convertToBanglaNumber(totalUpcomingMeals)} টি।</span>`;
            } else {
                khalaStatusText.innerHTML = `<span style="color:var(--danger-color); font-size:18px;">খালা আসেনি! সবার মিল ০ হয়ে গেছে।</span>`;
            }
        }
    }

    if (resetBtn) {
        resetBtn.style.display = (currentStatus !== 'pending' && AppState.isAdmin) ? 'block' : 'none';
    }
};

// খালার বাটনের অ্যাকশন (Yes, No, Reset)
const btnKhalaYes = document.getElementById('khalaYesBtn');
if(btnKhalaYes) {
    const newYesBtn = btnKhalaYes.cloneNode(true);
    btnKhalaYes.replaceWith(newYesBtn);
    newYesBtn.addEventListener('click', async function() {
        const info = getUpcomingMealInfo();
        AppState.meals[info.day].khalaStatus[info.type] = 'yes';
        
        let thisWaktTotal = 0;
        AppState.members.forEach(m => {
            thisWaktTotal += (AppState.meals[info.day][info.type][m.id] || 0);
        });

        showToast(`কনফার্ম: খালা এসেছে। ${info.label} ${convertToBanglaNumber(thisWaktTotal)} টি।`, 'success');
        await saveData();
        window.refreshAll();
    });
}

const btnKhalaNo = document.getElementById('khalaNoBtn');
if(btnKhalaNo) {
    const newNoBtn = btnKhalaNo.cloneNode(true);
    btnKhalaNo.replaceWith(newNoBtn);
    newNoBtn.addEventListener('click', function() {
        window.customConfirm("খালা আসেনি? সবার মিল জিরো (০) হয়ে যাবে। নিশ্চিত?", async function() {
            const info = getUpcomingMealInfo();
            // স্ন্যাপশট ব্যাকআপ
            AppState.meals[info.day][info.type + '_backup'] = JSON.parse(JSON.stringify(AppState.meals[info.day][info.type]));
            AppState.meals[info.day].khalaStatus[info.type] = 'no';
            
            AppState.members.forEach(m => { AppState.meals[info.day][info.type][m.id] = 0; });
            showToast('খালা আসেনি! সবার মিল ০ করে দেওয়া হয়েছে।', 'error');
            await saveData();
            window.refreshAll();
        });
    });
}

const btnAdminResetKhala = document.getElementById('adminResetKhalaBtn');
if(btnAdminResetKhala) {
    const newResetBtn = btnAdminResetKhala.cloneNode(true);
    btnAdminResetKhala.replaceWith(newResetBtn);
    
    newResetBtn.addEventListener('click', async function() {
        const info = getUpcomingMealInfo();
        const now = new Date();
        const hour = now.getHours();
        const currentDay = now.getDate();
        
        let isTimePassed = false;
        if (info.day < currentDay) {
            isTimePassed = true;
        } else if (info.day === currentDay) {
            if (info.type === 'morning' && hour >= 13) isTimePassed = true;
            if (info.type === 'night' && hour >= 22) isTimePassed = true;
        }

        if (isTimePassed) {
            AppState.meals[info.day].khalaStatus[info.type] = 'no';
            AppState.members.forEach(m => { AppState.meals[info.day][info.type][m.id] = 0; });
            showToast('সময় পার হয়ে যাওয়ায় সবার মিল ০ হয়ে গেছে!', 'error');
        } else {
            AppState.meals[info.day].khalaStatus[info.type] = 'pending';
            
            // রিস্টোর লজিক
            if (AppState.meals[info.day][info.type + '_backup']) {
                AppState.meals[info.day][info.type] = JSON.parse(JSON.stringify(AppState.meals[info.day][info.type + '_backup']));
                delete AppState.meals[info.day][info.type + '_backup']; 
                showToast('রিসেট সম্পন্ন! সবার আগের মিল ঠিকঠাক রিস্টোর করা হয়েছে।', 'success');
            } else {
                showToast('রিসেট সম্পন্ন! স্ট্যাটাস আবার পেন্ডিং করা হয়েছে।', 'success');
            }
        }
        await saveData();
        window.refreshAll();
    });
}

window.populateCalendarMonthDropdown = function() {
    const selectEl = document.getElementById('calendarMonthSelect');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    
    const monthNames = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
    const currentM = AppState.currentMonth; 
    const currentY = AppState.currentYear;
    
    for (let m = 1; m <= 12; m++) {
        const historyKey = `${currentY}-${String(m).padStart(2, '0')}`;
        let optionLabel = `${monthNames[m - 1]} ${convertToBanglaNumber(currentY)}`;
        let optionValue = historyKey;
        
        if (m === currentM) {
            optionLabel += " (চলতি মাস)";
            optionValue = "current";
        } else if (m > currentM) {
            optionLabel += " (আগামী মাস)";
        }
        
        const isSelected = (m === currentM) ? "selected" : "";
        const html = `<option value="${optionValue}" ${isSelected}>${optionLabel}</option>`;
        
        selectEl.insertAdjacentHTML('beforeend', html);
    }
    
    selectEl.removeEventListener('change', renderCalendar);
    selectEl.addEventListener('change', renderCalendar);
};

window.removeMember = function(id) {
    window.customConfirm('সতর্কতা: এই সদস্যকে মুছে ফেলতে চাইলে "delete" লিখুন।', async function() {
        AppState.members = AppState.members.filter(m => m.id !== id);
        Object.values(AppState.meals || {}).forEach(function(dayData) {
            if (dayData?.morning) delete dayData.morning[id];
            if (dayData?.night) delete dayData.night[id];
        });
        if (AppState.activeUserId === id) {
            AppState.activeUserId = null;
        }
        showToast('সদস্য মুছে ফেলা হয়েছে', 'success');
        await saveData();
        window.refreshAll();
    }, 'delete');
};

const authSection = document.querySelector('.admin-auth-section');
if (authSection) authSection.style.display = 'none';

const mainEnterBtn = document.getElementById('enterWebsiteBtn');
if (mainEnterBtn) {
    mainEnterBtn.addEventListener('click', function() {
        const activeUser = AppState.members.find(m => m.id === AppState.activeUserId);
        if (activeUser && activeUser.name === "Onon") {
            if (authSection) authSection.style.display = 'block';
        } else {
            if (authSection) authSection.style.display = 'none';
        }
    });
}

const btnSaveMem = document.getElementById('saveMemberBtn');
if (btnSaveMem) {
    btnSaveMem.addEventListener('click', async function(e) {
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
        
        ensureMealDaysForMembers();
        for (let day = 1; day <= 31; day++) {
            if (!AppState.meals[day]) {
                AppState.meals[day] = { morning: {}, night: {}, khalaStatus: { morning: 'pending', night: 'pending' } };
            }
            AppState.meals[day].morning[newId] = 1;
            AppState.meals[day].night[newId] = 1;
        }
        
        document.getElementById('addMemberModal').classList.remove('show');
        showToast(`সদস্য "${name}" সফলভাবে যুক্ত হয়েছে!`, 'success'); 
        populateMemberDropdowns();
        await saveData();
        window.refreshAll();
    });
}

// অটোমেটিক টাইম আউট এবং ব্যাকআপ লজিক
window.checkAndApplyKhalaTimeout = async function() {
    const now = new Date();
    const hour = now.getHours();
    const currentDay = now.getDate();
    let isDataChanged = false;

    for (let day = 1; day <= currentDay; day++) {
        if (!AppState.meals[day]) continue;
        
        // সকালের মিল: দুপুর ১টা (13:00) বেজে গেলে
        if (day < currentDay || (day === currentDay && hour >= 13)) {
            if (AppState.meals[day].khalaStatus.morning === 'pending') {
                AppState.meals[day]['morning_auto_backup'] = JSON.parse(JSON.stringify(AppState.meals[day].morning));
                AppState.meals[day].khalaStatus.morning = 'no'; 
                AppState.members.forEach(m => { AppState.meals[day].morning[m.id] = 0; });
                isDataChanged = true;
            }
        }

        // রাতের মিল: রাত ১০টা (22:00) বেজে গেলে
        if (day < currentDay || (day === currentDay && hour >= 22)) {
            if (AppState.meals[day].khalaStatus.night === 'pending') {
                AppState.meals[day]['night_auto_backup'] = JSON.parse(JSON.stringify(AppState.meals[day].night));
                AppState.meals[day].khalaStatus.night = 'no'; 
                AppState.members.forEach(m => { AppState.meals[day].night[m.id] = 0; });
                isDataChanged = true;
            }
        }
    }
    
    if (isDataChanged) {
        await saveData(); 
        console.warn("টাইম পার হয়ে গেছে! অটোমেটিক ০ করা হলো এবং ব্যাকআপ রাখা হলো।");
    }
};

// প্রতি ১ মিনিট পর পর চেক করবে (পেজ রিলোড ছাড়াই শিফট হবে)
setInterval(function() {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    
    if ((hour === 13 && min === 0) || (hour === 22 && min === 0)) {
        console.log("টাইম শিফট হয়েছে! ড্যাশবোর্ড আপডেট করা হচ্ছে...");
        if(typeof checkAndApplyKhalaTimeout === 'function') checkAndApplyKhalaTimeout();
        if(typeof refreshAll === 'function') window.refreshAll();
    }
}, 60000);

const btnSubmitNot = document.getElementById('submitNoticeBtn');
if (btnSubmitNot) {
    btnSubmitNot.addEventListener('click', async function(e) {
        e.preventDefault();
        const author = document.getElementById('noticeAuthorName').value.trim();
        const content = document.getElementById('noticeContent').value.trim();
        if (!author || !content) return showToast('নাম এবং নোটিশ দিন!', 'error');
        AppState.notices.push({ id: Date.now(), author: author, content: content, timestamp: Date.now() });
        document.getElementById('addNoticeModal').classList.remove('show');
        showToast('নতুন নোটিশ দেওয়া হয়েছে!', 'success');
        await saveData();
        window.refreshAll();
    });
}

const btnSaveBazaar = document.getElementById('saveBazaarBtn');
if (btnSaveBazaar) {
    btnSaveBazaar.addEventListener('click', async function(e) {
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
        await saveData();
        window.refreshAll();
    });
}

window.renderTodaysMenu = function() {
    const menuDisplay = document.getElementById('todaysMenuDisplay');
    if (!menuDisplay) return;
    menuDisplay.innerText = AppState.todaysMenu || "আজকের মেনু এখনও ঠিক করা হয়নি...";
};

const editMenuBtn = document.getElementById('editMenuBtn');
const saveMenuBtn = document.getElementById('saveMenuBtn');
const menuInput = document.getElementById('menuInputText');
const menuModal = document.getElementById('editMenuModal');

if (editMenuBtn && menuModal) {
    editMenuBtn.addEventListener('click', function() {
        menuInput.value = AppState.todaysMenu || "";
        menuModal.classList.add('show');
    });
}

if (saveMenuBtn && menuModal) {
    saveMenuBtn.addEventListener('click', async function() {
        const newMenu = menuInput.value.trim();
        if (!newMenu) return showToast('মেনু খালি রাখা যাবে না!', 'error');
        
        AppState.todaysMenu = newMenu;
        menuModal.classList.remove('show');
        showToast('আজকের মেনু সফলভাবে আপডেট হয়েছে!', 'success');
        await saveData();
        window.refreshAll();
    });
}

const deleteMenuBtn = document.getElementById('deleteMenuBtn');
if (deleteMenuBtn) {
    deleteMenuBtn.addEventListener('click', function() {
        window.customConfirm('আপনি কি আজকের মেনু মুছে ফেলতে চান?', async function() {
            AppState.todaysMenu = ""; 
            showToast('আজকের মেনু মুছে ফেলা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        });
    });
}

window.renderMissedMeals = function() {
    const container = document.getElementById('missedMealsContainer');
    if(!container) return;
    
    if(!AppState.isAdmin) {
        container.innerHTML = `<div style="padding:40px; text-align:center; background:#fff; border-radius:15px; width:100%;"><h3 style="color:var(--danger-color);">এই পেজটি শুধুমাত্র অ্যাডমিনদের জন্য!</h3></div>`;
        return;
    }

    let html = '';
    const processMeals = (mealsObj, monthLabel, monthKey) => {
        if (!mealsObj) return;
        const days = Object.keys(mealsObj).length;
        
        for(let day = 1; day <= days; day++) {
            if(!mealsObj[day]) continue;
            ['morning', 'night'].forEach(type => {
                const status = mealsObj[day].khalaStatus[type];
                const autoBackup = mealsObj[day][type + '_auto_backup'];
                const manualBackup = mealsObj[day][type + '_backup'];
                
                if(status === 'no' && (autoBackup || manualBackup)) {
                    const backupData = autoBackup || manualBackup;
                    let totalBackupMeals = 0;
                    let detailsHtml = '';
                    
                    AppState.members.forEach(m => {
                        const val = backupData[m.id] || 0;
                        totalBackupMeals += val;
                        if(val > 0) {
                            detailsHtml += `<span style="display:inline-block; background:rgba(67,97,238,0.1); padding:5px 10px; border-radius:8px; margin:4px; font-size:12px; font-weight:800; color:var(--primary-color); border:1px solid rgba(67,97,238,0.2);">${m.name}: ${convertToBanglaNumber(val)}</span>`;
                        }
                    });

                    const waktName = type === 'morning' ? 'সকাল' : 'রাত';
                    const backupTypeStr = autoBackup ? 'টাইম শেষ হয়েছিল' : 'ভুলে "খালা আসেনি" চাপ দেওয়া হয়েছিল';

                    html += `
                    <div class="member-card" style="border-left: 6px solid var(--danger-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="margin-bottom:15px;">
                            <h4 style="color:#707eae; margin-bottom:5px;">${monthLabel}</h4>
                            <h3 style="color:var(--danger-color); margin-bottom:8px; font-size: 20px;">${convertToBanglaNumber(day)} তারিখ - ${waktName}</h3>
                            <p style="font-size:13px; color:var(--text-muted); font-weight:700; background:#f8f9fa; padding:6px; border-radius:8px; display:inline-block;">${backupTypeStr}</p>
                        </div>
                        <div style="margin-bottom:20px; background: #fff; border: 1px dashed var(--primary-color); padding: 12px; border-radius: 10px;">
                            <p style="font-weight:800; color:var(--text-primary); margin-bottom:8px; font-size:15px;">রিকভারি মিল: <span style="color:var(--success-color); font-size: 18px;">${convertToBanglaNumber(totalBackupMeals)} টি</span></p>
                            <div style="display:flex; flex-wrap:wrap; gap: 4px;">${detailsHtml}</div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="restoreMissedMeal(${day}, '${type}', '${autoBackup ? 'auto' : 'manual'}', '${monthKey}')" style="flex:2; padding:12px; background:var(--success-color); color:#fff; font-weight:800; border-radius:10px; cursor:pointer;">রিকভার করুন</button>
                            <button onclick="deleteMissedMeal(${day}, '${type}', '${autoBackup ? 'auto' : 'manual'}', '${monthKey}')" style="flex:1; padding:12px; background:var(--danger-light); color:var(--danger-color); font-weight:800; border-radius:10px; cursor:pointer; border: 1px solid var(--danger-color);">মুছে ফেলুন</button>
                        </div>
                    </div>`;
                }
            });
        }
    };
    processMeals(AppState.meals, "চলতি মাস", "current");
    if (AppState.history) {
        Object.keys(AppState.history).forEach(key => {
            const splitKey = key.split('-');
            const monthName = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"][parseInt(splitKey[1])-1];
            processMeals(AppState.history[key].meals, `${monthName} ${convertToBanglaNumber(splitKey[0])}`, key);
        });
    }
    container.innerHTML = html || `<div style="padding:40px; text-align:center; background:#fff; border-radius:15px; width:100%;"><h3 style="color:var(--text-muted);">সব ঠিক আছে! কোনো মিসড মিল নেই।</h3></div>`;
};

window.restoreMissedMeal = function(day, type, backupType, monthKey) {
    window.customConfirm(`আপনি কি নিশ্চিত? এটি রিকভার করলে স্ট্যাটাস "খালা এসেছে" হয়ে যাবে।`, async function() {
        let targetMeals = (monthKey === 'current') ? AppState.meals : AppState.history[monthKey].meals;
        const backupKey = type + (backupType === 'auto' ? '_auto_backup' : '_backup');
        const backupData = targetMeals[day][backupKey];
        
        if(backupData) {
            targetMeals[day][type] = JSON.parse(JSON.stringify(backupData));
            targetMeals[day].khalaStatus[type] = 'yes';
            
            delete targetMeals[day][type + '_auto_backup'];
            delete targetMeals[day][type + '_backup'];
            
            showToast('সফলভাবে মিল রিকভার করা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        }
    });
};

window.deleteMissedMeal = function(day, type, backupType, monthKey) {
    window.customConfirm('এই রিকভারি অপশনটি মুছে ফেলতে চান?', async function() {
        let targetMeals = (monthKey === 'current') ? AppState.meals : AppState.history[monthKey].meals;
        const backupKey = type + (backupType === 'auto' ? '_auto_backup' : '_backup');

        if(targetMeals[day] && targetMeals[day][backupKey]) {
            delete targetMeals[day][backupKey];
            showToast('রিকভারি অপশনটি সফলভাবে মুছে ফেলা হয়েছে!', 'success');
            await saveData();
            window.refreshAll();
        }
    });
};

window.setupPermanentMealSettings = function() {
    const uid = AppState.activeUserId;
    if (!uid) return;

    if (!AppState.mealPreferences) {
        AppState.mealPreferences = {};
    }
    
    if (!AppState.mealPreferences[uid]) {
        AppState.mealPreferences[uid] = { morning: true, night: true };
    }

    const prefs = AppState.mealPreferences[uid];
    
    const mornToggle = document.getElementById('permMorningToggle');
    const nightToggle = document.getElementById('permNightToggle');
    const settingsBox = document.getElementById('permanentMealSettingsBox');

    if (!mornToggle || !nightToggle || !settingsBox) return;

    settingsBox.style.display = 'flex';

    const newMorn = mornToggle.cloneNode(true);
    const newNight = nightToggle.cloneNode(true);
    mornToggle.replaceWith(newMorn);
    nightToggle.replaceWith(newNight);

    newMorn.checked = prefs.morning;
    newNight.checked = prefs.night;

    const applyRoutine = (type, isEnabled) => {
        window.customConfirm(`আপনি কি নিশ্চিত? এটি আগামী সব দিনের '${type === 'morning' ? 'সকালের' : 'রাতের'}' মিল ${isEnabled ? 'চালু (১)' : 'অফ (০)'} করে দিবে।`, async function() {
            
            AppState.mealPreferences[uid][type] = isEnabled;
            const currentDay = new Date().getDate();
            
            let updatedCount = 0;
            const daysInMonth = new Date(AppState.currentYear, AppState.currentMonth, 0).getDate();
            for (let day = currentDay; day <= daysInMonth; day++) {
                if (AppState.meals[day] && !isTimePassedStrictly(day, type)) {
                    AppState.meals[day][type][uid] = isEnabled ? 1 : 0;
                    updatedCount++;
                }
            }
            
            showToast(`রুটিন আপডেট! আগামী ${convertToBanglaNumber(updatedCount)} বেলার মিল পরিবর্তন হয়েছে।`, 'success');
            await saveData();
            window.refreshAll();
        });
        
        if(type === 'morning') newMorn.checked = !isEnabled;
        if(type === 'night') newNight.checked = !isEnabled;
    };

    newMorn.addEventListener('change', (e) => applyRoutine('morning', e.target.checked));
    newNight.addEventListener('change', (e) => applyRoutine('night', e.target.checked));
};

 // অ্যাপ চালু হওয়ার প্রধান ফাংশন
function initializeApp() {
    const dateEl = document.getElementById('displayCurrentDate');
    if (dateEl) dateEl.innerText = getBengaliDate(new Date());
    
    if (typeof window.checkAndResetNewMonth === 'function') window.checkAndResetNewMonth();
    if (typeof window.populateMonthDropdown === 'function') window.populateMonthDropdown(); 
    if (typeof populateMemberDropdowns === 'function') populateMemberDropdowns();
    if (typeof window.setDailyMotivation === 'function') window.setDailyMotivation(); 
    if (typeof window.populateCalendarMonthDropdown === 'function') window.populateCalendarMonthDropdown();
    
    if (typeof window.refreshAll === 'function') {
        window.refreshAll();
    }
}

// Module স্ক্রিপ্ট সরাসরি কল করতে হয়
initializeApp();

window.addEventListener('error', function(event) {
    console.error("System Caught an Error:", event.error);
});