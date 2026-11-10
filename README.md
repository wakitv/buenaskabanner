# WackyBuds x Buenas: QR Banner Generator + Banner Library

Two tools in one site:

- **Library**: the team browses ready-to-post banners, copies each caption with one click, and downloads the banner.
- **QR Banner**: upload any banner, drag a square target to where the QR code should go, enter a website URL, and download the finished banner as a full-resolution PNG.
- **Admin**: the admin uploads banners and captions straight from the browser. They are saved in this GitHub repository.

No backend, no database, no paid service.

**Stack:** React, Vite, TypeScript, Tailwind CSS, Lucide icons, `qrcode`, HTML5 Canvas.

## Banner Library and where the data lives

GitHub Pages is static hosting, so the banners are stored **inside your GitHub repository** and published with the site:

```
public/library/library.json        <- title, caption, tags of every banner
public/library/images/<id>.jpg     <- the banner images
```

The **Admin** tab commits to these files for you (one commit per change, which redeploys the site in about 1-2 minutes). You can also edit them by hand on GitHub.

### Using the Admin tab

1. Create a **fine-grained personal access token** on GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Under *Repository access* choose **Only select repositories** and pick this repo. Under *Permissions → Repository permissions* set **Contents: Read and write**.
2. Open the site → **Admin**, check the username / repository / branch (they are guessed from the URL), paste the token and press **Connect**.
3. Choose a banner image, write the title and caption (the team copies this), optional tags, then **Publish to Library**.
4. Wait 1-2 minutes for the redeploy (watch the **Actions** tab), then refresh the Library.
5. Edit captions or delete banners from the list below the form.

The token is kept only in your own browser (and only if "Remember on this device" is ticked). Press **Disconnect & forget token** on shared computers. Anyone without the token can browse the Library but cannot change anything.

### Updating the code without losing your banners

Your banners live in `public/library/` **in your GitHub repo**. The code zip does not contain that folder on purpose, so uploading a new version of the code never overwrites your banners. Don't delete or replace `public/library/` when updating.

If you use git on your computer, always run `git pull` before `git push`, because the Admin tab commits to the repo too. If git ever reports a conflict in `public/library/library.json`, don't commit the `<<<<<<<` lines. The site and the Admin tab can recover a file with those markers (the Admin tab shows a **Repair library.json now** button), but the cleanest fix is to keep the version that has your banners.

### Good to know

- **Public repo = public banners.** Anyone with the link can see the images and captions. GitHub Pages for *private* repositories needs a paid GitHub plan. If banners must stay private, use a backend such as Supabase or Firebase instead.
- **Size limits:** GitHub recommends repositories under about 1 GB, files must be under 100 MB, and the published site under 1 GB. Large images are shrunk automatically to at most 2400 px on the longest side (JPEG, quality 90) unless you untick that option; typical banners end up around 0.3-2 MB, so hundreds of banners fit comfortably.
- Two admins can work at the same time: the Admin tab re-reads `library.json` from the repo right before each commit so changes are not overwritten.
- Deleting a banner removes it from the latest version of the site, but old copies stay in the repository's git history.

## How to use the QR Banner tool

1. **Upload Banner** (PNG, JPG, JPEG or WEBP).
2. Drag the square to position it. Use the corner handles to resize (it stays square and inside the banner). Arrow keys nudge it; hold Shift for bigger steps.
3. Enter the website URL.
4. Click **GENERATE QR CODE**. It fills the square exactly, and follows it if you move or resize afterwards. The Buenas logo is placed in the center of every QR by default.
5. (Optional) **Customize QR**, which updates live: turn the center logo on/off and change its size (15–30%), pick the QR color and background color, and choose the module style (Square, Rounded, Dots). The three corner eyes always stay square so every style scans well.
6. Click **DOWNLOAD FINAL BANNER** to get `wackybuds-buenas-banner.png` at the banner's original width and height. The square outline and handles are never included.

## Opening links from Messenger, Facebook, Telegram, etc.

Apps like Messenger and Facebook open links in their own built-in browser, where downloads and "copy" can fail. When the site detects one of these, it shows a banner with an **Open in Chrome** button (plus **Copy link** as a backup). A website cannot force Chrome to open by itself, so the person has to tap the button. It needs Chrome to be installed, and on Android it falls back to the normal page if Chrome can't be launched. The banner never shows in Chrome, Safari or desktop browsers.

## Visitor counter (shown in the Admin tab)

GitHub Pages has no built-in visitor stats, so the site uses **GoatCounter**: free, no cookies, no personal data.

1. Sign up at https://www.goatcounter.com and choose a site code (for example `wackybuds`).
2. In GoatCounter open **Settings** and tick **"Allow adding visitor counts on your website"**, then save.
3. Open `src/config.ts`, put your code in `SITE_CODE` (for example `const SITE_CODE = 'wackybuds'`), commit and push.
4. After the redeploy, the **Admin** tab shows (after you press Connect) total views, Library views and QR Banner views. Click **Full stats** there for the full GoatCounter dashboard (countries, devices, referrers, daily charts).

Notes: it counts page views of the Library and QR Banner tabs; the Admin tab is never counted. Tick **"Don't count my own visits on this device"** in the Admin tab so your own checking does not inflate the numbers. Ad blockers can block the counter, so real numbers are usually a bit higher. The public counter can lag by a few hours. Leave `SITE_CODE` empty to turn counting off completely.

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

- Default look is black on white with the standard 4-module quiet zone included inside the square. Error correction is level H when the logo is on (it covers part of the code) and level Q when it's off.
- To change the logo, replace `src/assets/buenas-logo.jpg` with your own square image.
- The app warns about low-contrast or light-on-dark color choices, since many phone scanners can't read those.
- Positions are stored in original banner pixels, so the preview and the exported PNG use identical coordinates.
- For reliable scanning, keep the QR at least ~3 pixels per module; the app warns you if it's too small.
- Very large banners may exceed your browser's canvas limit; the app shows a message if export fails.
