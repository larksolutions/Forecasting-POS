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
        ['Sample Product 1', 'SKU-001', 'This is a sample product', 29.99, 15.00, 100, 'Electronics', '1234567890123'],
        ['Sample Product 2', 'SKU-002', 'Another sample product', 49.99, 25.00, 50, 'Electronics', '1234567890124'],
        ['Sample Product 3', 'SKU-003', 'Third sample product', 19.99, 10.00, 75, 'Accessories', '1234567890125']
      ]);
    }
  }

  // Product operations
  getProducts() {
    return this.db.prepare('SELECT * FROM products ORDER BY name').all();
  }

  addProduct(product) {
    const stmt = this.db.prepare(`
      INSERT INTO products (name, sku, description, price, cost, stock, category, barcode)
      VALUES (@name, @sku, @description, @price, @cost, @stock, @category, @barcode)
    `);
    const result = stmt.run(product);
    return { id: result.lastInsertRowid, ...product };
  }

  updateProduct(id, product) {
    const stmt = this.db.prepare(`
      UPDATE products
      SET name = @name, sku = @sku, description = @description, 
          price = @price, cost = @cost, stock = @stock, 
          category = @category, barcode = @barcode, updated_at = CURRENT_TIMESTAMP
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
}

module.exports = POSDatabase;
