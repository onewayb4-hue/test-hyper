Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' تشغيل السيرفر في وضع صامت بدون شاشة سوداء
WshShell.Run "cmd /c node server.js", 0, False

WScript.Sleep 1500

' فتح الموقع في المتصفح
WshShell.Run "http://localhost:3000/admin/"
WshShell.Run "http://localhost:3000/"
