const express = require('express')
const app = express()
const cors = require('cors')
const scraper = require('./scraper')
require('dotenv').config()

app.use(cors())

const PORT = process.env.PORT || 3000

app.get('/', function (req, res) {
    res.send("Este es un webscraper del sitio https://www.promiedos.com.ar/. \nEn la ruta `/today-results` se pueden obtener los resultados de los partidos del día. \nEn la ruta `/cup-results/<cup-name>` se pueden obtener los resultados de los partidos de una copa en particular.")
})

app.get('/today-results', async (req, res) => {
    const matches = await scraper.getTodayMatches(req, res);
    res.json(matches);
});

app.get('/cup-results/:competition', async (req, res) => {
    const competition = req.params.competition;
    const matches = await scraper.getCompetitionCupMatches(req, res, competition);
    res.json(matches);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
