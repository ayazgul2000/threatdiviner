import pyautogui
import pygetwindow as gw
import time

windows = [w for w in gw.getAllWindows() if w.title == 'Claude']
if windows:
    win = windows[0]
    win.activate()
    time.sleep(1)

    # Note the \n at the end - this represents the Enter key
    pyautogui.press('enter')
