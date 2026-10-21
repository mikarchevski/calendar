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
        // 1. Определяем безопасную папку для данных WebView2 (в AppData пользователя)
        string appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Calendar");

        // 2. Создаем её, если она еще не существует
        if (!Directory.Exists(appDataPath))
        {
            Directory.CreateDirectory(appDataPath);
        }

        // 3. Передаем этот путь вторым аргументом в CreateAsync
        // Первый аргумент (browserExecutableFolder) оставляем null, чтобы использовался системный Edge
        var env = await CoreWebView2Environment.CreateAsync(null, appDataPath);

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
        System.Diagnostics.Debug.WriteLine("[C#] Подписка установлена");

        _reminderService.Start();

        webView.Source = new Uri("https://app.local/index.html");

        webView.CoreWebView2.NavigationCompleted += (s, args) =>
        {
            System.Diagnostics.Debug.WriteLine("[C#] Страница загружена");
            SendInitialDataToJs();
        };
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