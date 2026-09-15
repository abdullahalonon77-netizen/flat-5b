import re

with open('index.html', 'r') as f:
    content = f.read()

# Make sure the SVG inside enterWebsiteBtn has style="width: 24px; height: 24px; flex-shrink: 0;"
# Let's just find the button id="enterWebsiteBtn" and replace its SVG
button_regex = r'(<button\s+id="enterWebsiteBtn"[^>]*>.*?<svg[^>]*class="btn-icon-right"[^>]*>)(.*?<\/svg>\s*<\/button>)'
# Actually, the user says "Ensure the SVG has strictly style="width: 24px; height: 24px; flex-shrink: 0;""

def replacer(match):
    svg_tag = match.group(0)
    if 'style="' in svg_tag:
        svg_tag = re.sub(r'style="[^"]*"', 'style="width: 24px; height: 24px; flex-shrink: 0;"', svg_tag)
    else:
        svg_tag = svg_tag.replace('<svg ', '<svg style="width: 24px; height: 24px; flex-shrink: 0;" ')
    return svg_tag

content = re.sub(r'<button\s+id="enterWebsiteBtn".*?</button>', replacer, content, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(content)
