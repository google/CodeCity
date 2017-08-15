Minimal Database.

This database demonstrates a very minimal Code City instance.  It contains:

* Two users (Alpha and Beta)
* One room (Hangout)
* One object (Rock)

Run the database with:
  node codecity.js minimal
Telnet to port 7777
Type either 'Alpha' or 'Beta' to connect as one of the two users.

Once connected, the valid commands are:
* say <some text>
* eval <some code>
* look [me|here|alpha|beta|hangout|rock]
* get rock
* drop rock
* quit
