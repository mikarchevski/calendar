using Microsoft.Win32;
using System;
using System.Diagnostics;

namespace Calendar;

public static class AutoStartManager
{
    private const string RegistryKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string AppName = "CalendarApp"; // Имя в реестре

    public static void SetAutoStart(bool enable)
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKey, true);
            if (key != null)
            {
                if (enable)
                {
                    // Берём путь к текущему исполняемому файлу
                    var exePath = Process.GetCurrentProcess().MainModule?.FileName;
                    if (exePath != null)
                    {
                        // Кавычки нужны, если в пути есть пробелы
                        key.SetValue(AppName, $"\"{exePath}\"");
                    }
                }
                else
                {
                    key.DeleteValue(AppName, false);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"AutoStart error: {ex.Message}");
        }
    }
}