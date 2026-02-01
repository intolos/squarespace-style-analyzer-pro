import os
import csv

def count_lines(filepath):
    try:
        with open(filepath, 'rb') as f:
            return sum(1 for _ in f)
    except Exception:
        return 0

def get_purpose(filepath):
    try:
        ext = os.path.splitext(filepath)[1].lower()
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            
            # Skip YAML frontmatter if present
            start_line = 0
            if lines and lines[0].strip() == '---':
                for i in range(1, min(10, len(lines))):
                    if lines[i].strip() == '---':
                        start_line = i + 1
                        break
            
            # Strategy 1: Look for explicit "Purpose" or "PURPOSE" markers
            for line in lines[start_line:start_line+20]:
                text = line.strip()
                if not text: continue
                # Match "Purpose: [description]" or "// Purpose: [description]"
                if 'Purpose:' in text or 'PURPOSE:' in text:
                    parts = text.split('urpose:', 1) if 'urpose:' in text else text.split('URPOSE:', 1)
                    return parts[1].strip().strip(':-* ').strip()
            
            # Strategy 2: Look for Markdown Headers (e.g., # Header)
            if ext == '.md':
                for line in lines[start_line:start_line+10]:
                    text = line.strip()
                    if text.startswith('#'):
                        return text.lstrip('#').strip()
                    # Fallback for bolded first line or all-caps title
                    if text and text.isupper() and len(text) > 5:
                        return text.strip()

            # Strategy 3: JSDoc @file or @description
            for line in lines[start_line:start_line+20]:
                if '@file' in line or '@description' in line:
                    parts = line.split('@file', 1) if '@file' in line else line.split('@description', 1)
                    return parts[1].strip().strip(':-* ').strip()

            # Strategy 4: First substantial comment or line (non-code fallback)
            for line in lines[start_line:start_line+10]:
                text = line.strip()
                if not text: continue
                if text.startswith('//') or text.startswith('/*'):
                    cleaned = text.lstrip('/ *').strip()
                    if len(cleaned) > 5 and not cleaned.startswith('import'):
                        return cleaned
                if ext == '.sh' and text.startswith('#!') :
                    continue # Skip shebang
                if ext in ['.env', '.sh'] and text.startswith('#'):
                    return text.lstrip('# ').strip()
                if ext == '.ts' and not text.startswith('import ') and not text.startswith('import{'):
                    # If first line of logic, might be difficult to guess purpose without comments
                    break

            # Strategy 5: Special Filename Fallbacks
            filename = os.path.basename(filepath).lower()
            special_files = {
                'package.json': 'NPM Project Configuration & Dependencies',
                'package-lock.json': 'NPM Dependency Lock File',
                'wxt.config.ts': 'WXT Framework Configuration',
                'tsconfig.json': 'TypeScript Compilation Rules',
                'playwright.config.ts': 'Playwright E2E Testing Configuration',
                'vitest.config.ts': 'Vitest Unit Testing Configuration',
                'tailwind.config.ts': 'Tailwind CSS Styling Configuration',
                '.env.sqs': 'Squarespace Version Environment Variables',
                '.env.generic': 'Generic Version Environment Variables',
                'welcome.html': 'Extension Welcome & Onboarding Page',
                'index.html': 'Popup Main Interface Structure',
            }
            if filename in special_files:
                return special_files[filename]

            return "N/A"
    except Exception:
        return "N/A"

def process_dir(directory, base_path, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = []
    
    valid_extensions = {'.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json', '.md', '.sh', '.yml', '.yaml'}
    
    files_data = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        for file in files:
            if file == '.DS_Store':
                continue
            ext = os.path.splitext(file)[1].lower()
            if ext not in valid_extensions:
                continue
            filepath = os.path.join(root, file)
            rel_path = os.path.relpath(root, base_path)
            lines = count_lines(filepath)
            purpose = get_purpose(filepath)
            files_data.append({
                'filename': file,
                'purpose': purpose,
                'lines': lines,
                'folder_path': rel_path
            })
    return files_data

def write_csv(filename, data, headers):
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in data:
            writer.writerow({k: row[k] for k in headers})

# Target directories
wxt_dir = 'wxt-version'
arch_dir = 'documentation-md/architecture'
agent_dir = '.agent'
walkthrough_dir = 'documentation-md/walkthroughs'
tasklist_dir = 'documentation-md/task-lists'

# Process Extension Files
ext_data = process_dir(wxt_dir, wxt_dir, exclude_dirs=['node_modules', '.output', 'dist', 'source-code-files-counts'])
write_csv('documentation-md/source-code-files-counts/extension_files_report.csv', ext_data, ['filename', 'purpose', 'lines', 'folder_path'])

# Process Architecture Docs
arch_data = process_dir(arch_dir, arch_dir)
write_csv('documentation-md/source-code-files-counts/architecture_docs_report.csv', arch_data, ['filename', 'purpose', 'lines'])

# Process Agent Files
agent_data = process_dir(agent_dir, agent_dir)
write_csv('documentation-md/source-code-files-counts/agent_files_report.csv', agent_data, ['filename', 'purpose', 'lines', 'folder_path'])

# Process Walkthroughs
walk_data = process_dir(walk_dir := 'documentation-md/walkthroughs', walk_dir)
write_csv('documentation-md/source-code-files-counts/walkthroughs_report.csv', walk_data, ['filename', 'purpose', 'lines'])

# Process Tasklists
task_data = process_dir(task_dir := 'documentation-md/task-lists', task_dir)
write_csv('documentation-md/source-code-files-counts/task_lists_report.csv', task_data, ['filename', 'purpose', 'lines'])

print("Reports generated successfully.")
