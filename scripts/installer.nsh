!macro customInit
  ; Per-machine installs must never continue without an elevated process.
  ; This also blocks any unexpected non-admin fallback after a denied UAC prompt.
  ${IfNot} ${UAC_IsAdmin}
    MessageBox MB_ICONSTOP|MB_OK "Administrator permission is required to install Merlin. The installation will now close."
    SetErrorLevel 740
    Quit
  ${EndIf}
!macroend

!macro customInstall
  StrCpy $0 "$PROGRAMFILES32\Steam"

  ${If} ${FileExists} "$0\steam.exe"
    StrCpy $1 "0"

    ; Steam locks the OpenSteamTool files while it is running. Ask for consent before
    ; closing it, then verify that the process really stopped before copying.
    nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -Command "if (Get-Process steam -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"'
    Pop $2
    Pop $3

    ${If} $2 == "0"
      MessageBox MB_ICONEXCLAMATION|MB_OK "Steam is currently open and must be closed to finish installing Merlin. Click OK to close Steam and continue."
      nsExec::ExecToStack '"$SYSDIR\taskkill.exe" /F /T /IM steam.exe'
      Pop $2
      Pop $3
      Sleep 1500

      nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -Command "if (Get-Process steam -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"'
      Pop $2
      Pop $3
      ${If} $2 == "0"
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\OpenSteamTool.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\OpenSteamTool.dll" "$0\OpenSteamTool.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\dwmapi.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\dwmapi.dll" "$0\dwmapi.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "0"
      ${If} ${FileExists} "$INSTDIR\resources\dlls\xinput1_4.dll"
        ClearErrors
        CopyFiles /SILENT "$INSTDIR\resources\dlls\xinput1_4.dll" "$0\xinput1_4.dll"
        ${If} ${Errors}
          StrCpy $1 "1"
        ${EndIf}
      ${Else}
        StrCpy $1 "1"
      ${EndIf}
    ${EndIf}

    ${If} $1 == "1"
      MessageBox MB_ICONEXCLAMATION|MB_OK "Merlin was installed, but the OpenSteamTool files could not be copied to the default Steam folder. Make sure Steam is closed and use Repair inside Merlin."
    ${EndIf}
  ${EndIf}
!macroend
