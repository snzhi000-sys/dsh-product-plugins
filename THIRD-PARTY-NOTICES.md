# Third-party notices

`file-edit/client/dist/client.js` ships third-party code. Everything it embeds is MIT-licensed; the copyright line and the permission notice each component requires follow. Regenerate this file with `node scripts/collect-third-party-notices.mjs`; `--check` fails when it is stale.

## Embedded by the client build (esbuild)

| Component | Version | License | Copyright |
| --- | --- | --- | --- |
| `@codemirror/state` | 6.7.1 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/view` | 6.43.9 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/commands` | 6.11.0 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/language` | 6.12.4 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@codemirror/legacy-modes` | 6.5.3 | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/common` | 1.5.2 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/highlight` | 1.2.3 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `@lezer/lr` | 1.4.10 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `style-mod` | 4.1.3 | MIT | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `w3c-keyname` | 2.2.8 | MIT | Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| `crelt` | 1.0.7 | MIT | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> |

## Inserted into the client source

| Component | Version | License | Copyright |
| --- | --- | --- | --- |
| `markdown-it` | 15.0.0 | MIT | Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin. |

`markdown-it`: browser UMD build embedded in the client source; it carries linkify-it, mdurl and uc.micro.

## MIT License

Each component above is licensed under the MIT License with its own copyright line, and all of them carry this permission notice:

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Derived work

`dsh-file-edit` is a derivative of [justarook1e/dsh-file-edit](https://github.com/justarook1e/dsh-file-edit), MIT-licensed with copyright held by `justarook1e`; that project is no longer maintained and has moved to [justarook1e/dsh-ide-lite](https://github.com/justarook1e/dsh-ide-lite). The original copyright notice is retained in [LICENSE](LICENSE).

## Not redistributed here

The plugin runs against the DeepSeek Harness plugin APIs. Harness itself is MIT-licensed (Copyright (c) 2026 DeepSeek), but no Harness code is redistributed in this repository: the client requires the host's platform modules at runtime instead of bundling them.
