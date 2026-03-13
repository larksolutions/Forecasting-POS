# POS & Forecasting Desktop Application

A modern Point of Sale and Forecasting system built with Electron, Tailwind CSS, and SQLite.

## Features

- 🛒 **Point of Sale**: Fast and intuitive product selection and checkout
- 📦 **Product Management**: Manage inventory with SKU, pricing, and stock tracking
- 👥 **Customer Management**: Track customer information and purchase history
- 📊 **Sales History**: View and analyze past transactions
- 📈 **Dashboard**: Real-time statistics and top products
- 💾 **SQLite Database**: Fast, reliable local data storage
- 🎨 **Modern UI**: Beautiful interface built with Tailwind CSS

## Tech Stack

- **Electron**: Cross-platform desktop application framework
- **Tailwind CSS**: Utility-first CSS framework
- **SQLite (better-sqlite3)**: Embedded database for data persistence
- **JavaScript**: Native ES6+ for application logic

## Project Structure

```
Forecasting/
├── src/
│   ├── main/
│   │   └── main.js           # Electron main process
│   ├── preload/
│   │   └── preload.js        # Preload script (IPC bridge)
│   ├── database/
│   │   └── database.js       # SQLite database utilities
│   └── renderer/
│       ├── index.html        # Main UI
│       ├── renderer.js       # UI logic
│       └── styles/
│           ├── input.css     # Tailwind input
│           └── output.css    # Tailwind output (generated)
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build Tailwind CSS:**
   ```bash
   npm run build:css
   ```
   
   Or run in watch mode for development:
   ```bash
   npm run build:css
   ```
   (Keep this running in a separate terminal during development)

## Development

1. **Start the application:**
   ```bash
   npm start
   ```

2. **Start in development mode (with DevTools):**
   ```bash
   npm run dev
   ```

## Building

Build the application for distribution:

```bash
# Build for current platform
npm run build

# Package without installer
npm run pack

# Create distributable
npm run dist
```

## Database

The application uses SQLite for data storage. The database file is automatically created at:
- **macOS**: `~/Library/Application Support/pos-forecasting-app/pos.db`
- **Windows**: `%APPDATA%/pos-forecasting-app/pos.db`
- **Linux**: `~/.config/pos-forecasting-app/pos.db`

### Database Schema

**Products Table:**
- id, name, sku, description, price, cost, stock, category, barcode, image, timestamps

**Customers Table:**
- id, name, email, phone, address, city, timestamps

**Sales Table:**
- id, customer_id, total, subtotal, tax, discount, payment_method, status, notes, created_at

**Sale Items Table:**
- id, sale_id, product_id, quantity, unit_price, total

## Usage

### Point of Sale
1. Select products from the grid
2. Adjust quantities in the cart
3. Choose payment method
4. Complete the sale

### Product Management
1. Navigate to Products
2. Add new products with SKU, pricing, and stock information
3. Edit or delete existing products

### Sales History
View all past transactions with filtering options

### Dashboard
View real-time statistics including:
- Today's sales revenue
- Number of transactions
- Average sale value
- Top selling products

## Future Enhancements

- [ ] Advanced forecasting algorithms
- [ ] Inventory alerts for low stock
- [ ] Customer loyalty programs
- [ ] Receipt printing
- [ ] Barcode scanning support
- [ ] Multi-user support with authentication
- [ ] Export data to CSV/Excel
- [ ] Advanced reporting and analytics
- [ ] Dark mode support

## License

MIT

## Author

Your Name

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
# Forecasting-POS
