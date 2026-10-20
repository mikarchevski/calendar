using System.Windows;
using Calendar.Database;  // ← было MacCalendar.Database

namespace Calendar;  // ← было MacCalendar

public partial class App : Application
{
    private void Application_Startup(object sender, StartupEventArgs e)
    {
        CalendarDb.Initialize();  // ← можно без Database., т.к. using есть
        var mainWindow = new MainWindow();
        mainWindow.Show();
    }
}