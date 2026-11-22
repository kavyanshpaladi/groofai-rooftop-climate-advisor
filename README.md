# groofai

Find the best climate upgrade for your rooftop. groofai looks at your roof and recommends whether **solar panels, a green roof, a cool reflective coating, or rainwater harvesting** would help most, in about two minutes and with no sign-up.

**Live demo:** https://groofai.lovable.app

## Screenshots

<!-- EDIT: drag 2-3 screenshots here: landing page, roof map, recommendation result -->

## Why This Project

Cities are getting hotter and flooding more, while rooftops are one of the most unused spaces people own. I built groofai to make it easy for anyone to see which upgrade suits their own roof, using plain-language explanations instead of technical reports.

## Features

<!-- EDIT: keep only what your app actually does -->
- Search for an address with autocomplete, or draw your roof outline on a satellite map
- Measures roof area and the usable area
- Asks five short questions about roof type, shade, access, and budget
- Recommends the best fit: solar, green roof, cool coating, or rain harvesting
- Explains each recommendation in plain language
- No sign-up required

## How It Works

1. **Find your roof:** search your address or draw the outline on the map.
2. **Answer five questions:** roof type, how much shade it gets, how you reach it, what matters most to you, and your budget.
3. **Get your best fit:** the app combines your answers with local sun, heat, and rain data to recommend an upgrade.

## Tech Stack

<!-- EDIT: check package.json and keep only what's true -->
- TanStack Start, React, TypeScript
- Vite
- Tailwind CSS
- Leaflet for the interactive map
- Satellite imagery (Esri / Mapbox) and building outlines from OpenStreetMap
- Photon for address search autocomplete
- <!-- EDIT: add the source of your sun, heat, and rain data -->
- Built with [Lovable](https://lovable.dev)

## Run Locally

You need Node.js and npm installed.

```sh
git clone https://github.com/vishruth1729/groofai-rooftop-climate-advisor.git
cd groofai-rooftop-climate-advisor
npm install
npm run dev
```

Then open http://localhost:8080 in your browser.

<!-- EDIT: if the app needs a map token or other environment variable, list it here, for example:
Create a `.env` file and add `VITE_MAPBOX_TOKEN=your_public_token` -->

## Data Sources and Credits

- Map imagery: Esri / Mapbox
- Building outlines: © OpenStreetMap contributors
- <!-- EDIT: add your sun, heat, and rain data sources -->

## What I Learned

<!-- EDIT: write 2-3 honest lines -->
- Working with interactive maps and geographic data
- Turning user inputs into a clear recommendation
- Designing a simple, easy-to-follow user flow

## Future Improvements

<!-- EDIT: only list things you actually plan to do -->
- Estimated cost and payback time for each upgrade
- More accurate local climate data
- Support for more cities and roof types

## Author

**Kavyansh Paladi**

- GitHub: [@vishruth1729](https://github.com/kavyanshpaladi)
