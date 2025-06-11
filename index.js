import express from "express";
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import { create } from "xmlbuilder2";
import archiver from "archiver";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const BOUNDS = {
  lamin: -35, // latitude sul (extremo sul do RS)
  lamax: 5, // latitude norte (Roraima)
  lomin: -75, // longitude oeste (Acre)
  lomax: -33, // longitude leste (litoral)
};

const getAccessToken = async () => {
  const url =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
  const data = qs.stringify({
    grant_type: "client_credentials",
    client_id: process.env.OPENSKY_CLIENT_ID,
    client_secret: process.env.OPENSKY_CLIENT_SECRET,
  });

  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const response = await axios.post(url, data, { headers });
  return response.data.access_token;
};

app.get("/flights.kml", async (req, res) => {
  try {
    const token = await getAccessToken();
    const url = `https://opensky-network.org/api/states/all?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;
    const doc = create({ version: "1.0", encoding: "UTF-8" })
      .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
      .ele("Document")
      .ele("name")
      .txt("Voos sobre o Brasil")
      .up()

      // Estilo para os aviões
      .ele("Style", { id: "planeStyle" })
      .ele("IconStyle")
      .ele("scale")
      .txt("1.2")
      .up()
      .ele("Icon")
      .ele("href")
      .txt("http://maps.google.com/mapfiles/kml/shapes/airports.png")
      .up()
      .up()
      .up()
      .up()

      .ele("Folder")
      .ele("name")
      .txt("Aeronaves em tempo real")
      .up();

    data.states?.forEach((state) => {
      const [
        icao24,
        callsign,
        ,
        ,
        ,
        lon,
        lat,
        baroAlt,
        ,
        velocity,
        ,
        ,
        geoAlt,
        squawk,
        ,
        ,
        category,
      ] = state;

      if (lat && lon) {
        doc
          .ele("Placemark")
          .ele("name")
          .txt((callsign || icao24).trim())
          .up()
          .ele("description")
          .txt(
            `ICAO24: ${icao24}\n` +
              `Altitude: ${baroAlt?.toFixed(0) || "N/A"} m\n` +
              `Velocidade: ${velocity?.toFixed(1) || "N/A"} m/s\n` +
              `Origem: ${origin_country || "Indefinido"}`
          )
          .up()
          .ele("styleUrl")
          .txt("#planeStyle")
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
    console.error("❌ Erro ao gerar KML:", err.message);
    res.status(500).send("Erro ao gerar o KML");
  }
});

app.get("/flights.kmz", async (req, res) => {
  try {
    const token = await getAccessToken();
    const url = `https://opensky-network.org/api/states/all?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = response.data;
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
      const [
        icao24,
        callsign,
        ,
        ,
        ,
        lon,
        lat,
        baroAlt,
        ,
        velocity,
        ,
        ,
        geoAlt,
        squawk,
        ,
        ,
        category,
      ] = state;

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

    res.setHeader("Content-Type", "application/vnd.google-earth.kmz");
    res.setHeader("Content-Disposition", 'attachment; filename="flights.kmz"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    archive.append(kmlContent, { name: "doc.kml" });
    archive.finalize();
  } catch (err) {
    console.error("❌ Erro ao gerar KMZ:", err.message);
    res.status(500).send("Erro ao gerar o KMZ");
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
});
