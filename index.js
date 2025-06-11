import express from "express";
import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import { create } from "xmlbuilder2";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";

// Limites do Brasil (ajuste se quiser)
const BOUNDS = {
  lamin: -35,
  lamax: 5,
  lomin: -75,
  lomax: -33,
};

// Solicita token OAuth2 para a OpenSky API
const getAccessToken = async () => {
  const response = await axios.post(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    qs.stringify({
      grant_type: "client_credentials",
      client_id: process.env.OPENSKY_CLIENT_ID,
      client_secret: process.env.OPENSKY_CLIENT_SECRET,
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data.access_token;
};

// Rota KML com ícones e estilos para Google Earth (atualiza em tempo real)
app.get("/flights.kml", async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `https://opensky-network.org/api/states/all?lamin=${BOUNDS.lamin}&lomin=${BOUNDS.lomin}&lamax=${BOUNDS.lamax}&lomax=${BOUNDS.lomax}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = response.data;

    const doc = create({ version: "1.0", encoding: "UTF-8" })
      .ele("kml", { xmlns: "http://www.opengis.net/kml/2.2" })
      .ele("Document")
      .ele("name")
      .txt("Voos sobre o Brasil")
      .up()

      // Estilo visual dos aviões
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
      .txt("Aeronaves em Tempo Real")
      .up();

    data.states?.forEach((state) => {
      const [
        icao24,
        callsign,
        origin_country,
        time_position,
        last_contact,
        longitude,
        latitude,
        baro_altitude,
        on_ground,
        velocity,
        true_track,
        vertical_rate,
        sensors,
        geo_altitude,
        squawk,
        spi,
        position_source,
        category,
      ] = state;

      if (!latitude || !longitude) return; // Pula entradas sem posição

      doc
        .ele("Placemark")
        .ele("name")
        .txt((callsign || icao24).trim())
        .up()
        .ele("description")
        .txt(
          `País de origem: ${origin_country || "N/A"}\n` +
            `Altitude: ${baro_altitude?.toFixed(0) || "N/A"} m\n` +
            `Velocidade: ${velocity?.toFixed(1) || "N/A"} m/s\n` +
            `Rastreamento: ${true_track?.toFixed(1) || "N/A"}°\n` +
            `Em solo: ${on_ground ? "Sim" : "Não"}\n` +
            `Categoria: ${category || "N/A"}`
        )
        .up()
        .ele("Style") // estilo inline com heading dinâmico
        .ele("IconStyle")
        .ele("heading")
        .txt(true_track?.toFixed(0) || "0")
        .up()
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
        .ele("Point")
        .ele("coordinates")
        .txt(`${longitude},${latitude},${baro_altitude || 0}`)
        .up()
        .up()
        .up();
    
    });

    const kml = doc.end({ prettyPrint: true });
    res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml");
    res.send(kml);
  } catch (err) {
    console.error("❌ Erro ao gerar KML:", err.message);
    res.status(500).send("Erro ao gerar o KML");
  }
});

app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor rodando em http://${HOST}:${PORT}/flights.kml`);
});
