# QR & Cutout

An installable web app for Android and Windows with two tools:

- Generate a QR code from text or a URL, then save it as PNG or SVG.
- Remove an image background on the device, preview the result, then save a transparent PNG.

The app works in a modern browser. The background removal tool downloads its AI model on first use, so an internet connection is needed for that first processing run. Images are processed in the browser and are not uploaded to this app's server. Large photos may take longer or fail on devices with limited memory.

## Use

Visit [the web app](https://thelon3ly.github.io/qrCutout/). On Android, use your browser's **Install app** or **Add to Home screen** option. On Windows, use **Install app** from Chrome or Edge. The QR tool works offline after the app files have been cached. Background removal requires the model files to have loaded on that device.

## Develop

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

Build the static site with `npm run build`. Publish it with `npm run deploy`, which builds and pushes `dist/` to the `gh-pages` branch. Configure **GitHub Pages → Build and deployment → Deploy from a branch → gh-pages / (root)** in the repository settings.

## License and credits

QR & Cutout is licensed under AGPL-3.0. Background removal uses [IMG.LY Background Removal](https://github.com/imgly/background-removal-js), also AGPL-3.0. QR generation uses [node-qrcode](https://github.com/soldair/node-qrcode), MIT licensed.
