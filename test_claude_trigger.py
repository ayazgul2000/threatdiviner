import pyautogui, os, time
import pygetwindow as gw

# Paths
base = r"C:\Dev\threatdiviner-v0.2.0\.claude\ThreatModel"
txt_path = os.path.join(base, "CHECKPOINT.md")
zip_path = os.path.join(base, "repomix-output.zip")

# Find Window
windows = [w for w in gw.getAllWindows() if w.title == 'Claude']
if windows:
    win = windows[0]
    win.activate()
    time.sleep(1)

    # 1. Type Intro
    print("1. Typing intro...")
    pyautogui.write("check updates, read the files, match against implementation plan and all other SDD and check test scripts and files etc")
    time.sleep(0.5)
    
    # 2. Copy BOTH files at once (using comma separation in PowerShell)
    print("2. Copying both files...")
    # This command puts both file objects on the clipboard simultaneously
    os.system(f'powershell Set-Clipboard -Path "{txt_path}", "{zip_path}"')
    
    time.sleep(2.0) # Wait for clipboard
    
    # 3. Paste
    print("3. Pasting files...")
    pyautogui.hotkey('ctrl', 'v')
    
    time.sleep(6.0) # Wait for uploads to process
    
    # 4. Send
    print("4. Sending...")
    pyautogui.press('enter')
    print("Done!")
    
else:
    print("Claude window not found")