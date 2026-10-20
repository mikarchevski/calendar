using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using MacCalendar.Models;

namespace Calendar.Notifications;

internal sealed class ReminderNotificationWindow : Window
{
    private readonly ReminderStage _stage;
    private readonly Action<ReminderStage, IReadOnlyCollection<long>, bool> _onDismissed;
    private readonly Dictionary<long, CalendarEvent> _events = new();
    private readonly StackPanel _eventList = new();
    private readonly List<TextBlock> _secondaryTexts = new();
    private readonly List<(Button Button, bool IsPrimary)> _buttons = new();
    private readonly ScrollViewer _eventScrollViewer;
    private bool _isDarkTheme;
    private bool _dismissed;

    public ReminderNotificationWindow(
        ReminderStage stage,
        IEnumerable<CalendarEvent> events,
        Action<ReminderStage, IReadOnlyCollection<long>, bool> onDismissed,
        bool isDarkTheme)
    {
        _stage = stage;
        _onDismissed = onDismissed;
        _isDarkTheme = isDarkTheme;
        Title = stage == ReminderStage.Upcoming ? "События через 15 минут" : "Началось событие";
        Width = 420;
        MaxHeight = 560;
        SizeToContent = SizeToContent.Height;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        WindowStyle = WindowStyle.ToolWindow;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        Topmost = true;
        _eventScrollViewer = new ScrollViewer
        {
            Content = _eventList,
            MaxHeight = 360,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Margin = new Thickness(0, 8, 0, 12)
        };
        Content = BuildContent();

        AddEvents(events);
        ApplyTheme();
        Closing += (_, _) =>
        {
            if (_dismissed) return;
            _dismissed = true;
            _onDismissed(_stage, _events.Keys.ToArray(), false);
        };
    }

    public void SetDarkTheme(bool isDark)
    {
        _isDarkTheme = isDark;
        ApplyTheme();
    }

    public void AddEvents(IEnumerable<CalendarEvent> events)
    {
        foreach (var calendarEvent in events)
        {
            if (!_events.TryAdd(calendarEvent.Id, calendarEvent)) continue;

            var details = _stage == ReminderStage.Upcoming
                ? $"Начало в {GetStartTime(calendarEvent):HH:mm}"
                : string.Empty;
            var item = new StackPanel { Margin = new Thickness(0, 8, 0, 0) };
            item.Children.Add(new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(calendarEvent.Title) ? "Без названия" : calendarEvent.Title,
                FontSize = 16,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap
            });
            if (details.Length > 0)
            {
                var detail = new TextBlock
                {
                    Text = details,
                    Margin = new Thickness(0, 2, 0, 0)
                };
                _secondaryTexts.Add(detail);
                item.Children.Add(detail);
            }
            _eventList.Children.Add(item);
        }
        ApplyTheme();
    }

    private UIElement BuildContent()
    {
        var root = new StackPanel { Margin = new Thickness(24) };
        root.Children.Add(new TextBlock
        {
            Text = _stage == ReminderStage.Upcoming ? "Событие через 15 минут" : "Началось событие",
            FontSize = 20,
            FontWeight = FontWeights.Bold,
            TextWrapping = TextWrapping.Wrap
        });

        root.Children.Add(_eventScrollViewer);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right
        };
        if (_stage == ReminderStage.Upcoming)
        {
            buttons.Children.Add(CreateButton("Прекратить все", () => Dismiss(stopAll: true), isPrimary: false));
        }
        buttons.Children.Add(CreateButton("Ок", () => Dismiss(stopAll: false), isPrimary: true));
        root.Children.Add(buttons);
        return root;
    }

    private Button CreateButton(string text, Action onClick, bool isPrimary)
    {
        var button = new Button
        {
            Content = text,
            Padding = new Thickness(16, 8, 16, 8),
            Margin = new Thickness(8, 0, 0, 0),
            BorderThickness = new Thickness(0),
            FontSize = 13,
            Cursor = System.Windows.Input.Cursors.Hand,
            Template = CreateButtonTemplate()
        };
        button.Click += (_, _) => onClick();
        _buttons.Add((button, isPrimary));
        return button;
    }

    private static ControlTemplate CreateButtonTemplate()
    {
        const string template =
            "<ControlTemplate xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" " +
            "xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\" TargetType=\"{x:Type Button}\">" +
            "<Border Background=\"{TemplateBinding Background}\" CornerRadius=\"6\">" +
            "<ContentPresenter HorizontalAlignment=\"Center\" VerticalAlignment=\"Center\" " +
            "Margin=\"{TemplateBinding Padding}\" /></Border>" +
            "<ControlTemplate.Triggers><Trigger Property=\"IsMouseOver\" Value=\"True\">" +
            "<Setter Property=\"Opacity\" Value=\"0.85\" /></Trigger></ControlTemplate.Triggers>" +
            "</ControlTemplate>";
        return (ControlTemplate)XamlReader.Parse(template);
    }

    private void ApplyTheme()
    {
        var background = _isDarkTheme
            ? Color.FromRgb(44, 44, 46)
            : Color.FromRgb(245, 245, 247);
        var primaryText = _isDarkTheme
            ? Color.FromRgb(245, 245, 247)
            : Color.FromRgb(29, 29, 31);
        var secondaryText = _isDarkTheme
            ? Color.FromRgb(161, 161, 166)
            : Color.FromRgb(110, 110, 115);
        var secondaryButton = _isDarkTheme
            ? Color.FromRgb(58, 58, 60)
            : Color.FromRgb(232, 232, 237);

        Background = new SolidColorBrush(background);
        Foreground = new SolidColorBrush(primaryText);
        foreach (var detail in _secondaryTexts)
        {
            detail.Foreground = new SolidColorBrush(secondaryText);
        }
        foreach (var (button, isPrimary) in _buttons)
        {
            button.Background = new SolidColorBrush(isPrimary
                ? Color.FromRgb(0, 122, 255)
                : secondaryButton);
            button.Foreground = new SolidColorBrush(isPrimary ? Colors.White : primaryText);
        }
    }

    private void Dismiss(bool stopAll)
    {
        if (_dismissed) return;
        _dismissed = true;
        _onDismissed(_stage, _events.Keys.ToArray(), stopAll);
        Close();
    }

    private static DateTime GetStartTime(CalendarEvent calendarEvent) =>
        DateTime.TryParse(calendarEvent.Start, out var start) ? start : DateTime.Now;
}
