# Third-Party Notices

## Lucide icons (ISC License)

The line icons in the interface (`source/app/shell.html`, `symbols`) follow the
Lucide icon set, released under the ISC License. Some icons originate from the
Feather icon set (MIT, below). No visible credit is required in the UI; this
notice travels with the source.

```
ISC License

Copyright (c) the Lucide contributors
Portions of the Lucide icon set are attributed to the Feather icon set.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

## Feather icons (MIT License)

```
The MIT License (MIT)

Copyright (c) 2013-2017 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING OUT
OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Microsoft WebView2 (runtime components)

The application restores the Microsoft.Web.WebView2 SDK, pinned to 1.0.2903.40,
from Microsoft's NuGet distribution. The transitive dependency graph is recorded
in source/app/packages.lock.json. The SDK and its runtime components remain
subject to Microsoft's license terms; they are not relicensed under this
repository's MIT license. The WebView2 Runtime must be installed separately.

## Test-only Node dependencies

jsdom and Playwright are development dependencies, pinned in package-lock.json.
Their licenses and transitive dependency notices remain in their respective
packages. They are not bundled into the desktop application.
