#!/usr/bin/osascript
# Script to open four terminal windows that execute all the Code City servers
# with one double-click.  For OSX.

tell application "Finder"
  set basePath to (POSIX path of (container of (container of (path to me)) as alias))
end tell

tell app "Terminal"

  do script "cd " & basePath & "/login
./loginServer"

  do script "cd " & basePath & "/connect
./connectServer"

  do script "cd " & basePath & "/mobwrite
python2 mobwrite_server.py"

  do script "cd " & basePath & "/server
./codecity " & basePath & "/database/codecity.cfg"

end tell
