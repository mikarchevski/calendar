!include "MUI2.nsh"

; Основные настройки
Name "Calendar"
OutFile "Calendar-Setup.exe"
InstallDir "$PROGRAMFILES\Calendar"
InstallDirRegKey HKLM "Software\Calendar" "InstallDir"
RequestExecutionLevel admin

; Настройки интерфейса
!define MUI_ABORTWARNING
!define MUI_ICON "Assets\app.ico"
!define MUI_UNICON "Assets\app.ico"

; Страницы установщика
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Страницы деинсталляции
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Язык
!insertmacro MUI_LANGUAGE "English"

Section "Calendar" SecMain
    SetOutPath "$INSTDIR"
    
    ; Копируем все файлы из папки publish
    File /r "publish\*.*"
    
    ; Создаём ярлык на рабочем столе
    CreateShortCut "$DESKTOP\Calendar.lnk" "$INSTDIR\Calendar.exe"
    
    ; Создаём ярлык в меню Пуск
    CreateDirectory "$SMPROGRAMS\Calendar"
    CreateShortCut "$SMPROGRAMS\Calendar\Calendar.lnk" "$INSTDIR\Calendar.exe"
    CreateShortCut "$SMPROGRAMS\Calendar\Uninstall.lnk" "$INSTDIR\uninst.exe"
    
    ; Записываем путь установки в реестр
    WriteRegStr HKLM "Software\Calendar" "InstallDir" "$INSTDIR"
    
    ; Записываем информацию для "Установка и удаление программ"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar" \
        "DisplayName" "Calendar"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar" \
        "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar" \
        "DisplayIcon" "$INSTDIR\Calendar.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar" \
        "Publisher" "mikarchevski"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar" \
        "DisplayVersion" "1.2.1"
    
    ; Создаём деинсталлятор
    WriteUninstaller "$INSTDIR\uninst.exe"
SectionEnd

Section "Uninstall"
    ; Удаляем файлы
    RMDir /r "$INSTDIR"
    
    ; Удаляем ярлыки
    Delete "$DESKTOP\Calendar.lnk"
    RMDir /r "$SMPROGRAMS\Calendar"
    
    ; Удаляем записи реестра
    DeleteRegKey HKLM "Software\Calendar"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Calendar"
SectionEnd