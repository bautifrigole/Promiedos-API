const axios = require('axios')
const cheerio = require('cheerio')
const url = 'https://www.promiedos.com.ar/'

// scorers será un string como el siguiente "25' M. Muldur; 65' A. Guler; 90(+7)' K. Akturkoglu;"
function getScorersList(scorers){
    const scorersList = scorers.split(';');
    scorersList.pop(); // Remove the last empty element

    return scorersList.map((scorer) => {
        const minute = scorer.substring(0, scorer.indexOf('\''));
        const scorerName = scorer.substring(scorer.indexOf('\'') + 1);
        return {minute, scorerName};
    });
}

async function getTodayMatches(req, res) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        const matches = [];

        function processMatchRow(row) {
            if ($(row).hasClass("goles")) {
                const homeScorers = $(row).first().children().eq(0).text().trim();
                const awayScorers = $(row).first().children().eq(1).text().trim();

                matches[matches.length - 1].homeScorers = getScorersList(homeScorers);
                matches[matches.length - 1].awayScorers = getScorersList(awayScorers);
            } else {
                const leagueTitleElement = $(row).prevAll('.tituloin').first().find('a');
                const leagueTitle = leagueTitleElement.contents().filter(function () {
                    return this.nodeType === 3; // Filter out non-text nodes
                }).map(function () {
                    return $(this).text().trim();
                }).get().join(' ');

                const leagueLogo = leagueTitleElement.find('img').attr('src');
                const gameStatePlay = $(row).find('.game-play');
                const timestamp = gameStatePlay.length ? gameStatePlay.text().trim() : null;
                const gameStateFinal = $(row).find('.game-fin').text().trim();
                const gameStateTime = $(row).find('.game-time').text().trim();
                let gameState;

                if (gameStateFinal.length) {
                    gameState = gameStateFinal;
                } else {
                    gameState = gameStateTime || timestamp;
                }

                const homeTeam = $(row).find('.game-t1').first().find('.datoequipo').text().trim();
                const homeLogo = $(row).find('.game-t1').first().find('img').attr('src');
                const awayTeam = $(row).find('.game-t1').last().find('.datoequipo').text().trim();
                const awayLogo = $(row).find('.game-t1').last().find('img').attr('src');
                const homeScore = $(row).find('.game-r1 span').text().trim();
                const awayScore = $(row).find('.game-r2 span').text().trim();

                if (gameState || homeTeam || awayTeam || homeScore || awayScore || leagueLogo) {
                    const match = {
                        leagueTitle,
                        leagueLogo,
                        gameState,
                        homeTeam,
                        homeLogo,
                        awayTeam,
                        awayLogo,
                        homeScore,
                        awayScore
                    };
                    matches.push(match);
                }
            }
        }

        // nvp son partidos finalizados y vp son partidos en curso
        $('tr[name="nvp"], tr[name="vp"]').each(function () {
            processMatchRow(this);
        });

        return matches;
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
  getTodayMatches,
};
