# GroofAI Explorer

Build a mobile-friendly React + Tailwind app called "GroofAI". Green and white theme, minimal UI. No paid APIs, no API keys. Do NOT add login, extra pages, animations, or features I haven't listed.

Pages: "/" landing page and "/map".

Landing: headline "Find the best climate upgrade for your rooftop", three short cards (Cooler, Greener, Cleaner), and a "Find my roof" button linking to /map.

/map:

- Full-screen react-leaflet map with Esri World Imagery tiles (https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}) and correct attribution. Start at Hyderabad (17.385, 78.4867), zoom 17.

- Search box using the Nominatim API to jump to an address.

- At zoom >= 17, after the map stops moving for 800 ms, fetch buildings in the visible bounds from the Overpass API (way["building"]), convert them to GeoJSON, and draw them as semi-transparent green polygons. Cache by bounding box, show a small loading indicator, and show a friendly message if Overpass fails or rate-limits.

- Click a polygon to select it (orange highlight) and open a side panel (bottom sheet on mobile).

- "Draw my roof" button using leaflet-draw, for when no building polygon exists.

- Use Turf.js to calculate roof area in m². In the panel show Roof area and Usable area (65% of area, labelled "estimated"), plus the polygon centroid lat/lon.

- "Try a sample roof" button that selects a hard-coded building near the start point.

Keep code clean: src/components, src/lib, src/pages. Stop after this; do not build the questionnaire or results yet.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cfddc250-cea9-4334-bc97-7952a6128ff4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
