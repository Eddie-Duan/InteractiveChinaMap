# InteractiveChinaMap

## Project Introduction

InteractiveChinaMap is an interactive China map learning platform designed to help users master Chinese geography knowledge—including province names, geographic locations, province outlines, city positions, and boundaries—through gamified learning. The platform offers multiple learning modes suitable for learners at different levels.

## Features

- **Homepage Entry**: Supports multi-language switching, user login/registration, and admin access.
- **Mode Selection**: Offers various modes including Puzzle, Challenge, and Learning modes.
- **Province Puzzle**: Click on the corresponding province on the map based on prompts.
- **City Puzzle**: Click on the corresponding city on the map based on prompts.
- **Challenge Mode**: Timed quizzes to test your geographic knowledge.
- **Daily Challenge**: Daily updated quizzes with historical score tracking.
- **Learning Mode**: Interactive map with hover-over information for provinces and cities.
- **Standard Map**: Comprehensive reference of Chinese geography, including province boundaries, population, GDP, and more.
- **Achievement System**: Unlock achievements by completing specific tasks to track learning progress.
- **Statistics & Analytics**: View personal statistics such as answer accuracy rate and consecutive login days.
- **Feedback System**: Submit usage feedback and improvement suggestions.

## Technology Stack

- **Backend**: Node.js (native http module)
- **Frontend**: HTML5, CSS3, JavaScript (native)
- **Data Storage**: JSON files
- **Map Resources**: SVG vector graphics

## Project Structure

```
interactivecnmap/
├── backend/                 # Backend service
│   ├── server.js           # Main server file
│   ├── package.json        # Project configuration
│   └── *.json              # Data files (users, achievements, questions, etc.)
├── frontend/              # Frontend resources
│   ├── index.html          # Homepage
│   ├── mode.html           # Mode selection page
│   ├── *.html              # Individual feature pages
│   ├── assets/             # Static assets (images, SVGs)
│   └── *.json              # Map data files
└── LICENSE                 # License
```

## Quick Start

### Prerequisites

- Node.js (v12.0.0 or higher)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies (if any are listed in package.json):
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node server.js
   ```

4. Open your browser and visit: `http://localhost:3000` (default port)

## How to Use

1. **Register/Login**: Click the login/register button on the homepage to create an account.
2. **Select Mode**: Go to the mode selection page and choose your desired practice type.
3. **Start Learning/Challenging**: Follow on-screen instructions to begin.
4. **View Statistics**: Check your learning progress and achievements in your profile.

## Contribution Guidelines

Pull requests and issues are welcome to help improve the project.

## License

This project is open-sourced under the MIT License. See the [LICENSE](LICENSE) file for details.