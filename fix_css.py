import re

with open('style.css', 'r') as f:
    content = f.read()

# Update .login-modal-box max-width from 600px to 420px
content = re.sub(r'\.login-modal-box\s*\{\s*max-width:\s*600px\s*!important;\s*/\*.*?\*/\s*\}', '.login-modal-box {\n    max-width: 420px !important;\n}', content)
# It's already at the bottom too: .login-modal-box { max-width: 420px !important; }
# Let's ensure .btn-enter-website and .btn-icon-right have the correct CSS.
# Since it's already at the end of style.css, I will just append or replace them if they exist.

# Check if .btn-enter-website exists
if '.btn-enter-website' in content:
    content = re.sub(r'\.btn-enter-website\s*\{[^}]*\}', '''.btn-enter-website { width: 100%; padding: 15px; font-size: 20px; border-radius: 30px; background: var(--grad-green); color: #111c43; font-weight: 800; box-shadow: 0 10px 25px rgba(56, 249, 215, 0.4); display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px; height: auto; }''', content)
else:
    content += '''\n.btn-enter-website { width: 100%; padding: 15px; font-size: 20px; border-radius: 30px; background: var(--grad-green); color: #111c43; font-weight: 800; box-shadow: 0 10px 25px rgba(56, 249, 215, 0.4); display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 10px; height: auto; }'''

if '.btn-icon-right' in content:
    content = re.sub(r'\.btn-icon-right\s*\{[^}]*\}', '''.btn-icon-right { width: 24px !important; height: 24px !important; flex-shrink: 0; }''', content)
else:
    content += '''\n.btn-icon-right { width: 24px !important; height: 24px !important; flex-shrink: 0; }'''

with open('style.css', 'w') as f:
    f.write(content)
