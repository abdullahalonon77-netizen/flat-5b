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
let saveQueue = Promise.resolve();

const DATABASE_PATH = 'flat5b_data';
const databaseRef = ref(db, DATABASE_PATH);

function deepClone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

function normalizeArray(value, fallback = []) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (value && typeof value === 'object') {
        return Object.values(value).filter(Boolean);
    }

    return Array.isArray(fallback) ? deepClone(fallback) : [];
}

function normalizeObject(value, fallback = {}) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }

    return fallback && typeof fallback === 'object' && !Array.isArray(fallback)
        ? deepClone(fallback)
        : {};
}

function normalizeMeals(value, fallback = {}) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : fallback;

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return {};
    }

    const normalized = {};

    Object.entries(source).forEach(([day, meal]) => {
        if (!meal || typeof meal !== 'object' || Array.isArray(meal)) return;

        normalized[day] = {
            morning: normalizeObject(meal.morning, {}),
            night: normalizeObject(meal.night, {}),
            khalaStatus: {
                morning: meal.khalaStatus?.morning || 'pending',
                night: meal.khalaStatus?.night || 'pending'
            }
        };
    });

    return normalized;
}

function ensureMealDaysForMembers() {
    if (!AppState.meals || typeof AppState.meals !== 'object' || Array.isArray(AppState.meals)) {
        AppState.meals = {};
    }

    for (let day = 1; day <= 31; day++) {
        if (!AppState.meals[day] || typeof AppState.meals[day] !== 'object') {
            AppState.meals[day] = {
                morning: {},
                night: {},
                khalaStatus: { morning: 'pending', night: 'pending' }
            };
        }

        if (!AppState.meals[day].morning || typeof AppState.meals[day].morning !== 'object') {
            AppState.meals[day].morning = {};
        }

        if (!AppState.meals[day].night || typeof AppState.meals[day].night !== 'object') {
            AppState.meals[day].night = {};
        }

        if (!AppState.meals[day].khalaStatus || typeof AppState.meals[day].khalaStatus !== 'object') {
            AppState.meals[day].khalaStatus = { morning: 'pending', night: 'pending' };
        }

        AppState.meals[day].khalaStatus.morning =
            AppState.meals[day].khalaStatus.morning || 'pending';
        AppState.meals[day].khalaStatus.night =
            AppState.meals[day].khalaStatus.night || 'pending';
    }
}

function buildPersistedState() {
    const state = deepClone(AppState);

    // UI-only/session-only values must not overwrite shared Firebase data.
    state.isAdmin = false;
    state.activeUserId = null;

    return state;
}

window.saveData = function() {
    if (!firebaseReady) {
        pendingSave = true;
        return Promise.resolve(false);
    }

    const payload = buildPersistedState();

    // Serialize full-state writes so rapid consecutive updates cannot race each other.
    saveQueue = saveQueue
        .catch(() => undefined)
        .then(() => set(databaseRef, payload))
        .then(() => {
            console.log("ডাটা ফায়ারবেসে সফলভাবে সেভ হয়েছে!");
            return true;
        })
        .catch((error) => {
            console.error("ফায়ারবেস এরর:", error);
            showToast('ডাটা সেভ করা যায়নি। আবার চেষ্টা করুন।', 'error');
            return false;
        });

    return saveQueue;
};

const saveData = window.saveData;

