const { app, BrowserWindow, Menu } = require("electron");
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

function getDatabasePath() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "scheduler.db");
}

function migrateDatabase() {
  const newDbPath = getDatabasePath();
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

function startBackend() {
  const backendPath = getBackendPath();
  if (!backendPath) {
    console.log("[electron] Dev mode: assuming backend is running externally.");
    return;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[electron] Starting backend: ${backendPath}`);
  console.log(`[electron] Database path: ${dbPath}`);

  backendProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      DATABASE_PATH: getDatabasePath(),
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
  migrateDatabase();
  startBackend();

  try {
    await pollBackendHealth();
  } catch (err) {
    console.error("[electron]", err.message);
    // In dev mode, backend might just be slow — continue anyway
    if (!isDev) {
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
