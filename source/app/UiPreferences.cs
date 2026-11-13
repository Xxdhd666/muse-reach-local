using System;using System.Collections.Generic;using System.Drawing;using System.Linq;
namespace MuseReach {
 public sealed class WindowGeometry {public int x{get;set;}public int y{get;set;}public int width{get;set;}public int height{get;set;}public static bool IsVisible(WindowGeometry b,IEnumerable<Rectangle> screens){if(b==null||b.width<200||b.height<150)return false;var title=new Rectangle(b.x,b.y,Math.Max(100,Math.Min(b.width,300)),32);return screens.Any(s=>Rectangle.Intersect(s,title).Width>=100&&Rectangle.Intersect(s,title).Height>=24);}}
 public sealed partial class AppSettings {
  public bool sidebarCollapsed{get;set;}=false;public string sidebarSide{get;set;}="left";public bool animationsEnabled{get;set;}=true;public bool recentChangesCollapsed{get;set;}=true;public bool recentFilesCollapsed{get;set;}=false;public WindowGeometry windowBounds{get;set;}public bool windowMaximized{get;set;}=false;public double webZoom{get;set;}=1.0;
  public double consoleScale{get;set;}=1;
  public void SetConsoleScale(double z){if(z!=1&&z!=1.15&&z!=1.3)throw new ArgumentException("请选择100%、115%或130%");consoleScale=z;}
  public void SetWebZoom(double z){if(Math.Abs(z-.9)>.00001&&Math.Abs(z-1)>.00001&&Math.Abs(z-1.1)>.00001)throw new ArgumentException("请选择90%、100%或110%");webZoom=z;}
 }
}
