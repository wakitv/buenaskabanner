# WackyBuds x Buenas: QR Banner Generator

Upload a promotional banner, drag a square target to where the QR code should go, enter a website URL, and download the finished banner as a full-resolution PNG. Everything runs locally in your browser. No backend, no login, no API.

**Stack:** React, Vite, TypeScript, Tailwind CSS, Lucide icons, `qrcode`, HTML5 Canvas.

## How to use

1. **Upload Banner** (PNG, JPG, JPEG or WEBP).
2. Drag the square to position it. Use the corner handles to resize (it stays square and inside the banner). Arrow keys nudge it; hold Shift for bigger steps.
3. Enter the website URL.
4. Click **GENERATE QR CODE**. It fills the square exactly, and follows it if you move or resize afterwards.
5. Click **DOWNLOAD FINAL BANNER** to get `wackybuds-buenas-banner.png` at the banner's original width and height. The square outline and handles are never included.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build locally
```

## Deploy to GitHub Pages

1. Create a new repository on GitHub (for example `wackybuds-buenas`). Don't add a README or .gitignore there.
2. In this project folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**.
4. The push to `main` triggers the **Deploy to GitHub Pages** workflow (see the **Actions** tab). When it finishes, your site is live at:

   `https://<your-username>.github.io/<your-repo>/`

Every later push to `main` redeploys automatically.

### About the base path

The workflow sets `VITE_BASE=/<repo-name>/` automatically from your repository name, so you don't need to edit anything, even if you rename the repo. Local `dev` and `build` use a relative base (`./`) and work as-is. For a custom domain or a `<user>.github.io` repository, no change is needed either, since the workflow value is only a path prefix; if your site is served from the domain root, set `VITE_BASE: /` in `.github/workflows/deploy.yml`.

## Notes

- The QR code uses error correction level Q, black on white, with the standard 4-module quiet zone included inside the square.
- Positions are stored in original banner pixels, so the preview and the exported PNG use identical coordinates.
- For reliable scanning, keep the QR at least ~3 pixels per module; the app warns you if it's too small.
- Very large banners may exceed your browser's canvas limit; the app shows a message if export fails.
