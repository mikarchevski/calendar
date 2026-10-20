!include "MUI2.nsh"
!include "FileFunc.nsh"

; Основные настройки
Name "MacCalendar"
OutFile "MacCalendar-Setup.exe"
InstallDir "$PROGRAMFILES\MacCalendar"
InstallDirRegKey HKLM "Software\MacCalendar" "InstallDir"
RequestExecutionLevel admin

; Настройки интерфейса
!define MUI_ABORTWARNING
!define MUI_ICON "Assets\app.ico"
!define MUI_UNICON "Assets\app.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "Assets\app.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "Assets\app.ico"

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

; Размер устанавливаемых файлов
!insertmacro GetSize "$INSTDIR" "/S=0K" $0 $1 $2

Section "MacCalendar" SecMain
    SetOutPath "$INSTDIR"
    
    ; Копируем все файлы из папки publish
    File /r "publish\*.*"
    
    ; Создаём ярлык на рабочем столе
    CreateShortCut "$DESKTOP\MacCalendar.lnk" "$INSTDIR\MacCalendar.exe"
    
    ; Создаём ярлык в меню Пуск
    CreateDirectory "$SMPROGRAMS\MacCalendar"
    CreateShortCut "$SMPROGRAMS\MacCalendar\MacCalendar.lnk" "$INSTDIR\MacCalendar.exe"
    CreateShortCut "$SMPROGRAMS\MacCalendar\Uninstall.lnk" "$INSTDIR\uninst.exe"
    
    ; Записываем путь установки в реестр
    WriteRegStr HKLM "Software\MacCalendar" "InstallDir" "$INSTDIR"
    
    ; Записываем информацию для "Установка и удаление программ"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "DisplayName" "MacCalendar"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "DisplayIcon" "$INSTDIR\MacCalendar.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "Publisher" "mikarchevski"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "DisplayVersion" "1.1.0"
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar" \
        "EstimatedSize" "$0"
    
    ; Создаём деинсталлятор
    WriteUninstaller "$INSTDIR\uninst.exe"
SectionEnd

Section "Uninstall"
    ; Удаляем файлы
    RMDir /r "$INSTDIR"
    
    ; Удаляем ярлыки
    Delete "$DESKTOP\MacCalendar.lnk"
    RMDir /r "$SMPROGRAMS\MacCalendar"
    
    ; Удаляем записи реестра
    DeleteRegKey HKLM "Software\MacCalendar"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MacCalendar"
SectionEnd