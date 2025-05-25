# CS571 Full-Stack Artsy Projects

This repository contains my coursework for **CS571**, focused on full-stack development using the [Artsy API](https://developers.artsy.net/). The course is structured into four progressive assignments, each building upon the previous one, transitioning from static pages to a complete Android application.

## Project Overview

The core goal of these assignments is to explore different web and mobile technologies while integrating with a real-world public API. The Artsy API provides access to artist information, artworks, and more — allowing for the development of visually rich and responsive applications.

---

## Assignments Breakdown

### Assignment 1: Page Template (Static HTML)
- Simple static page with links to the following assignments

### Assignment 2: Responsive HTML + CSS Page
- Implemented the visual design with responsive layout using **HTML5** and **CSS3**
- Created a search page for artists

### Assignment 3: Angular Frontend + Express.js Backend
- Built a fully functional **Angular** application with **Bootstrap**
- Integrated with **Artsy API** to fetch artist details and artworks
- Users can:
  - Search for artists
  - View artist information and related artworks
  - Favorite and manage favorite artists (stored in MongoDB)
- Includes user login/register (MongoDB)

### Assignment 4: Android App with Material3
- Developed a **native Android app** using **Material 3 components**
- Connected to the same Express.js Backend for real-time data
- Core features:
  - User authentication with persistent sessions via cookies
  - Artist search & detail pages
  - Artwork & similar artist browsing
  - Favorites management using SharedPreferences
- Used:
  - `ViewModel`, `LiveData`, `RecyclerView`
  - **Navigation Component**
  - **OkHttp** for network
  - **PersistentCookieJar** for login sessions

---

## Tech Stack Summary

| Assignment | Frontend      | Backend/API        | Tech Highlights                            |
|------------|---------------|--------------------|---------------------------------------------|
| 1          | HTML Template | -                  | Semantic HTML                               |
| 2          | HTML + CSS    | Flask              | Ajax, Flexbox, media queries                |
| 3          | Angular       | Express.js         | Bootstrap, Angular Routing, Local Storage   |
| 4          | Android       | Express.js         | Material 3, OkHttp, ViewModel, Jetpack Libs |