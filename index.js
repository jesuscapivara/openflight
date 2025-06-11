import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { create } from "xmlbuilder2";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

// Limites aproximados do Brasil
const BOUNDS = {
  latMin: -35,
  latMax: 5,
  lonMin: -75,
  lonMax: -33,
};

const FLIGHTRADAR_URL = `https://data-live.flightradar24.com/zones/fcgi/feed.js?bounds=${BOUNDS.latMin},${BOUNDS.latMax},${BOUNDS.lonMin},${BOUNDS.lonMax}&faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=0&estimated=1&maxage=14400`;

app.get("/flightradar.kml", async (req, res) => {
  try {
    const { data } = await axios.get(FLIGHTRADAR_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.flightradar24.com/",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.flightradar24.com",
        "X-Requested-With": "XMLHttpRequest",
      },
    });    

    const doc = create({ version: "1.0", encoding: "UTF-8" })
      .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
      .ele("Document")
      .ele("name")
      .txt("FlightRadar24 - Tráfego Aéreo no Brasil")
      .up();

    for (const [key, value] of Object.entries(data)) {
      if (!Array.isArray(value) || value.length < 5) continue;

      const [
        lat,
        lon,
        alt,
        speed,
        callsign,
        aircraftType,
        ,
        ,
        ,
        ,
        ,
        ,
        heading,
      ] = value;

      doc
        .ele("Placemark")
        .ele("name")
        .txt(callsign || key)
        .up()
        .ele("description")
        .txt(
          `Tipo: ${aircraftType || "Desconhecido"}\n` +
            `Altitude: ${alt} ft\n` +
            `Velocidade: ${speed} kt\n` +
            `Proa: ${heading || "N/A"}°`
        )
        .up()
        .ele("Style")
        .ele("IconStyle")
        .ele("heading")
        .txt(heading || 0)
        .up()
        .ele("scale")
        .txt("1.1")
        .up()
        .ele("Icon")
        .ele("href")
        .txt("http://maps.google.com/mapfiles/kml/shapes/airports.png")
        .up()
        .up()
        .up()
        .up()
        .ele("Point")
        .ele("coordinates")
        .txt(`${lon},${lat},${alt || 0}`)
        .up()
        .up()
        .up();
    }

    const kml = doc.end({ prettyPrint: true });
    res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
    res.send(kml);
  } catch (err) {
    console.error("❌ Erro ao gerar KML:", err.message);
    res.status(500).send("Erro ao gerar KML");
  }
});

app.listen(PORT, () => {
  console.log(
    `🛰️ Servidor rodando em http://localhost:${PORT}/flightradar.kml`
  );
});

console.log(
  "[✔] Dados recebidos da FR24:",
  JSON.stringify(data).substring(0, 500)
);
