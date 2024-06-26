const axios = require('axios')
const cheerio = require('cheerio')
const iconv = require('iconv-lite');
const url = 'https://www.promiedos.com.ar/'

// scorers example: "25' M. Muldur; 65' A. Guler; 90(+7)' K. Akturkoglu;"
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

        // nvp are ended matches and vp are playing matches
        $('tr[name="nvp"], tr[name="vp"]').each(function () {
            processMatchRow(this);
        });

        return matches;
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

function getCompetitionId(competitionName, year) {
    let competitionId;
    switch (competitionName) {
        case "copaamerica":
            competitionId = "CA";
            break;
        case "eurocopa":
            competitionId = "EC";
            break;
        case "mundial":
            competitionId = "WC";
            break;
        default:
            competitionId = "";
            break;
    }
    return competitionId + year;
}

function getRoundId(round) {
    // Contar la cantidad de partidos dentro de este round
    const numMatches = round.find('#py2cont').length;

    switch (numMatches) {
        case 8:
            return 'K8';
        case 4:
            return 'K4';
        case 2:
            return 'K2';
        case 1:
            return 'KF';
        default:
            return `R${numMatches}`;
    }
}

function getRoundName(round) {
    // Contar la cantidad de partidos dentro de este round
    const numMatches = round.find('#py2cont').length;

    switch (numMatches) {
        case 8:
            return 'Round of 16';
        case 4:
            return 'Quarter-finals';
        case 2:
            return 'Semi-finals';
        case 1:
            return 'Final';
        default:
            return `Round with ${numMatches} matches`;
    }
}

async function getCompetitionCupMatches(req, res, competitionCupName) {
    try {
        const competitionUrl = `${url}${competitionCupName}`;
        console.log(`Fetching URL: ${competitionUrl}`);

        const response = await axios({
            method: 'get',
            url: competitionUrl,
            responseType: 'arraybuffer'
        });
        const html = iconv.decode(response.data, 'latin1');
        const $ = cheerio.load(html);
        const stages = [];
        let edition;
        if (competitionCupName === 'copaamerica' || competitionCupName === 'eurocopa') {
            edition = "2024";
        } else {
            edition = $('#titulos').text().trim().split(' ')[1];
        }

        const competitionId = getCompetitionId(competitionCupName, edition);

        // Group matches
        $('#tablapts .grupo').each(function () {
            const group = $(this);
            const groupName = group.find('.titulotabla2').text().trim().split(' ')[1];
            const groupMatches = [];
            var groupMatchCounter = 0;

            group.find('#fixgrupo').each(function () {
                const matchDay = $(this).find('.fechagrupo').text().trim().split(' ')[1];
                let matchDate;

                $(this).find('.diahoragr, .grtr').each(function () {
                    if ($(this).hasClass('diahoragr')) {
                        matchDate = $(this).text().trim();
                        return;
                    }

                    const match = $(this);
                    const matchId = competitionId + "_" + groupName + "_" + groupMatchCounter;
                    const homeTeam = match.find('.greq1').text().trim();
                    const awayTeam = match.find('.greq2').text().trim();

                    const finishedScore = match.find('.grres4').text().trim();
                    const pendingScore = match.find('.grres0').text().trim();
                    const playingScore = match.find('.grres1').text().trim();

                    const score = finishedScore || playingScore;
                    const status = finishedScore ? 'finished' : pendingScore ? 'pending' : 'playing';

                    groupMatchCounter++;

                    if (homeTeam && awayTeam && score) {
                        groupMatches.push({
                            matchId,
                            matchDay,
                            matchDate,
                            homeTeam,
                            awayTeam,
                            score,
                            status
                        });
                    } else {
                        const homeTeamPending = match.find('.greq1').text().trim();
                        const awayTeamPending = match.find('.greq2').text().trim();

                        if (homeTeamPending && awayTeamPending && pendingScore) {
                            groupMatches.push({
                                matchId,
                                matchDay,
                                matchDate,
                                homeTeam: homeTeamPending,
                                awayTeam: awayTeamPending,
                                status
                            });
                        }
                    }
                });
            });

            if (groupMatches.length > 0) {
                stages.push({
                    stage: "Group "+groupName,
                    matches: groupMatches
                });
            }
        });

        // Knockout matches
        $('#bracket .round').each(function () {
            const round = $(this);
            const roundName = getRoundName(round);
            const roundId = getRoundId(round);
            const roundMatches = [];
            var roundMatchCounter = 0;
    
            round.find('#py2cont').each(function () {
                const matchContainer = $(this);
    
                const matchId = competitionId + "_" + roundId + "_" + roundMatchCounter;
                const homeTeam = matchContainer.find('#py2esc1').text().trim();
                const awayTeam = matchContainer.find('#py2esc2').text().trim();
                const score = matchContainer.find('#py2res #py2restotal0').text().trim();

                roundMatchCounter++;
    
                if (homeTeam && awayTeam) {
                    roundMatches.push({
                        matchId,
                        homeTeam,
                        awayTeam,
                        score: score === '-' ? 'Pending' : score,
                        status: 'pending'
                    });
                }
            });
    
            if (roundMatches.length > 0) {
                stages.push({
                    stage: roundName,
                    matches: roundMatches
                });
            }
        });

        return {
            competition: competitionCupName,
            edition,
            stages
        };
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = {
  getTodayMatches, getCompetitionCupMatches, 
};
