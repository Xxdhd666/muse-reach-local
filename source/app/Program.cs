using System;
using System.Windows.Forms;
namespace MuseReach
{
    internal static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            if(args.Length==2&&args[0]=="--tunnel-control"){try{Environment.Exit(TunnelControl.Elevated(args[1]));}catch{Environment.Exit(5);}return;}
            using var singleton=new System.Threading.Mutex(true,"Local\\MuseReach-v11",out bool first);
            // v34：重复启动不再静默退出——先通知已运行的实例把窗口带到前台
            // （RegisterWindowMessage 广播，见 MainForm.BringToFrontMessage），再退出。
            // Mutex 名故意不改 v11：改名会让 v33 与 v34 各持一个互斥体、同时跑起来。
            if(!first){MainForm.NotifyFirstInstance();return;}
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
