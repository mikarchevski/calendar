[Setup]
AppName=Calendar
AppVersion=1.0.0
DefaultDirName={autopf}\Calendar
DefaultGroupName=Calendar
OutputDir=.\InstallerOutput
OutputBaseFilename=Calendar_Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
; Иконка для самого установщика (опционально, можно добавить IconSetup.ico в корень)
; SetupIconFile=IconSetup.ico

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительные ярлыки:";

[Files]
; Копируем ВСЁ из папки publish, включая wwwroot и SQLite библиотеки
; Относительный путь работает, если вы запускаете компиляцию из корня репозитория
Source: "bin\Release\net9.0-windows\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; --- ОПЦИОНАЛЬНО: WebView2 Runtime ---
; Если вы хотите быть на 100% уверены, что WebView2 установится даже на старых Windows 10,
; скачайте MicrosoftEdgeWebview2Setup.exe, положите его в корень репозитория и раскомментируйте строку ниже:
; Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{group}\Calendar"; Filename: "{app}\Calendar.exe"
Name: "{autodesktop}\Calendar"; Filename: "{app}\Calendar.exe"; Tasks: desktopicon

[Run]
; Запуск приложения после установки (по желанию пользователя)
Filename: "{app}\Calendar.exe"; Description: "Запустить Calendar"; Flags: nowait postinstall skipifsilent

; --- ОПЦИОНАЛЬНО: Тихая установка WebView2 ---
; Раскомментируйте, если добавили файл выше
; Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Установка компонента WebView2..."; Flags: waituntilterminated