const { app, BrowserWindow, Menu, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let backendProcess = null;
let mainWindow = null;
let isDev = false;

const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function getBackendPath() {
  if (isDev) {
    // In dev mode, we assume the Python backend is started separately
    return null;
  }
  // In production, the PyInstaller binary is in extraResources/backend/
  const resourcesPath = process.resourcesPath;
  const binaryName =
    process.platform === "win32" ? "course_scheduler.exe" : "course_scheduler";
  return path.join(resourcesPath, "backend", binaryName);
}

function getDefaultDatabasePath() {
  return path.join(app.getPath("userData"), "scheduler.db");
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readConfig() {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function showFirstLaunchDialog() {
  const defaultDir = app.getPath("userData");
  const result = dialog.showSaveDialogSync({
    title: "Choose Database Location",
    defaultPath: path.join(defaultDir, "scheduler.db"),
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
  });
  return result || getDefaultDatabasePath();
}

function resolveDatabasePath() {
  const config = readConfig();

  // If config already has a databasePath, use it
  if (config.databasePath) {
    return config.databasePath;
  }

  const defaultPath = getDefaultDatabasePath();

  // If database exists at default path (existing install), record it in config
  if (fs.existsSync(defaultPath)) {
    writeConfig({ ...config, databasePath: defaultPath });
    return defaultPath;
  }

  // First launch — show dialog
  const chosenPath = showFirstLaunchDialog();
  writeConfig({ ...config, databasePath: chosenPath });
  return chosenPath;
}

function migrateDatabase(resolvedDbPath) {
  const newDbPath = resolvedDbPath;
  if (fs.existsSync(newDbPath)) return; // already migrated or fresh install

  // Determine old path based on platform
  let oldDbPath;
  if (process.platform === "darwin") {
    oldDbPath = path.join(app.getPath("home"), "Library", "Application Support", "course-scheduler", "scheduler.db");
  } else if (process.platform === "win32") {
    oldDbPath = path.join(app.getPath("appData"), "course-scheduler", "scheduler.db");
  } else {
    oldDbPath = path.join(app.getPath("home"), ".config", "course-scheduler", "scheduler.db");
  }

  if (!fs.existsSync(oldDbPath)) return; // no old database to migrate

  // Ensure the new directory exists
  const newDir = path.dirname(newDbPath);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
  }

  console.log(`[electron] Migrating database from ${oldDbPath} to ${newDbPath}`);
  fs.copyFileSync(oldDbPath, newDbPath);
}

function startBackend(dbPath) {
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log("[electron] Dev mode: assuming backend is running externally.");
    return;
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[electron] Starting backend: ${backendPath}`);
  console.log(`[electron] Database path: ${dbPath}`);

  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: dbPath,
      CONFIG_PATH: getConfigPath(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("[electron] Failed to start backend:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[electron] Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function pollBackendHealth(retries = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function check() {
      attempts++;
      const req = http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log("[electron] Backend is ready.");
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => retry());
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (attempts >= retries) {
        reject(new Error("Backend did not start in time"));
      } else {
        setTimeout(check, interval);
      }
    }

    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "The Chair's Desk",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // Dev mode: load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load the built React app from extraResources
    const indexPath = path.join(process.resourcesPath, "frontend", "dist", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log("[electron] Stopping backend...");
    backendProcess.kill("SIGTERM");

    // Force kill after 5 seconds if it doesn't stop
    setTimeout(() => {
      if (backendProcess) {
        console.log("[electron] Force killing backend...");
        backendProcess.kill("SIGKILL");
      }
    }, 5000);
  }
}

function navigateToHelp() {
  if (!mainWindow) return;
  if (isDev) {
    mainWindow.webContents.executeJavaScript(
      "window.location.href = '/help'"
    );
  } else {
    mainWindow.webContents.executeJavaScript(
      "window.location.hash = '#/help'"
    );
  }
}

function setupMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "User Guide",
          accelerator: "CmdOrCtrl+Shift+/",
          click: () => navigateToHelp(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  isDev = !app.isPackaged;

  // Resolve database path: dev uses default, production may show dialog
  const dbPath = isDev ? getDefaultDatabasePath() : resolveDatabasePath();

  migrateDatabase(dbPath);
  startBackend(dbPath);

  try {
    await pollBackendHealth();
  } catch (err) {
    console.error("[electron]", err.message);
    if (!isDev) {
      dialog.showErrorBox(
        "Backend Failed to Start",
        "The application backend did not start in time. Please try again or check the logs."
      );
      app.quit();
      return;
    }
  }

  createWindow();
  setupMenu();

  app.on("activate", () => {
    // macOS: re-create window if dock icon clicked and no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, apps typically stay open until Cmd+Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("will-quit", () => {
  stopBackend();
});
