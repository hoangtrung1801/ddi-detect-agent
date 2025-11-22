# macOS (Darwin) System Commands

This project is being developed on macOS (Darwin). Here are relevant system-specific commands and considerations.

## System Information

### Check System
```bash
# System version
sw_vers

# Kernel version
uname -a

# Architecture (Apple Silicon vs Intel)
uname -m  # arm64 for M1/M2, x86_64 for Intel

# macOS version
system_profiler SPSoftwareDataType
```

## Package Management

### Homebrew (Primary)
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python@3.11

# Install igraph (if pip fails)
brew install igraph
pip install python-igraph

# Update packages
brew update
brew upgrade
```

### Python Management
```bash
# macOS comes with system Python, use Homebrew Python instead
which python3  # Should show /opt/homebrew/bin/python3 (or /usr/local/bin/python3)

# Use python3, not python
python3 --version
pip3 install -r requirements.txt

# Or if Homebrew Python is default
python --version
pip install -r requirements.txt
```

## File System Commands

### Navigation
```bash
# List files (BSD ls)
ls -lh

# Find files
find . -name "*.py" -type f

# Search in files (BSD grep)
grep -r "pattern" . --include="*.py"

# Tree view (install via Homebrew)
brew install tree
tree -L 2 -I '__pycache__|*.pyc'
```

### File Operations
```bash
# Copy
cp source dest

# Move/Rename
mv old_name new_name

# Remove
rm file
rm -rf directory

# Create directory
mkdir -p path/to/dir

# Show file contents
cat file.txt
less file.txt
head -n 10 file.txt
tail -f log.txt
```

## Process Management

### Running Processes
```bash
# List processes
ps aux | grep python

# Find process by port
lsof -i :8000

# Kill process
kill PID
kill -9 PID  # Force kill

# Background process
python script.py &

# Bring to foreground
fg
```

## Network & Port

### Check Ports
```bash
# Check if port is in use
lsof -i :8000
netstat -an | grep 8000

# Kill process on port
lsof -ti:8000 | xargs kill -9
```

### Curl (API Testing)
```bash
# GET request
curl http://localhost:8000/health

# POST request
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'

# Show headers
curl -I http://localhost:8000/health

# Follow redirects
curl -L http://example.com

# Save output
curl -o output.json http://localhost:8000/stats
```

## Environment Variables

### Set Variables (zsh - default shell on modern macOS)
```bash
# Temporary (current session)
export OPENAI_API_KEY="sk-..."

# View variable
echo $OPENAI_API_KEY

# Permanent (add to ~/.zshrc)
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.zshrc
source ~/.zshrc

# List all env vars
env
printenv
```

### Shell Configuration
```bash
# Edit zsh config
nano ~/.zshrc
# or
vim ~/.zshrc

# Reload config
source ~/.zshrc
```

## Text Processing

### BSD vs GNU Commands
macOS uses BSD versions of commands (not GNU), which may have different flags:

```bash
# sed (BSD version)
sed -i '' 's/old/new/g' file.txt  # Note: -i '' for BSD

# awk
awk '{print $1}' file.txt

# head/tail work similarly to GNU
head -n 5 file.txt
tail -n 10 file.txt
```

## Opening Files/Applications

### macOS-Specific Commands
```bash
# Open file with default app
open file.txt
open drug_network.png
open http://localhost:8000/docs

# Open in specific app
open -a "Visual Studio Code" .
open -a "TextEdit" README.md

# Reveal in Finder
open .
open -R file.txt
```

## Python on macOS

### Virtual Environments
```bash
# Create venv
python3 -m venv venv

# Activate (zsh/bash)
source venv/bin/activate

# Deactivate
deactivate

# Install packages in venv
pip install -r requirements.txt
```

### Python Path Issues
```bash
# Check Python location
which python3
which pip3

# Check installed packages
pip3 list
pip3 show package-name

# Fix SSL issues (if any)
pip3 install --upgrade certifi

# Install specific Python version with Homebrew
brew install python@3.11
# Then use: /opt/homebrew/bin/python3.11
```

## igraph Installation (macOS Specific)

### Common Issues & Solutions
```bash
# Method 1: Using Homebrew first
brew install igraph
pip3 install python-igraph

# Method 2: Using pip only
pip3 install python-igraph

# Method 3: If building from source
brew install pkg-config
pip3 install python-igraph --no-binary python-igraph

# Verify installation
python3 -c "import igraph; print(igraph.__version__)"
```

## Monitoring & Performance

### System Resources
```bash
# CPU/Memory usage
top

# Disk usage
df -h
du -sh *

# Activity Monitor (GUI)
open -a "Activity Monitor"
```

## Clipboard

### Copy to Clipboard
```bash
# Copy file contents
cat file.txt | pbcopy

# Copy command output
curl http://localhost:8000/stats | pbcopy

# Paste from clipboard
pbpaste > file.txt
```

## Shortcuts & Aliases

### Useful Aliases (add to ~/.zshrc)
```bash
# Add these to ~/.zshrc
alias ll='ls -lhG'
alias la='ls -lhAG'
alias py='python3'
alias pip='pip3'
alias runapi='python app/main.py'
alias runcli='python drug_agent_cli.py'
alias testall='python test_langgraph_agent.py && python test_agent.py'
```

## Security & Permissions

### File Permissions
```bash
# Make script executable
chmod +x script.sh

# Check permissions
ls -la file.txt

# Change ownership
chown user:group file.txt
```

## macOS Quirks for This Project

1. **Use `/opt/homebrew/bin/zsh`** (Apple Silicon) or `/usr/local/bin/zsh` (Intel)
2. **Python**: Always use `python3` and `pip3`, not `python` or `pip`
3. **igraph**: May require Homebrew installation of C library first
4. **Port 8000**: Should be available unless another service is using it
5. **File System**: Case-insensitive by default (but case-preserving)
6. **Paths**: Use forward slashes, not backslashes
7. **.env Files**: Make sure they're not hidden in Finder (⌘⇧. to toggle)

## Useful Keyboard Shortcuts

- `⌘ + C`: Copy
- `⌘ + V`: Paste
- `⌘ + Q`: Quit application
- `⌃ + C`: Kill process in terminal
- `⌃ + Z`: Suspend process
- `⌃ + R`: Search command history
- `⌃ + A`: Go to start of line
- `⌃ + E`: Go to end of line
