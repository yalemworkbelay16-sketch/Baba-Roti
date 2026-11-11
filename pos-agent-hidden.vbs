' pos-agent-hidden.vbs – Silent Background Launcher for Baba Roti POS Print Bridge Agent
' Launches node pos-agent.js with window style 0 (completely hidden in background)

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Set working directory to the folder containing this VBS script
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

nodeExe = "node"
If FSO.FileExists("C:\Program Files\nodejs\node.exe") Then
    nodeExe = """C:\Program Files\nodejs\node.exe"""
End If

' Launch node pos-agent.js with window hidden (0) without waiting (False)
WshShell.Run nodeExe & " pos-agent.js", 0, False
