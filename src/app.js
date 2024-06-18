const express = require('express')
const app = express()
const cors = require('cors')
const scraper = require('./scraper')
require('dotenv').config()

app.use(cors())

const PORT = process.env.PORT || 3000
const url = 'https://www.promiedos.com.ar/'

app.get('/', function (req, res) {
    res.send('Este es un webscraper del sitio https://www.promiedos.com.ar/ (para ver los resultados de los partidos de hoy, acceder a la ruta /today-results')
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
