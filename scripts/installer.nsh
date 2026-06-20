!macro customInstall
  StrCpy $0 "$PROGRAMFILES32\Steam"

  ${If} ${FileExists} "$0\steam.exe"
    StrCpy $1 "0"

    ${If} ${FileExists} "$INSTDIR\resources\dlls\LumaCore.dll"
      ClearErrors
      CopyFiles /SILENT "$INSTDIR\resources\dlls\LumaCore.dll" "$0\LumaCore.dll"
      ${If} ${Errors}
        StrCpy $1 "1"
      ${EndIf}
    ${Else}
      StrCpy $1 "1"
    ${EndIf}

    ${If} ${FileExists} "$INSTDIR\resources\dlls\dwmapi.dll"
      ClearErrors
      CopyFiles /SILENT "$INSTDIR\resources\dlls\dwmapi.dll" "$0\dwmapi.dll"
      ${If} ${Errors}
        StrCpy $1 "1"
      ${EndIf}
    ${Else}
      StrCpy $1 "1"
    ${EndIf}

    ${If} $1 == "1"
      MessageBox MB_ICONEXCLAMATION|MB_OK "Merlin was installed, but the LumaCore files could not be copied to the default Steam folder. Close Steam and use Repair inside Merlin."
    ${EndIf}
  ${EndIf}
!macroend
