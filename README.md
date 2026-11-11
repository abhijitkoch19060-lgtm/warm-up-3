# Summit Weather

A static weather-monitoring website with a mountain background, live weather and air quality, a world map, and a 20-year Time Machine. Pure HTML, CSS and JavaScript, so it runs on GitHub Pages with no build step.

## Features

- **Mountain background:** plays `assets/mountain.mp4` if present, otherwise shows a built-in animated mountain scene (moving ridges and clouds).
- **Home:** search any place for temperature, feels-like, humidity, wind, rain, US AQI with PM2.5/PM10, and a 7-day forecast.
- **World Map:** colored markers for 32 major cities. Choose Temperature or Air Quality, and click any city or any point on the map for details.
- **Time Machine:** a slider from today back to 20 years ago. It shows the average temperature for the same calendar day in that year. A Play button steps through the years.
- **20-year chart:** click a point to see its temperature on this calendar day for each of the last 20 years, with a trend line.
- **About Us, Login, Profile, footer, links and template cards** from the first version.

## Files

```
index.html     – pages, footer, links, template cards
style.css      – styling
script.js      – background, routing, weather, map, time machine, login, profile
assets/
  mountain.mp4 – your background video (you add this)
```

## Add the mountain video

1. Download a free mountain video from [Pexels](https://www.pexels.com/search/videos/mountain/) or [Pixabay](https://pixabay.com/videos/search/mountain/).
2. Save it as `assets/mountain.mp4` next to `index.html`.
3. Keep it under about 10 MB (720p, 10 to 20 second loop is ideal). GitHub blocks files over 100 MB.

If the file is missing or can't play, the animated scene stays on screen.

## Run locally

Open `index.html` in a browser, or run `python -m http.server` in this folder and visit `http://localhost:8000`. An internet connection is needed for weather data and map tiles.

## Publish on GitHub Pages

1. Create a repository and upload all files (including `assets/`).
2. Go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then Save.
3. Your site appears at `https://<your-username>.github.io/<repo-name>/`.

## Data and limits

- Weather, air quality, geocoding and history come from [Open-Meteo](https://open-meteo.com) (free, no API key; attribution required, CC BY 4.0). Free use is intended for non-commercial projects.
- Past years show the **daily average** temperature, while Today shows the **live reading**, so small differences are expected.
- Air-quality history is not available for 20 years, so the AQI layer is live only.
- The free API has request limits. If you press Play repeatedly you may see "too many requests"; wait a minute and retry. Results are cached per year during a visit.

## Customise

- **City markers:** edit the `CITIES` list in `script.js`.
- **Add a card/template:** copy an `<article class="card">` block in `index.html`.
- **Footer links:** edit the `<footer>` section.
- **Colors:** edit the variables at the top of `style.css`.

## Login note

Login and Profile use the browser's `localStorage`, so accounts exist only on the visitor's own device and are not secure. For real users, connect a backend or an auth service such as Firebase Auth or Supabase.
