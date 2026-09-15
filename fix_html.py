import re

with open('index.html', 'r') as f:
    content = f.read()

# Add Missed Meal Recovery after monthly-summary
missed_meal_item = """
                    <li
                        class="nav-item admin-only-btn"
                        data-target="missed-meal-recovery"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="nav-icon"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span
                            class="nav-text"
                        >
                            মিল রিকভারি
                        </span>
                    </li>"""

if "missed-meal-recovery" not in content:
    # Find the end of monthly-summary list item
    target = r'(<li\s+class="nav-item"\s+data-target="monthly-summary">.*?</li>)'
    content = re.sub(target, r'\1' + missed_meal_item, content, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(content)
