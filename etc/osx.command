# Script to open four terminal windows that execute all the Code City servers
# with one double-click.  For OSX.

osascript -e '
set ccPath to "~/Code/CodeCity/"
tell app "Terminal"
    do script "cd " & ccPath & "login\nnode loginServer.js"
    do script "cd " & ccPath & "connect\nnode connectServer.js"
    do script "cd " & ccPath & "mobwrite\npython mobwrite_server.py"
    do script "cd " & ccPath & "server\nnode codecity.js ../demo/demo.cfg"
end tell
'
