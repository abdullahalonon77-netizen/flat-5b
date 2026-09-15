import re

# Fix index.html viewport
with open('index.html', 'r') as f:
    html_content = f.read()

viewport_pattern = r'<\s*meta\s*\n\s*name="viewport"\s*\n\s*content="width=device-width, initial-scale=1\.0"\s*\n\s*>'
new_viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'

if re.search(viewport_pattern, html_content):
    html_content = re.sub(viewport_pattern, new_viewport, html_content)
else:
    print("Warning: Viewport tag not matched precisely. Using fallback replacement.")
    # Fallback to replace whatever viewport tag exists
    html_content = re.sub(
        r'<meta[^>]*name="viewport"[^>]*>', 
        new_viewport, 
        html_content, 
        flags=re.IGNORECASE
    )

with open('index.html', 'w') as f:
    f.write(html_content)


# Fix style.css
with open('style.css', 'r') as f:
    css_content = f.read()

# Replace html {}
html_target = r'html\s*\{\s*scroll-behavior:\s*smooth;\s*\}'
html_replacement = '''html {
    scroll-behavior: smooth;
    overflow-x: hidden;
    width: 100%;
}'''
css_content = re.sub(html_target, html_replacement, css_content)

# Replace body {}
body_target = r'body\s*\{\s*background-color:\s*var\(--bg-main\);\s*color:\s*var\(--text-primary\);\s*font-size:\s*16px;\s*line-height:\s*1\.6;\s*overflow-x:\s*hidden;\s*-webkit-font-smoothing:\s*antialiased;\s*-moz-osx-font-smoothing:\s*grayscale;\s*\}'
body_replacement = '''body {
    background-color: var(--bg-main);
    color: var(--text-primary);
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
    width: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-image: none;
}'''
css_content = re.sub(body_target, body_replacement, css_content)

# Replace .modal-overlay
modal_target = r'\.modal-overlay\s*\{[^}]*\}'
modal_replacement = '''.modal-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(17, 28, 67, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999 !important;
    opacity: 0;
    visibility: hidden;
    transition: var(--transition-normal);
}'''
# Wait, I should make sure I only replace the FIRST occurrence of .modal-overlay, but let's see if there are other occurrences.
css_content = re.sub(modal_target, modal_replacement, css_content, count=1)

with open('style.css', 'w') as f:
    f.write(css_content)

print("iOS Safari bug fixes applied successfully!")
