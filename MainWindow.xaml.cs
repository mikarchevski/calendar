using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Calendar.Database;
using Calendar.Notifications;
using Hardcodet.Wpf.TaskbarNotification; // ← ДОБАВЬ

namespace Calendar;

public partial class MainWindow : Window
{
    private TaskbarIcon? _trayIcon;
    private readonly ReminderService _reminderService = new();

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
    }
    private void TrayIcon_DoubleClick(object sender, RoutedEventArgs e)
    {
        this.Show();
        this.WindowState = WindowState.Normal;
        this.Activate();
    }
    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        var env = await CoreWebView2Environment.CreateAsync();
        await webView.EnsureCoreWebView2Async(env);

        var wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
        webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "app.local",
            wwwrootPath,
            CoreWebView2HostResourceAccessKind.Allow);

        webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
        webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

        webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        webView.Source = new Uri("https://app.local/index.html");

        webView.CoreWebView2.NavigationCompleted += (s, args) =>
        {
            SendInitialDataToJs();
        };

        // 1. Инициализация трей-иконки
        _trayIcon = (TaskbarIcon)FindResource("TrayIcon");

        // 2. Включаем автозагрузку (можно вынести в настройки позже)
        AutoStartManager.SetAutoStart(true);

        // 3. Запускаем сервис уведомлений
        _reminderService.Start();
    }

    // Перехватываем закрытие окна: вместо закрытия просто скрываем его
    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        e.Cancel = true;
        this.Hide();
    }

    // Обработчик пункта "Открыть календарь" в трее
    private void MenuItem_Show_Click(object sender, RoutedEventArgs e)
    {
        this.Show();
        this.WindowState = WindowState.Normal;
        this.Activate(); // Делаем окно активным
    }

    // Обработчик пункта "Выход" в трее
    private void MenuItem_Exit_Click(object sender, RoutedEventArgs e)
    {
        _reminderService.Stop();
        _trayIcon?.Dispose();
        Application.Current.Shutdown(); // Теперь закрываемся по-настоящему
    }

    private void SendInitialDataToJs()
    {
        var calendars = CalendarDb.GetCalendars();
        var events = CalendarDb.GetEvents();

        var payload = new { type = "init", calendars, events };
        var json = JsonSerializer.Serialize(payload);
        webView.CoreWebView2.PostWebMessageAsJson(json);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        var message = e.TryGetWebMessageAsString();
        if (string.IsNullOrEmpty(message)) return;

        try
        {
            using var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();

            switch (type)
            {
                case "saveEvent":
                    CalendarDb.SaveEvent(root);
                    SendInitialDataToJs();
                    break;
                case "deleteEvent":
                    CalendarDb.DeleteEvent(root.GetProperty("id").GetInt64());
                    SendInitialDataToJs();
                    break;
                case "toggleCalendar":
                    CalendarDb.SetCalendarVisibility(
                        root.GetProperty("id").GetInt64(),
                        root.GetProperty("visible").GetBoolean());
                    SendInitialDataToJs();
                    break;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Message error: {ex.Message}");
        }
    }
}