# Third-Party Notices

Noctra source code is licensed under the MIT License. See [`LICENSE`](LICENSE).

Extension-enabled Noctra builds include third-party Chrome extension compatibility packages. These notices must be kept with release artifacts that include Chrome extension support.

## electron-chrome-extensions

- Package: `electron-chrome-extensions@4.9.0`
- Author: Samuel Maddock
- Repository: <https://github.com/samuelmaddock/electron-browser-shell>
- License path selected by Noctra: GPL-3.0
- License text in packaged app: `licenses/electron-chrome-extensions/LICENSE-GPL`

Noctra does not use the Patron/proprietary license path for this package. Release notes and bundled notices for extension-enabled builds must not describe the distributed app as MIT-only.

## electron-chrome-web-store

- Package: `electron-chrome-web-store@0.13.0`
- Author: Samuel Maddock
- Repository: <https://github.com/samuelmaddock/electron-browser-shell>
- License: MIT

## Managed Chrome Extensions

Noctra can install managed Chrome extensions, starting with password-manager providers such as Bitwarden and 1Password. Those extensions are third-party software governed by their own licenses, terms, privacy policies, and update channels. Noctra does not store, inspect, sync, or log password-manager credentials.
