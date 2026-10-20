using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Calendar.Database;
using Calendar.Notifications;

namespace Calendar;

public partial class MainWindow : Window
{
    private readonly ReminderService _reminderService = new();
    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
        Closing += MainWindow_Closing;
    }
    private void MainWindow_Closing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _reminderService.Stop();
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

        // ПОДПИСКА ДО ЗАГРУЗКИ СТРАНИЦЫ
        webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        System.Diagnostics.Debug.WriteLine("[C#] Подписка установлена");
        _reminderService.Start();

        webView.Source = new Uri("https://app.local/index.html");

        webView.CoreWebView2.NavigationCompleted += (s, args) =>
        {
            System.Diagnostics.Debug.WriteLine("[C#] Страница загружена");
            SendInitialDataToJs();
        };
    }

    private void SendInitialDataToJs()
    {
        var calendars = CalendarDb.GetCalendars();
        var events = CalendarDb.GetEvents();

        var payload = new
        {
            type = "init",
            calendars,
            events
        };

        var json = JsonSerializer.Serialize(payload);
        System.Diagnostics.Debug.WriteLine($"[C#] Отправляем в JS: {json}");
        webView.CoreWebView2.PostWebMessageAsJson(json);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        var message = e.TryGetWebMessageAsString();
        System.Diagnostics.Debug.WriteLine($"[C#] Получено: {message}");

        if (string.IsNullOrEmpty(message)) return;

        try
        {
            using var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;
            var type = root.GetProperty("type").GetString();
            System.Diagnostics.Debug.WriteLine($"[C#] Тип: {type}");

            switch (type)
            {
                case "saveEvent":
                    CalendarDb.SaveEvent(root);
                    SendInitialDataToJs();
                    break;

                case "deleteEvent":
                    var eventId = root.GetProperty("id").GetInt64();
                    CalendarDb.DeleteEvent(eventId);
                    SendInitialDataToJs();
                    break;

                case "toggleCalendar":
                    var calId = root.GetProperty("id").GetInt64();
                    var visible = root.GetProperty("visible").GetBoolean();
                    CalendarDb.SetCalendarVisibility(calId, visible);
                    break;

                case "setTheme":
                    _reminderService.SetDarkTheme(root.GetProperty("isDark").GetBoolean());
                    break;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[C#] Ошибка: {ex.Message}");
        }
    }
}