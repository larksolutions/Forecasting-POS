const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('../database/database');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f3f4f6'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database
function initDatabase() {
  db = new Database();
  db.initialize();
}

// App lifecycle events
app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) db.close();
});

// IPC Handlers for database operations

// Products
ipcMain.handle('db:getProducts', async () => {
  return db.getProducts();
});

ipcMain.handle('db:addProduct', async (event, product) => {
  return db.addProduct(product);
});

ipcMain.handle('db:updateProduct', async (event, id, product) => {
  return db.updateProduct(id, product);
});

ipcMain.handle('db:deleteProduct', async (event, id) => {
  return db.deleteProduct(id);
});

// Product images
ipcMain.handle('app:saveProductImage', async (event, { fileName, dataUrl }) => {
  const imagesDir = path.join(app.getPath('userData'), 'product-images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  // Strip data URL prefix to get raw base64
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const filePath = path.join(imagesDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return fileName;
});

ipcMain.handle('app:getProductImagesPath', async () => {
  return path.join(app.getPath('userData'), 'product-images');
});

ipcMain.handle('app:deleteProductImage', async (event, fileName) => {
  if (!fileName) return;
  const filePath = path.join(app.getPath('userData'), 'product-images', fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});

// Sales
ipcMain.handle('db:getSales', async (event, filters) => {
  return db.getSales(filters);
});

ipcMain.handle('db:addSale', async (event, sale) => {
  return db.addSale(sale);
});

ipcMain.handle('db:getSaleById', async (event, id) => {
  return db.getSaleById(id);
});

// Customers
ipcMain.handle('db:getCustomers', async () => {
  return db.getCustomers();
});

ipcMain.handle('db:addCustomer', async (event, customer) => {
  return db.addCustomer(customer);
});

ipcMain.handle('db:updateCustomer', async (event, id, customer) => {
  return db.updateCustomer(id, customer);
});

ipcMain.handle('db:deleteCustomer', async (event, id) => {
  return db.deleteCustomer(id);
});

// Statistics
ipcMain.handle('db:getStatistics', async (event, dateRange) => {
  return db.getStatistics(dateRange);
});

// Forecasting
ipcMain.handle('db:getForecastData', async () => {
  return db.getForecastData();
});
