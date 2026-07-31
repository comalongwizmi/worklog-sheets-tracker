# Task Time Tracker

A small local-first task timer with a minimal UI and optional Google Sheets sync.

## Use it

Open `index.html` in a browser to use local-only tracking.

For Google login, run it from a local web server, then open the shown localhost URL:

```powershell
node server.js
```

Then open `http://localhost:8765`.

The app stores tasks in browser local storage immediately. You can connect Google Sheets on first launch or later with the settings button.

## Google Sheets setup

For normal users, the app should feel like any other Google login: open settings, enter Google credentials once, choose or create a Sheet, press Connect, approve Google's consent screen, and you are done.

For this public version, do not commit real Google credentials. The app stores the OAuth Client ID and API key in this browser's `localStorage` after you enter them in Settings.

1. Go to Google Cloud Console.
2. Create or choose a project.
3. Enable the Google Sheets API.
4. Create an OAuth 2.0 Client ID for a web application.
5. Add `http://localhost:8765` to authorized JavaScript origins for local testing.
6. If deploying to GitHub Pages, also add your Pages origin, for example `https://YOUR_USERNAME.github.io`.
7. Create an API key in the same project.
8. Paste both values into the app's Google credentials fields.

The settings dialog always shows Google credentials fields in this public copy.

After the first successful Google consent, the app remembers that access was granted. Future task changes are saved locally first and then synced automatically when the browser can refresh the Google access token. If Google cannot refresh the session silently, the task stays pending locally until Connect is pressed again.

In the settings dialog:

- Leave the spreadsheet field empty to create a new Google Sheet.
- Paste an existing Google Sheet URL or spreadsheet ID to use a table created by another app instance.
- Set the table name to name or rename the spreadsheet.

Rows are synced as:

`Start | End | Person | Task | Type | Rate | Duration | Status | ID`

## GitHub Pages

This folder is ready to publish as a static site. After creating a GitHub repository from these files, enable Pages from the repository settings with:

- Source: deploy from branch
- Branch: `main`
- Folder: `/`

## Windows app packaging direction

For a proper Windows app with a taskbar icon, tray menu, startup behavior, and installer, the next best step is wrapping this UI in Tauri or Electron.

Tauri is usually better here because this app is small: it makes a lighter Windows executable and supports a system tray icon/menu. Google Sheets sync can stay local-first: tasks are saved locally first, then synced whenever Google auth and internet are available.

