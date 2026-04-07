; NapasVPN custom NSIS hooks
; Runs during uninstall — disables system proxy so internet stays working

!macro customUnInstall
  ; Disable Windows system proxy via PowerShell before removing files
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -Command "\
    Set-ItemProperty \
      -Path ''HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'' \
      -Name ProxyEnable -Value 0; \
    Remove-ItemProperty \
      -Path ''HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'' \
      -Name ProxyServer -ErrorAction SilentlyContinue; \
    Remove-ItemProperty \
      -Path ''HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'' \
      -Name ProxyOverride -ErrorAction SilentlyContinue \
  "'
!macroend
