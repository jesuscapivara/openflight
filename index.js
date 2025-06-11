// index.js
import express from "express";
import fetch from "node-fetch";
import { create } from "xmlbuilder2";
import dotenv from "dotenv";
import fs from "fs";
import archiver from "archiver"; 

dotenv.config(); // Carrega as variáveis do .env

const app = express();
const OPENSKY_USER = process.env.OPENSKY_CLIENT_ID;
const OPENSKY_PASS = process.env.OPENSKY_CLIENT_SECRET;


// Carrega credenciais do OpenSky do arquivo JSON
const { clientId, clientSecret } = JSON.parse(
  fs.readFileSync("./credentials.json", "utf8")
);
const authHeader =
  "Basic " + Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString("base64");

// Região monitorada (ajustável, ou configurable via .env se desejar)
const BOUNDS = {
  lamin: -23,
  lamax: -22,
  lomin: -47,
  lomax: -46,
};

app.get("/flights.kml", async (req, res) => {
  try {
    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}` +
      `&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const doc = create({ version: "1.0", encoding: "UTF-8" })
      .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
      .ele("Document")
      .ele("name")
      .txt("Rastreamento de Voos")
      .up()
      .ele("Folder")
      .ele("name")
      .txt("Aeronaves em tempo real")
      .up();

    data.states?.forEach((state) => {
      const [icao24, callsign, , , , lon, lat, baroAlt] = state;

      if (lat && lon) {
        doc
          .ele("Placemark")
          .ele("name")
          .txt((callsign || icao24).trim())
          .up()
          .ele("description")
          .txt(`ICAO24: ${icao24}\nAltitude: ${baroAlt?.toFixed(0) || "N/A"} m`)
          .up()
          .ele("Point")
          .ele("coordinates")
          .txt(`${lon},${lat},${baroAlt || 0}`)
          .up()
          .up()
          .up();
      }
    });

    const kml = doc.end({ prettyPrint: true });
    res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
    res.send(kml);
  } catch (err) {
    console.error("Erro ao gerar KML:", err);
    res.status(500).send("Erro ao gerar o KML");
  }
});

app.get("/flights.kmz", async (req, res) => {
  try {
    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}` +
      `&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const doc = create({ version: "1.0", encoding: "UTF-8" })
      .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
      .ele("Document")
      .ele("name")
      .txt("Rastreamento de Voos")
      .up()
      .ele("Folder")
      .ele("name")
      .txt("Aeronaves em tempo real")
      .up();

    data.states?.forEach((state) => {
      const [icao24, callsign, , , , lon, lat, baroAlt] = state;

      if (lat && lon) {
        doc
          .ele("Placemark")
          .ele("name")
          .txt((callsign || icao24).trim())
          .up()
          .ele("description")
          .txt(`ICAO24: ${icao24}\nAltitude: ${baroAlt?.toFixed(0) || "N/A"} m`)
          .up()
          .ele("Point")
          .ele("coordinates")
          .txt(`${lon},${lat},${baroAlt || 0}`)
          .up()
          .up()
          .up();
      }
    });

    const kmlContent = doc.end({ prettyPrint: true });

    // Cabeçalhos para KMZ
    res.setHeader("Content-Type", "application/vnd.google-earth.kmz");
    res.setHeader("Content-Disposition", 'attachment; filename="flights.kmz"');

    // Compacta o KML dentro do KMZ (ZIP)
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(kmlContent, { name: "doc.kml" });
    archive.finalize();
  } catch (err) {
    console.error("Erro ao gerar KMZ:", err);
    res.status(500).send("Erro ao gerar KMZ");
  }
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor rodando em http://${HOST}:${PORT}/flights.kml`);
});

console.log("🔐 OpenSky ID:", OPENSKY_USER);