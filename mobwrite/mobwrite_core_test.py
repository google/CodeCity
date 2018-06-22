#!/usr/bin/python2.4

"""Test harness for mobwrite_core_test.py

Copyright 2009 Google Inc.
http://code.google.com/p/google-diff-match-patch/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import unittest
import logging
import mobwrite_core
# Force a module reload so to make debugging easier (at least in PythonWin).
reload(mobwrite_core)

class MobWriteCoreTest(unittest.TestCase):

  def setUp(self):
    mobwrite_core.LOG.setLevel(logging.ERROR)
    mobwrite_core.logging.basicConfig()

  def tearDown(self):
    mobwrite_core.logging.shutdown()

  def testParseRequest(self):
    mobwrite = mobwrite_core.MobWrite()

    actions = mobwrite.parseRequest("")
    self.assertEquals([], actions)

    actions = mobwrite.parseRequest("""u:fred
f:3:report
d:2:=10+Hello-7=2

""")
    self.assertEquals([{"username":"fred",
       "filename":"report",
       "mode":"delta",
       "data":"=10+Hello-7=2",
       "force":False,
       "server_version":3,
       "client_version":2,
       "echo_username":False
      }], actions)

    actions = mobwrite.parseRequest("""U:fred
f:3:report
R:2:Hello World

""")
    self.assertEquals([{"username":"fred",
       "filename":"report",
       "mode":"raw",
       "data":"Hello World",
       "force":True,
       "server_version":3,
       "client_version":2,
       "echo_username":True
      }], actions)

    actions = mobwrite.parseRequest("""U:fred
N:report

""")
    self.assertEquals([{"username":"fred",
       "filename":"report",
       "mode":"null",
      }], actions)


if __name__ == "__main__":
  unittest.main()
