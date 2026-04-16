const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class POSDatabase {
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'pos.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  initialize() {
    // Create tables
    this.createTables();
    // Insert sample data if tables are empty
    this.insertSampleData();
  }

  createTables() {
    // Products table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        description TEXT,
        price REAL NOT NULL,
        cost REAL,
        stock INTEGER DEFAULT 0,
        category TEXT,
        barcode TEXT,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        city TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sales table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        total REAL NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        payment_method TEXT,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )
    `);

    // Sale items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    `);
  }

  insertSampleData() {
    const productCount = this.db.prepare('SELECT COUNT(*) as count FROM products').get();
    
    if (productCount.count === 0) {
      const insert = this.db.prepare(`
        INSERT INTO products (name, sku, description, price, cost, stock, category, barcode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = this.db.transaction((products) => {
        for (const product of products) insert.run(...product);
      });

      insertMany([
        ['Wireless Mouse', 'SKU-001', 'Ergonomic wireless mouse', 29.99, 15.00, 120, 'Electronics', '1234567890123'],
        ['USB-C Hub', 'SKU-002', '7-in-1 USB-C adapter', 49.99, 25.00, 80, 'Electronics', '1234567890124'],
        ['Phone Case', 'SKU-003', 'Protective silicone case', 19.99, 8.00, 200, 'Accessories', '1234567890125'],
        ['Wireless Charger', 'SKU-004', '15W fast wireless charger', 34.99, 18.00, 90, 'Electronics', '1234567890126'],
        ['Screen Protector', 'SKU-005', 'Tempered glass protector', 12.99, 4.00, 300, 'Accessories', '1234567890127'],
        ['Bluetooth Speaker', 'SKU-006', 'Portable mini speaker', 39.99, 20.00, 60, 'Electronics', '1234567890128'],
        ['Laptop Stand', 'SKU-007', 'Adjustable aluminum stand', 59.99, 30.00, 45, 'Accessories', '1234567890129'],
        ['Webcam HD', 'SKU-008', '1080p HD webcam', 44.99, 22.00, 70, 'Electronics', '1234567890130']
      ]);
    }

    // Generate dummy historical sales if none exist
    const salesCount = this.db.prepare('SELECT COUNT(*) as count FROM sales').get();
    if (salesCount.count === 0) {
      this.generateDummySales();
    }
  }

  generateDummySales() {
    const products = this.db.prepare('SELECT * FROM products').all();
    if (products.length === 0) return;

    const paymentMethods = ['cash', 'card', 'mobile'];
    const now = new Date();

    const insertSale = this.db.prepare(`
      INSERT INTO sales (customer_id, total, subtotal, tax, discount, payment_method, status, created_at)
      VALUES (?, ?, ?, ?, 0, ?, 'completed', ?)
    `);
    const insertItem = this.db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?)
    `);

    const generateSales = this.db.transaction(() => {
      // Generate 12 weeks (84 days) of sales data
      for (let daysAgo = 84; daysAgo >= 0; daysAgo--) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

        // More sales on weekends, fewer early in the week
        let baseSalesCount;
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          baseSalesCount = 6 + Math.floor(Math.random() * 5); // 6-10
        } else if (dayOfWeek === 5) {
          baseSalesCount = 5 + Math.floor(Math.random() * 4); // 5-8
        } else {
          baseSalesCount = 3 + Math.floor(Math.random() * 4); // 3-6
        }

        // Add a slight upward trend over time (growth)
        const weekNumber = Math.floor((84 - daysAgo) / 7);
        const trendMultiplier = 1 + (weekNumber * 0.03); // 3% growth per week
        const salesCount = Math.round(baseSalesCount * trendMultiplier);

        for (let s = 0; s < salesCount; s++) {
          // Random time during business hours (9am-8pm)
          const hour = 9 + Math.floor(Math.random() * 11);
          const minute = Math.floor(Math.random() * 60);
          date.setHours(hour, minute, Math.floor(Math.random() * 60));
          const dateStr = date.toISOString().replace('T', ' ').split('.')[0];

          // Pick 1-4 products for this sale
          const itemCount = 1 + Math.floor(Math.random() * 3);
          const selectedProducts = [];
          for (let i = 0; i < itemCount; i++) {
            const prod = products[Math.floor(Math.random() * products.length)];
            if (!selectedProducts.find(p => p.id === prod.id)) {
              selectedProducts.push(prod);
            }
          }

          let subtotal = 0;
          const items = selectedProducts.map(prod => {
            const qty = 1 + Math.floor(Math.random() * 3);
            const itemTotal = prod.price * qty;
            subtotal += itemTotal;
            return { product_id: prod.id, quantity: qty, unit_price: prod.price, total: itemTotal };
          });

          const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
          const total = Math.round((subtotal + tax) * 100) / 100;
          const payment = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

          const result = insertSale.run(null, total, subtotal, tax, payment, dateStr);
          const saleId = result.lastInsertRowid;

          for (const item of items) {
            insertItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.total);
          }
        }
      }
    });

    generateSales();
  }

  // Product operations
  getProducts() {
    return this.db.prepare('SELECT * FROM products ORDER BY name').all();
  }

  addProduct(product) {
    const stmt = this.db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, stock, category, barcode, image)
      VALUES (@name, @sku, @description, @price, @cost, @stock, @category, @barcode, @image)
    `);
    const result = stmt.run(product);
    return { id: result.lastInsertRowid, ...product };
  }

  updateProduct(id, product) {
    const stmt = this.db.prepare(`
      UPDATE products
      SET name = @name, sku = @sku, description = @description, 
          price = @price, cost = @cost, stock = @stock, 
          category = @category, barcode = @barcode, image = @image, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    stmt.run({ id, ...product });
    return { id, ...product };
  }

  deleteProduct(id) {
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run(id);
    return { success: true };
  }

  // Customer operations
  getCustomers() {
    return this.db.prepare('SELECT * FROM customers ORDER BY name').all();
  }

  addCustomer(customer) {
    const stmt = this.db.prepare(`
      INSERT INTO customers (name, email, phone, address, city)
      VALUES (@name, @email, @phone, @address, @city)
    `);
    const result = stmt.run(customer);
    return { id: result.lastInsertRowid, ...customer };
  }

  updateCustomer(id, customer) {
    const stmt = this.db.prepare(`
      UPDATE customers
      SET name = @name, email = @email, phone = @phone, 
          address = @address, city = @city, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    stmt.run({ id, ...customer });
    return { id, ...customer };
  }

  deleteCustomer(id) {
    const stmt = this.db.prepare('DELETE FROM customers WHERE id = ?');
    stmt.run(id);
    return { success: true };
  }

  // Sales operations
  getSales(filters = {}) {
    let query = `
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
    `;
    
    const conditions = [];
    const params = {};

    if (filters.startDate) {
      conditions.push('s.created_at >= @startDate');
      params.startDate = filters.startDate;
    }

    if (filters.endDate) {
      conditions.push('s.created_at <= @endDate');
      params.endDate = filters.endDate;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.created_at DESC';

    return this.db.prepare(query).all(params);
  }

  addSale(sale) {
    const addSaleTransaction = this.db.transaction((saleData) => {
      // Insert sale
      const saleStmt = this.db.prepare(`
        INSERT INTO sales (customer_id, total, subtotal, tax, discount, payment_method, notes)
        VALUES (@customer_id, @total, @subtotal, @tax, @discount, @payment_method, @notes)
      `);
      
      const result = saleStmt.run({
        customer_id: saleData.customer_id || null,
        total: saleData.total,
        subtotal: saleData.subtotal,
        tax: saleData.tax || 0,
        discount: saleData.discount || 0,
        payment_method: saleData.payment_method,
        notes: saleData.notes || ''
      });

      const saleId = result.lastInsertRowid;

      // Insert sale items
      const itemStmt = this.db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?)
      `);

      // Update product stock
      const updateStockStmt = this.db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `);

      for (const item of saleData.items) {
        itemStmt.run(saleId, item.product_id, item.quantity, item.unit_price, item.total);
        updateStockStmt.run(item.quantity, item.product_id);
      }

      return saleId;
    });

    const saleId = addSaleTransaction(sale);
    return this.getSaleById(saleId);
  }

  getSaleById(id) {
    const sale = this.db.prepare(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `).get(id);

    if (sale) {
      sale.items = this.db.prepare(`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(id);
    }

    return sale;
  }

  // Statistics
  getStatistics(dateRange = {}) {
    const today = new Date().toISOString().split('T')[0];
    const startDate = dateRange.startDate || today;
    const endDate = dateRange.endDate || today;

    const stats = {
      totalSales: 0,
      totalRevenue: 0,
      totalTransactions: 0,
      averageTransaction: 0,
      topProducts: [],
      recentSales: []
    };

    // Total revenue and transactions
    const salesData = this.db.prepare(`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM sales
      WHERE DATE(created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    stats.totalTransactions = salesData.count || 0;
    stats.totalRevenue = salesData.revenue || 0;
    stats.averageTransaction = stats.totalTransactions > 0 
      ? stats.totalRevenue / stats.totalTransactions 
      : 0;

    // Top products
    stats.topProducts = this.db.prepare(`
      SELECT p.name, SUM(si.quantity) as quantity, SUM(si.total) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      GROUP BY si.product_id
      ORDER BY revenue DESC
      LIMIT 5
    `).all(startDate, endDate);

    // Recent sales
    stats.recentSales = this.db.prepare(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      ORDER BY s.created_at DESC
      LIMIT 10
    `).all(startDate, endDate);

    return stats;
  }

  close() {
    this.db.close();
  }

  // ===== Forecasting Methods =====

  // Get daily sales aggregates for the last N days
  getDailySales(days = 84) {
    return this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(total) as revenue,
        SUM(subtotal) as subtotal,
        AVG(total) as avg_transaction
      FROM sales 
      WHERE DATE(created_at) >= DATE('now', ?)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(`-${days} days`);
  }

  // Get weekly sales aggregates
  getWeeklySales(weeks = 12) {
    return this.db.prepare(`
      SELECT 
        strftime('%Y-W%W', created_at) as week_label,
        MIN(DATE(created_at)) as week_start,
        COUNT(*) as transactions,
        SUM(total) as revenue,
        AVG(total) as avg_transaction
      FROM sales
      WHERE DATE(created_at) >= DATE('now', ?)
      GROUP BY strftime('%Y-%W', created_at)
      ORDER BY week_start ASC
    `).all(`-${weeks * 7} days`);
  }

  // Get product-level sales velocity (units per day)
  getProductSalesVelocity(days = 28) {
    return this.db.prepare(`
      SELECT
        p.id as product_id,
        p.name,
        p.stock,
        p.price,
        p.category,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        ROUND(CAST(COALESCE(SUM(si.quantity), 0) AS REAL) / ?, 2) as daily_velocity,
        COALESCE(SUM(si.total), 0) as total_revenue
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND DATE(s.created_at) >= DATE('now', ?)
      GROUP BY p.id
      ORDER BY total_sold DESC
    `).all(days, `-${days} days`);
  }

  // Get daily sales for a specific product
  getProductDailySales(productId, days = 84) {
    return this.db.prepare(`
      SELECT 
        DATE(s.created_at) as date,
        SUM(si.quantity) as quantity,
        SUM(si.total) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.product_id = ? AND DATE(s.created_at) >= DATE('now', ?)
      GROUP BY DATE(s.created_at)
      ORDER BY date ASC
    `).all(productId, `-${days} days`);
  }

  // Get day-of-week patterns
  getDayOfWeekPattern() {
    return this.db.prepare(`
      SELECT 
        CAST(strftime('%w', created_at) AS INTEGER) as day_of_week,
        COUNT(*) as transactions,
        SUM(total) as revenue,
        AVG(total) as avg_revenue
      FROM sales
      WHERE DATE(created_at) >= DATE('now', '-84 days')
      GROUP BY strftime('%w', created_at)
      ORDER BY day_of_week
    `).all();
  }

  // Get forecast data bundle (all data needed for predictions)
  getForecastData() {
    const dailySales = this.getDailySales(84);
    const weeklySales = this.getWeeklySales(12);
    const productVelocity = this.getProductSalesVelocity(28);
    const dayOfWeekPattern = this.getDayOfWeekPattern();

    // Compute forecasts
    const forecast = this.computeForecast(dailySales, weeklySales, dayOfWeekPattern);
    const productForecasts = this.computeProductForecasts(productVelocity);

    return {
      dailySales,
      weeklySales,
      dayOfWeekPattern,
      productVelocity,
      forecast,
      productForecasts
    };
  }

  // Weighted Moving Average forecast
  computeForecast(dailySales, weeklySales, dayOfWeekPattern) {
    if (dailySales.length < 7) {
      return { predicted: [], trend: 0, confidence: 'low', method: 'insufficient-data' };
    }

    const n = dailySales.length;
    const values = dailySales.map(d => d.revenue);

    // === Holt's Double Exponential Smoothing ===
    // Level smoothing: α (alpha) — reacts to recent level changes
    // Trend smoothing: β (beta) — reacts to recent trend changes
    const alpha = 0.3;  // level smoothing factor
    const beta = 0.15;  // trend smoothing factor

    // Initialize: level = first value, trend = avg of first 7-day differences
    let level = values[0];
    let trend = 0;
    const initPeriod = Math.min(7, n - 1);
    for (let i = 0; i < initPeriod; i++) {
      trend += (values[i + 1] - values[i]);
    }
    trend /= initPeriod;

    // Run Holt's method through all historical data
    const smoothed = [level];
    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      const prevTrend = trend;
      // Update level: S_t = α * Y_t + (1 - α) * (S_{t-1} + T_{t-1})
      level = alpha * values[i] + (1 - alpha) * (prevLevel + prevTrend);
      // Update trend: T_t = β * (S_t - S_{t-1}) + (1 - β) * T_{t-1}
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
      smoothed.push(level);
    }

    // Day-of-week seasonal multipliers
    const overallAvg = values.reduce((s, v) => s + v, 0) / n;
    const dowMultipliers = {};
    for (const dow of dayOfWeekPattern) {
      const avgForDay = dow.revenue / (Math.ceil(n / 7) || 1);
      dowMultipliers[dow.day_of_week] = overallAvg > 0 ? avgForDay / overallAvg : 1;
    }

    // Forecast: F_{t+h} = S_t + h * T_t (adjusted by day-of-week)
    const predicted = [];
    const today = new Date();
    for (let h = 1; h <= 14; h++) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + h);
      const dow = futureDate.getDay();
      const dowMult = dowMultipliers[dow] || 1;

      const baseValue = level + h * trend;
      const prediction = Math.max(0, baseValue * dowMult);

      predicted.push({
        date: futureDate.toISOString().split('T')[0],
        revenue: Math.round(prediction * 100) / 100,
        dayOfWeek: dow
      });
    }

    // Weekly trend percentage
    const weeklyTrend = weeklySales.length >= 2
      ? ((weeklySales[weeklySales.length - 1].revenue - weeklySales[weeklySales.length - 2].revenue) 
         / (weeklySales[weeklySales.length - 2].revenue || 1)) * 100
      : 0;

    const confidence = n >= 56 ? 'high' : n >= 28 ? 'medium' : 'low';
    const dailyTrend = trend;

    // Weighted daily avg for reference
    const recentDays = dailySales.slice(-28);
    const weightedDailyAvg = recentDays.reduce((s, d) => s + d.revenue, 0) / (recentDays.length || 1);

    return {
      predicted,
      dailyTrend: Math.round(dailyTrend * 100) / 100,
      weeklyTrend: Math.round(weeklyTrend * 100) / 100,
      weightedDailyAvg: Math.round(weightedDailyAvg * 100) / 100,
      next7DayTotal: Math.round(predicted.slice(0, 7).reduce((s, p) => s + p.revenue, 0) * 100) / 100,
      next14DayTotal: Math.round(predicted.reduce((s, p) => s + p.revenue, 0) * 100) / 100,
      confidence,
      method: 'holt-exponential-smoothing',
      parameters: { alpha, beta },
      finalLevel: Math.round(level * 100) / 100,
      finalTrend: Math.round(trend * 100) / 100
    };
  }

  // Product-level demand forecasting
  computeProductForecasts(productVelocity) {
    return productVelocity.map(p => {
      const dailyRate = p.daily_velocity;
      const predicted7Day = Math.round(dailyRate * 7 * 100) / 100;
      const predicted14Day = Math.round(dailyRate * 14 * 100) / 100;
      const predicted30Day = Math.round(dailyRate * 30 * 100) / 100;
      const daysUntilStockout = dailyRate > 0 ? Math.floor(p.stock / dailyRate) : null;
      const needsRestock = daysUntilStockout !== null && daysUntilStockout <= 14;

      return {
        product_id: p.product_id,
        name: p.name,
        stock: p.stock,
        price: p.price,
        category: p.category,
        daily_velocity: dailyRate,
        total_sold: p.total_sold,
        total_revenue: p.total_revenue,
        predicted_demand_7d: predicted7Day,
        predicted_demand_14d: predicted14Day,
        predicted_demand_30d: predicted30Day,
        days_until_stockout: daysUntilStockout,
        needs_restock: needsRestock
      };
    });
  }
}

module.exports = POSDatabase;
