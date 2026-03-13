// POS Application Logic
const app = {
  cart: [],
  products: [],
  customers: [],
  sales: [],
  currentView: 'pos',

  // Initialize the application
  async init() {
    this.updateDate();
    setInterval(() => this.updateDate(), 60000); // Update date every minute

    // Load initial data
    await this.loadProducts();
    await this.loadCustomers();
    await this.loadSales();
    
    // Initialize views
    this.switchView('pos');
    this.renderProducts();
  },

  // Update current date display
  updateDate() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    document.getElementById('current-date').textContent = dateStr;
  },

  // View switching
  switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active', 'bg-primary-700');
    });
    event?.target.closest('.nav-item')?.classList.add('active', 'bg-primary-700');

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.add('hidden');
    });

    // Show selected view
    const view = document.getElementById(`${viewName}-view`);
    if (view) {
      view.classList.remove('hidden');
      this.currentView = viewName;
    }

    // Update page title
    const titles = {
      dashboard: { title: 'Dashboard', subtitle: 'Overview of your business' },
      pos: { title: 'Point of Sale', subtitle: 'Process customer transactions' },
      products: { title: 'Products', subtitle: 'Manage your inventory' },
      sales: { title: 'Sales History', subtitle: 'View past transactions' },
      customers: { title: 'Customers', subtitle: 'Manage customer information' }
    };

    if (titles[viewName]) {
      document.getElementById('page-title').textContent = titles[viewName].title;
      document.getElementById('page-subtitle').textContent = titles[viewName].subtitle;
    }

    // Load view-specific data
    if (viewName === 'dashboard') {
      this.loadDashboard();
    } else if (viewName === 'products') {
      this.renderProductsTable();
    } else if (viewName === 'sales') {
      this.renderSalesTable();
    } else if (viewName === 'customers') {
      this.renderCustomersTable();
    }
  },

  // Load data from database
  async loadProducts() {
    try {
      this.products = await window.api.getProducts();
    } catch (error) {
      console.error('Error loading products:', error);
      this.showNotification('Error loading products', 'error');
    }
  },

  async loadCustomers() {
    try {
      this.customers = await window.api.getCustomers();
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  },

  async loadSales() {
    try {
      this.sales = await window.api.getSales({});
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  },

  async loadDashboard() {
    try {
      const stats = await window.api.getStatistics({});
      
      // Update statistics
      document.getElementById('stat-today-sales').textContent = 
        this.formatCurrency(stats.totalRevenue);
      document.getElementById('stat-transactions').textContent = 
        stats.totalTransactions;
      document.getElementById('stat-avg-sale').textContent = 
        this.formatCurrency(stats.averageTransaction);
      document.getElementById('stat-products').textContent = 
        this.products.length;

      // Render recent sales
      const recentSalesList = document.getElementById('recent-sales-list');
      if (stats.recentSales && stats.recentSales.length > 0) {
        recentSalesList.innerHTML = stats.recentSales.map(sale => `
          <div class="flex justify-between items-center py-2 border-b">
            <div>
              <p class="text-sm font-medium">#${sale.id}</p>
              <p class="text-xs text-gray-500">${new Date(sale.created_at).toLocaleString()}</p>
            </div>
            <p class="text-sm font-semibold">${this.formatCurrency(sale.total)}</p>
          </div>
        `).join('');
      } else {
        recentSalesList.innerHTML = '<p class="text-gray-500 text-sm">No sales found</p>';
      }

      // Render top products
      const topProductsList = document.getElementById('top-products-list');
      if (stats.topProducts && stats.topProducts.length > 0) {
        topProductsList.innerHTML = stats.topProducts.map(product => `
          <div class="flex justify-between items-center py-2 border-b">
            <div>
              <p class="text-sm font-medium">${product.name}</p>
              <p class="text-xs text-gray-500">${product.quantity} sold</p>
            </div>
            <p class="text-sm font-semibold">${this.formatCurrency(product.revenue)}</p>
          </div>
        `).join('');
      } else {
        topProductsList.innerHTML = '<p class="text-gray-500 text-sm">No data available</p>';
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  },

  // Product rendering for POS
  renderProducts(searchTerm = '') {
    const grid = document.getElementById('products-grid');
    let filteredProducts = this.products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredProducts = this.products.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    }

    if (filteredProducts.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No products found</p>';
      return;
    }

    grid.innerHTML = filteredProducts.map(product => `
      <div 
        class="card cursor-pointer hover:shadow-lg transition-shadow"
        onclick="app.addToCart(${product.id})"
      >
        <div class="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
        </div>
        <h4 class="font-medium text-sm mb-1 truncate">${product.name}</h4>
        <p class="text-xs text-gray-500 mb-2">${product.category || 'Uncategorized'}</p>
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-primary-600">${this.formatCurrency(product.price)}</span>
          <span class="text-xs ${product.stock > 10 ? 'text-green-600' : 'text-orange-600'}">
            Stock: ${product.stock}
          </span>
        </div>
      </div>
    `).join('');
  },

  searchProducts(searchTerm) {
    this.renderProducts(searchTerm);
  },

  // Cart management
  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
      this.showNotification('Product out of stock', 'error');
      return;
    }

    const existingItem = this.cart.find(item => item.product_id === productId);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        this.showNotification('Not enough stock available', 'error');
        return;
      }
      existingItem.quantity++;
      existingItem.total = existingItem.quantity * existingItem.unit_price;
    } else {
      this.cart.push({
        product_id: productId,
        name: product.name,
        quantity: 1,
        unit_price: product.price,
        total: product.price
      });
    }

    this.renderCart();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product_id !== productId);
    this.renderCart();
  },

  updateCartQuantity(productId, quantity) {
    const item = this.cart.find(item => item.product_id === productId);
    const product = this.products.find(p => p.id === productId);
    
    if (!item || !product) return;

    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    if (quantity > product.stock) {
      this.showNotification('Not enough stock available', 'error');
      return;
    }

    item.quantity = quantity;
    item.total = item.quantity * item.unit_price;
    this.renderCart();
  },

  renderCart() {
    const cartItems = document.getElementById('cart-items');
    
    if (this.cart.length === 0) {
      cartItems.innerHTML = '<p class="text-gray-500 text-sm text-center py-8">Cart is empty</p>';
      this.updateCartTotals();
      return;
    }

    cartItems.innerHTML = this.cart.map(item => `
      <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
        <div class="flex-1">
          <p class="text-sm font-medium">${item.name}</p>
          <p class="text-xs text-gray-500">${this.formatCurrency(item.unit_price)}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            onclick="app.updateCartQuantity(${item.product_id}, ${item.quantity - 1})"
            class="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >-</button>
          <span class="text-sm font-medium w-8 text-center">${item.quantity}</span>
          <button 
            onclick="app.updateCartQuantity(${item.product_id}, ${item.quantity + 1})"
            class="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >+</button>
          <button 
            onclick="app.removeFromCart(${item.product_id})"
            class="w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
          >×</button>
        </div>
      </div>
    `).join('');

    this.updateCartTotals();
  },

  updateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
    const tax = 0; // Can be calculated based on your tax rate
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').textContent = this.formatCurrency(subtotal);
    document.getElementById('cart-tax').textContent = this.formatCurrency(tax);
    document.getElementById('cart-total').textContent = this.formatCurrency(total);
  },

  async completeSale() {
    if (this.cart.length === 0) {
      this.showNotification('Cart is empty', 'error');
      return;
    }

    const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
    const tax = 0;
    const total = subtotal + tax;
    const paymentMethod = document.getElementById('payment-method').value;

    const sale = {
      customer_id: null,
      total: total,
      subtotal: subtotal,
      tax: tax,
      discount: 0,
      payment_method: paymentMethod,
      items: this.cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total
      }))
    };

    try {
      await window.api.addSale(sale);
      this.showNotification('Sale completed successfully!', 'success');
      this.clearCart();
      await this.loadProducts(); // Reload products to update stock
      this.renderProducts();
    } catch (error) {
      console.error('Error completing sale:', error);
      this.showNotification('Error completing sale', 'error');
    }
  },

  clearCart() {
    this.cart = [];
    this.renderCart();
  },

  // Products table
  renderProductsTable() {
    const tbody = document.getElementById('products-table-body');
    
    if (this.products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No products found</td></tr>';
      return;
    }

    tbody.innerHTML = this.products.map(product => `
      <tr class="table-row">
        <td class="px-6 py-4">
          <div class="text-sm font-medium text-gray-900">${product.name}</div>
          <div class="text-sm text-gray-500">${product.description || ''}</div>
        </td>
        <td class="px-6 py-4 text-sm text-gray-500">${product.sku || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${product.category || '-'}</td>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.formatCurrency(product.price)}</td>
        <td class="px-6 py-4">
          <span class="badge ${product.stock > 10 ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'}">
            ${product.stock}
          </span>
        </td>
        <td class="px-6 py-4 text-sm space-x-2">
          <button class="text-primary-600 hover:text-primary-900">Edit</button>
          <button class="text-red-600 hover:text-red-900">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  // Sales table
  renderSalesTable() {
    const tbody = document.getElementById('sales-table-body');
    
    if (this.sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No sales found</td></tr>';
      return;
    }

    tbody.innerHTML = this.sales.map(sale => `
      <tr class="table-row">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">#${sale.id}</td>
        <td class="px-6 py-4 text-sm text-gray-500">
          ${new Date(sale.created_at).toLocaleString()}
        </td>
        <td class="px-6 py-4 text-sm text-gray-500">${sale.customer_name || 'Walk-in'}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${this.capitalize(sale.payment_method)}</td>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.formatCurrency(sale.total)}</td>
        <td class="px-6 py-4">
          <span class="badge badge-success">${this.capitalize(sale.status)}</span>
        </td>
      </tr>
    `).join('');
  },

  // Customers table
  renderCustomersTable() {
    const tbody = document.getElementById('customers-table-body');
    
    if (this.customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No customers found</td></tr>';
      return;
    }

    tbody.innerHTML = this.customers.map(customer => `
      <tr class="table-row">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${customer.name}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${customer.email || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${customer.phone || '-'}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${customer.city || '-'}</td>
        <td class="px-6 py-4 text-sm space-x-2">
          <button class="text-primary-600 hover:text-primary-900">Edit</button>
          <button class="text-red-600 hover:text-red-900">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  // Modal functions (placeholders)
  showProductModal() {
    this.showNotification('Product modal coming soon', 'info');
  },

  showCustomerModal() {
    this.showNotification('Customer modal coming soon', 'info');
  },

  // Utility functions
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a proper toast library
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      warning: 'bg-yellow-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
