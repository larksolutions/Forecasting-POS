const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Products
  getProducts: () => ipcRenderer.invoke('db:getProducts'),
  addProduct: (product) => ipcRenderer.invoke('db:addProduct', product),
  updateProduct: (id, product) => ipcRenderer.invoke('db:updateProduct', id, product),
  deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

  // Sales
  getSales: (filters) => ipcRenderer.invoke('db:getSales', filters),
  addSale: (sale) => ipcRenderer.invoke('db:addSale', sale),
  getSaleById: (id) => ipcRenderer.invoke('db:getSaleById', id),

  // Customers
  getCustomers: () => ipcRenderer.invoke('db:getCustomers'),
  addCustomer: (customer) => ipcRenderer.invoke('db:addCustomer', customer),
  updateCustomer: (id, customer) => ipcRenderer.invoke('db:updateCustomer', id, customer),

  // Statistics
  getStatistics: (dateRange) => ipcRenderer.invoke('db:getStatistics', dateRange)
});
