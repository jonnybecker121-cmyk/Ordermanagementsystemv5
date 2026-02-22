# Figma Make React App

This project is a React application built with Vite and Tailwind CSS.

## Deployment to Cloudflare Pages

This project is configured for easy deployment to Cloudflare Pages.

### Prerequisites

- A GitHub account
- A Cloudflare account

### Steps

1.  **Push to GitHub:**
    Push this repository to your GitHub account.

2.  **Connect to Cloudflare Pages:**
    - Log in to the Cloudflare dashboard.
    - Go to "Pages" and click "Create a project" > "Connect to Git".
    - Select your repository.

3.  **Configure Build Settings:**
    - **Framework preset:** `Vite`
    - **Build command:** `npm run build`
    - **Build output directory:** `dist`

4.  **Deploy:**
    Click "Save and Deploy".

### Single Page Application (SPA) Routing

A `public/_redirects` file has been added to support client-side routing. This ensures that all paths are redirected to `index.html`, allowing the React Router to handle navigation correctly.
