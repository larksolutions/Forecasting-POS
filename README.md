# Café de Marcelino — POS & Sales Forecasting

A desktop Point of Sale system with built-in sales forecasting using Holt's Double Exponential Smoothing. Built with Electron, SQLite, and Tailwind CSS.

## Features

- **Point of Sale** — Product grid, cart, customer selection, discount, 12% VAT, receipt printing
- **Product Management** — CRUD with image upload, search, pagination
- **Customer Management** — CRUD with search and pagination
- **Sales History** — Date filtering, pagination, real-time updates
- **Dashboard** — Today's sales, transactions, average sale, top products
- **Sales Forecasting** — 14-day revenue predictions, day-of-week patterns, product demand forecasting, restock alerts
- **Receipt / Invoice** — Auto-generated after each sale with print support

## Tech Stack

- **Electron** ^28 — Cross-platform desktop framework
- **better-sqlite3** — Embedded SQLite database
- **Tailwind CSS** ^3.4 — Utility-first styling
- **JavaScript** (ES6+) — No frontend framework required

---

## Setup (Windows)

### Prerequisites

Install these first:

1. **Node.js** (v18 or later) — [https://nodejs.org](https://nodejs.org)
2. **Git** — [https://git-scm.com](https://git-scm.com)
3. **Visual Studio Build Tools** (required for `better-sqlite3`):
   ```
   npm install -g windows-build-tools
   ```
   Or install manually: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) → select "Desktop development with C++"

### Installation

```bash
# 1. Clone the project
git clone <your-repo-url>
cd Forecasting-POS

# 2. Install dependencies
npm install

# 3. Build Tailwind CSS (run once, or keep running in a separate terminal)
npm run build:css

# 4. Start the app
npm start
```

### Development Mode (with DevTools)

```bash
npm run dev
```

### Build for Distribution

```bash
npm run dist
```

---

## Project Structure

```
Forecasting-POS/
├── src/
│   ├── main/main.js            # Electron main process + IPC handlers
│   ├── preload/preload.js      # Context bridge (renderer ↔ main)
│   ├── database/database.js    # SQLite schema, CRUD, forecasting engine
│   └── renderer/
│       ├── index.html          # Main UI (6 views, modals)
│       ├── renderer.js         # All frontend logic
│       └── styles/
│           ├── input.css       # Tailwind directives + custom classes
│           └── output.css      # Generated CSS
├── package.json
├── tailwind.config.js
└── postcss.config.js
```

## Database

SQLite database is created automatically at:
- **Windows**: `%APPDATA%/cafe-de-marcelino/pos.db`
- **macOS**: `~/Library/Application Support/cafe-de-marcelino/pos.db`
- **Linux**: `~/.config/cafe-de-marcelino/pos.db`

Product images are stored in `{userData}/product-images/`.

---

## Sales Forecasting — How It Works

The system uses **Holt's Double Exponential Smoothing** to predict future daily sales revenue. It tracks two components: **level** (current baseline) and **trend** (direction of change).

### Core Formulas

**Level equation** — estimates the current sales baseline:

```
S_t = α · Y_t + (1 - α)(S_{t-1} + T_{t-1})
```

| Symbol   | Meaning                        |
|----------|--------------------------------|
| S_t      | Smoothed level at time t       |
| Y_t      | Actual observed sales at time t |
| S_{t-1}  | Previous level                 |
| T_{t-1}  | Previous trend                 |

**Trend equation** — estimates how fast sales are rising or falling:

```
T_t = β · (S_t - S_{t-1}) + (1 - β) · T_{t-1}
```

**Forecast equation** — predicts revenue h days ahead:

```
F_{t+h} = S_t + h · T_t
```

### Parameters

| Parameter | Value  | Role                                            |
|-----------|--------|--------------------------------------------------|
| α (alpha) | 0.3    | Level smoothing — weight given to recent sales   |
| β (beta)  | 0.15   | Trend smoothing — how fast trends adapt          |

- Higher α → faster reaction to new data, more noise
- Lower β → smoother, more stable trend estimates

### Step-by-Step Process

1. **Initialize**: Level = first day's revenue. Trend = average daily change over the first 7 days.
2. **Smooth**: Walk through all historical daily sales (up to 84 days), updating level and trend at each step.
3. **Seasonal adjustment**: Compute a day-of-week multiplier (e.g., weekends = 1.3×, Mondays = 0.8×). Apply to each forecast:
   ```
   Prediction_h = max(0, (S_t + h · T_t) × DOW_multiplier)
   ```
4. **Output**: 14-day forecast with daily revenue predictions.

### Confidence Levels

| Historical Data Available | Confidence |
|--------------------------|------------|
| ≥ 56 days (8 weeks)     | High       |
| ≥ 28 days (4 weeks)     | Medium     |
| < 28 days               | Low        |

### Product-Level Demand Forecasting

Individual products use **linear extrapolation** based on sales velocity:

```
Predicted Demand = daily_velocity × days
Days Until Stockout = floor(current_stock / daily_velocity)
```

A **restock alert** triggers when days until stockout ≤ 14.

### Example Calculation

Given: Level = ₱2,500 | Trend = ₱50/day | Saturday multiplier = 1.3

Forecast for Saturday (3 days ahead):
```
F = (2,500 + 3 × 50) × 1.3 = 2,650 × 1.3 = ₱3,445
```

### Key Outputs

- 7-day and 14-day total revenue forecasts (₱)
- Daily trend (₱/day change)
- Weekly trend (% week-over-week growth)
- Per-product demand (7, 14, 30 days)
- Restock alerts for products running low

---

## License

MIT
# Forecasting-POS