onValue(databaseRef, (snapshot) => {
    isFetching = true;

    const data = snapshot.val();
    const currentAdminStatus = AppState.isAdmin;
    const currentActiveUser = AppState.activeUserId;

    if (data && typeof data === 'object') {
        // Merge remote data into the existing state. Never fall back to defaults merely
        // because one remote property is temporarily absent.
        AppState.currentMonth = Number.isFinite(Number(data.currentMonth))
            ? Number(data.currentMonth)
            : AppState.currentMonth || defaultState.currentMonth;

        AppState.currentYear = Number.isFinite(Number(data.currentYear))
            ? Number(data.currentYear)
            : AppState.currentYear || defaultState.currentYear;

        AppState.guestMeals = normalizeObject(data.guestMeals, AppState.guestMeals);
        AppState.vacations = normalizeObject(data.vacations, AppState.vacations);
        AppState.todaysMenu = typeof data.todaysMenu === 'string'
            ? data.todaysMenu
            : (AppState.todaysMenu || '');

        // Firebase stores JS arrays as objects with numeric keys. Convert them back safely.
        AppState.members = normalizeArray(data.members, AppState.members);
        AppState.bazaarRecords = normalizeArray(data.bazaarRecords, AppState.bazaarRecords);
        AppState.notices = normalizeArray(data.notices, AppState.notices);

        // Meals are keyed by day, so keep them as an object while normalizing each day.
        AppState.meals = normalizeMeals(data.meals, AppState.meals);
        AppState.history = normalizeObject(data.history, AppState.history);

        // Preserve local/session-only UI state.
        AppState.isAdmin = currentAdminStatus;
        AppState.activeUserId = currentActiveUser;
    } else {
        // A genuinely empty database gets initialized once with the application defaults.
        AppState = deepClone(defaultState);
        AppState.isAdmin = currentAdminStatus;
        AppState.activeUserId = currentActiveUser;
    }

    ensureMealDaysForMembers();

    firebaseReady = true;
    isFetching = false;

    if (isInitialLoad) {
        isInitialLoad = false;

        if (!data) {
            // Only initialize an empty Firebase node. Never write defaults before the
            // first remote snapshot arrives.
            saveData();
        } else if (pendingSave) {
            pendingSave = false;
            saveData();
        }
    }

    if (typeof window.checkAndResetNewMonth === 'function') {
        window.checkAndResetNewMonth();
    }

    if (typeof window.refreshAll === 'function') {
        window.refreshAll();
    }
}, (error) => {
    isFetching = false;
    console.error("ফায়ারবেস ডাটা পড়তে সমস্যা হয়েছে:", error);
    showToast('ফায়ারবেস থেকে ডাটা লোড করা যায়নি।', 'error');
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
        if (activeUser && activeUser.name === 'Onon') {
            const greetingEl = document.getElementById('greetingText');
            if (greetingEl) {
                greetingEl.innerText = "Welcome, " + activeUser.name + "!";
            }
            AppState.isAdmin = false;
            const adminBtn = document.getElementById('adminLoginBtn');
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

function isTimePassedStrictly(day, type) {
    const now = new Date();
    const currentDay = now.getDate();
    const currentHour = now.getHours();
    if (day < currentDay) {
        return true;
    }
    if (day === currentDay) {
        if (type === 'morning') {
            return currentHour >= 8;
        } else if (type === 'night') {
            return currentHour >= 18;
        }
    }
    return false;
}

function isMealLocked(day, type) {
    if (AppState.isAdmin) {
        return false;
    }
    return isTimePassedStrictly(day, type);
}

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
    const count = parseInt(config.count) || 0;
    const duration = config.duration ? parseInt(config.duration) : null;
    const isMorning = config.isMorning;
    const isNight = config.isNight;
    const prefs = (AppState.mealPreferences && AppState.mealPreferences[uid]) ? AppState.mealPreferences[uid] : { morning: true, night: true };
    let mealsApplied = 0;
    const currentDay = new Date().getDate();
    
    for (let day = currentDay; day <= 31; day++) {
        if (duration !== null && mealsApplied >= duration) break;
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
            else txtHtml += `<span style="font-size: 14px; opacity:0.8; margin-top:5px; display:block;">আনলিমিটেড সময়</span>`;
            detailsTxt.innerHTML = txtHtml;
        }
    } else {
        if (controls) controls.style.display = 'block'; 
        if (statusBox) statusBox.style.display = 'none';
    }
};

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
        AppState.guestMeals[AppState.activeUserId] = config; 
        applyAdvancedGuestMeals(AppState.activeUserId, config, true);
        saveData();
        showToast('গেস্ট মিল চালু হয়েছে!', 'success'); 
        if (typeof window.refreshAll === 'function') {
            window.refreshAll();
        }
    });
}

