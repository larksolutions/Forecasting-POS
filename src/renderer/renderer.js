// POS Application Logic
const app = {
  cart: [],
  products: [],
  customers: [],
  sales: [],
  currentView: 'pos',
  salesPage: 1,
  salesPerPage: 10,
  salesDateFrom: '',
  salesDateTo: '',
  productsPage: 1,
  productsPerPage: 10,
  productsSearch: '',
  taxRate: 0.12, // 12% VAT
  productImagesPath: '', // resolved at init

  // Initialize the application
  async init() {
    this.updateDate();
    setInterval(() => this.updateDate(), 60000);

    // Bind all event listeners (no inline handlers — CSP compliant)
    this.bindEvents();

    // Load initial data
    this.productImagesPath = await window.api.getProductImagesPath();
    await this.loadProducts();
    await this.loadCustomers();
    await this.loadSales();
    this.populateCustomerDropdown();
    
    // Initialize views
    this.switchView('pos');
    this.renderProducts();
  },

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchView(btn.dataset.view, e);
      });
    });

    // POS search
    document.getElementById('product-search').addEventListener('input', (e) => {
      this.searchProducts(e.target.value);
    });

    // Cart buttons
    document.getElementById('btn-complete-sale').addEventListener('click', () => this.completeSale());
    document.getElementById('btn-clear-cart').addEventListener('click', () => this.clearCart());
    document.getElementById('cart-discount').addEventListener('input', () => this.updateCartTotals());

    // Receipt modal
    document.getElementById('btn-close-receipt').addEventListener('click', () => this.closeReceiptModal());
    document.getElementById('btn-close-receipt-bottom').addEventListener('click', () => this.closeReceiptModal());
    document.getElementById('receipt-modal-backdrop').addEventListener('click', () => this.closeReceiptModal());
    document.getElementById('btn-print-receipt').addEventListener('click', () => this.printReceipt());

    // Product image upload
    document.getElementById('product-image-input').addEventListener('change', (e) => this.handleProductImageUpload(e));
    document.getElementById('btn-remove-product-image').addEventListener('click', () => this.removeProductImage());

    // Product management
    document.getElementById('btn-add-product').addEventListener('click', () => this.showProductModal());
    document.getElementById('btn-close-product-modal').addEventListener('click', () => this.closeProductModal());
    document.getElementById('product-modal-backdrop').addEventListener('click', () => this.closeProductModal());
    document.getElementById('btn-cancel-product').addEventListener('click', () => this.closeProductModal());
    document.getElementById('product-form').addEventListener('submit', (e) => this.saveProduct(e));

    // Customer management
    document.getElementById('btn-add-customer').addEventListener('click', () => this.showCustomerModal());
    document.getElementById('btn-close-customer-modal').addEventListener('click', () => this.closeCustomerModal());
    document.getElementById('customer-modal-backdrop').addEventListener('click', () => this.closeCustomerModal());
    document.getElementById('btn-cancel-customer').addEventListener('click', () => this.closeCustomerModal());
    document.getElementById('customer-form').addEventListener('submit', (e) => this.saveCustomer(e));

    // Confirm modal
    document.getElementById('btn-cancel-confirm').addEventListener('click', () => this.closeConfirmModal());

    // Products search & pagination
    document.getElementById('products-search').addEventListener('input', (e) => {
      this.productsSearch = e.target.value;
      this.productsPage = 1;
      this.renderProductsTable();
    });
    document.getElementById('btn-products-prev').addEventListener('click', () => {
      if (this.productsPage > 1) { this.productsPage--; this.renderProductsTable(); }
    });
    document.getElementById('btn-products-next').addEventListener('click', () => {
      this.productsPage++; this.renderProductsTable();
    });
    document.getElementById('products-page-numbers').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) { this.productsPage = parseInt(btn.dataset.page); this.renderProductsTable(); }
    });

    // Delegate clicks on dynamically created elements (products grid, cart, tables)
    document.getElementById('products-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-product-id]');
      if (card) this.addToCart(parseInt(card.dataset.productId));
    });

    document.getElementById('cart-items').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const productId = parseInt(btn.dataset.productId);
      const action = btn.dataset.action;
      if (action === 'increment') {
        const item = this.cart.find(i => i.product_id === productId);
        if (item) this.updateCartQuantity(productId, item.quantity + 1);
      } else if (action === 'decrement') {
        const item = this.cart.find(i => i.product_id === productId);
        if (item) this.updateCartQuantity(productId, item.quantity - 1);
      } else if (action === 'remove') {
        this.removeFromCart(productId);
      }
    });

    document.getElementById('products-table-body').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit-product') this.editProduct(id);
      if (btn.dataset.action === 'delete-product') this.confirmDeleteProduct(id);
    });

    document.getElementById('customers-table-body').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit-customer') this.editCustomer(id);
      if (btn.dataset.action === 'delete-customer') this.confirmDeleteCustomer(id);
    });

    // Sales filter & pagination
    document.getElementById('btn-filter-sales').addEventListener('click', () => {
      this.salesDateFrom = document.getElementById('sales-date-from').value;
      this.salesDateTo = document.getElementById('sales-date-to').value;
      this.salesPage = 1;
      this.renderSalesTable();
    });
    document.getElementById('btn-clear-sales-filter').addEventListener('click', () => {
      document.getElementById('sales-date-from').value = '';
      document.getElementById('sales-date-to').value = '';
      this.salesDateFrom = '';
      this.salesDateTo = '';
      this.salesPage = 1;
      this.renderSalesTable();
    });
    document.getElementById('btn-sales-prev').addEventListener('click', () => {
      if (this.salesPage > 1) { this.salesPage--; this.renderSalesTable(); }
    });
    document.getElementById('btn-sales-next').addEventListener('click', () => {
      this.salesPage++; this.renderSalesTable();
    });
    document.getElementById('sales-page-numbers').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (btn) { this.salesPage = parseInt(btn.dataset.page); this.renderSalesTable(); }
    });
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
  switchView(viewName, e) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active', 'bg-primary-700');
    });
    if (e) {
      e.target.closest('.nav-item')?.classList.add('active', 'bg-primary-700');
    } else {
      // Fallback: find the nav button by data-view attribute
      const navBtn = document.querySelector(`.nav-item[data-view="${viewName}"]`);
      if (navBtn) navBtn.classList.add('active', 'bg-primary-700');
    }

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
      customers: { title: 'Customers', subtitle: 'Manage customer information' },
      forecasting: { title: 'Sales Forecasting', subtitle: 'Predictions & demand analysis' }
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
    } else if (viewName === 'forecasting') {
      this.loadForecasting();
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
        class="card cursor-pointer hover:shadow-lg transition-shadow ${product.stock <= 0 ? 'opacity-50' : ''}"
        data-product-id="${product.id}"
      >
        <div class="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
          ${product.image
            ? `<img src="${this.getProductImageUrl(product.image)}" alt="${this.escapeHtml(product.name)}" class="w-full h-full object-cover">`
            : `<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>`
          }
        </div>
        <h4 class="font-medium text-sm mb-1 truncate">${this.escapeHtml(product.name)}</h4>
        <p class="text-xs text-gray-500 mb-2">${this.escapeHtml(product.category || 'Uncategorized')}</p>
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-primary-600">${this.formatCurrency(product.price)}</span>
          <span class="text-xs ${product.stock > 10 ? 'text-green-600' : product.stock > 0 ? 'text-orange-600' : 'text-red-600'}">
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
            data-action="decrement" data-product-id="${item.product_id}"
            class="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >-</button>
          <span class="text-sm font-medium w-8 text-center">${item.quantity}</span>
          <button 
            data-action="increment" data-product-id="${item.product_id}"
            class="w-6 h-6 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >+</button>
          <button 
            data-action="remove" data-product-id="${item.product_id}"
            class="w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
          >×</button>
        </div>
      </div>
    `).join('');

    this.updateCartTotals();
  },

  updateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.total, 0);
    const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * this.taxRate * 100) / 100;
    const total = taxableAmount + tax;

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
    const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Math.round(taxableAmount * this.taxRate * 100) / 100;
    const total = taxableAmount + tax;
    const paymentMethod = document.getElementById('payment-method').value;
    const customerSelect = document.getElementById('sale-customer');
    const customerId = customerSelect.value ? parseInt(customerSelect.value) : null;
    const customerName = customerId
      ? customerSelect.options[customerSelect.selectedIndex].text
      : 'Walk-in';

    const saleItems = this.cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total
    }));

    const sale = {
      customer_id: customerId,
      total: total,
      subtotal: subtotal,
      tax: tax,
      discount: discount,
      payment_method: paymentMethod,
      items: saleItems
    };

    try {
      const savedSale = await window.api.addSale(sale);
      this.showNotification('Sale completed successfully!', 'success');

      // Show receipt
      this.showReceipt({
        id: savedSale.id,
        created_at: savedSale.created_at || new Date().toISOString(),
        customer_name: customerName,
        payment_method: paymentMethod,
        subtotal,
        discount,
        tax,
        total,
        items: this.cart.map(item => ({ ...item }))
      });

      this.clearCart();
      document.getElementById('cart-discount').value = '0';
      document.getElementById('sale-customer').value = '';
      await this.loadProducts();
      await this.loadSales();
      this.renderProducts();
      if (this.currentView === 'sales') {
        this.renderSalesTable();
      }
    } catch (error) {
      console.error('Error completing sale:', error);
      this.showNotification('Error completing sale', 'error');
    }
  },

  clearCart() {
    this.cart = [];
    this.renderCart();
  },

  // Populate customer dropdown in POS
  populateCustomerDropdown() {
    const select = document.getElementById('sale-customer');
    const current = select.value;
    select.innerHTML = '<option value="">Walk-in</option>' +
      this.customers.map(c =>
        `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`
      ).join('');
    select.value = current;
  },

  // ===== Receipt Modal =====
  showReceipt(data) {
    const content = document.getElementById('receipt-content');
    content.innerHTML = `
      <div class="text-center mb-4">
        <h2 class="text-xl font-bold">Café de Marcelino</h2>
        <p class="text-xs text-gray-500">Official Receipt</p>
      </div>
      <div class="text-sm space-y-1 mb-4">
        <div class="flex justify-between"><span class="text-gray-500">Receipt #</span><span class="font-medium">${data.id}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Date</span><span>${new Date(data.created_at).toLocaleString()}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Customer</span><span>${this.escapeHtml(data.customer_name)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Payment</span><span>${this.capitalize(data.payment_method)}</span></div>
      </div>
      <table class="w-full text-sm mb-4">
        <thead>
          <tr class="border-b border-dashed">
            <th class="text-left py-1">Item</th>
            <th class="text-center py-1">Qty</th>
            <th class="text-right py-1">Price</th>
            <th class="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr class="border-b border-gray-100">
              <td class="py-1">${this.escapeHtml(item.name)}</td>
              <td class="text-center py-1">${item.quantity}</td>
              <td class="text-right py-1">${this.formatCurrency(item.unit_price)}</td>
              <td class="text-right py-1">${this.formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="border-t border-dashed pt-2 space-y-1 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">Subtotal</span><span>${this.formatCurrency(data.subtotal)}</span></div>
        ${data.discount > 0 ? `<div class="flex justify-between text-red-600"><span>Discount</span><span>-${this.formatCurrency(data.discount)}</span></div>` : ''}
        <div class="flex justify-between"><span class="text-gray-500">VAT (12%)</span><span>${this.formatCurrency(data.tax)}</span></div>
        <div class="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Total</span><span>${this.formatCurrency(data.total)}</span></div>
      </div>
      <p class="text-center text-xs text-gray-400 mt-4">Thank you for your purchase!</p>
    `;
    document.getElementById('receipt-modal').classList.remove('hidden');
  },

  closeReceiptModal() {
    document.getElementById('receipt-modal').classList.add('hidden');
  },

  printReceipt() {
    const content = document.getElementById('receipt-content').innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; max-width: 360px; margin: 0 auto; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 0; text-align: left; }
        th:last-child, td:last-child, th:nth-child(3), td:nth-child(3) { text-align: right; }
        th:nth-child(2), td:nth-child(2) { text-align: center; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-xs { font-size: 11px; }
        .text-sm { font-size: 12px; }
        .text-base { font-size: 14px; }
        .text-xl { font-size: 18px; }
        .text-gray-400, .text-gray-500 { color: #888; }
        .text-red-600 { color: #dc2626; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .space-y-1 > * + * { margin-top: 4px; }
        .mb-4 { margin-bottom: 16px; }
        .mt-4 { margin-top: 16px; }
        .pt-1 { padding-top: 4px; }
        .pt-2 { padding-top: 8px; }
        .mt-1 { margin-top: 4px; }
        .py-1 { padding: 4px 0; }
        .border-b { border-bottom: 1px solid #ddd; }
        .border-t { border-top: 1px solid #ddd; }
        .border-dashed { border-style: dashed; }
        .border-gray-100 { border-color: #eee; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        @media print { body { padding: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  },

  // ===== Product Image Handling =====
  getProductImageUrl(image) {
    if (!image) return null;
    // If it's already a data URL (legacy), use it directly
    if (image.startsWith('data:')) return image;
    // Otherwise it's a filename — build file:// path
    return 'file://' + this.productImagesPath + '/' + image;
  },

  handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showNotification('Please select an image file', 'error');
      return;
    }

    // Limit to 2MB
    if (file.size > 2 * 1024 * 1024) {
      this.showNotification('Image must be under 2MB', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Store the data URL temporarily; will be saved to disk on form submit
      document.getElementById('product-image-data').value = dataUrl;
      const preview = document.getElementById('product-image-preview');
      preview.innerHTML = `<img src="${dataUrl}" class="w-full h-full object-cover">`;
      document.getElementById('btn-remove-product-image').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },

  removeProductImage() {
    document.getElementById('product-image-data').value = '__REMOVE__';
    document.getElementById('product-image-input').value = '';
    this.setProductImagePreview(null);
  },

  setProductImagePreview(imageValue) {
    const preview = document.getElementById('product-image-preview');
    const removeBtn = document.getElementById('btn-remove-product-image');
    const url = imageValue ? this.getProductImageUrl(imageValue) : null;
    if (url) {
      preview.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
      removeBtn.classList.remove('hidden');
    } else {
      preview.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
      removeBtn.classList.add('hidden');
    }
  },

  // Products table
  renderProductsTable() {
    const tbody = document.getElementById('products-table-body');

    // Filter by search term
    let filtered = this.products;
    if (this.productsSearch) {
      const q = this.productsSearch.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.productsPerPage));
    if (this.productsPage > totalPages) this.productsPage = totalPages;

    const start = (this.productsPage - 1) * this.productsPerPage;
    const pageItems = filtered.slice(start, start + this.productsPerPage);

    if (totalItems === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No products found</td></tr>';
    } else {
      tbody.innerHTML = pageItems.map(product => `
        <tr class="table-row">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                ${product.image
                  ? `<img src="${this.getProductImageUrl(product.image)}" class="w-full h-full object-cover">`
                  : `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>`
                }
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">${this.escapeHtml(product.name)}</div>
                <div class="text-sm text-gray-500">${this.escapeHtml(product.description || '')}</div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500">${this.escapeHtml(product.sku || '-')}</td>
          <td class="px-6 py-4 text-sm text-gray-500">${this.escapeHtml(product.category || '-')}</td>
          <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.formatCurrency(product.price)}</td>
          <td class="px-6 py-4">
            <span class="badge ${product.stock > 10 ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'}">
              ${product.stock}
            </span>
          </td>
          <td class="px-6 py-4 text-sm space-x-2">
            <button data-action="edit-product" data-id="${product.id}" class="text-primary-600 hover:text-primary-900">Edit</button>
            <button data-action="delete-product" data-id="${product.id}" class="text-red-600 hover:text-red-900">Delete</button>
          </td>
        </tr>
      `).join('');
    }

    // Pagination info
    const infoEl = document.getElementById('products-pagination-info');
    if (totalItems === 0) {
      infoEl.textContent = '0 results';
    } else {
      infoEl.textContent = `Showing ${start + 1}\u2013${Math.min(start + this.productsPerPage, totalItems)} of ${totalItems}`;
    }

    // Prev / Next buttons
    document.getElementById('btn-products-prev').disabled = this.productsPage <= 1;
    document.getElementById('btn-products-next').disabled = this.productsPage >= totalPages;

    // Page number buttons
    const pageNums = document.getElementById('products-page-numbers');
    let pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.productsPage - 1 && i <= this.productsPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    pageNums.innerHTML = pages.map(p => {
      if (p === '...') return '<span class="text-gray-400 text-sm px-1">\u2026</span>';
      const active = p === this.productsPage;
      return `<button data-page="${p}" class="px-2.5 py-1 text-sm rounded ${active ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">${p}</button>`;
    }).join('');
  },

  // Sales table with date filter and pagination
  renderSalesTable() {
    const tbody = document.getElementById('sales-table-body');

    // Filter by date
    let filtered = this.sales;
    if (this.salesDateFrom) {
      const from = new Date(this.salesDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => new Date(s.created_at) >= from);
    }
    if (this.salesDateTo) {
      const to = new Date(this.salesDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.created_at) <= to);
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / this.salesPerPage));
    if (this.salesPage > totalPages) this.salesPage = totalPages;

    const start = (this.salesPage - 1) * this.salesPerPage;
    const pageItems = filtered.slice(start, start + this.salesPerPage);

    if (totalItems === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No sales found</td></tr>';
    } else {
      tbody.innerHTML = pageItems.map(sale => `
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
    }

    // Pagination info
    const infoEl = document.getElementById('sales-pagination-info');
    if (totalItems === 0) {
      infoEl.textContent = '0 results';
    } else {
      infoEl.textContent = `Showing ${start + 1}–${Math.min(start + this.salesPerPage, totalItems)} of ${totalItems}`;
    }

    // Prev / Next buttons
    document.getElementById('btn-sales-prev').disabled = this.salesPage <= 1;
    document.getElementById('btn-sales-next').disabled = this.salesPage >= totalPages;

    // Page number buttons
    const pageNums = document.getElementById('sales-page-numbers');
    let pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.salesPage - 1 && i <= this.salesPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    pageNums.innerHTML = pages.map(p => {
      if (p === '...') return '<span class="text-gray-400 text-sm px-1">…</span>';
      const active = p === this.salesPage;
      return `<button data-page="${p}" class="px-2.5 py-1 text-sm rounded ${active ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">${p}</button>`;
    }).join('');
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
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.escapeHtml(customer.name)}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${this.escapeHtml(customer.email || '-')}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${this.escapeHtml(customer.phone || '-')}</td>
        <td class="px-6 py-4 text-sm text-gray-500">${this.escapeHtml(customer.city || '-')}</td>
        <td class="px-6 py-4 text-sm space-x-2">
          <button data-action="edit-customer" data-id="${customer.id}" class="text-primary-600 hover:text-primary-900">Edit</button>
          <button data-action="delete-customer" data-id="${customer.id}" class="text-red-600 hover:text-red-900">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  // ===== Product Modal =====
  showProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    form.reset();
    document.getElementById('product-image-input').value = '';
    document.getElementById('product-image-data').value = '';

    if (productId) {
      const product = this.products.find(p => p.id === productId);
      if (!product) return;
      title.textContent = 'Edit Product';
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-sku').value = product.sku || '';
      document.getElementById('product-barcode').value = product.barcode || '';
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-cost').value = product.cost || '';
      document.getElementById('product-stock').value = product.stock;
      document.getElementById('product-category').value = product.category || '';
      document.getElementById('product-description').value = product.description || '';
      // Load image preview
      this.setProductImagePreview(product.image || null);
      document.getElementById('product-image-data').value = product.image || '';
    } else {
      title.textContent = 'Add Product';
      document.getElementById('product-id').value = '';
      this.setProductImagePreview(null);
      document.getElementById('product-image-data').value = '';
    }

    modal.classList.remove('hidden');
  },

  closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
  },

  async saveProduct(event) {
    event.preventDefault();
    const id = document.getElementById('product-id').value;
    const imageDataValue = document.getElementById('product-image-data').value;

    // Handle image: save to disk or remove
    let imageFileName = null;
    if (imageDataValue === '__REMOVE__') {
      // User wants to remove image — delete old file if editing
      if (id) {
        const oldProduct = this.products.find(p => p.id === parseInt(id));
        if (oldProduct && oldProduct.image) {
          await window.api.deleteProductImage(oldProduct.image);
        }
      }
      imageFileName = null;
    } else if (imageDataValue && imageDataValue.startsWith('data:')) {
      // New image uploaded — save to disk
      const ext = imageDataValue.match(/^data:image\/(\\w+);/)?.[1] || 'png';
      const fileName = `product_${Date.now()}.${ext}`;
      await window.api.saveProductImage({ fileName, dataUrl: imageDataValue });
      imageFileName = fileName;
      // Delete old image file if editing
      if (id) {
        const oldProduct = this.products.find(p => p.id === parseInt(id));
        if (oldProduct && oldProduct.image && oldProduct.image !== imageFileName) {
          await window.api.deleteProductImage(oldProduct.image);
        }
      }
    } else if (id) {
      // No change — keep existing image
      const oldProduct = this.products.find(p => p.id === parseInt(id));
      imageFileName = oldProduct?.image || null;
    }

    const product = {
      name: document.getElementById('product-name').value.trim(),
      sku: document.getElementById('product-sku').value.trim() || null,
      barcode: document.getElementById('product-barcode').value.trim() || null,
      price: parseFloat(document.getElementById('product-price').value),
      cost: parseFloat(document.getElementById('product-cost').value) || null,
      stock: parseInt(document.getElementById('product-stock').value) || 0,
      category: document.getElementById('product-category').value.trim() || null,
      description: document.getElementById('product-description').value.trim() || null,
      image: imageFileName
    };

    try {
      if (id) {
        await window.api.updateProduct(parseInt(id), product);
        this.showNotification('Product updated successfully!', 'success');
      } else {
        await window.api.addProduct(product);
        this.showNotification('Product added successfully!', 'success');
      }
      this.closeProductModal();
      await this.loadProducts();
      this.renderProductsTable();
      this.renderProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      this.showNotification('Error saving product', 'error');
    }
  },

  editProduct(id) {
    this.showProductModal(id);
  },

  confirmDeleteProduct(id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;
    document.getElementById('confirm-message').textContent = 
      `Are you sure you want to delete "${product.name}"?`;
    const deleteBtn = document.getElementById('confirm-delete-btn');
    deleteBtn.onclick = () => this.deleteProduct(id);
    document.getElementById('confirm-modal').classList.remove('hidden');
  },

  async deleteProduct(id) {
    try {
      await window.api.deleteProduct(id);
      this.showNotification('Product deleted successfully!', 'success');
      this.closeConfirmModal();
      await this.loadProducts();
      this.renderProductsTable();
      this.renderProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      this.showNotification('Error deleting product', 'error');
    }
  },

  // ===== Customer Modal =====
  showCustomerModal(customerId = null) {
    const modal = document.getElementById('customer-modal');
    const title = document.getElementById('customer-modal-title');
    const form = document.getElementById('customer-form');
    form.reset();

    if (customerId) {
      const customer = this.customers.find(c => c.id === customerId);
      if (!customer) return;
      title.textContent = 'Edit Customer';
      document.getElementById('customer-id').value = customer.id;
      document.getElementById('customer-name').value = customer.name;
      document.getElementById('customer-email').value = customer.email || '';
      document.getElementById('customer-phone').value = customer.phone || '';
      document.getElementById('customer-city').value = customer.city || '';
      document.getElementById('customer-address').value = customer.address || '';
    } else {
      title.textContent = 'Add Customer';
      document.getElementById('customer-id').value = '';
    }

    modal.classList.remove('hidden');
  },

  closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
  },

  async saveCustomer(event) {
    event.preventDefault();
    const id = document.getElementById('customer-id').value;
    const customer = {
      name: document.getElementById('customer-name').value.trim(),
      email: document.getElementById('customer-email').value.trim() || null,
      phone: document.getElementById('customer-phone').value.trim() || null,
      city: document.getElementById('customer-city').value.trim() || null,
      address: document.getElementById('customer-address').value.trim() || null
    };

    try {
      if (id) {
        await window.api.updateCustomer(parseInt(id), customer);
        this.showNotification('Customer updated successfully!', 'success');
      } else {
        await window.api.addCustomer(customer);
        this.showNotification('Customer added successfully!', 'success');
      }
      this.closeCustomerModal();
      await this.loadCustomers();
      this.renderCustomersTable();
      this.populateCustomerDropdown();
    } catch (error) {
      console.error('Error saving customer:', error);
      this.showNotification('Error saving customer', 'error');
    }
  },

  editCustomer(id) {
    this.showCustomerModal(id);
  },

  confirmDeleteCustomer(id) {
    const customer = this.customers.find(c => c.id === id);
    if (!customer) return;
    document.getElementById('confirm-message').textContent = 
      `Are you sure you want to delete customer "${customer.name}"?`;
    const deleteBtn = document.getElementById('confirm-delete-btn');
    deleteBtn.onclick = () => this.deleteCustomer(id);
    document.getElementById('confirm-modal').classList.remove('hidden');
  },

  async deleteCustomer(id) {
    try {
      await window.api.deleteCustomer(id);
      this.showNotification('Customer deleted successfully!', 'success');
      this.closeConfirmModal();
      await this.loadCustomers();
      this.renderCustomersTable();
      this.populateCustomerDropdown();
    } catch (error) {
      console.error('Error deleting customer:', error);
      this.showNotification('Error deleting customer', 'error');
    }
  },

  closeConfirmModal() {
    document.getElementById('confirm-modal').classList.add('hidden');
  },

  // ===== Forecasting =====
  async loadForecasting() {
    try {
      const data = await window.api.getForecastData();
      this.renderForecastSummary(data.forecast);
      this.renderForecastChart(data.dailySales, data.forecast.predicted);
      this.renderDOWChart(data.dayOfWeekPattern);
      this.renderWeeklyChart(data.weeklySales);
      this.renderProductForecastTable(data.productForecasts);
      this.renderRestockAlerts(data.productForecasts);
    } catch (error) {
      console.error('Error loading forecast data:', error);
      this.showNotification('Error loading forecast data', 'error');
    }
  },

  renderForecastSummary(forecast) {
    document.getElementById('forecast-7day').textContent = this.formatCurrency(forecast.next7DayTotal);
    document.getElementById('forecast-14day').textContent = this.formatCurrency(forecast.next14DayTotal);
    
    const trendEl = document.getElementById('forecast-trend');
    const trend = forecast.weeklyTrend;
    trendEl.textContent = (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%';
    trendEl.className = `text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`;

    const confEl = document.getElementById('forecast-confidence');
    const confColors = { high: 'text-green-600', medium: 'text-yellow-600', low: 'text-red-600' };
    confEl.textContent = this.capitalize(forecast.confidence);
    confEl.className = `text-2xl font-bold ${confColors[forecast.confidence] || 'text-gray-800'}`;
  },

  // Canvas line chart for daily sales + predictions
  renderForecastChart(dailySales, predicted) {
    const canvas = document.getElementById('forecast-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    // Use last 30 days of actual data + 14 predicted
    const recent = dailySales.slice(-30);
    const allPoints = [
      ...recent.map(d => ({ date: d.date, value: d.revenue, type: 'actual' })),
      ...predicted.map(d => ({ date: d.date, value: d.revenue, type: 'predicted' }))
    ];

    if (allPoints.length === 0) return;

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const maxVal = Math.max(...allPoints.map(p => p.value)) * 1.1;
    const minVal = 0;

    const xScale = (i) => padding.left + (i / (allPoints.length - 1)) * chartW;
    const yScale = (v) => padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    // Grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (i / gridLines) * chartH;
      const val = maxVal - (i / gridLines) * (maxVal - minVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('₱' + Math.round(val), padding.left - 8, y + 4);
    }

    // Divider line between actual and predicted
    const splitIndex = recent.length - 1;
    if (splitIndex >= 0 && splitIndex < allPoints.length) {
      const splitX = xScale(splitIndex);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(splitX, padding.top);
      ctx.lineTo(splitX, padding.top + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Today', splitX, padding.top + chartH + 30);
    }

    // Draw actual line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= splitIndex && i < allPoints.length; i++) {
      const x = xScale(i);
      const y = yScale(allPoints[i].value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under actual
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(0));
    for (let i = 0; i <= splitIndex && i < allPoints.length; i++) {
      ctx.lineTo(xScale(i), yScale(allPoints[i].value));
    }
    ctx.lineTo(xScale(splitIndex), yScale(0));
    ctx.closePath();
    ctx.fill();

    // Draw predicted line (dashed)
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    for (let i = splitIndex; i < allPoints.length; i++) {
      const x = xScale(i);
      const y = yScale(allPoints[i].value);
      if (i === splitIndex) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill under predicted
    ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
    ctx.beginPath();
    ctx.moveTo(xScale(splitIndex), yScale(0));
    for (let i = splitIndex; i < allPoints.length; i++) {
      ctx.lineTo(xScale(i), yScale(allPoints[i].value));
    }
    ctx.lineTo(xScale(allPoints.length - 1), yScale(0));
    ctx.closePath();
    ctx.fill();

    // Trend line (linear regression across all actual data)
    if (recent.length >= 2) {
      const n = recent.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += i; sy += recent[i].revenue; sxy += i * recent[i].revenue; sx2 += i * i;
      }
      const sl = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
      const ic = (sy - sl * sx) / n;

      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xScale(0), yScale(ic));
      ctx.lineTo(xScale(splitIndex), yScale(ic + sl * splitIndex));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X-axis labels (show every 5th date)
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i < allPoints.length; i += 5) {
      const label = allPoints[i].date.slice(5); // MM-DD
      ctx.fillText(label, xScale(i), padding.top + chartH + 16);
    }

    // Data points
    for (let i = 0; i < allPoints.length; i++) {
      const x = xScale(i);
      const y = yScale(allPoints[i].value);
      ctx.fillStyle = allPoints[i].type === 'actual' ? '#3b82f6' : '#f97316';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Bar chart for day-of-week pattern
  renderDOWChart(dowData) {
    const canvas = document.getElementById('dow-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const padding = { top: 15, right: 15, bottom: 30, left: 55 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    // Ensure all 7 days have data
    const values = dayNames.map((_, i) => {
      const found = dowData.find(d => d.day_of_week === i);
      return found ? found.revenue : 0;
    });
    const maxVal = Math.max(...values) * 1.15 || 1;

    const barW = chartW / 7 * 0.6;
    const gap = chartW / 7;

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      const val = maxVal - (i / 4) * maxVal;
      ctx.fillText('₱' + Math.round(val), padding.left - 6, y + 4);
    }

    // Bars
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 7; i++) {
      const x = padding.left + i * gap + (gap - barW) / 2;
      const barH = (values[i] / maxVal) * chartH;
      const y = padding.top + chartH - barH;

      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Label
      ctx.fillStyle = '#374151';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(dayNames[i], x + barW / 2, padding.top + chartH + 18);
    }
  },

  // Bar chart for weekly revenue
  renderWeeklyChart(weeklySales) {
    const canvas = document.getElementById('weekly-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    if (weeklySales.length === 0) return;

    const padding = { top: 15, right: 15, bottom: 30, left: 55 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const values = weeklySales.map(w => w.revenue);
    const maxVal = Math.max(...values) * 1.15 || 1;
    const count = values.length;
    const gap = chartW / count;
    const barW = gap * 0.65;

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      const val = maxVal - (i / 4) * maxVal;
      ctx.fillText('₱' + Math.round(val), padding.left - 6, y + 4);
    }

    // Bars with gradient
    for (let i = 0; i < count; i++) {
      const x = padding.left + i * gap + (gap - barW) / 2;
      const barH = (values[i] / maxVal) * chartH;
      const y = padding.top + chartH - barH;

      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, '#3b82f6');
      grad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Week label
      ctx.fillStyle = '#374151';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      const label = 'W' + (i + 1);
      ctx.fillText(label, x + barW / 2, padding.top + chartH + 16);
    }
  },

  // Product demand forecast table
  renderProductForecastTable(forecasts) {
    const tbody = document.getElementById('product-forecast-body');
    if (!forecasts || forecasts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-4 text-center text-gray-500">No forecast data</td></tr>';
      return;
    }

    tbody.innerHTML = forecasts.map(p => {
      const stockoutClass = p.needs_restock ? 'bg-red-50' : '';
      const stockoutBadge = p.days_until_stockout !== null
        ? `<span class="badge ${p.days_until_stockout <= 7 ? 'badge-danger' : p.days_until_stockout <= 14 ? 'badge-warning' : 'badge-success'}">${p.days_until_stockout} days</span>`
        : '<span class="text-gray-400">N/A</span>';

      return `
        <tr class="table-row ${stockoutClass}">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-gray-900">${this.escapeHtml(p.name)}</div>
            <div class="text-xs text-gray-500">${this.escapeHtml(p.category || '')}</div>
          </td>
          <td class="px-4 py-3">
            <span class="badge ${p.stock > 50 ? 'badge-success' : p.stock > 20 ? 'badge-warning' : 'badge-danger'}">${p.stock}</span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-700">${p.daily_velocity} /day</td>
          <td class="px-4 py-3 text-sm text-gray-700">${Math.ceil(p.predicted_demand_7d)} units</td>
          <td class="px-4 py-3 text-sm text-gray-700">${Math.ceil(p.predicted_demand_14d)} units</td>
          <td class="px-4 py-3">${stockoutBadge}</td>
        </tr>
      `;
    }).join('');
  },

  // Restock alerts panel
  renderRestockAlerts(forecasts) {
    const container = document.getElementById('restock-alerts');
    const alerts = forecasts.filter(p => p.needs_restock);

    if (alerts.length === 0) {
      container.innerHTML = '<div class="text-center py-6"><p class="text-green-600 font-medium">All products stocked well</p><p class="text-gray-500 text-xs mt-1">No restocking needed in the next 14 days</p></div>';
      return;
    }

    container.innerHTML = alerts.map(p => `
      <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-sm font-medium text-red-800">${this.escapeHtml(p.name)}</p>
            <p class="text-xs text-red-600 mt-1">
              ${p.days_until_stockout} days until stockout
            </p>
          </div>
          <span class="badge badge-danger text-xs">${p.stock} left</span>
        </div>
        <div class="mt-2 text-xs text-red-700">
          Selling ~${p.daily_velocity}/day &middot; Need ~${Math.ceil(p.predicted_demand_14d)} for next 14 days
        </div>
      </div>
    `).join('');
  },

  // Utility functions
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  },

  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
