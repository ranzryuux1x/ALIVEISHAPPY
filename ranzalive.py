#!/usr/bin/env python3
"""
Interactive Script Runner & Manager
Console-based command prompt untuk menjalankan script Python & Node.js
"""

import subprocess
import time
import os
import sys
import signal
import threading
import json
import readline
from datetime import datetime
from pathlib import Path

# Konfigurasi
LOG_DIR = "runner_logs"
CONFIG_FILE = "runner_state.json"
os.makedirs(LOG_DIR, exist_ok=True)

# State global
running = True
active_processes = {}
process_counter = 0
command_history = []

# Warna ANSI
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

def colored(text, color):
    return f"{color}{text}{Colors.RESET}"

def log_message(source, message, color=Colors.WHITE):
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] [{source}] {message}"
    print(colored(log_entry, color))
    
    log_file = os.path.join(LOG_DIR, "manager.log")
    with open(log_file, "a") as f:
        f.write(log_entry + "\n")

def show_banner():
    os.system('clear' if os.name != 'nt' else 'cls')
    print(colored("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║           🚀 INTERACTIVE SCRIPT RUNNER & MANAGER              ║
    ║              Console Command Prompt v2.0                        ║
    ╚═══════════════════════════════════════════════════════════════╝
    """, Colors.CYAN + Colors.BOLD))
    print(colored("    Ketik 'help' untuk daftar perintah", Colors.DIM))
    print(colored("    Ketik 'exit' untuk keluar\n", Colors.DIM))

def show_help():
    print(colored("""
╔══════════════════════════════════════════════════════════════════╗
║                         DAFTAR PERINTAH                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  📁 FILE & PROJECT:                                              ║
║  ─────────────────                                               ║
║  cd <path>              → Pindah direktori                       ║
║  ls / dir               → List file & folder                     ║
║  pwd                    → Tampilkan direktori aktif              ║
║  cat <file>             → Baca isi file                          ║
║  mkdir <name>           → Buat folder                            ║
║  touch <file>           → Buat file kosong                         ║
║                                                                  ║
║  🐍 PYTHON:                                                      ║
║  ─────────                                                       ║
║  py <file.py>           → Jalankan script Python                 ║
║  pybg <file.py>         → Jalankan Python di background          ║
║  pip <args>             → Jalankan pip (install, list, dll)      ║
║  python --version       → Cek versi Python                         ║
║                                                                  ║
║  📦 NODE.JS:                                                     ║
║  ──────────                                                      ║
║  npm install            → Install dependencies                     ║
║  npm start              → Jalankan npm start                       ║
║  npm run <script>       → Jalankan npm script                      ║
║  npm init               → Inisialisasi project Node.js             ║
║  node <file.js>         → Jalankan file JavaScript                 ║
║  nodebg <file.js>       → Jalankan Node.js di background         ║
║  npx <package>          → Jalankan package dengan npx              ║
║  npm --version          → Cek versi npm                              ║
║                                                                  ║
║  🔄 MANAGEMENT:                                                  ║
║  ────────────                                                    ║
║  run <file>             → Auto-detect & jalankan script          ║
║  runbg <file>           → Jalankan di background dengan monitor  ║
║  stop <id/name>         → Hentikan proses tertentu                 ║
║  stopall                → Hentikan SEMUA proses                    ║
║  status / ps            → Tampilkan semua proses aktif             ║
║  logs <name>            → Tampilkan log proses                     ║
║  tail <name>            → Live tail log proses                     ║
║                                                                  ║
║  ⚙️  SYSTEM:                                                      ║
║  ────────                                                        ║
║  shell <command>        → Jalankan command shell langsung          ║
║  !<command>             → Alias untuk shell command                 ║
║  env                    → Tampilkan environment variables            ║
║  clear                  → Bersihkan layar                            ║
║  history                → Tampilkan riwayat perintah               ║
║  save                   → Simpan state ke file                       ║
║  load                   → Muat state dari file                       ║
║                                                                  ║
║  ℹ️  INFO:                                                        ║
║  ─────                                                           ║
║  help                   → Tampilkan bantuan ini                    ║
║  info                   → Info sistem & versi                        ║
║  exit / quit / q        → Keluar dari runner                         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""", Colors.YELLOW))

def get_next_id():
    global process_counter
    process_counter += 1
    return f"proc_{process_counter}"

def detect_interpreter(file_path):
    """Auto-detect interpreter berdasarkan ekstensi"""
    ext = os.path.splitext(file_path)[1].lower()
    interpreters = {
        '.py': sys.executable,
        '.js': 'node',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'zsh',
    }
    return interpreters.get(ext, None)

def run_process(cmd, name=None, cwd=None, env=None, background=False, restart=False, restart_delay=5):
    """Jalankan proses dengan monitoring"""
    proc_id = get_next_id()
    proc_name = name or proc_id
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=cwd or os.getcwd(),
            env={**os.environ, **(env or {})}
        )
        
        active_processes[proc_id] = {
            'id': proc_id,
            'name': proc_name,
            'process': process,
            'cmd': ' '.join(cmd),
            'start_time': datetime.now(),
            'restart': restart,
            'restart_delay': restart_delay,
            'log_file': os.path.join(LOG_DIR, f"{proc_name}.log")
        }
        
        log_message("RUNNER", f"✅ [{proc_id}] {proc_name} started (PID: {process.pid})", Colors.GREEN)
        
        if background:
            # Jalankan monitoring di thread terpisah
            def monitor():
                with open(active_processes[proc_id]['log_file'], 'a') as log_f:
                    while True:
                        line = process.stdout.readline()
                        if not line and process.poll() is not None:
                            break
                        if line:
                            output = line.strip()
                            log_f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {output}\n")
                            log_f.flush()
                
                # Handle restart
                returncode = process.wait()
                active_processes[proc_id]['returncode'] = returncode
                
                if returncode != 0 and restart and running:
                    log_message("RUNNER", f"🔄 [{proc_id}] {proc_name} crashed, restarting...", Colors.YELLOW)
                    time.sleep(restart_delay)
                    run_process(cmd, name, cwd, env, background, restart, restart_delay)
                else:
                    log_message("RUNNER", f"⏹️  [{proc_id}] {proc_name} finished (code: {returncode})", Colors.DIM)
            
            thread = threading.Thread(target=monitor, daemon=True)
            thread.start()
            return proc_id
            
        else:
            # Foreground - tampilkan output langsung
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                if line:
                    print(colored(f"[{proc_name}] {line.strip()}", Colors.DIM))
            
            returncode = process.wait()
            active_processes.pop(proc_id, None)
            return returncode
            
    except Exception as e:
        log_message("RUNNER", f"❌ Error starting {proc_name}: {e}", Colors.RED)
        return None

def interactive_npm_setup():
    """Interactive setup untuk project Node.js"""
    print(colored("\n📦 NODE.JS PROJECT SETUP", Colors.CYAN + Colors.BOLD))
    print(colored("=" * 50, Colors.CYAN))
    
    # Cek apakah package.json sudah ada
    if os.path.exists("package.json"):
        print(colored("⚠️  package.json sudah ada!", Colors.YELLOW))
        with open("package.json", "r") as f:
            print(f.read())
        return
    
    # Tanya ke user
    project_name = input(colored("Nama project: ", Colors.CYAN)) or "my-project"
    version = input(colored("Version [1.0.0]: ", Colors.CYAN)) or "1.0.0"
    description = input(colored("Description: ", Colors.CYAN)) or ""
    entry = input(colored("Entry point [index.js]: ", Colors.CYAN)) or "index.js"
    
    # Buat package.json
    package = {
        "name": project_name,
        "version": version,
        "description": description,
        "main": entry,
        "scripts": {
            "start": f"node {entry}",
            "test": "echo \"Error: no test specified\" && exit 1"
        },
        "keywords": [],
        "author": "",
        "license": "ISC"
    }
    
    with open("package.json", "w") as f:
        json.dump(package, f, indent=2)
    
    print(colored(f"\n✅ package.json dibuat!", Colors.GREEN))
    print(colored("📋 Isi package.json:", Colors.CYAN))
    print(json.dumps(package, indent=2))
    
    # Buat entry file
    if not os.path.exists(entry):
        with open(entry, "w") as f:
            f.write("""// Entry point
console.log('🚀 Server started!');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from Node.js!\\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
""")
        print(colored(f"✅ {entry} dibuat!", Colors.GREEN))
    
    # Tanya mau install dependencies?
    install = input(colored("\nInstall dependencies sekarang? (y/n): ", Colors.CYAN)).lower()
    if install == 'y':
        run_process(['npm', 'install'], name='npm-install', background=False)

def show_status():
    """Tampilkan semua proses aktif"""
    print(colored("\n📊 PROSES AKTIF", Colors.CYAN + Colors.BOLD))
    print(colored("=" * 80, Colors.CYAN))
    
    if not active_processes:
        print(colored("   Tidak ada proses yang berjalan", Colors.DIM))
        return
    
    print(colored(f"{'ID':<12} {'NAME':<20} {'PID':<8} {'STATUS':<10} {'CMD':<30}", Colors.BOLD))
    print(colored("-" * 80, Colors.DIM))
    
    for proc_id, info in active_processes.items():
        process = info['process']
        status = colored("RUNNING", Colors.GREEN) if process.poll() is None else colored("STOPPED", Colors.RED)
        pid = process.pid if process.poll() is None else "N/A"
        cmd_short = info['cmd'][:28] + ".." if len(info['cmd']) > 30 else info['cmd']
        print(f"{proc_id:<12} {info['name']:<20} {pid:<8} {status:<10} {cmd_short}")

def stop_process(identifier):
    """Hentikan proses berdasarkan ID atau nama"""
    for proc_id, info in list(active_processes.items()):
        if proc_id == identifier or info['name'] == identifier:
            try:
                info['process'].terminate()
                info['process'].wait(timeout=3)
                log_message("STOP", f"✅ {identifier} dihentikan", Colors.GREEN)
                return True
            except:
                try:
                    info['process'].kill()
                    log_message("STOP", f"💀 {identifier} force killed", Colors.RED)
                    return True
                except:
                    pass
    log_message("STOP", f"❌ Proses '{identifier}' tidak ditemukan", Colors.RED)
    return False

def stop_all_processes():
    """Hentikan semua proses"""
    log_message("STOPALL", "🛑 Menghentikan semua proses...", Colors.YELLOW)
    for proc_id in list(active_processes.keys()):
        stop_process(proc_id)

def show_logs(name, follow=False):
    """Tampilkan log proses"""
    log_file = os.path.join(LOG_DIR, f"{name}.log")
    
    if not os.path.exists(log_file):
        # Coba cari di active_processes
        for info in active_processes.values():
            if info['name'] == name:
                log_file = info['log_file']
                break
    
    if not os.path.exists(log_file):
        print(colored(f"❌ Log untuk '{name}' tidak ditemukan", Colors.RED))
        return
    
    if follow:
        print(colored(f"\n📋 Live tail: {name} (Ctrl+C untuk berhenti)\n", Colors.CYAN))
        try:
            with open(log_file, 'r') as f:
                # Go to end
                f.seek(0, 2)
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(0.5)
                        continue
                    print(line.strip())
        except KeyboardInterrupt:
            print(colored("\n⏹️  Tail dihentikan", Colors.DIM))
    else:
        print(colored(f"\n📋 Log: {name}\n", Colors.CYAN))
        with open(log_file, 'r') as f:
            print(f.read())

def execute_shell(command):
    """Jalankan command shell"""
    log_message("SHELL", f"$ {command}", Colors.BLUE)
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(colored(result.stderr, Colors.RED))
    return result.returncode

def process_command(cmd_line):
    """Proses command dari user"""
    global running
    
    if not cmd_line.strip():
        return
    
    command_history.append(cmd_line)
    parts = cmd_line.strip().split()
    cmd = parts[0].lower()
    args = parts[1:]
    
    # FILE & DIRECTORY
    if cmd == 'cd':
        if args:
            try:
                os.chdir(' '.join(args))
                print(colored(f"📁 {os.getcwd()}", Colors.GREEN))
            except Exception as e:
                print(colored(f"❌ {e}", Colors.RED))
        else:
            print(colored(f"📁 {os.getcwd()}", Colors.GREEN))
    
    elif cmd in ('ls', 'dir'):
        try:
            files = os.listdir('.')
            for f in sorted(files):
                if os.path.isdir(f):
                    print(colored(f"📂 {f}/", Colors.BLUE))
                else:
                    size = os.path.getsize(f)
                    print(f"📄 {f:<30} {size:>10,} bytes")
        except Exception as e:
            print(colored(f"❌ {e}", Colors.RED))
    
    elif cmd == 'pwd':
        print(os.getcwd())
    
    elif cmd == 'cat':
        if args:
            try:
                with open(' '.join(args), 'r') as f:
                    print(f.read())
            except Exception as e:
                print(colored(f"❌ {e}", Colors.RED))
    
    elif cmd == 'mkdir':
        if args:
            os.makedirs(' '.join(args), exist_ok=True)
            print(colored(f"✅ Folder dibuat", Colors.GREEN))
    
    elif cmd == 'touch':
        if args:
            Path(' '.join(args)).touch()
            print(colored(f"✅ File dibuat", Colors.GREEN))
    
    # PYTHON
    elif cmd == 'py':
        if args:
            file_path = ' '.join(args)
            run_process([sys.executable, file_path], name=os.path.basename(file_path))
    
    elif cmd == 'pybg':
        if args:
            file_path = ' '.join(args)
            run_process([sys.executable, file_path], name=os.path.basename(file_path), background=True, restart=True)
    
    elif cmd == 'pip':
        run_process([sys.executable, '-m', 'pip'] + args, name='pip')
    
    # NODE.JS
    elif cmd == 'npm':
        if not args:
            run_process(['npm'], name='npm')
        elif args[0] == 'init':
            interactive_npm_setup()
        else:
            run_process(['npm'] + args, name=f"npm-{'-'.join(args)}")
    
    elif cmd == 'node':
        if args:
            file_path = ' '.join(args)
            run_process(['node', file_path], name=os.path.basename(file_path))
    
    elif cmd == 'nodebg':
        if args:
            file_path = ' '.join(args)
            run_process(['node', file_path], name=os.path.basename(file_path), background=True, restart=True)
    
    elif cmd == 'npx':
        if args:
            run_process(['npx'] + args, name=f"npx-{args[0]}")
    
    # MANAGEMENT
    elif cmd == 'run':
        if args:
            file_path = ' '.join(args)
            interpreter = detect_interpreter(file_path)
            if interpreter:
                run_process([interpreter, file_path], name=os.path.basename(file_path))
            else:
                print(colored(f"❌ Format file tidak dikenali: {file_path}", Colors.RED))
    
    elif cmd == 'runbg':
        if args:
            file_path = ' '.join(args)
            interpreter = detect_interpreter(file_path)
            if interpreter:
                run_process([interpreter, file_path], name=os.path.basename(file_path), background=True, restart=True)
            else:
                print(colored(f"❌ Format file tidak dikenali: {file_path}", Colors.RED))
    
    elif cmd in ('status', 'ps'):
        show_status()
    
    elif cmd == 'stop':
        if args:
            stop_process(' '.join(args))
    
    elif cmd == 'stopall':
        stop_all_processes()
    
    elif cmd == 'logs':
        if args:
            show_logs(args[0])
    
    elif cmd == 'tail':
        if args:
            show_logs(args[0], follow=True)
    
    # SYSTEM
    elif cmd in ('shell', '!'):
        if args:
            execute_shell(' '.join(args))
    
    elif cmd == 'env':
        for k, v in sorted(os.environ.items()):
            print(f"{k}={v}")
    
    elif cmd == 'clear':
        show_banner()
    
    elif cmd == 'history':
        for i, h in enumerate(command_history[-20:], 1):
            print(f"{i:>3}: {h}")
    
    elif cmd == 'save':
        state = {
            'history': command_history,
            'cwd': os.getcwd()
        }
        with open(CONFIG_FILE, 'w') as f:
            json.dump(state, f)
        print(colored("✅ State disimpan", Colors.GREEN))
    
    elif cmd == 'load':
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                state = json.load(f)
            command_history.extend(state.get('history', []))
            print(colored("✅ State dimuat", Colors.GREEN))
    
    # INFO
    elif cmd == 'help':
        show_help()
    
    elif cmd == 'info':
        print(colored("\nℹ️  SYSTEM INFO", Colors.CYAN + Colors.BOLD))
        print(colored("=" * 40, Colors.CYAN))
        print(f"Python: {sys.version}")
        print(f"Platform: {sys.platform}")
        print(f"CWD: {os.getcwd()}")
        
        # Cek Node.js
        try:
            node_v = subprocess.run(['node', '--version'], capture_output=True, text=True, timeout=2)
            print(f"Node.js: {node_v.stdout.strip()}")
        except:
            print(f"Node.js: {colored('Tidak terinstall', Colors.RED)}")
        
        # Cek npm
        try:
            npm_v = subprocess.run(['npm', '--version'], capture_output=True, text=True, timeout=2)
            print(f"npm: {npm_v.stdout.strip()}")
        except:
            print(f"npm: {colored('Tidak terinstall', Colors.RED)}")
        
        print(f"Active processes: {len(active_processes)}")
    
    elif cmd in ('exit', 'quit', 'q'):
        print(colored("\n👋 Keluar dari Interactive Script Runner...", Colors.YELLOW))
        stop_all_processes()
        running = False
    
    else:
        # Coba jalankan sebagai shell command
        execute_shell(cmd_line)

def signal_handler(signum, frame):
    """Handle Ctrl+C"""
    print(colored("\n\n⚠️  Tekan 'exit' untuk keluar atau lanjutkan...", Colors.YELLOW))

signal.signal(signal.SIGINT, signal_handler)

def main():
    show_banner()
    
    # Setup tab completion
    readline.parse_and_bind('tab: complete')
    
    while running:
        try:
            # Prompt
            cwd = os.getcwd().replace(os.path.expanduser('~'), '~')
            prompt = colored(f"\n📟 [{cwd}] $ ", Colors.GREEN + Colors.BOLD)
            
            cmd_line = input(prompt).strip()
            process_command(cmd_line)
            
        except EOFError:
            break
        except Exception as e:
            print(colored(f"❌ Error: {e}", Colors.RED))
    
    print(colored("\n🏁 Runner selesai. Sampai jumpa!", Colors.CYAN))

if __name__ == "__main__":
    main()
