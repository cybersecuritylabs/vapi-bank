# V-API-BANK ACADEMY

A professional-grade vulnerable web application training platform for learning API security testing. Inspired by PortSwigger Web Academy — modern, realistic, and hands-on.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     V-API-BANK ACADEMY                          │
├───────────────────────┬─────────────────────────────────────────┤
│   ACADEMY WORLD       │         LAB WORLD                       │
│   (Control Plane)     │         (Attack Plane)                  │
│                       │                                         │
│   Port 3000           │   Ports 9001–9010                       │
│                       │                                         │
│   ┌───────────────┐   │   ┌──────────┐  ┌──────────┐           │
│   │  Academy UI   │   │   │  Lab 01  │  │  Lab 02  │  ...      │
│   │  (Learning)   │   │   │ NexaPay  │  │ FinVault │           │
│   └───────┬───────┘   │   └──────────┘  └──────────┘           │
│           │           │   ┌──────────┐  ┌──────────┐           │
│   ┌───────┴───────┐   │   │  Lab 03  │  │  Lab 04  │  ...      │
│   │Academy Backend│   │   │CloudPay  │  │SecureVlt │           │
│   │  Express.js   │   │   └──────────┘  └──────────┘           │
│   └───────┬───────┘   │   ┌──────────┐  ┌──────────┐           │
│           │           │   │  Lab 05  │  │  Lab 06  │  ...      │
│   ┌───────┴───────┐   │   │QuickXfer │  │ ShopAPI  │           │
│   │  JSON File DB │   │   └──────────┘  └──────────┘           │
│   └───────────────┘   │   ┌──────────┐  ┌──────────┐           │
│                       │   │  Lab 07  │  │  Lab 08  │           │
│                       │   │DataStrm  │  │MediRec   │           │
│                       │   └──────────┘  └──────────┘           │
│                       │   ┌──────────┐  ┌──────────┐           │
│                       │   │  Lab 09  │  │  Lab 10  │           │
│                       │   │ DevHub   │  │CryptoTrd │           │
│                       │   └──────────┘  └──────────┘           │
└───────────────────────┴─────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone and run
git clone <repo-url>
cd vAPI-Bank
docker-compose up --build

# Access
# Academy:  http://localhost:3000
# Labs:     http://localhost:9001 – 9010
```

## Labs Overview

| #  | Name | Target App | Vulnerability | Difficulty |
|----|------|------------|---------------|------------|
| 01 | Chained IDOR | NexaPay Digital Bank | IDOR chain → Account takeover | Intermediate |
| 02 | Broken Function-Level Auth | FinVault Admin Portal | Missing function-level access control | Intermediate |
| 03 | Mass Assignment | CloudPay Wallet | Hidden nested property injection | Intermediate |
| 04 | JWT Secret Forgery | SecureVault API Gateway | Weak JWT signing secret | Intermediate |
| 05 | Race Condition | QuickTransfer Payments | Double-spend via race condition | Intermediate+ |
| 06 | Business Logic Flaw | ShopAPI E-Commerce | Price manipulation | Intermediate |
| 07 | API Key Leak | DataStream Analytics | Leaked credentials in headers | Intermediate |
| 08 | Predictable Reset Token | MediRecord Health Portal | Weak token generation | Intermediate+ |
| 09 | GraphQL Auth Bypass | DevHub Platform | Introspection + broken auth | Intermediate+ |
| 10 | Multi-Step Chain | CryptoTrade Exchange | SSRF + Info Disclosure + Auth Bypass | Advanced |

## How It Works

1. **Register** on the Academy at `http://localhost:3000`
2. **Browse Labs** — only Lab 1 is unlocked initially
3. **Launch** a lab — opens the target application in a new tab
4. **Exploit** the vulnerability using Burp Suite or manual testing
5. **Find the flag** hidden in the target application
6. **Submit the flag** back in the Academy
7. **Unlock the next lab** and continue

## Tech Stack

- **Academy**: Node.js, Express, JSON file DB, JWT auth
- **Labs**: Individual Express.js applications
- **Infrastructure**: Docker, docker-compose
- **Frontend**: Vanilla HTML/CSS/JS (no framework dependencies)

## License

Educational use only. Do not deploy on public networks.