const stopGuestBtn = document.getElementById('stopGuestMealBtn');
if (stopGuestBtn) {
    stopGuestBtn.addEventListener('click', function() {
        const config = AppState.guestMeals[AppState.activeUserId];
        if (config) { 
            applyAdvancedGuestMeals(AppState.activeUserId, config, false); 
            delete AppState.guestMeals[AppState.activeUserId]; 
            saveData();
            showToast('গেস্ট মিল অফ করা হয়েছে!', 'success'); 
            if (typeof window.refreshAll === 'function') {
                window.refreshAll();
            }
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
        window.customConfirm("ভবিষ্যতের সব আনলকড মিল ০ হয়ে যাবে। আপনি কি নিশ্চিত?", function() {
            AppState.vacations[AppState.activeUserId] = true; 
            applyVacation(AppState.activeUserId, true);
            saveData();
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
        window.customConfirm("ছুটি শেষ? আগামী সব আনলকড মিল আবার চালু (১) হয়ে যাবে। নিশ্চিত?", function() {
            delete AppState.vacations[AppState.activeUserId]; 
            applyVacation(AppState.activeUserId, false);
            saveData();
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

window.checkAndResetNewMonth = function() {
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
        saveData();
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
        let optionLabel = `${monthNames[m - 1]}${convertToBanglaNumber(currentY)}`;
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
    selectEl.removeEventListener('change', renderMonthlySummary);
    selectEl.addEventListener('change', renderMonthlySummary);
};

window.renderMonthlySummary = function() {
    const selectEl = document.getElementById('reportMonthSelect');
    const contentBox = document.getElementById('monthlySummaryContent');
    if (!selectEl || !contentBox) return;
    const selectedValue = selectEl.value;

    if (selectedValue === 'upcoming') {
        contentBox.innerHTML = `
            <div style="text-align:center; padding: 60px 0;">
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
                    <h3 style="color:#fc6076; font-size:22px; font-weight:700;">কোনো তথ্য পাওয়া যায়নি!</h3>
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
                AppState.members.forEach(function(m) {
                    totalMealsCount += (sourceMeals[d].morning[m.id] || 0);
                });
            }
            if (selectedValue !== 'current' || isTimePassedStrictly(d, 'night') || sourceMeals[d].khalaStatus?.night === 'yes') {
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

    let tableHtml = `<table class="bazaar-table"><thead><tr><th>মেম্বার</th><th>মোট মিল</th><th>খরচ</th><th>বাজার জমা</th><th>পাবে/দিবে</th></tr></thead><tbody>`;
    
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
        let balanceOutput = balance >= 0 ? `<span style="color:var(--success-color)">পাবে: ${formatCurrency(balance)}</span>` : `<span style="color:var(--danger-color)">দিবে: ${formatCurrency(Math.abs(balance))}</span>`;
        
        tableHtml += `<tr><td><b>${member.name}</b></td><td>${convertToBanglaNumber(memberMeals)}</td><td>${formatCurrency(mealCost)}</td><td>${formatCurrency(memberBazaar)}</td><td>${balanceOutput}</td></tr>`;
    });
    
    tableHtml += `</tbody></table>`;
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

window.refreshAll = function() {
    if (typeof populateMemberDropdowns === 'function') populateMemberDropdowns();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof updateNextMealDisplay === 'function') updateNextMealDisplay();
    if (typeof updateQuickMealToggle === 'function') updateQuickMealToggle();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderBazaarList === 'function') renderBazaarList();
    if (typeof renderTodaysMenu === 'function') renderTodaysMenu();
    if (typeof renderMissedMeals === 'function') renderMissedMeals();
    if (typeof renderGuestMealBox === 'function') renderGuestMealBox();
    if (typeof renderVacationBox === 'function') renderVacationBox();
    if (typeof renderMonthlySummary === 'function') renderMonthlySummary();
};

window.renderCalendar = function() {
    const thead = document.getElementById('mealTableHead');
    const tbody = document.getElementById('mealTableBody');
    if (!thead || !tbody) return;
    let headHtml = `<tr><th>তারিখ</th><th>বেলা</th><th>মোট</th>`;
    AppState.members.forEach(function(m) { headHtml += `<th>${m.name}</th>`; });
    headHtml += `<th>অ্যাকশন</th></tr>`;
    thead.innerHTML = headHtml;
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
        form.insertAdjacentHTML('beforeend', `<div style="display:flex; justify-content:space-between; margin-bottom:15px;"><label>${m.name}</label><select id="edit_member_${m.id}"><option value="1" ${currentVal===1?'selected':''}>ফুল</option><option value="0" ${currentVal===0?'selected':''}>অফ</option></select></div>`);
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
        showToast('মিল আপডেট হয়েছে!', 'success');
        saveData();
        window.refreshAll();
    });
}

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
    if(labelEl) labelEl.innerText = info.label;
    let total = 0;
    if(AppState.meals[info.day]) {
        AppState.members.forEach(function(m) {
            total += (AppState.meals[info.day][info.type][m.id] || 0);
        });
    }
    if(countEl) countEl.innerText = convertToBanglaNumber(total);
};

window.updateQuickMealToggle = function() {};

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

window.removeMember = function(id) {
    window.customConfirm('সতর্কতা: এই সদস্যকে মুছে ফেলতে চাইলে "delete" লিখুন।', function() {
        AppState.members = AppState.members.filter(m => m.id !== id);
        Object.values(AppState.meals || {}).forEach(function(dayData) {
            if (dayData?.morning) delete dayData.morning[id];
            if (dayData?.night) delete dayData.night[id];
        });
        if (AppState.activeUserId === id) {
            AppState.activeUserId = null;
        }
        showToast('সদস্য মুছে ফেলা হয়েছে', 'success');
        saveData();
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
        
        ensureMealDaysForMembers();
        for (let day = 1; day <= 31; day++) {
            AppState.meals[day].morning[newId] = 1;
            AppState.meals[day].night[newId] = 1;
        }
        
        document.getElementById('addMemberModal').classList.remove('show');
        showToast(`সদস্য "${name}" সফলভাবে যুক্ত হয়েছে!`, 'success'); 
        populateMemberDropdowns();
        saveData(); // <--- অত্যন্ত জরুরি: ফায়ারবেসে সেভ করার কমান্ড
        window.refreshAll();
    });
}

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
        saveData();
        window.refreshAll();
    });
}

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
        saveData();
        window.refreshAll();
    });
}

window.renderTodaysMenu = function() {};
window.renderMissedMeals = function() {};

function initializeApp() {
    const dateEl = document.getElementById('displayCurrentDate');
    if (dateEl) {
        dateEl.innerText = getBengaliDate(new Date());
    }
    if (typeof checkAndResetNewMonth === 'function') checkAndResetNewMonth(); 
    if (typeof populateMonthDropdown === 'function') populateMonthDropdown(); 
    if (typeof populateMemberDropdowns === 'function') populateMemberDropdowns();
    if (typeof setDailyMotivation === 'function') setDailyMotivation(); 
    window.refreshAll();
}

document.addEventListener('DOMContentLoaded', initializeApp);

window.addEventListener('error', function(event) {
    console.error("System Caught an Error:", event.error);
});