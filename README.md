# ERJV POS

![Status](https://img.shields.io/badge/Status-In%20Development-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-lightgrey)

ERJV POS is a production-ready Point of Sale frontend designed to handle seamless checkout transactions, secure authentication, and robust back-office management. Built with a focus on performance and maintainability, it separates terminal operations from dashboard analytics for an optimal user experience.

## Features

- **Dual Interface System:**
  - **POS Terminal:** Lightning-fast, keyboard-friendly checkout interface for cashiers.
  - **Admin Dashboard:** Comprehensive back-office views for inventory, sales reports, and settings.
- **Secure Authentication:** JWT-based login system with protected route wrappers.
- **Optimized Performance:** Lazy-loaded routes and split-code architecture to ensure the terminal never hangs.
- **Scalable UI:** Built with a custom, reusable component library (Cards, Modals, Tables) for consistent design.

## Tech Stack

- **Framework:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand / Redux (Update as needed)
- **Routing:** React Router v6
- **Network:** Axios (with custom interceptors)

## Getting Started

### Prerequisites

Make sure you have Node.js (v16+) and npm/yarn installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/yourusername/erjv-pos.git](https://github.com/yourusername/erjv-pos.git)
   cd erjv-pos
   ```
