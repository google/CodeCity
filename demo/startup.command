#!/usr/bin/osascript
# Script to open four terminal windows that execute all the Code City servers
# with one double-click.  For OSX.

tell application "Finder"
  set dbPath to (POSIX path of (container of (path to me) as alias))
end tell

tell app "Terminal"

  do script "cd " & dbPath & "../login
node loginServer.js"

  do script "cd " & dbPath & "../connect
node connectServer.js"

  do script "cd " & dbPath & "../mobwrite
python mobwrite_server.py"

  do script "cd " & dbPath & "../server
node --harmony-weak-refs codecity.js " & dbPath & "demo.cfg"

end tell
